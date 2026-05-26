"""Schemas para historial de importaciones bono histórico."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FuenteBonoHistoricoSchema = Literal[
    "empleados",
    "calidad_historico",
    "seguridad_historico",
    "importadas_historico",
    "evaluacion_historica_gral",
]


class BonoHistoricoImportLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fuente: FuenteBonoHistoricoSchema
    corrida_id: str | None
    origen_ejecucion: Literal["scheduler", "manual"]
    status: Literal["ok", "skipped", "error"]
    started_at: datetime
    finished_at: datetime
    leidos: int | None
    insertados: int | None
    omitidos: int | None
    errores: int | None
    mensajes_error: list[str] | None
    error_msg: str | None
    created_at: datetime


class BonoHistoricoImportLogListResponse(BaseModel):
    items: list[BonoHistoricoImportLogItem]
    total: int
    limit: int = Field(description="Límite aplicado a la consulta")
    offset: int = Field(description="Desplazamiento aplicado")
