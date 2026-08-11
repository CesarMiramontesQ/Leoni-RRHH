"""Lectura del catálogo de turnos y del turno vigente por empleado, replicados en Bono.

Es el acceso que necesitan los consumidores **fuera de comedor** (hoy, la proyección de
descansos). `ComedorHorarioJornadaRepository` conserva sus propios accesores —incluida la
lectura de `levelup_horarios`, que este repositorio no necesita— porque también gestiona la
ventana de comida; unificarlos queda fuera del alcance de este cambio.

`tu_codigo` conserva el relleno de `CHAR(6)` en `levelup_turnos` (es una réplica 1:1 de
`dbo.TURNO`), así que se compara con `rtrim`.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.turnos import Turno
from app.models.turnos_empleados import TurnoEmpleado
from app.utils.turno_empleado_match import turno_no_empleado_matches


class TurnosRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_tu_codigo_de_empleado(self, no_empleado: int) -> str | None:
        """Turno vigente de la persona, desde `levelup_turnos_empleados`.

        Es una foto: TRESS guarda el histórico de cambios en el kardex, no en COLABORA.
        """
        result = await self.db.execute(
            select(TurnoEmpleado.tu_codigo).where(turno_no_empleado_matches(no_empleado))
        )
        codigo = result.scalars().first()
        return (codigo or "").strip() or None

    async def get_turno(self, tu_codigo: str) -> Turno | None:
        stmt = select(Turno).where(func.rtrim(Turno.tu_codigo) == tu_codigo.strip())
        return (await self.db.execute(stmt)).scalars().first()
