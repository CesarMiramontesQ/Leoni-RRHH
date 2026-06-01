"""Historial de corridas de importación desde tablas históricas de bono_productividad."""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BonoHistoricoImportLog(Base):
    __tablename__ = "bono_historico_import_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fuente: Mapped[str] = mapped_column(
        Enum(
            "empleados",
            "calidad_historico",
            "seguridad_historico",
            "importadas_historico",
            "evaluacion_historica_gral",
            name="bono_historico_fuente_enum",
        ),
        nullable=False,
    )
    corrida_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    origen_ejecucion: Mapped[str] = mapped_column(
        Enum("scheduler", "manual", name="bono_historico_origen_enum"),
        nullable=False,
        default="scheduler",
    )
    status: Mapped[str] = mapped_column(
        Enum("ok", "skipped", "error", name="bono_historico_import_status_enum"),
        nullable=False,
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    leidos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    insertados: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    omitidos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    errores: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mensajes_error: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    error_msg: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<BonoHistoricoImportLog id={self.id} fuente={self.fuente} "
            f"status={self.status}>"
        )
