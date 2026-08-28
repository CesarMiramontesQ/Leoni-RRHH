"""Día festivo de la planta, capturado por RH en «Configuración laborales».

Lista propia de Bono (no es espejo de TRESS): aplica a toda la planta y a solicitudes
**nuevas**; nada se revalida hacia atrás. Un festivo bloquea inicio/fin de vacaciones
y la fecha de home office, y no descuenta días de vacaciones si cae dentro del rango.
Las filas no se borran: se apagan con ``activo``.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class DiaFestivo(Base):
    __tablename__ = "levelup_dias_festivos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fecha: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    descripcion: Mapped[str] = mapped_column(String(120), nullable=False)
    activo: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    actualizado_por_empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    actualizado_por: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[actualizado_por_empleado_id]
    )

    def __repr__(self) -> str:
        return f"<DiaFestivo {self.fecha} {self.descripcion!r} activo={self.activo}>"
