from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


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

    def __repr__(self) -> str:
        return f"<ComedorRegistro id={self.id} empleado_id={self.empleado_id}>"
