"""Schemas para el ciclo de aprobación de horas extra (gerente regional / director)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_serializer, field_validator

# Tipos de firma reales del modelo `horas_extra_aprobaciones`.
HorasExtraTipoFirma = Literal["gerente_area", "gerente_regional", "director_planta"]
HorasExtraFirmaEstado = Literal["pendiente", "aprobado", "rechazado"]

# Estado consolidado que ve RH (calculado a partir de las firmas).
HorasExtraEstadoConsolidado = Literal[
    "pendiente", "aprobado_parcial", "aprobado", "rechazado"
]

TIPO_FIRMA_LABELS: dict[str, str] = {
    "gerente_area": "Gerente de área",
    "gerente_regional": "Gerente regional",
    "director_planta": "Director",
}

ESTADO_CONSOLIDADO_LABELS: dict[str, str] = {
    "pendiente": "Pendiente de aprobación",
    "aprobado_parcial": "Aprobación parcial",
    "aprobado": "Aprobado",
    "rechazado": "Rechazado",
}


class HorasExtraAprobarRequest(BaseModel):
    comentario: Optional[str] = Field(default=None, max_length=500)

    @field_validator("comentario")
    @classmethod
    def _strip(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None


class HorasExtraRechazarRequest(BaseModel):
    comentario: str = Field(min_length=1, max_length=500)

    @field_validator("comentario")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El comentario es obligatorio al rechazar.")
        return v


class HorasExtraFirmaResponse(BaseModel):
    tipo_firma: HorasExtraTipoFirma
    tipo_firma_label: str
    estado: HorasExtraFirmaEstado
    aprobador_id: Optional[int] = None
    aprobador_nombre: Optional[str] = None
    rol_aprobador_nombre: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None
    comentario: Optional[str] = None


class HorasExtraPendienteItem(BaseModel):
    solicitud_id: int
    semana: int
    semana_inicio: date
    fecha_solicitud: date
    tipo: str
    area_descripcion: Optional[str] = None
    centrocosto_id: Optional[int] = None
    centrocosto_descripcion: Optional[str] = None
    motivo: Optional[str] = None
    total_horas: float
    total_empleados: int
    registrado_por_nombre: Optional[str] = None
    mi_tipo_firma: HorasExtraTipoFirma
    mi_tipo_firma_label: str
    estado_consolidado: HorasExtraEstadoConsolidado
    aprobado_parcial: bool


class HorasExtraPendientesListResponse(BaseModel):
    items: list[HorasExtraPendienteItem]
    total: int
    page: int
    page_size: int


class HorasExtraEstadoConsolidadoResponse(BaseModel):
    solicitud_id: int
    estado: HorasExtraEstadoConsolidado
    estado_label: str
    aprobado_parcial: bool
    listo_para_nomina: bool
    firmas: list[HorasExtraFirmaResponse]
    faltantes: list[str]
    rechazado_por: Optional[str] = None
    comentario_rechazo: Optional[str] = None


class HorasExtraHistorialResponse(BaseModel):
    solicitud_id: int
    estado: HorasExtraEstadoConsolidado
    estado_label: str
    firmas: list[HorasExtraFirmaResponse]
