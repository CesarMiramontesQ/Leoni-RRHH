from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TurnoUso(Base):
    """Caché en Bono de cuánto personal activo tiene cada turno según TRESS.

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_turnos_uso_service`` a partir de ``dbo.COLABORA``
    (``CB_TURNO`` agrupado con ``CB_ACTIVO = 'S'``). Existe para que la pantalla de
    Ajustes Comedor pueda mostrar solo los turnos que se usan de verdad —25 de los 76
    del catálogo— sin ir a esa BD externa en cada carga de página.

    Dos decisiones que conviene no revertir:

    - ``tu_codigo`` se guarda **ya normalizado** (sin el relleno de espacios de
      ``CHAR(6)``), porque el origen es ``RTRIM(CB_TURNO)``. El join contra el catálogo
      normaliza el otro lado: ``rtrim(levelup_turnos.tu_codigo)``.
    - **Sin FK a** :class:`app.models.turnos.Turno`. TRESS puede tener un turno que la
      réplica del catálogo todavía no incluya (hoy pasa con ``LCI``, con 3 empleados):
      una FK haría fallar el sync entero cada vez que la réplica fuera por detrás.

    Un turno que se queda sin personal conserva su fila con ``empleados_activos = 0``, lo
    que permite distinguir «turno sin gente» de «turno nunca sincronizado».
    """

    __tablename__ = "levelup_turnos_uso"
    __table_args__ = (
        UniqueConstraint("tu_codigo", name="uq_levelup_turnos_uso_tu_codigo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tu_codigo: Mapped[str] = mapped_column(String(6), nullable=False)
    empleados_activos: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:
        return (
            f"<TurnoUso tu_codigo={self.tu_codigo!r} "
            f"empleados_activos={self.empleados_activos}>"
        )
