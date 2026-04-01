# app/schemas/incidencias.py
"""
Schemas Pydantic v2 para el dominio incidencias y evidencias.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator


INCIDENCIA_TIPOS_VALIDOS = {"falta", "retardo", "conducta", "accidente", "otro"}
INCIDENCIA_ESTADOS_VALIDOS = {"open", "in_review", "resolved", "closed"}
INCIDENCIA_TRANSICIONES_VALIDAS = {
    "open": {"in_review"},
    "in_review": {"resolved"},
    "resolved": {"closed"},
    "closed": set(),
}


class IncidenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    tipo: str
    descripcion: str

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in INCIDENCIA_TIPOS_VALIDOS:
            raise ValueError(f"tipo debe ser uno de: {sorted(INCIDENCIA_TIPOS_VALIDOS)}")
        return v


class IncidenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    # Solo el estado puede actualizarse — el workflow lo controla el service
    estado: Optional[str] = None

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in INCIDENCIA_ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de: {sorted(INCIDENCIA_ESTADOS_VALIDOS)}")
        return v


class IncidenciaEstadoRequest(BaseModel):
    nuevo_estado: str

    @field_validator("nuevo_estado")
    @classmethod
    def validar_estado(cls, v: str) -> str:
        if v not in INCIDENCIA_ESTADOS_VALIDOS:
            raise ValueError(f"nuevo_estado debe ser uno de: {sorted(INCIDENCIA_ESTADOS_VALIDOS)}")
        return v


class IncidenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    tipo: str
    descripcion: str
    estado: str
    registrado_por: int
    created_at: datetime
    evidencias_count: int = 0


class EvidenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre_original: str
    mime_type: str
    tamano_bytes: int
    created_at: datetime
