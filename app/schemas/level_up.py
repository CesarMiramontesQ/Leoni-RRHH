from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

TipoHabilidad = Literal["blanda", "liderazgo", "comunicacion", "tecnica_transversal"]


class HabilidadCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo: TipoHabilidad
    niveles_descripcion: Optional[dict[str, str]] = None

    @field_validator("niveles_descripcion")
    @classmethod
    def validate_niveles(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        if v is None:
            return v
        for key in v:
            if not key.isdigit() or not (1 <= int(key) <= 5):
                raise ValueError(f"Las claves deben ser '1'-'5', se recibió '{key}'")
        return v


class HabilidadUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=2, max_length=255)
    descripcion: Optional[str] = None
    tipo: Optional[TipoHabilidad] = None
    niveles_descripcion: Optional[dict[str, str]] = None

    @field_validator("niveles_descripcion")
    @classmethod
    def validate_niveles(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        if v is None:
            return v
        for key in v:
            if not key.isdigit() or not (1 <= int(key) <= 5):
                raise ValueError(f"Las claves deben ser '1'-'5', se recibió '{key}'")
        return v


class HabilidadResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    tipo: TipoHabilidad
    niveles_descripcion: Optional[dict[str, str]] = None
    activo: bool
    created_at: datetime
    updated_at: datetime


class HabilidadListResponse(BaseModel):
    items: list[HabilidadResponse]
    total: int
    page: int
    page_size: int
