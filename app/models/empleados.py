from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.roles import Rol
    from app.models.solicitudes import Solicitud, SolicitudAprobacion
    from app.models.incidencias import Incidencia, Evidencia
    from app.models.actas import ActaAdministrativa, ActaAprobacion
    from app.models.comedor import ComedorRegistro
    from app.models.notificaciones import Notificacion
    from app.models.auditoria import AuditLog


class Empleado(Base):
    __tablename__ = "empleados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    num_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    apellido: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    departamento: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    puesto: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    supervisor_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    rol: Mapped["Rol"] = relationship("Rol", back_populates="empleados")
    supervisor: Mapped[Optional["Empleado"]] = relationship(
        "Empleado",
        remote_side="Empleado.id",
        foreign_keys=[supervisor_id],
        back_populates="subordinados",
    )
    subordinados: Mapped[List["Empleado"]] = relationship(
        "Empleado",
        foreign_keys=[supervisor_id],
        back_populates="supervisor",
    )

    def __repr__(self) -> str:
        return f"<Empleado id={self.id} num={self.num_empleado} nombre={self.nombre}>"
