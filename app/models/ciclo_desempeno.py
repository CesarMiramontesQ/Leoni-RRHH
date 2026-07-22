# app/models/ciclo_desempeno.py
"""
Modelos SQLAlchemy para el modulo de Ciclo de Desempeno (orquestador).

Objetivo: combinar el cumplimiento de metas (levelup_meta_ciclo) y la
calificacion de competencias de una campana 360 (levelup_eval360_campana)
en una calificacion de desempeno ponderada por empleado, mas una captura
de potencial para ubicar el resultado en la matriz 9-Box.

Entidades:
  - CicloDesempeno: configuracion del ciclo (pesos metas/competencias,
    umbrales de banda, enlaces opcionales a MetaCiclo y Eval360Campana).
  - CicloDesempenoResultado: snapshot por empleado (cumplimiento de metas,
    calificacion 360 normalizada, calificacion de desempeno resultante,
    potencial capturado y banda/segmento 9-Box).

Convenciones (ver app/models/metas.py, app/models/evaluacion360.py):
  - Enums modelados como String para compatibilidad con SQLite en tests.
  - Timestamps via server_default=func.now().
  - JSONB de sqlalchemy.dialects.postgresql para config flexible.
  - Los enlaces a levelup_meta_ciclo / levelup_eval360_campana son solo FK
    (sin relationship ORM) para no acoplar este modulo a los otros; el
    calculo/consumo de esos datos se hace en el service.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado  # noqa: F401


# ── Valores de columnas (String) usados por el modulo ──────────────────────
CICLO_DESEMPENO_ESTADOS = ("borrador", "activo", "cerrado")
CICLO_DESEMPENO_BANDAS = ("bajo", "medio", "alto")


class CicloDesempeno(Base):
    """Ciclo de desempeno: pondera metas + competencias para calificar."""

    __tablename__ = "levelup_ciclo_desempeno"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nombre: Mapped[str] = mapped_column(String(255), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(
        String(20), nullable=False, default="borrador",
        comment="borrador|activo|cerrado",
    )
    meta_ciclo_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_meta_ciclo.id", ondelete="SET NULL"), nullable=True
    )
    eval360_campana_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_eval360_campana.id", ondelete="SET NULL"), nullable=True
    )
    peso_metas: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("60"),
        comment="Peso (%) del cumplimiento de metas en la calificacion final",
    )
    peso_competencias: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("40"),
        comment="Peso (%) de la calificacion 360 en la calificacion final",
    )
    umbral_medio: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("50"),
        comment="Calificacion minima (%) para banda 'medio'",
    )
    umbral_alto: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("75"),
        comment="Calificacion minima (%) para banda 'alto'",
    )
    # Configuracion flexible adicional (ej. reglas de segmentacion 9-Box)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    creado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    resultados: Mapped[List["CicloDesempenoResultado"]] = relationship(
        "CicloDesempenoResultado",
        back_populates="ciclo",
        cascade="all, delete-orphan",
        order_by="CicloDesempenoResultado.id",
    )

    def __repr__(self) -> str:
        return f"<CicloDesempeno id={self.id} nombre={self.nombre!r} estado={self.estado}>"


class CicloDesempenoResultado(Base):
    """Snapshot de desempeno/potencial de un empleado dentro de un ciclo."""

    __tablename__ = "levelup_ciclo_desempeno_resultado"
    __table_args__ = (
        UniqueConstraint(
            "ciclo_id", "empleado_id",
            name="uq_levelup_ciclo_desempeno_resultado",
        ),
        Index("ix_levelup_ciclo_desempeno_resultado_ciclo", "ciclo_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ciclo_id: Mapped[int] = mapped_column(
        ForeignKey("levelup_ciclo_desempeno.id", ondelete="CASCADE"), nullable=False
    )
    empleado_id: Mapped[int] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=False
    )
    # ── Snapshot de calificacion (se calcula/congela en el service) ────────
    cumplimiento_metas: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    calificacion_360_raw: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    calificacion_360_norm: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    escala_min: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    escala_max: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    calificacion_desempeno: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    peso_metas_efectivo: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    peso_competencias_efectivo: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    potencial: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    banda_desempeno: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, comment="bajo|medio|alto",
    )
    banda_potencial: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, comment="bajo|medio|alto",
    )
    segmento_9box: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    # ── Auditoria de la captura de potencial (manual, la calificacion no lo es) ──
    potencial_capturado_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    potencial_capturado_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    snapshot_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    ciclo: Mapped["CicloDesempeno"] = relationship("CicloDesempeno", back_populates="resultados")

    def __repr__(self) -> str:
        return (
            f"<CicloDesempenoResultado id={self.id} ciclo_id={self.ciclo_id} "
            f"empleado_id={self.empleado_id}>"
        )
