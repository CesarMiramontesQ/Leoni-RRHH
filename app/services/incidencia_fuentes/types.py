"""Tipos compartidos de la capa de fuentes de incidencias."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class IncidenciaFuenteFilters:
    """Filtros normalizados para consultas sobre fuentes externas (bono_productividad)."""

    tipo: str | None = None
    empleado_id: int | None = None
    no_empleado: str | None = None
    nombre: str | None = None
    fecha: date | None = None
    categoria: str | None = None
    area: str | None = None
    subarea: str | None = None
    fecha_inicio: date | None = None
    fecha_fin: date | None = None
    # Alcance por rol: None = sin restricción; lista vacía = sin resultados.
    empleado_ids_scope: list[int] | None = None
