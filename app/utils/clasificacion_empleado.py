"""Utilidades para clasificación de colaboradores (`clasificacion_empleado`)."""

from __future__ import annotations

import unicodedata

from app.models.catalogos import ClasificacionEmpleado
from app.models.empleados import Empleado


def _normalize_clasificacion_text(value: str) -> str:
    no_accents = "".join(
        ch
        for ch in unicodedata.normalize("NFD", value)
        if unicodedata.category(ch) != "Mn"
    )
    return no_accents.strip().lower()


def clasificacion_es_administrativo(
    clasificacion: ClasificacionEmpleado | None,
) -> bool:
    """True si la fila de catálogo corresponde a colaborador administrativo (código A o texto)."""
    if clasificacion is None:
        return False
    for raw in (clasificacion.significado, clasificacion.descripcion):
        if not raw or not str(raw).strip():
            continue
        normalized = _normalize_clasificacion_text(str(raw))
        if normalized in ("a", "administrativo") or "administrat" in normalized:
            return True
    return False


def empleado_es_administrativo(empleado: Empleado) -> bool:
    return clasificacion_es_administrativo(empleado.clasificacion)
