from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class Vacaciones(Base):
    """Saldo de días de vacaciones por empleado (fuente local, no TRESS)."""

    __tablename__ = "levelup_vacaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"),
        unique=True,
        nullable=False,
    )
    dias_disponibles: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        back_populates="vacaciones",
    )

    def __repr__(self) -> str:
        return (
            f"<Vacaciones empleado_id={self.empleado_id} "
            f"dias_disponibles={self.dias_disponibles}>"
        )
