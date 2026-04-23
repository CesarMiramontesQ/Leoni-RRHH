from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Solicitud(Base):
    __tablename__ = "solicitudes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum("vacaciones", "home_office", name="solicitud_tipo_enum"),
        nullable=False,
    )
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "approved",
            "rejected",
            "cancelled",
            "overridden",
            "changes_requested",
            name="solicitud_estado_enum",
        ),
        nullable=False,
        default="pending",
    )
    nivel_actual: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    empleado = relationship("Empleado", foreign_keys=[empleado_id])
    aprobaciones: Mapped[list["SolicitudAprobacion"]] = relationship(
        "SolicitudAprobacion", back_populates="solicitud"
    )

    def __repr__(self) -> str:
        return f"<Solicitud id={self.id} tipo={self.tipo} estado={self.estado}>"


class SolicitudAprobacion(Base):
    __tablename__ = "solicitud_aprobaciones"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    solicitud_id: Mapped[int] = mapped_column(ForeignKey("solicitudes.id"), nullable=False)
    aprobador_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    accion: Mapped[str] = mapped_column(
        Enum("approve", "reject", "override", "request_changes", name="aprobacion_accion_enum"),
        nullable=False,
    )
    nivel: Mapped[int] = mapped_column(Integer, nullable=False)
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    solicitud: Mapped["Solicitud"] = relationship("Solicitud", back_populates="aprobaciones")
    aprobador = relationship("Empleado", foreign_keys=[aprobador_id])

    def __repr__(self) -> str:
        return f"<SolicitudAprobacion id={self.id} accion={self.accion}>"
