"""Capa de obtención de incidencias por tipo de fuente (calidad_historico, futuro seguridad_historico)."""

from app.services.incidencia_fuentes.constants import (
    ORIGEN_CALIDAD_HISTORICO,
    TIPO_INCIDENCIA_CALIDAD,
    TIPO_INCIDENCIA_SEGURIDAD,
)
from app.services.incidencia_fuentes.mapper import map_fuente_row_to_incidencia_response
from app.services.incidencia_fuentes.types import IncidenciaFuenteFilters

__all__ = [
    "IncidenciaFuenteFilters",
    "ORIGEN_CALIDAD_HISTORICO",
    "TIPO_INCIDENCIA_CALIDAD",
    "TIPO_INCIDENCIA_SEGURIDAD",
    "map_fuente_row_to_incidencia_response",
]
