# app/models/talento.py
"""
Modelos SQLAlchemy para el modulo de Talento — Fase 1.

Entidades:
  - PuestoPerfil: perfil de puesto con competencias tecnicas/blandas en JSONB
  - Competencia: catalogo de competencias (tecnicas y blandas)
  - CompetenciaRequisito: relacion puesto-competencia con nivel requerido (0-4)
"""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.catalogos import Area


class PuestoPerfil(Base):
    __tablename__ = "puestos_perfil"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    nivel: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    competencias_tecnicas: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    habilidades_blandas: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    maquinas_herramientas: Mapped[Optional[dict]] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="puesto_perfil", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<PuestoPerfil id={self.id} codigo={self.codigo} nombre={self.nombre}>"


class Competencia(Base):
    __tablename__ = "competencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'tecnica' | 'blanda'
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    area: Mapped[Optional["Area"]] = relationship("Area", foreign_keys=[area_id])
    requisitos: Mapped[List["CompetenciaRequisito"]] = relationship(
        "CompetenciaRequisito", back_populates="competencia", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Competencia id={self.id} nombre={self.nombre} categoria={self.categoria}>"


class CompetenciaRequisito(Base):
    __tablename__ = "competencia_requisitos"
    __table_args__ = (
        UniqueConstraint(
            "competencia_id", "puesto_perfil_id", name="uq_competencia_puesto_perfil"
        ),
        CheckConstraint(
            "nivel_requerido >= 0 AND nivel_requerido <= 4",
            name="ck_nivel_requerido_rango",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    competencia_id: Mapped[int] = mapped_column(
        ForeignKey("competencias.id", ondelete="CASCADE"), nullable=False
    )
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    nivel_requerido: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0,
        comment="0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    competencia: Mapped["Competencia"] = relationship(
        "Competencia", back_populates="requisitos"
    )
    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="requisitos"
    )

    def __repr__(self) -> str:
        return (
            f"<CompetenciaRequisito competencia_id={self.competencia_id} "
            f"puesto_perfil_id={self.puesto_perfil_id} nivel={self.nivel_requerido}>"
        )
