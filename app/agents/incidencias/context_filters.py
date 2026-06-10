"""Fusión de filtros de pantalla con args de herramientas."""

from __future__ import annotations

import re
from typing import Any

_CONTEXT_KEYS_DROP_ON_EMPLOYEE_QUERY = frozenset(
    {
        "tipo",
        "area",
        "subarea",
        "categoria",
        "fecha",
        "fecha_inicio",
        "fecha_fin",
        "tendencia_agrupacion",
    }
)

_DATE_KEYS = frozenset({"fecha", "fecha_inicio", "fecha_fin"})
_AREA_KEYS = frozenset({"area", "subarea"})
_TIPO_KEYS = frozenset({"tipo", "categoria"})

_DATE_HINT = re.compile(
    r"\b(fecha|mes|semana|periodo|desde|hasta|enero|febrero|marzo|abril|mayo|junio|"
    r"julio|agosto|septiembre|octubre|noviembre|diciembre|\d{4}-\d{2}-\d{2})\b",
    re.IGNORECASE,
)
_AREA_HINT = re.compile(r"\b(área|area|subárea|subarea|departamento|planta)\b", re.IGNORECASE)
_TIPO_HINT = re.compile(r"\b(tipo|retardo|falta|seguridad|calidad|vacaciones)\b", re.IGNORECASE)
_EMPLOYEE_HINT = re.compile(
    r"\b(empleado|no\.?\s*empleado|n[uú]mero\s+de\s+empleado)\b",
    re.IGNORECASE,
)
_EMPLOYEE_KEYS = frozenset({"no_empleado", "nombre", "empleado_id"})
_GLOBAL_HINT = re.compile(
    r"\b(toda\s+la\s+planta|toda\s+la\s+empresa|en\s+total|en\s+la\s+planta|global)\b",
    re.IGNORECASE,
)


def _args_target_employee(args: dict[str, Any]) -> bool:
    for key in ("no_empleado", "nombre", "empleado_id"):
        val = args.get(key)
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        return True
    return False


def _strip_unmentioned_context(
    merged: dict[str, Any],
    user_message: str | None,
) -> None:
    """No hereda filtros de pantalla si el usuario no los mencionó en su pregunta."""
    if not user_message or not user_message.strip():
        for key in _DATE_KEYS | _AREA_KEYS | _TIPO_KEYS:
            merged.pop(key, None)
        return

    text = user_message.strip()
    if not _DATE_HINT.search(text):
        for key in _DATE_KEYS:
            merged.pop(key, None)
    if not _AREA_HINT.search(text):
        for key in _AREA_KEYS:
            merged.pop(key, None)
    if not _TIPO_HINT.search(text):
        for key in _TIPO_KEYS:
            merged.pop(key, None)
    if _GLOBAL_HINT.search(text) or not _EMPLOYEE_HINT.search(text):
        for key in _EMPLOYEE_KEYS:
            merged.pop(key, None)


def merge_context_filters(
    args: dict[str, Any],
    context: dict[str, Any] | None,
    *,
    user_message: str | None = None,
) -> dict[str, Any]:
    merged = dict(context or {})
    _strip_unmentioned_context(merged, user_message)
    if _args_target_employee(args):
        for key in _CONTEXT_KEYS_DROP_ON_EMPLOYEE_QUERY:
            merged.pop(key, None)
    for key, val in args.items():
        if val is not None and val != "":
            merged[key] = val
    return merged
