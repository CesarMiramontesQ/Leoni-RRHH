"""Schemas de Configuración laborales (reglas de home office por área y días festivos)."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator, model_validator

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


# ── Días festivos ────────────────────────────────────────────────────────────

DESCRIPCION_FESTIVO_MAX = 120


class DiaFestivoItem(BaseModel):
    id: int
    fecha: date
    descripcion: str
    activo: bool
    actualizado_en: datetime | None = None
    actualizado_por: str | None = None


class DiasFestivosListResponse(BaseModel):
    anio: int
    items: list[DiaFestivoItem]
    total: int


class DiaFestivoCreate(BaseModel):
    fecha: date
    descripcion: str = Field(..., min_length=1, max_length=DESCRIPCION_FESTIVO_MAX)

    @field_validator("descripcion")
    @classmethod
    def _sin_espacios(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La descripción es obligatoria.")
        return v


class DiaFestivoUpdate(BaseModel):
    descripcion: str = Field(..., min_length=1, max_length=DESCRIPCION_FESTIVO_MAX)
    activo: bool

    @field_validator("descripcion")
    @classmethod
    def _sin_espacios(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La descripción es obligatoria.")
        return v


class DiaFestivoGuardadoResponse(BaseModel):
    """Festivo guardado + cuántas solicitudes vivas (vacaciones/HO) incluyen esa fecha.

    Esas solicitudes no se recalculan: el número es solo para advertir a RH.
    """

    item: DiaFestivoItem
    solicitudes_afectadas: int


class DiasFestivosCargaOficialesRequest(BaseModel):
    anio: int = Field(..., ge=2000, le=2100)


class DiasFestivosCargaOficialesResponse(BaseModel):
    anio: int
    agregados: list[DiaFestivoItem]
    omitidos: int


class DiaFestivoPublico(BaseModel):
    """Lo que ve cualquier usuario autenticado al abrir el modal de solicitudes."""

    fecha: date
    descripcion: str


class DiasFestivosPublicosResponse(BaseModel):
    anio: int
    items: list[DiaFestivoPublico]
