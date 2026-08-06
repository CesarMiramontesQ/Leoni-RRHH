"""
Lectura de días de home office desde SQL Server datos-analisis (motor separado).

Complementa a ``datos_analisis_home_office_write_repository`` (que inserta en
``dbo.PERMISO`` al aprobar una solicitud): aquí solo se consulta lo ya registrado, y solo
lo hace el sync que llena ``levelup_homeoffice_tomados`` — ninguna carga de página pasa por
aquí. La consulta vive en ``sql/datos_analisis_home_office_dias_por_empleado.sql``.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_POR_EMPLEADO_FILE = (
    Path(__file__).resolve().parent
    / "sql"
    / "datos_analisis_home_office_dias_por_empleado.sql"
)


def load_home_office_dias_por_empleado_sql() -> str:
    return _SQL_POR_EMPLEADO_FILE.read_text(encoding="utf-8")


class DatosAnalisisHomeOfficeReadRepository:
    """Ejecuta el conteo de días con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_dias_por_empleado(
        self, *, desde: date, hasta: date
    ) -> dict[int, Decimal]:
        """Días de home office agrupados por empleado, con ``PM_FEC_INI`` en ``[desde, hasta)``.

        Una sola consulta para toda la plantilla: son unos cientos de grupos y evita un
        round-trip por empleado. Los empleados sin home office simplemente no aparecen en
        el mapa; es el llamador quien decide que eso significa cero.
        """
        sql = load_home_office_dias_por_empleado_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"desde": desde, "hasta": hasta})
            filas = result.mappings().all()

        salida: dict[int, Decimal] = {}
        for fila in filas:
            numero = fila["no_empleado"]
            if numero is None:
                continue
            salida[int(numero)] = Decimal(str(fila["dias_home_office"] or 0))
        return salida
