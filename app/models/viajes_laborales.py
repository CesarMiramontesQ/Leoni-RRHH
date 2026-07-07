from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado

VIAJE_LABORAL_ESTADOS = (
    "borrador",
    "pendiente",
    "aprobado",
    "rechazado",
    "cancelado",
)

VIAJE_LABORAL_ESTADOS_EDITABLES = frozenset({"borrador", "rechazado"})
VIAJE_LABORAL_ESTADOS_ENVIABLES = frozenset({"borrador", "rechazado"})
VIAJE_LABORAL_ESTADOS_CANCELABLES = frozenset({"pendiente", "aprobado"})


class ViajeLaboral(Base):
    __tablename__ = "levelup_viajes_laborales"
    __table_args__ = (
        CheckConstraint(
            "fecha_regreso >= fecha_salida",
            name="chk_viajes_laborales_fecha_regreso_gte_salida",
        ),
        Index("ix_levelup_viajes_laborales_empleado_id", "empleado_id"),
        Index("ix_levelup_viajes_laborales_fecha_salida", "fecha_salida"),
        Index("ix_levelup_viajes_laborales_lugar_destino", "lugar_destino"),
        Index("ix_levelup_viajes_laborales_estado", "estado"),
        Index("ix_levelup_viajes_laborales_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    fecha_salida: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_regreso: Mapped[date] = mapped_column(Date, nullable=False)
    lugar_origen: Mapped[str] = mapped_column(String(255), nullable=False)
    lugar_destino: Mapped[str] = mapped_column(String(255), nullable=False)
    motivo: Mapped[str] = mapped_column(Text, nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    medio_transporte: Mapped[str] = mapped_column(String(120), nullable=False)
    hospedaje: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    viaticos_estimados: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    estado: Mapped[str] = mapped_column(
        Enum(*VIAJE_LABORAL_ESTADOS, name="viaje_laboral_estado_enum"),
        nullable=False,
        server_default="borrador",
    )
    registrado_por_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    aprobado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    motivo_rechazo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])
    registrado_por: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[registrado_por_id]
    )
    aprobado_por: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[aprobado_por_id]
    )

    def __repr__(self) -> str:
        return (
            f"<ViajeLaboral id={self.id} empleado_id={self.empleado_id} "
            f"estado={self.estado}>"
        )
