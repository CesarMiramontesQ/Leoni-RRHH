# app/models/proveedores_externos.py
"""
Modelos SQLAlchemy para el modulo de Capacitacion de Personal Externo (Cursos).

Objetivo: llevar el registro de los proveedores/contratistas cuyo personal entra
a la planta y los cursos (seguridad, induccion, etc.) que deben tener vigentes.
Es un dominio AUTONOMO: las personas externas NO son empleados de Bono, por lo que
no hay FK a `empleados` para ellas (solo `created_by`/`updated_by` referencian al
empleado RH que registra, para auditoria).

Entidades:
  - Proveedor: empresa/marca contratista (padre de personas)
  - ProveedorPersona: persona individual que pertenece a un proveedor (hijo)
  - CursoExterno: catalogo de cursos externos, con periodicidad (vigencia_meses)
  - ProveedorPersonaCurso: registro de un curso tomado por una persona, con la
    fecha en que se realizo y la fecha de vencimiento calculada.

Convenciones (como el resto del proyecto):
  - Enums modelados como String para compatibilidad con SQLite en tests.
  - Soft delete via `activo`; auditoria via created_at/updated_at/created_by.
  - `vigencia_meses` NULL en el curso = el curso no vence.
  - `fecha_vencimiento` se persiste calculada (fecha_realizado + vigencia_meses);
    el estado (vigente/por_vencer/vencido/sin_vencimiento) y los dias restantes se
    derivan en tiempo de lectura en el service.
"""

from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Date,
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


# Estados derivados de un registro de curso (no se persisten; se calculan al leer).
CURSO_EXTERNO_ESTADOS = ("vigente", "por_vencer", "vencido", "sin_vencimiento")


class Proveedor(Base):
    """Empresa/marca contratista cuyo personal externo entra a la planta."""

    __tablename__ = "levelup_proveedores"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_levelup_proveedores_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    rfc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contacto: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    direccion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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

    personas: Mapped[List["ProveedorPersona"]] = relationship(
        "ProveedorPersona",
        back_populates="proveedor",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Proveedor id={self.id} nombre={self.nombre}>"


class ProveedorPersona(Base):
    """Persona externa perteneciente a un proveedor (no es empleado de Bono)."""

    __tablename__ = "levelup_proveedor_personas"
    __table_args__ = (
        UniqueConstraint(
            "proveedor_id", "identificacion",
            name="uq_levelup_proveedor_persona_ident",
        ),
        Index("ix_levelup_proveedor_personas_proveedor", "proveedor_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    proveedor_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_proveedores.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    identificacion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    puesto: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    proveedor: Mapped["Proveedor"] = relationship(
        "Proveedor", back_populates="personas"
    )
    cursos: Mapped[List["ProveedorPersonaCurso"]] = relationship(
        "ProveedorPersonaCurso",
        back_populates="persona",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<ProveedorPersona id={self.id} proveedor_id={self.proveedor_id} "
            f"nombre={self.nombre}>"
        )


class CursoExterno(Base):
    """Catalogo de cursos que requiere el personal externo (independiente de los
    cursos internos de `levelup_cursos`)."""

    __tablename__ = "levelup_cursos_externos"
    __table_args__ = (
        UniqueConstraint("nombre", name="uq_levelup_cursos_externos_nombre"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # NULL = el curso no vence. N meses = periodicidad de recertificacion.
    vigencia_meses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<CursoExterno id={self.id} nombre={self.nombre}>"


class ProveedorPersonaCurso(Base):
    """Registro de un curso externo tomado por una persona externa.

    Se permite historico (varias filas por persona+curso): cada recertificacion
    es un evento con su propia fecha. El estado "actual" lo resuelve el service
    tomando el registro mas reciente por (persona, curso).
    """

    __tablename__ = "levelup_proveedor_persona_curso"
    __table_args__ = (
        Index("ix_levelup_ppc_persona", "persona_id"),
        Index("ix_levelup_ppc_curso", "curso_externo_id"),
        Index("ix_levelup_ppc_fecha_venc", "fecha_vencimiento"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    persona_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_proveedor_personas.id", ondelete="CASCADE"), nullable=False
    )
    curso_externo_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_cursos_externos.id"), nullable=False
    )
    fecha_realizado: Mapped[date] = mapped_column(Date, nullable=False)
    # Calculada y persistida = fecha_realizado + vigencia_meses. NULL si no vence.
    fecha_vencimiento: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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

    persona: Mapped["ProveedorPersona"] = relationship(
        "ProveedorPersona", back_populates="cursos"
    )
    curso: Mapped["CursoExterno"] = relationship("CursoExterno")

    def __repr__(self) -> str:
        return (
            f"<ProveedorPersonaCurso id={self.id} persona_id={self.persona_id} "
            f"curso_externo_id={self.curso_externo_id}>"
        )
