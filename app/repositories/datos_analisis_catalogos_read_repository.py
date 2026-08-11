"""
Lectura directa a SQL Server datos-analisis para los syncs que alimentan caché en Bono.

Reúne los cuatro SELECT de solo lectura (uno por archivo en ``sql/``, no todos con sufijo
``_catalogo``): catálogo de turnos (``levelup_turnos``), catálogo de jornadas
(``levelup_horarios``), turno vigente por empleado (``levelup_turnos_empleados``, vía
``dbo.COLABORA``) y datos generales del colaborador —hoy solo fecha de ingreso—
(``levelup_empleados_tress``, también desde ``dbo.COLABORA``). Solo lo usan esos syncs
(``sync_turnos_catalogo``, ``sync_turnos_empleados``, ``sync_empleados_tress``); ninguna
carga de página pasa por aquí.
"""

from __future__ import annotations

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

    async def get_datos_generales_por_empleado(self) -> dict[int, date | None]:
        """``{no_empleado: fecha_ingreso}`` de todo ``dbo.COLABORA``.

        La clave es ``int`` porque la columna destino lo es. ``CB_FEC_ING`` es ``datetime``
        en TRESS y se normaliza a ``date``; un valor ausente viaja como ``None``.
        """
        salida: dict[int, date | None] = {}
        for fila in await self._filas(load_colabora_datos_generales_sql()):
            crudo = fila.get("no_empleado")
            if crudo is None:
                continue
            try:
                no_empleado = int(crudo)
            except (TypeError, ValueError):
                continue
            valor = fila.get("fecha_ingreso")
            if isinstance(valor, datetime):
                valor = valor.date()
            salida[no_empleado] = valor if isinstance(valor, date) else None
        return salida
