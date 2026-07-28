# app/models/clasificacion_puesto.py
"""
Modelos SQLAlchemy de la clasificacion de puestos (metodologia Willis Towers Watson).

Un puesto oficialmente clasificado por RH se identifica por:
    Career Path (Professional / Management) + Funcion + Disciplina + Global Level

La evaluacion que asigna esos valores se realiza FUERA del sistema; aqui solo se
registran, administran y mantienen.

Entidades:
  - CareerPath: catalogo de trayectorias (Professional, Management)
  - FuncionPuesto: catalogo de funciones / job families (Ingenieria, Calidad, ...)
  - DisciplinaPuesto: catalogo de disciplinas, dependiente de la funcion
  - CategoriaTarea: catalogo de categorias para las responsabilidades del puesto
  - PuestoPerfilClasificacionHistorial: bitacora append-only de la clasificacion

El Global Level vive en `GradoPuesto` (`levelup_grados_puesto`, en `app/models/talento.py`),
que gana `career_path_id` y `codigo`: la tabla no se renombra porque cuatro tablas la
referencian por FK.
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
    from app.models.talento import GradoPuesto, PerfilTarea, PuestoPerfil, TareaCatalogo


class CareerPath(Base):
    """Catalogo de trayectorias de carrera (Professional / Management)."""

    __tablename__ = "levelup_career_paths"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    grados: Mapped[List["GradoPuesto"]] = relationship(
        "GradoPuesto", back_populates="career_path"
    )

    def __repr__(self) -> str:
        return f"<CareerPath id={self.id} codigo={self.codigo} nombre={self.nombre}>"


class FuncionPuesto(Base):
    """Catalogo de funciones / job families (Ingenieria, Calidad, Recursos Humanos...)."""

    __tablename__ = "levelup_funciones_puesto"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    disciplinas: Mapped[List["DisciplinaPuesto"]] = relationship(
        "DisciplinaPuesto", back_populates="funcion"
    )

    def __repr__(self) -> str:
        return f"<FuncionPuesto id={self.id} codigo={self.codigo} nombre={self.nombre}>"


class DisciplinaPuesto(Base):
    """Catalogo de disciplinas; siempre dependiente de una funcion."""

    __tablename__ = "levelup_disciplinas_puesto"
    __table_args__ = (
        UniqueConstraint(
            "funcion_id", "nombre", name="uq_levelup_disciplina_funcion_nombre"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    funcion_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_funciones_puesto.id"), nullable=False
    )
    codigo: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    funcion: Mapped["FuncionPuesto"] = relationship(
        "FuncionPuesto", back_populates="disciplinas"
    )

    def __repr__(self) -> str:
        return (
            f"<DisciplinaPuesto id={self.id} nombre={self.nombre} "
            f"funcion_id={self.funcion_id}>"
        )


class CategoriaTarea(Base):
    """Catalogo de categorias para las responsabilidades del puesto."""

    __tablename__ = "levelup_categorias_tarea"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tareas_catalogo: Mapped[List["TareaCatalogo"]] = relationship(
        "TareaCatalogo", back_populates="categoria_tarea"
    )
    perfil_tareas: Mapped[List["PerfilTarea"]] = relationship(
        "PerfilTarea", back_populates="categoria_tarea"
    )

    def __repr__(self) -> str:
        return f"<CategoriaTarea id={self.id} nombre={self.nombre}>"


class PuestoPerfilClasificacionHistorial(Base):
    """
    Bitacora append-only de la clasificacion de un perfil.

    Se escribe una fila al crear el perfil y cada vez que cambia cualquier campo de
    clasificacion (career path, funcion, disciplina, rango de global level o estado).
    Es la base de "historial de clasificacion" y de los modulos futuros de planes de
    carrera y matrices de sucesion: nunca se actualiza ni se borra.
    """

    __tablename__ = "levelup_puesto_perfil_clasificacion_historial"
    __table_args__ = (
        Index(
            "ix_levelup_clasificacion_historial_perfil",
            "puesto_perfil_id",
            "created_at",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    puesto_perfil_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_puestos_perfil.id", ondelete="CASCADE"), nullable=False
    )
    career_path_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_career_paths.id"), nullable=True
    )
    funcion_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_funciones_puesto.id"), nullable=True
    )
    disciplina_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_disciplinas_puesto.id"), nullable=True
    )
    global_level_desde_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    global_level_hasta_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    estado: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="activo|inactivo|en_revision"
    )
    version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    puesto_perfil: Mapped["PuestoPerfil"] = relationship(
        "PuestoPerfil", back_populates="clasificacion_historial"
    )
    career_path: Mapped[Optional["CareerPath"]] = relationship("CareerPath")
    funcion: Mapped[Optional["FuncionPuesto"]] = relationship("FuncionPuesto")
    disciplina: Mapped[Optional["DisciplinaPuesto"]] = relationship("DisciplinaPuesto")
    global_level_desde: Mapped[Optional["GradoPuesto"]] = relationship(
        "GradoPuesto", foreign_keys=[global_level_desde_id]
    )
    global_level_hasta: Mapped[Optional["GradoPuesto"]] = relationship(
        "GradoPuesto", foreign_keys=[global_level_hasta_id]
    )

    def __repr__(self) -> str:
        return (
            f"<PuestoPerfilClasificacionHistorial id={self.id} "
            f"puesto_perfil_id={self.puesto_perfil_id} version={self.version}>"
        )
