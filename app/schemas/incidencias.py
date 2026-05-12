# app/schemas/incidencias.py
"""
Schemas Pydantic v2 para el dominio incidencias y evidencias.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class IncidenciaCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: str
    empleado_id: int
    no_empleado: Optional[str] = None
    nombre: Optional[str] = None
    fecha: Optional[date] = None
    semana_id: Optional[int] = None
    numero_semana: Optional[int] = None
    categoria: Optional[str] = None
    detalle: Optional[str] = None
    descuento_porcentaje: Optional[float] = None
    estatus_id: Optional[int] = None
    area: Optional[str] = None
    subarea: Optional[str] = None


class IncidenciaUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: Optional[str] = None
    no_empleado: Optional[str] = None
    nombre: Optional[str] = None
    fecha: Optional[date] = None
    semana_id: Optional[int] = None
    numero_semana: Optional[int] = None
    categoria: Optional[str] = None
    detalle: Optional[str] = None
    descuento_porcentaje: Optional[float] = None
    estatus_id: Optional[int] = None
    area: Optional[str] = None
    subarea: Optional[str] = None


class IncidenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    tipo: str
    empleado_id: int
    no_empleado: Optional[str] = None
    nombre: Optional[str] = None
    fecha: Optional[date] = None
    semana_id: Optional[int] = None
    numero_semana: Optional[int] = None
    categoria: Optional[str] = None
    detalle: Optional[str] = None
    descuento_porcentaje: Optional[float] = None
    estatus_id: Optional[int] = None
    area: Optional[str] = None
    subarea: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    evidencias_count: int = 0
    # Catálogo empleados (resueltos por `no_empleado` de la incidencia o por `empleado_id`).
    puesto: Optional[str] = None
    supervisor_directo: Optional[str] = None


class IncidenciasKpiResumen(BaseModel):
    """Totales para tarjetas de resumen (vista listado)."""

    abiertas: int
    en_investigacion: int
    resueltas: int
    criticas: int


class IncidenciasListPageResponse(BaseModel):
    """Listado paginado por offset/página (máx. 10 ítems recomendado en cliente)."""

    items: list[IncidenciaResponse]
    total: int
    page: int
    page_size: int
    resumen: IncidenciasKpiResumen


class IncidenciasTiposResponse(BaseModel):
    """Valores distintos de `tipo` visibles para el usuario según su rol (ordenados)."""

    items: list[str]


class EvidenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre_original: str
    mime_type: str
    tamano_bytes: int
    created_at: datetime
