"""Schemas de Configuración laborales (reglas de home office por área)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

DIAS_PERMITIDOS_MAX = 5
PERIODO_SEMANAS_MAX = 4


class HomeOfficeReglaAreaItem(BaseModel):
    area_id: int
    area_descripcion: str
    # None ⇒ el área no tiene regla capturada.
    dias_permitidos: int | None = None
    periodo_semanas: int | None = None
    activo: bool = False
    actualizado_en: datetime | None = None
    actualizado_por: str | None = None


class HomeOfficeReglasAreaListResponse(BaseModel):
    items: list[HomeOfficeReglaAreaItem]
    total: int


class HomeOfficeReglaAreaUpdate(BaseModel):
    dias_permitidos: int = Field(..., ge=1, le=DIAS_PERMITIDOS_MAX)
    periodo_semanas: int = Field(..., ge=1, le=PERIODO_SEMANAS_MAX)
    activo: bool = True

    @model_validator(mode="after")
    def _dias_caben_en_periodo(self) -> "HomeOfficeReglaAreaUpdate":
        if self.dias_permitidos > DIAS_PERMITIDOS_MAX * self.periodo_semanas:
            raise ValueError(
                "dias_permitidos no puede exceder 5 días hábiles por semana del periodo."
            )
        return self
