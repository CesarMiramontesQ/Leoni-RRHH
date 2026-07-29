# app/models/clasificacion_puesto.py
"""
Modelos SQLAlchemy de la clasificacion de puestos (metodologia Willis Towers Watson).

Un puesto oficialmente clasificado por RH se identifica por:
    Career Path (Professional / Management) + Funcion + Disciplina + Career Level

La evaluacion que asigna esos valores se realiza FUERA del sistema; aqui solo se
registran, administran y mantienen.

Un puesto oficialmente clasificado por RH se identifica por:
    Career Path + Funcion + Disciplina + Career Level + Global Grade

Entidades:
  - CareerPath: catalogo de trayectorias (Professional, Management)
  - FuncionPuesto: catalogo de funciones / job families (Ingenieria, Calidad, ...)
  - DisciplinaPuesto: catalogo de disciplinas, dependiente de la funcion
  - GlobalGrade: catalogo de grados organizacionales (GG01..GGnn)
  - CareerLevelGradeMapping: equivalencia configurable Career Level -> Global Grade
  - CategoriaTarea: catalogo de categorias para las responsabilidades del puesto
  - PuestoPerfilClasificacionHistorial: bitacora append-only de la clasificacion

El Career Level vive en `GradoPuesto` (`levelup_grados_puesto`, en `app/models/talento.py`),
que gana `career_path_id` y `codigo`: la tabla no se renombra porque cuatro tablas la
referencian por FK.

El Global Grade clasifica el puesto dentro de la estructura organizacional. NO representa
sueldo, banda salarial ni compensacion: este sistema no administra nada de eso.
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.talento import GradoPuesto, PerfilTarea, PuestoPerfil, TareaCatalogo


class CareerPath(Base):
    """
    Catalogo de trayectorias de carrera (Professional / Management).

    No tiene orden propio: los career paths son alternativas, no una escala. Se
    listan por codigo, que es estable y corto.
    """

    __tablename__ = "levelup_career_paths"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
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


class GlobalGrade(Base):
    """
    Catalogo de Global Grades (GG01, GG02, ...).

    Es la clasificacion organizacional oficial del puesto. El formato del codigo lo
    define RH desde el catalogo: no hay valores fijos en codigo.

    No tiene ninguna relacion con sueldos, bandas salariales ni compensaciones; este
    sistema no administra esos conceptos.
    """

    __tablename__ = "levelup_global_grades"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    orden: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    equivalencias: Mapped[List["CareerLevelGradeMapping"]] = relationship(
        "CareerLevelGradeMapping", back_populates="global_grade"
    )

    def __repr__(self) -> str:
        return f"<GlobalGrade id={self.id} codigo={self.codigo} orden={self.orden}>"


class CareerLevelGradeMapping(Base):
    """
    Equivalencia configurable entre un Career Level y un Global Grade.

    RH la define; el sistema nunca la calcula. El career path no se guarda aqui
    porque ya cuelga del career level (`GradoPuesto.career_path_id`) y duplicarlo
    permitiria que las dos copias se contradigan.

    **Un career level puede equivaler a VARIOS global grades**: M4 abarca GG17 y
    GG18. Lo unico que no se repite es el par — la unicidad es
    `(career_level_id, global_grade_id)`. Por eso dos empleados en M4 pueden
    estar clasificados distinto: el nivel dice el tamano del puesto y el grado lo
    afina dentro de ese tamano.

    No se asume ninguna correspondencia por defecto: P10 puede equivaler a GG09 y
    M1 a GG10 si asi lo define la organizacion.
    """

    __tablename__ = "levelup_career_level_grade_mappings"
    __table_args__ = (
        UniqueConstraint(
            "career_level_id",
            "global_grade_id",
            name="uq_levelup_career_level_grade_mapping_level_grade",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    career_level_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=False
    )
    global_grade_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_global_grades.id"), nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    career_level: Mapped["GradoPuesto"] = relationship("GradoPuesto")
    global_grade: Mapped["GlobalGrade"] = relationship(
        "GlobalGrade", back_populates="equivalencias"
    )

    def __repr__(self) -> str:
        return (
            f"<CareerLevelGradeMapping career_level_id={self.career_level_id} "
            f"global_grade_id={self.global_grade_id}>"
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
    clasificacion (career path, funcion, disciplina, rango de career level, global
    grade o estado). Nunca se actualiza ni se borra.

    Cada fila guarda dos cosas complementarias:
      - la FOTO del estado resultante (columnas `*_id`, `estado`, `version`), que
        responde "que clasificacion tenia este puesto en tal fecha" — lo que van a
        necesitar planes de carrera y matrices de sucesion;
      - el DIFF en `cambios`, con el valor anterior y el nuevo de cada campo que se
        movio, para pintar la bitacora sin tener que leer la fila previa.
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
    career_level_desde_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    career_level_hasta_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_grados_puesto.id"), nullable=True
    )
    global_grade_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_global_grades.id"), nullable=True
    )
    estado: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="activo|inactivo|en_revision"
    )
    version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cambios: Mapped[Optional[list]] = mapped_column(
        JSONB,
        nullable=True,
        comment=(
            "Diff del evento: [{campo, etiqueta, anterior, nuevo}] con los valores "
            "ya resueltos a texto legible"
        ),
    )
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
    career_level_desde: Mapped[Optional["GradoPuesto"]] = relationship(
        "GradoPuesto", foreign_keys=[career_level_desde_id]
    )
    career_level_hasta: Mapped[Optional["GradoPuesto"]] = relationship(
        "GradoPuesto", foreign_keys=[career_level_hasta_id]
    )
    global_grade: Mapped[Optional["GlobalGrade"]] = relationship("GlobalGrade")

    def __repr__(self) -> str:
        return (
            f"<PuestoPerfilClasificacionHistorial id={self.id} "
            f"puesto_perfil_id={self.puesto_perfil_id} version={self.version}>"
        )
