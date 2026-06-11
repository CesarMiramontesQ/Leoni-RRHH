from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.catalogos import Area, Subarea
    from app.models.empleados import Empleado
    from app.models.roles import Rol


class Departamento(Base):
    __tablename__ = "departamentos"

    departamento_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    solicitudes: Mapped[list["HorasExtraSolicitud"]] = relationship(
        "HorasExtraSolicitud", back_populates="departamento"
    )

    def __repr__(self) -> str:
        return f"<Departamento id={self.departamento_id} codigo={self.codigo}>"


class CentroCosto(Base):
    __tablename__ = "centros_costo"

    centrocosto_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    descripcion: Mapped[str] = mapped_column(String(200), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    solicitudes: Mapped[list["HorasExtraSolicitud"]] = relationship(
        "HorasExtraSolicitud", back_populates="centro_costo"
    )

    def __repr__(self) -> str:
        return f"<CentroCosto id={self.centrocosto_id} codigo={self.codigo}>"


class HorasExtraMotivo(Base):
    __tablename__ = "horas_extra_motivos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    descripcion: Mapped[str] = mapped_column(String(255), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    solicitudes: Mapped[list["HorasExtraSolicitud"]] = relationship(
        "HorasExtraSolicitud", back_populates="motivo"
    )

    def __repr__(self) -> str:
        return f"<HorasExtraMotivo id={self.id} codigo={self.codigo}>"


class HorasExtraSolicitud(Base):
    __tablename__ = "horas_extra_solicitudes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fecha_solicitud: Mapped[date] = mapped_column(Date, nullable=False)
    semana_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum("planeado", "espontaneo", name="horas_extra_tipo_enum"),
        nullable=False,
    )
    departamento_id: Mapped[int] = mapped_column(
        ForeignKey("departamentos.departamento_id"), nullable=False
    )
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.area_id"), nullable=False)
    subarea_id: Mapped[int] = mapped_column(ForeignKey("subareas.subarea_id"), nullable=False)
    centrocosto_id: Mapped[int] = mapped_column(
        ForeignKey("centros_costo.centrocosto_id"), nullable=False
    )
    motivo_id: Mapped[int] = mapped_column(ForeignKey("horas_extra_motivos.id"), nullable=False)
    comentarios: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column(
        Enum(
            "borrador",
            "pendiente",
            "aprobado",
            "rechazado",
            "cancelado",
            name="horas_extra_estado_enum",
        ),
        nullable=False,
        default="pendiente",
        server_default="pendiente",
    )
    registrado_por_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    departamento: Mapped["Departamento"] = relationship(
        "Departamento", back_populates="solicitudes"
    )
    area: Mapped["Area"] = relationship("Area", foreign_keys=[area_id])
    subarea: Mapped["Subarea"] = relationship("Subarea", foreign_keys=[subarea_id])
    centro_costo: Mapped["CentroCosto"] = relationship(
        "CentroCosto", back_populates="solicitudes"
    )
    motivo: Mapped["HorasExtraMotivo"] = relationship(
        "HorasExtraMotivo", back_populates="solicitudes"
    )
    registrado_por: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[registrado_por_id]
    )
    detalle: Mapped[list["HorasExtraSolicitudDetalle"]] = relationship(
        "HorasExtraSolicitudDetalle",
        back_populates="solicitud",
        cascade="all, delete-orphan",
    )
    aprobaciones: Mapped[list["HorasExtraAprobacion"]] = relationship(
        "HorasExtraAprobacion",
        back_populates="solicitud",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<HorasExtraSolicitud id={self.id} estado={self.estado}>"


class HorasExtraSolicitudDetalle(Base):
    __tablename__ = "horas_extra_solicitud_detalle"
    __table_args__ = (
        UniqueConstraint("solicitud_id", "empleado_id", name="uq_he_detalle_solicitud_empleado"),
        CheckConstraint("lunes >= 0", name="chk_he_detalle_lunes_nonneg"),
        CheckConstraint("martes >= 0", name="chk_he_detalle_martes_nonneg"),
        CheckConstraint("miercoles >= 0", name="chk_he_detalle_miercoles_nonneg"),
        CheckConstraint("jueves >= 0", name="chk_he_detalle_jueves_nonneg"),
        CheckConstraint("viernes >= 0", name="chk_he_detalle_viernes_nonneg"),
        CheckConstraint("sabado >= 0", name="chk_he_detalle_sabado_nonneg"),
        CheckConstraint("domingo >= 0", name="chk_he_detalle_domingo_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    solicitud_id: Mapped[int] = mapped_column(
        ForeignKey("horas_extra_solicitudes.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    lunes: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    martes: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    miercoles: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    jueves: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    viernes: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    sabado: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    domingo: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=0, server_default="0"
    )
    total_horas: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        Computed(
            "lunes + martes + miercoles + jueves + viernes + sabado + domingo",
            persisted=True,
        ),
        nullable=False,
    )

    solicitud: Mapped["HorasExtraSolicitud"] = relationship(
        "HorasExtraSolicitud", back_populates="detalle"
    )
    empleado: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[empleado_id])

    def __repr__(self) -> str:
        return f"<HorasExtraSolicitudDetalle id={self.id} solicitud_id={self.solicitud_id}>"


class HorasExtraAprobacion(Base):
    __tablename__ = "horas_extra_aprobaciones"
    __table_args__ = (
        UniqueConstraint("solicitud_id", "tipo_firma", name="uq_he_aprobacion_solicitud_tipo"),
        CheckConstraint(
            "(estado = 'pendiente' AND aprobador_id IS NULL AND fecha_aprobacion IS NULL) "
            "OR (estado IN ('aprobado', 'rechazado') "
            "AND aprobador_id IS NOT NULL AND fecha_aprobacion IS NOT NULL)",
            name="chk_he_aprobacion_firmada",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    solicitud_id: Mapped[int] = mapped_column(
        ForeignKey("horas_extra_solicitudes.id", ondelete="CASCADE"), nullable=False
    )
    tipo_firma: Mapped[str] = mapped_column(
        Enum(
            "gerente_area",
            "gerente_regional",
            "director_planta",
            name="horas_extra_tipo_firma_enum",
        ),
        nullable=False,
    )
    aprobador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    rol_aprobador_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("roles.id"), nullable=True
    )
    rol_aprobador_nombre: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    estado: Mapped[str] = mapped_column(
        Enum(
            "pendiente",
            "aprobado",
            "rechazado",
            name="horas_extra_aprobacion_estado_enum",
        ),
        nullable=False,
        default="pendiente",
        server_default="pendiente",
    )
    fecha_aprobacion: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    solicitud: Mapped["HorasExtraSolicitud"] = relationship(
        "HorasExtraSolicitud", back_populates="aprobaciones"
    )
    aprobador: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[aprobador_id]
    )
    rol_aprobador: Mapped[Optional["Rol"]] = relationship("Rol", foreign_keys=[rol_aprobador_id])

    def __repr__(self) -> str:
        return f"<HorasExtraAprobacion id={self.id} tipo_firma={self.tipo_firma}>"
