"""Motor de Sugerencias de Capacitacion: CRUD + generador desde brechas."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


def prioridad_desde_brecha(gap_porcentaje: float) -> int:
    """Deriva la prioridad 1-5 desde el porcentaje de brecha, alineado a los
    rangos de AccionRecomendada (0 / 1-30 / 31-50 / 51-100):
      <= 0 -> 1 (mantener nivel); <= 30 -> 3; <= 50 -> 4; > 50 -> 5."""
    g = float(gap_porcentaje)
    if g <= 0:
        return 1
    if g <= 30:
        return 3
    if g <= 50:
        return 4
    return 5


class SugerenciaCapacitacionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
