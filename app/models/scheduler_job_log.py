"""Historial de corridas de los jobs de APScheduler.

Una fila por ejecución. Se inserta como `en_curso` al arrancar el job y se cierra al
terminar: una fila que se queda en `en_curso` es la señal de que el proceso murió a
media corrida, no un bug del registro.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SchedulerJobLog(Base):
    __tablename__ = "levelup_scheduler_job_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    inicio_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duracion_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resultado: Mapped[str] = mapped_column(
        Enum(
            "en_curso",
            "ok",
            "advertencia",
            "error",
            name="scheduler_job_resultado_enum",
        ),
        nullable=False,
        default="en_curso",
    )
    # Última línea INFO de la corrida (la del resumen con conteos). Se guarda aparte para
    # que el listado no tenga que traer `lineas`.
    resumen: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lineas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    lineas_descartadas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_levelup_scheduler_job_log_job_inicio", "job_id", "inicio_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<SchedulerJobLog id={self.id} job_id={self.job_id} "
            f"resultado={self.resultado}>"
        )
