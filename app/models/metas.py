# app/models/metas.py
"""
Modelos SQLAlchemy para el modulo de Metas (OKR ligero).

Objetivo: metas/objetivos cualitativos con 1+ resultados clave medibles
(valor objetivo/actual), agrupados en ciclos configurables por RH, con
asignacion top-down (jefe/RH -> empleado), seguimiento por check-ins del
empleado (o ajustes del jefe) y cierre con calificacion + cumplimiento
ponderado.

Entidades:
  - MetaCiclo: ventana de tiempo (nombre + fechas) que agrupa metas.
  - Meta: objetivo cualitativo individual o de equipo, con peso y estado;
    puede enlazarse opcionalmente a una meta de nivel "equipo" (roll-up).
  - MetaResultadoClave: resultado clave medible de una meta (avance % se
    deriva en el service, no se almacena).
  - MetaCheckin: historial inmutable de actualizaciones de avance de un
    resultado clave (autor + valor registrado + nota; `es_ajuste_jefe`
    distingue el check-in del empleado del ajuste del jefe).

Convenciones (ver app/models/encuestas_rh.py):
  - Enums modelados como String para compatibilidad con SQLite en tests.
  - Timestamps via server_default=func.now().
  - Campos numericos medibles (peso, valores de RC, calificacion) con
    Numeric + Mapped[Decimal] (patron de app/models/horas_extra.py).
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado  # noqa: F401


# ── Valores de columnas (String) usados por el modulo ──────────────────────
META_CICLO_ESTADOS = ("borrador", "activo", "cerrado")
META_ESTADOS = ("asignada", "en_progreso", "cerrada")
META_NIVELES = ("individual", "equipo")
RC_TIPOS_METRICA = ("numero", "porcentaje", "booleano", "moneda")
RC_DIRECCIONES = ("subir", "bajar")


class MetaCiclo(Base):
    """Ciclo de metas: agrupa metas y define la ventana de captura/cierre."""

    __tablename__ = "levelup_meta_ciclo"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date] = mapped_column(Date, nullable=False)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="borrador",
        comment="borrador|activo|cerrado",
    )
    creado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    metas: Mapped[List["Meta"]] = relationship(
        "Meta",
        back_populates="ciclo",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<MetaCiclo id={self.id} nombre={self.nombre!r} estado={self.estado}>"


class Meta(Base):
    """Objetivo cualitativo (individual o de equipo) dentro de un ciclo."""

    __tablename__ = "levelup_meta"
    __table_args__ = (
        Index("ix_levelup_meta_ciclo_empleado", "ciclo_id", "empleado_id"),
        Index("ix_levelup_meta_ciclo_nivel", "ciclo_id", "nivel"),
        Index("ix_levelup_meta_padre", "meta_padre_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ciclo_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_meta_ciclo.id", ondelete="CASCADE"), nullable=False
    )
    nivel: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="individual|equipo"
    )
    empleado_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True,
        comment="Requerido si nivel=individual",
    )
    area_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("areas.area_id"), nullable=True, comment="Requerido si nivel=equipo"
    )
    lider_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True,
        comment="Requerido si nivel=equipo",
    )
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    peso: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, comment="Peso 0-100 dentro del ciclo del empleado"
    )
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="asignada",
        comment="asignada|en_progreso|cerrada",
    )
    meta_padre_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_meta.id"), nullable=True,
        comment="Enlace opcional a una meta nivel equipo (roll-up)",
    )
    asignada_por_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False,
        comment="Jefe o RH que asigna la meta",
    )
    calificacion_cierre: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 2), nullable=True, comment="Calificacion 0-100 al cerrar"
    )
    comentario_cierre: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    ciclo: Mapped["MetaCiclo"] = relationship("MetaCiclo", back_populates="metas")
    empleado: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[empleado_id]
    )
    lider: Mapped[Optional["Empleado"]] = relationship(
        "Empleado", foreign_keys=[lider_id]
    )
    asignada_por: Mapped["Empleado"] = relationship(
        "Empleado", foreign_keys=[asignada_por_id]
    )
    meta_padre: Mapped[Optional["Meta"]] = relationship(
        "Meta", remote_side=[id], back_populates="submetas",
        foreign_keys=[meta_padre_id],
    )
    submetas: Mapped[List["Meta"]] = relationship(
        "Meta", back_populates="meta_padre", foreign_keys=[meta_padre_id],
    )
    resultados_clave: Mapped[List["MetaResultadoClave"]] = relationship(
        "MetaResultadoClave",
        back_populates="meta",
        order_by="MetaResultadoClave.orden",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<Meta id={self.id} ciclo_id={self.ciclo_id} nivel={self.nivel} "
            f"titulo={self.titulo!r} estado={self.estado}>"
        )


class MetaResultadoClave(Base):
    """Resultado clave medible de una meta. El avance % se deriva (no se guarda)."""

    __tablename__ = "levelup_meta_resultado_clave"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    meta_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_meta.id", ondelete="CASCADE"), nullable=False
    )
    orden: Mapped[int] = mapped_column(Integer, nullable=False)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    tipo_metrica: Mapped[str] = mapped_column(
        String(20), nullable=False, comment="numero|porcentaje|booleano|moneda"
    )
    unidad: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    direccion: Mapped[str] = mapped_column(
        String(10), nullable=False, comment="subir|bajar"
    )
    valor_inicial: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    valor_objetivo: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    valor_actual: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    meta: Mapped["Meta"] = relationship("Meta", back_populates="resultados_clave")
    checkins: Mapped[List["MetaCheckin"]] = relationship(
        "MetaCheckin",
        back_populates="resultado_clave",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<MetaResultadoClave id={self.id} meta_id={self.meta_id} "
            f"orden={self.orden} titulo={self.titulo!r}>"
        )


class MetaCheckin(Base):
    """Historial inmutable de actualizaciones de avance de un resultado clave."""

    __tablename__ = "levelup_meta_checkin"
    __table_args__ = (
        Index("ix_levelup_meta_checkin_resultado_clave", "resultado_clave_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    resultado_clave_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_meta_resultado_clave.id", ondelete="CASCADE"), nullable=False
    )
    autor_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    valor_registrado: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    nota: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    es_ajuste_jefe: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    resultado_clave: Mapped["MetaResultadoClave"] = relationship(
        "MetaResultadoClave", back_populates="checkins"
    )
    autor: Mapped["Empleado"] = relationship("Empleado", foreign_keys=[autor_id])

    def __repr__(self) -> str:
        return (
            f"<MetaCheckin id={self.id} resultado_clave_id={self.resultado_clave_id} "
            f"autor_id={self.autor_id}>"
        )
