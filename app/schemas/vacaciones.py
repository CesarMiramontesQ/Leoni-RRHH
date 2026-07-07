from datetime import datetime

from pydantic import BaseModel, Field


class VacacionesResponse(BaseModel):
    empleado_id: int
    dias_disponibles: int
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class VacacionesUpdate(BaseModel):
    dias_disponibles: int = Field(..., ge=0, description="Saldo de días de vacaciones disponibles")


class SaldoVacacionesRealResponse(BaseModel):
    """Saldo real de días de gozo desde SQL Server datos-analisis (vista V_SALD_VAC)."""

    empleado_id: int
    no_empleado: int
    saldo_gozo_total: float | None = None  # None = sin registro en la vista
