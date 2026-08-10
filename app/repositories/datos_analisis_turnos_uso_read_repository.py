"""
Lectura del personal activo por turno desde SQL Server datos-analisis (motor separado).

Solo lo usa el sync que llena ``levelup_turnos_uso`` — ninguna carga de página pasa por
aquí. La consulta vive en ``sql/datos_analisis_turnos_en_uso.sql``.
"""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_TURNOS_EN_USO_FILE = (
    Path(__file__).resolve().parent / "sql" / "datos_analisis_turnos_en_uso.sql"
)


def load_turnos_en_uso_sql() -> str:
    return _SQL_TURNOS_EN_USO_FILE.read_text(encoding="utf-8")


class DatosAnalisisTurnosUsoReadRepository:
    """Ejecuta el conteo agregado por turno (una sola consulta, sin parámetros)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_empleados_por_turno(self) -> dict[str, int]:
        """``{tu_codigo normalizado: empleados activos}``.

        Los turnos sin personal activo no vienen en el resultado: es el llamador quien
        decide que eso significa cero.
        """
        sql = load_turnos_en_uso_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql))
            filas = result.mappings().all()

        salida: dict[str, int] = {}
        for fila in filas:
            codigo = (fila["tu_codigo"] or "").strip()
            if not codigo:
                continue
            salida[codigo] = int(fila["empleados_activos"] or 0)
        return salida
