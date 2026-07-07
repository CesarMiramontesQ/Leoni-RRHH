# app/models/juntas.py
"""
Modelos SQLAlchemy para el modulo de Juntas (Level Up / Cursos).

Objetivo: registrar juntas (reuniones) con su informacion basica y la lista de
empleados asistentes. Reutiliza el catalogo de empleados legacy de Bono
(`empleados.empleado_id`, read-only) sin duplicar datos de personas.

Entidades:
  - Junta: la reunion (padre)
  - JuntaAsistente: empleado asistente a una junta (hijo, FK a `empleados`)

Convenciones (como el resto del proyecto):
  - Enums modelados como String para compatibilidad con SQLite en tests.
  - Soft delete via `activo`; auditoria via created_at/updated_at/created_by.
  - Estructura preparada para futuras fases (edicion, cancelacion, adjuntos,
    control de asistencia) sin cambios de arquitectura:
      * `estado` permite cancelar/cerrar sin borrar.
      * `JuntaAsistente.asistio` deja lista la casilla de control de asistencia.
      * Una futura tabla `levelup_junta_adjunto` colgaria de `Junta` igual que
        `JuntaAsistente`.
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado  # noqa: F401


# Estados de junta (columna String). Extensible sin migrar enums nativos.
JUNTA_ESTADOS = ("registrada", "cancelada", "cerrada")


class Junta(Base):
    """Junta (reunion) registrada con su lista de asistentes."""

    __tablename__ = "levelup_juntas"
    __table_args__ = (
        Index("ix_levelup_juntas_categoria", "categoria"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="registrada",
        comment="registrada|cancelada|cerrada",
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    asistentes: Mapped[List["JuntaAsistente"]] = relationship(
        "JuntaAsistente",
        back_populates="junta",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Junta id={self.id} nombre={self.nombre} estado={self.estado}>"


class JuntaAsistente(Base):
    """Empleado asistente a una junta (referencia al catalogo legacy Bono)."""

    __tablename__ = "levelup_junta_asistente"
    __table_args__ = (
        UniqueConstraint(
            "junta_id", "empleado_id",
            name="uq_levelup_junta_asistente",
        ),
        Index("ix_levelup_junta_asistente_empleado", "empleado_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    junta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_juntas.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    # Reservado para el control de asistencia (fase futura): NULL = sin registrar.
    asistio: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    junta: Mapped["Junta"] = relationship("Junta", back_populates="asistentes")
    empleado: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )

    def __repr__(self) -> str:
        return (
            f"<JuntaAsistente id={self.id} junta_id={self.junta_id} "
            f"empleado_id={self.empleado_id}>"
        )
