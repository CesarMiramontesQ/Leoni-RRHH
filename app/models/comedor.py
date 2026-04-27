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


class ComedorTipoComida(str, enum.Enum):
    casera = "casera"
    saludable = "saludable"


class Comedor(Base):
    __tablename__ = "comedores"

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

    def __repr__(self) -> str:
        return f"<Comedor id={self.id} nombre={self.nombre}>"


class MenuSemanal(Base):
    __tablename__ = "menu_semanal"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("comedores.id"), nullable=False)
    semana: Mapped[date] = mapped_column(Date, nullable=False)
    dia: Mapped[str] = mapped_column(String(20), nullable=False)
    tipo: Mapped[str] = mapped_column(
        Enum("normal", "dieta", name="menu_tipo_enum"),
        nullable=False,
        default="normal",
    )
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    foto_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    comedor: Mapped["Comedor"] = relationship("Comedor", back_populates="menus")
    creador = relationship("Empleado", foreign_keys=[created_by])

    def __repr__(self) -> str:
        return f"<MenuSemanal id={self.id} semana={self.semana} dia={self.dia}>"


class ComedorRegistro(Base):
    __tablename__ = "comedor_registros"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("comedores.id"), nullable=False)
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
    __tablename__ = "comedor_accesos"
    __table_args__ = (
        UniqueConstraint(
            "empleado_id",
            "fecha_servicio",
            name="uq_comedor_acceso_empleado_fecha",
        ),
        Index(
            "ix_comedor_accesos_empleado_fecha_estado",
            "empleado_id",
            "fecha_servicio",
            "estado_acceso",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    comedor_id: Mapped[int] = mapped_column(ForeignKey("comedores.id"), nullable=False)
    comedor_registro_id: Mapped[int] = mapped_column(
        ForeignKey("comedor_registros.id"), nullable=False
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
