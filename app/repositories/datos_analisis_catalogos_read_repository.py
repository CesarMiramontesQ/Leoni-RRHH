"""
Lectura directa a SQL Server datos-analisis para los syncs que alimentan caché en Bono.

Reúne los cuatro SELECT de solo lectura (uno por archivo en ``sql/``, no todos con sufijo
``_catalogo``): catálogo de turnos (``levelup_turnos``), catálogo de jornadas
(``levelup_horarios``), turno vigente por empleado (``levelup_turnos_empleados``, vía
``dbo.COLABORA``) y datos generales del colaborador —fecha de ingreso y contrato actual—
(``levelup_empleados_tress``, desde ``dbo.COLABORA`` + ``dbo.CONTRATO``). Solo lo usan esos syncs
(``sync_turnos_catalogo``, ``sync_turnos_empleados``, ``sync_empleados_tress``); ninguna
carga de página pasa por aquí.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_DIR = Path(__file__).resolve().parent / "sql"
_SQL_TURNOS_CATALOGO_FILE = _SQL_DIR / "datos_analisis_turnos_catalogo.sql"
_SQL_HORARIOS_CATALOGO_FILE = _SQL_DIR / "datos_analisis_horarios_catalogo.sql"
_SQL_COLABORA_TURNOS_FILE = _SQL_DIR / "datos_analisis_colabora_turnos.sql"
_SQL_COLABORA_DATOS_GENERALES_FILE = _SQL_DIR / "datos_analisis_colabora_datos_generales.sql"


def load_turnos_catalogo_sql() -> str:
    return _SQL_TURNOS_CATALOGO_FILE.read_text(encoding="utf-8")


def load_horarios_catalogo_sql() -> str:
    return _SQL_HORARIOS_CATALOGO_FILE.read_text(encoding="utf-8")


def load_colabora_turnos_sql() -> str:
    return _SQL_COLABORA_TURNOS_FILE.read_text(encoding="utf-8")


def load_colabora_datos_generales_sql() -> str:
    return _SQL_COLABORA_DATOS_GENERALES_FILE.read_text(encoding="utf-8")


# «Vacío» de TRESS para columnas datetime: un contrato anclado ahí no tiene fecha real.
FECHA_VACIA_TRESS = date(1899, 12, 30)


@dataclass(frozen=True)
class DatosGeneralesColabora:
    """Una fila de ``dbo.COLABORA`` ya normalizada, tal como la consume el sync."""

    fecha_ingreso: date | None = None
    contrato_codigo: str | None = None
    contrato_descripcion: str | None = None
    # TB_DIAS del catálogo: 0 = indefinido; None = código sin fila en dbo.CONTRATO.
    contrato_dias: int | None = None
    # None también cuando TRESS trae su «vacío» (1899-12-30).
    fecha_contrato: date | None = None


def _a_date(valor: Any) -> date | None:
    if isinstance(valor, datetime):
        valor = valor.date()
    return valor if isinstance(valor, date) else None


def _a_texto(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _a_int(valor: Any) -> int | None:
    if valor is None:
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


class DatosAnalisisCatalogosReadRepository:
    """Ejecuta los cuatro SELECT de catálogo (una consulta cada uno, sin parámetros)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def _filas(self, sql: str) -> list[dict[str, Any]]:
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql))
            return [dict(fila) for fila in result.mappings().all()]

    async def get_turnos_catalogo(self) -> list[dict[str, Any]]:
        """Las 76 filas de ``dbo.TURNO`` con las claves ya en minúscula del modelo."""
        return await self._filas(load_turnos_catalogo_sql())

    async def get_horarios_catalogo(self) -> list[dict[str, Any]]:
        """``dbo.HORARIO`` con ``ho_codigo`` ya normalizado."""
        return await self._filas(load_horarios_catalogo_sql())

    async def get_turno_por_empleado(self) -> dict[str, str]:
        """``{no_empleado: tu_codigo normalizado}`` de los colaboradores activos.

        La clave se devuelve como texto porque la columna destino es ``varchar``; el
        llamador es quien concilia la variante con sufijo ``.0`` que dejó el seed viejo.
        """
        salida: dict[str, str] = {}
        for fila in await self._filas(load_colabora_turnos_sql()):
            no_empleado = str(fila["no_empleado"] or "").strip()
            tu_codigo = (fila["tu_codigo"] or "").strip()
            if not no_empleado or not tu_codigo:
                continue
            salida[no_empleado] = tu_codigo
        return salida

    async def get_datos_generales_por_empleado(self) -> dict[int, DatosGeneralesColabora]:
        """``{no_empleado: DatosGeneralesColabora}`` de todo ``dbo.COLABORA``.

        La clave es ``int`` porque la columna destino lo es. Las fechas vienen como
        ``datetime`` en TRESS y se normalizan a ``date``; un valor ausente viaja como
        ``None``. La fecha de contrato «vacía» de TRESS (1899-12-30) también se convierte
        en ``None`` para que el sync la trate como dato incompleto.
        """
        salida: dict[int, DatosGeneralesColabora] = {}
        for fila in await self._filas(load_colabora_datos_generales_sql()):
            no_empleado = _a_int(fila.get("no_empleado"))
            if no_empleado is None:
                continue
            fecha_contrato = _a_date(fila.get("fecha_contrato"))
            if fecha_contrato == FECHA_VACIA_TRESS:
                fecha_contrato = None
            salida[no_empleado] = DatosGeneralesColabora(
                fecha_ingreso=_a_date(fila.get("fecha_ingreso")),
                contrato_codigo=_a_texto(fila.get("contrato_codigo")),
                contrato_descripcion=_a_texto(fila.get("contrato_descripcion")),
                contrato_dias=_a_int(fila.get("contrato_dias")),
                fecha_contrato=fecha_contrato,
            )
        return salida
