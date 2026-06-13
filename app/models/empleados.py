from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.emails import Email
    from app.models.roles import Rol
    from app.models.solicitudes import Solicitud, SolicitudAprobacion
    from app.models.incidencias import Incidencia, Evidencia
    from app.models.actas import ActaAdministrativa, ActaAprobacion
    from app.models.comedor import ComedorRegistro
    from app.models.notificaciones import Notificacion
    from app.models.auditoria import AuditLog
    from app.models.turnos_empleados import TurnoEmpleado
    from app.models.vacaciones import Vacaciones
    from app.models.catalogos import (
        Area,
        Categoria,
        ClasificacionEmpleado,
        EstadoEmpleado,
        Puesto,
        Subarea,
    )


class Empleado(Base):
    __tablename__ = "empleados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    no_empleado: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    no_sap: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    usuario: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)

    categoria_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("categorias.categoria_id"), nullable=True
    )
    subarea_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("subareas.subarea_id"), nullable=True
    )
    puesto_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("puestos.puesto_id"), nullable=True
    )
    estado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("estados_empleados.estado_id"), nullable=True
    )
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    clasificacion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("clasificacion_empleado.clasificacion_id"), nullable=True
    )

    lider_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )

    centrocosto_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    foto: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recibe_bono: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    brigada: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    registro: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin_contrato: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    a_restringido: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    requiere_cambio_password: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    puede_administrar_permisos_rh: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    puede_registrar_horas_extra: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    horas_extra_autorizado_en: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    horas_extra_autorizado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    modulos_rh: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    rol: Mapped["Rol"] = relationship("Rol", back_populates="empleados")
    categoria: Mapped[Optional["Categoria"]] = relationship(
        "Categoria", back_populates="empleados"
    )
    subarea: Mapped[Optional["Subarea"]] = relationship(
        "Subarea", back_populates="empleados"
    )
    puesto: Mapped[Optional["Puesto"]] = relationship(
        "Puesto", back_populates="empleados"
    )
    estado: Mapped[Optional["EstadoEmpleado"]] = relationship(
        "EstadoEmpleado", back_populates="empleados"
    )
    area: Mapped[Optional["Area"]] = relationship("Area", back_populates="empleados")
    clasificacion: Mapped[Optional["ClasificacionEmpleado"]] = relationship(
        "ClasificacionEmpleado", back_populates="empleados"
    )
    lider: Mapped[Optional["Empleado"]] = relationship(
        "Empleado",
        remote_side="Empleado.empleado_id",
        foreign_keys=[lider_id],
        back_populates="subordinados",
    )
    subordinados: Mapped[List["Empleado"]] = relationship(
        "Empleado",
        foreign_keys=[lider_id],
        back_populates="lider",
    )
    horas_extra_autorizado_por: Mapped[Optional["Empleado"]] = relationship(
        "Empleado",
        remote_side="Empleado.id",
        foreign_keys=[horas_extra_autorizado_por_id],
    )
    email_alterno: Mapped[Optional["Email"]] = relationship(
        "Email",
        back_populates="empleado",
        uselist=False,
    )
    turno_empleado: Mapped[Optional["TurnoEmpleado"]] = relationship(
        "TurnoEmpleado",
        back_populates="empleado",
        uselist=False,
    )
    vacaciones: Mapped[Optional["Vacaciones"]] = relationship(
        "Vacaciones",
        back_populates="empleado",
        uselist=False,
    )

    def __repr__(self) -> str:
        return f"<Empleado id={self.id} no_empleado={self.no_empleado} nombre={self.nombre}>"
