"""Capacidad gestor (líder/gerente) para usuarios con rol RH según puesto."""

from __future__ import annotations

import unicodedata
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.models.empleados import Empleado

RhGestorAlcance = Literal["supervisor", "gerente"]

# Mapeo normalizado descripción de puesto → alcance gestor.
_PUESTO_ALCANCE_BY_NORM: dict[str, RhGestorAlcance] = {
    "lider de equipo de recursos humanos": "supervisor",
    "gerente de recursos humanos": "gerente",
}

# Opcional: mapeo estable por puesto_id cuando se conozca en catálogo.
_PUESTO_ID_ALCANCE: dict[int, RhGestorAlcance] = {}


def normalize_puesto_text(value: str | None) -> str:
    if not value:
        return ""
    text = unicodedata.normalize("NFD", value.strip().casefold())
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def resolve_rh_gestor_alcance(empleado: "Empleado") -> RhGestorAlcance | None:
    """None si el RH no tiene capacidad gestor."""
    rol = empleado.rol.nombre if empleado.rol else "empleado"
    if rol != "rh":
        return None

    puesto = getattr(empleado, "puesto", None)
    if puesto is not None and puesto.puesto_id in _PUESTO_ID_ALCANCE:
        return _PUESTO_ID_ALCANCE[puesto.puesto_id]

    descripcion = puesto.descripcion if puesto is not None else None
    norm = normalize_puesto_text(descripcion)
    if not norm:
        return None
    return _PUESTO_ALCANCE_BY_NORM.get(norm)
