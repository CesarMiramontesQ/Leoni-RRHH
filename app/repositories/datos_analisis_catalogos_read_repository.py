"""
Lectura de los catálogos de turnos y jornadas desde SQL Server datos-analisis.

Solo lo usan los syncs que llenan ``levelup_turnos`` y ``levelup_horarios`` — ninguna
carga de página pasa por aquí. Las consultas viven en ``sql/datos_analisis_*_catalogo.sql``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_DIR = Path(__file__).resolve().parent / "sql"
_SQL_TURNOS_CATALOGO_FILE = _SQL_DIR / "datos_analisis_turnos_catalogo.sql"
_SQL_HORARIOS_CATALOGO_FILE = _SQL_DIR / "datos_analisis_horarios_catalogo.sql"
_SQL_COLABORA_TURNOS_FILE = _SQL_DIR / "datos_analisis_colabora_turnos.sql"


def load_turnos_catalogo_sql() -> str:
    return _SQL_TURNOS_CATALOGO_FILE.read_text(encoding="utf-8")


def load_horarios_catalogo_sql() -> str:
    return _SQL_HORARIOS_CATALOGO_FILE.read_text(encoding="utf-8")


def load_colabora_turnos_sql() -> str:
    return _SQL_COLABORA_TURNOS_FILE.read_text(encoding="utf-8")


class DatosAnalisisCatalogosReadRepository:
    """Ejecuta los tres SELECT de catálogo (una consulta cada uno, sin parámetros)."""

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
