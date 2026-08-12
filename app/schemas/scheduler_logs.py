"""Contratos de la página de logs del scheduler."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchedulerLogItem(BaseModel):
    """Fila del listado. Sin `lineas`: eso solo va en el detalle."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: str
    inicio_at: datetime
    fin_at: datetime | None = None
    duracion_ms: int | None = None
    resultado: str
    resumen: str | None = None
    error: str | None = None


class SchedulerLogLinea(BaseModel):
    ts: str
    nivel: str
    mensaje: str


class SchedulerLogDetalle(SchedulerLogItem):
    lineas: list[SchedulerLogLinea] = []
    lineas_descartadas: int = 0


class SchedulerLogPage(BaseModel):
    items: list[SchedulerLogItem]
    total: int
    page: int
    page_size: int


class SchedulerJobsResponse(BaseModel):
    """Ids registrados en el scheduler vivo, para poblar el filtro."""

    items: list[str]
