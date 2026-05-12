# app/schemas/incidencias.py
"""
Schemas Pydantic v2 para el dominio incidencias y evidencias.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


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


class IncidenciaAreaTotalItem(BaseModel):
    area: str
    total: int


class IncidenciaSubareaTotalItem(BaseModel):
    subarea: str
    total: int
    # Área más frecuente asociada a la subárea en el conjunto filtrado (heurística).
    area: str | None = None


class IncidenciaEmpleadoTotalItem(BaseModel):
    empleado_id: int
    no_empleado: str | None = None
    nombre: str | None = None
    total: int


class IncidenciaTipoDistribucionItem(BaseModel):
    tipo: str
    total: int
    porcentaje: float


class IncidenciaSerieMensualItem(BaseModel):
    """Bucket mensual (fecha de negocio o fecha de alta) para tendencia en dashboard."""

    periodo: str  # YYYY-MM
    total: int


class IncidenciasEstadisticasResponse(BaseModel):
    """Agregados para analítica del listado (mismos filtros y alcance que GET /incidencias)."""

    total_incidencias: int
    incidencias_seguridad: int
    incidencias_calidad: int
    areas_con_mas_incidencias: list[IncidenciaAreaTotalItem]
    subareas_con_mas_incidencias: list[IncidenciaSubareaTotalItem]
    empleados_con_mas_incidencias: list[IncidenciaEmpleadoTotalItem]
    incidencias_por_tipo: list[IncidenciaTipoDistribucionItem]
    incidencias_por_mes: list[IncidenciaSerieMensualItem] = Field(default_factory=list)
    total_periodo_anterior: int | None = None
    variacion_total_pct: float | None = None


class EvidenciaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre_original: str
    mime_type: str
    tamano_bytes: int
    created_at: datetime
