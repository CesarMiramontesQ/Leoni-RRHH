from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

ORIGEN_INCIDENCIA_MANUAL = "manual"
ORIGEN_INCIDENCIA_BONO = "bono"


class Incidencia(Base):
    __tablename__ = "incidencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    no_empleado: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    nombre: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tipo: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    detalle: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    subarea: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    origen: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=ORIGEN_INCIDENCIA_MANUAL
    )
    origen_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    empleado = relationship("Empleado", foreign_keys=[empleado_id])

    def __repr__(self) -> str:
        return f"<Incidencia id={self.id} tipo={self.tipo} origen={self.origen}>"


class Evidencia(Base):
    __tablename__ = "evidencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entidad_tipo: Mapped[str] = mapped_column(
        Enum("incidencia", "acta", name="evidencia_entidad_tipo_enum"),
        nullable=False,
    )
    entidad_id: Mapped[int] = mapped_column(Integer, nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    nombre_original: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tamano_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    subido_por: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    subidor = relationship("Empleado", foreign_keys=[subido_por])

    def __repr__(self) -> str:
        return (
            f"<Evidencia id={self.id} entidad_tipo={self.entidad_tipo} "
            f"entidad_id={self.entidad_id}>"
        )
