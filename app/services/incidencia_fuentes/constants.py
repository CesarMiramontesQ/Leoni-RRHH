"""Constantes compartidas para fuentes de incidencias por tipo."""

from __future__ import annotations

TIPO_INCIDENCIA_CALIDAD = "Calidad"
TIPO_INCIDENCIA_SEGURIDAD = "Seguridad"

ORIGEN_CALIDAD_HISTORICO = "calidad_historico"
ORIGEN_SEGURIDAD_HISTORICO = "seguridad_historico"

# Fuentes activas en la fase actual (solo calidad_historico).
FUENTES_ACTIVAS: tuple[str, ...] = (ORIGEN_CALIDAD_HISTORICO,)

# Tipos de incidencia expuestos en filtros y badges de UI.
TIPOS_INCIDENCIA_REGISTRADOS: tuple[str, ...] = (TIPO_INCIDENCIA_CALIDAD,)
