from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS

# Orígenes válidos. Los dos primeros son las ramas del SQL base de datos-analisis
# (dbo.AUSENCIA y dbo.PERMISO); `manual` son los eventos que solo viven en
# levelup_faltas_retardos y que el sync refleja aquí.
ORIGENES_CACHE = ("ausencia", "permiso", "manual")

_TIPOS_SQL = ", ".join(f"'{t}'" for t in FALTA_RETARDO_TIPOS)


class IncidenciaTress(Base):
    """Caché en Bono de las incidencias que viven en DATOS_ANALISIS (TRESS).

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_incidencias_tress_service`` a partir de ``dbo.AUSENCIA`` y
    ``dbo.PERMISO``, más el reflejo de ``levelup_faltas_retardos``. Existe para que la
    página Incidencias no tenga que esperar a esa BD externa en cada carga.

    Una fila por evento de origen. ``(origen, origen_id)`` es la llave de idempotencia:
    ``LLAVE`` de TRESS para ``ausencia``/``permiso``, ``levelup_faltas_retardos.id`` para
    ``manual``.
    """

    __tablename__ = "levelup_incidencias_tress"
    __table_args__ = (
        UniqueConstraint(
            "origen", "origen_id", name="uq_levelup_incidencias_tress_origen"
        ),
        CheckConstraint(f"tipo IN ({_TIPOS_SQL})", name="chk_levelup_incidencias_tress_tipo"),
        Index("ix_levelup_incidencias_tress_fecha_evento", "fecha_evento"),
        Index("ix_levelup_incidencias_tress_no_empleado", "no_empleado"),
        Index("ix_levelup_incidencias_tress_tipo", "tipo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origen: Mapped[str] = mapped_column(String(16), nullable=False)
    origen_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # CB_CODIGO en TRESS. Sin FK a empleados: patrón Bono, igual que
    # levelup_homeoffice_tomados.
    no_empleado: Mapped[int] = mapped_column(Integer, nullable=False)
    # NULL cuando el empleado existe en TRESS pero no en Bono. La respuesta lo expone
    # como 0 para que el total de la página cuadre con lo que se ve.
    empleado_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tipo: Mapped[str] = mapped_column(String(32), nullable=False)
    fecha_evento: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # PM_CAPTURA en TRESS; alimenta el created_at de la respuesta.
    fecha_registro: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    registrado_por_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<IncidenciaTress {self.origen}:{self.origen_id} tipo={self.tipo} "
            f"fecha={self.fecha_evento}>"
        )
