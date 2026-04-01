from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Incidencia(Base):
    __tablename__ = "incidencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empleado_id: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(
        Enum("open", "in_review", "resolved", "closed", name="incidencia_estado_enum"),
        nullable=False,
        default="open",
    )
    registrado_por: Mapped[int] = mapped_column(ForeignKey("empleados.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    empleado = relationship("Empleado", foreign_keys=[empleado_id])
    registrador = relationship("Empleado", foreign_keys=[registrado_por])

    def __repr__(self) -> str:
        return f"<Incidencia id={self.id} tipo={self.tipo} estado={self.estado}>"


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

    # Relationships
    subidor = relationship("Empleado", foreign_keys=[subido_por])

    def __repr__(self) -> str:
        return f"<Evidencia id={self.id} entidad_tipo={self.entidad_tipo} entidad_id={self.entidad_id}>"
