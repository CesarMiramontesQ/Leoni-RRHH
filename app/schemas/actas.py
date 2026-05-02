# app/schemas/actas.py
"""
Schemas Pydantic v2 para el dominio actas administrativas.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel


class ActaGenerarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    incidencia_id: Optional[int] = None


class ActaEditarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    contenido_final: str


class ActaFirmarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    comentario: Optional[str] = None


FundamentoLegalActa = Literal[
    "Ley Federal del Trabajo",
    "Reglamento Interior de Trabajo",
]


class ActaCreateRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}

    empleado_id: int
    numero_empleado: str
    area_departamento: str
    supervisor_directo: str
    tipo_falta: str
    fundamento_legal: FundamentoLegalActa
    articulo_inciso: Optional[str] = None
    fecha_evento: date
    lugar_incidente: str
    descripcion_hechos: str
    personas_involucradas: Optional[str] = None
    testigos: Optional[str] = None
    responsable_rh: str
    evidencia: Optional[str] = None


class ActaAprobacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    acta_id: int
    firmante_id: int
    rol_firmante: str
    firma_timestamp: Optional[datetime] = None
    comentario: Optional[str] = None


class ActaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    numero_empleado: Optional[str] = None
    area_departamento: Optional[str] = None
    supervisor_directo: Optional[str] = None
    tipo_falta: Optional[str] = None
    fundamento_legal: Optional[FundamentoLegalActa] = None
    articulo_inciso: Optional[str] = None
    fecha_evento: Optional[date] = None
    lugar_incidente: Optional[str] = None
    descripcion_hechos: Optional[str] = None
    personas_involucradas: Optional[str] = None
    testigos: Optional[str] = None
    responsable_rh: Optional[str] = None
    evidencia: Optional[str] = None
    incidencia_id: Optional[int] = None
    contenido_ia: Optional[str] = None
    contenido_final: Optional[str] = None
    estado: str
    generado_por: int
    created_at: datetime
    aprobaciones: list[ActaAprobacionResponse] = []
    firmantes_pendientes: list[str] = []
