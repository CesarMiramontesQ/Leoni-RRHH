import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ComedorAccesoEstado(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ACCEDIDO = "ACCEDIDO"
    EXPIRADO = "EXPIRADO"
    REPETIDO = "REPETIDO"


class ComedorTipoComida(str, enum.Enum):
    casera = "casera"
    saludable = "saludable"


class ComedorCodigoExternoEstado(str, enum.Enum):
    ACTIVO = "ACTIVO"
    USADO_PARCIAL = "USADO_PARCIAL"
    USADO_TOTAL = "USADO_TOTAL"
    VENCIDO = "VENCIDO"


class ComedorExternoCorrelativo(Base):
    """Fila única (id=1): último número usado en códigos CEXT{n} para externos."""

    __tablename__ = "levelup_comedor_externo_correlativo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    siguiente: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class Comedor(Base):
    __tablename__ = "levelup_comedores"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    ubicacion: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    capacidad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    turno_ids: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    menus: Mapped[list["MenuSemanal"]] = relationship("MenuSemanal", back_populates="comedor")
    registros: Mapped[list["ComedorRegistro"]] = relationship(
        "ComedorRegistro", back_populates="comedor"
    )
    accesos: Mapped[list["ComedorAcceso"]] = relationship(
        "ComedorAcceso", back_populates="comedor"
    )
    codigos_externos: Mapped[list["ComedorCodigoExterno"]] = relationship(
        "ComedorCodigoExterno",
        back_populates="comedor",
    )

    def __repr__(self) -> str:
        return f"<Comedor id={self.id} nombre={self.nombre}>"


class MenuSemanal(Base):
    __tablename__ = "levelup_menu_semanal"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("levelup_comedores.id"), nullable=False)
    semana: Mapped[date] = mapped_column(Date, nullable=False)
    dia: Mapped[str] = mapped_column(String(20), nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum("normal", "dieta", name="menu_tipo_enum"),
        nullable=False,
        default="normal",
    )
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    detalle: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    foto_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    comedor: Mapped["Comedor"] = relationship("Comedor", back_populates="menus")
    creador = relationship("Empleado", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<MenuSemanal id={self.id} semana={self.semana} dia={self.dia}>"


class ComedorRegistro(Base):
    __tablename__ = "levelup_comedor_registros"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("levelup_comedores.id"), nullable=False)
    semana: Mapped[date] = mapped_column(Date, nullable=False)
    tipo_platillo: Mapped[str] = mapped_column(
        Enum("normal", "dieta", name="comedor_tipo_platillo_enum"),
        nullable=False,
        default="normal",
    )
    acceso_concedido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    huella_timestamp: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    empleado = relationship("Empleado", foreign_keys=[empleado_id])
    comedor: Mapped["Comedor"] = relationship("Comedor", back_populates="registros")
    accesos: Mapped[list["ComedorAcceso"]] = relationship(
        "ComedorAcceso", back_populates="registro"
    )

    def __repr__(self) -> str:
        return f"<ComedorRegistro id={self.id} empleado_id={self.empleado_id}>"


class ComedorAcceso(Base):
    __tablename__ = "levelup_comedor_accesos"
    __table_args__ = (
        UniqueConstraint(
            "empleado_id",
            "fecha_servicio",
            name="uq_levelup_comedor_acceso_empleado_fecha",
        ),
        Index(
            "ix_levelup_comedor_accesos_empleado_fecha_estado",
            "empleado_id",
            "fecha_servicio",
            "estado_acceso",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("levelup_comedores.id"), nullable=False)
    comedor_registro_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_comedor_registros.id"), nullable=False
    )
    fecha_servicio: Mapped[date] = mapped_column(Date, nullable=False)
    tipo_comida: Mapped[ComedorTipoComida] = mapped_column(
        Enum(ComedorTipoComida, name="comedor_tipo_comida_enum"),
        nullable=False,
        default=ComedorTipoComida.casera,
    )
    estado_acceso: Mapped[ComedorAccesoEstado] = mapped_column(
        Enum(ComedorAccesoEstado, name="comedor_acceso_estado_enum"),
        nullable=False,
        default=ComedorAccesoEstado.PENDIENTE,
    )
    hora_entrada: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    empleado = relationship("Empleado", foreign_keys=[empleado_id])
    comedor: Mapped["Comedor"] = relationship("Comedor", back_populates="accesos")
    registro: Mapped["ComedorRegistro"] = relationship(
        "ComedorRegistro", back_populates="accesos"
    )

    def __repr__(self) -> str:
        return f"<ComedorAcceso id={self.id} empleado_id={self.empleado_id} fecha={self.fecha_servicio}>"


class ComedorCodigoExterno(Base):
    __tablename__ = "levelup_comedor_codigos_externos"
    __table_args__ = (
        Index("ix_levelup_comedor_codigos_externos_fecha_inicio", "fecha_inicio"),
        Index("ix_levelup_comedor_codigos_externos_fecha_fin", "fecha_fin"),
        Index("ix_levelup_comedor_codigos_externos_codigo_acceso", "codigo_acceso", unique=True),
        Index("ix_levelup_comedor_codigos_externos_empleado_id", "empleado_id"),
        Index("ix_levelup_comedor_codigos_externos_lote_id", "lote_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("levelup_comedores.id"), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("empleados.empleado_id"), nullable=False)
    empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"),
        nullable=True,
    )
    lote_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    cantidad_personas: Mapped[int] = mapped_column(Integer, nullable=False)
    tipo_comida: Mapped[ComedorTipoComida] = mapped_column(
        Enum(ComedorTipoComida, name="comedor_tipo_comida_enum"),
        nullable=False,
    )
    codigo_acceso: Mapped[str] = mapped_column(String(80), nullable=False)
    password_temporal: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    comedor: Mapped["Comedor"] = relationship("Comedor", back_populates="codigos_externos")
    creador = relationship("Empleado", foreign_keys=[created_by])
    empleado_externo = relationship("Empleado", foreign_keys=[empleado_id])

    def __repr__(self) -> str:
        return (
            f"<ComedorCodigoExterno id={self.id} codigo={self.codigo_acceso} "
            f"rango={self.fecha_inicio}:{self.fecha_fin}>"
        )
