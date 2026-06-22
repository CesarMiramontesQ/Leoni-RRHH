from typing import TYPE_CHECKING, Optional

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class TurnoEmpleado(Base):
    """Turno/comedor por número de empleado (`empleados.no_empleado`), sincronizado con listados RH."""

    __tablename__ = "levelup_turnos_empleados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (en Bono no_empleado no es único
    # y empleados no se modifica). Validación a nivel app.
    # En BD es varchar (listados TRESS / Excel); empleados.no_empleado es integer.
    no_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    clasificacion: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    comedor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    turno: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        back_populates="turno_empleado",
        primaryjoin="cast(Empleado.no_empleado, String) == TurnoEmpleado.no_empleado",
        foreign_keys="TurnoEmpleado.no_empleado",
        viewonly=True,
    )
