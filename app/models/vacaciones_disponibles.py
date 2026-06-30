from typing import TYPE_CHECKING

from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class VacacionesDisponibles(Base):
    """Saldo de días de vacaciones por número de empleado (carga inicial desde Excel)."""

    __tablename__ = "levelup_vacaciones_disponibles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    dias: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="VacacionesDisponibles.no_empleado == Empleado.no_empleado",
        foreign_keys="VacacionesDisponibles.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return f"<VacacionesDisponibles no_empleado={self.no_empleado} dias={self.dias}>"
