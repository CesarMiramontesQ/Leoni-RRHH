"""Planificador determinístico para consultas frecuentes del agente de incidencias."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PlannedQuery:
    tool: str
    args: dict[str, Any]


_NO_EMPLEADO_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?:n[uú]mero|no\.?)\s+de\s+empleado\s+(\d[\d.]*)", re.IGNORECASE),
    re.compile(r"empleado\s+(?:con\s+)?(?:n[uú]mero|no\.?)\s+(\d[\d.]*)", re.IGNORECASE),
    re.compile(r"empleado\s+(\d{3,}(?:\.\d+)?)", re.IGNORECASE),
)

_COUNT_HINT = re.compile(
    r"\b(cu[aá]nt[ao]s?|total|cantidad|n[uú]mero\s+de\s+incidencias)\b",
    re.IGNORECASE,
)
_LIST_HINT = re.compile(
    r"\b(lista|listar|mu[eé]strame|cu[aá]les|detalle\s+de)\b",
    re.IGNORECASE,
)
_GLOBAL_HINT = re.compile(
    r"\b(toda\s+la\s+planta|toda\s+la\s+empresa|en\s+total|en\s+la\s+planta|global)\b",
    re.IGNORECASE,
)
_ATTENTION_HINT = re.compile(
    r"\b("
    r"m[aá]s\s+atenci[oó]n|"
    r"poner\s+atenci[oó]n|"
    r"deber[ií]a\s+de\s+poner|"
    r"prioriz|"
    r"preocup|"
    r"empleado\s+con\s+m[aá]s|"
    r"cu[aá]l\s+empleado|"
    r"en\s+cual\s+empleado|"
    r"a\s+qui[eé]n"
    r")\b",
    re.IGNORECASE,
)
_TIPO_MAP: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bretardos?\b", re.IGNORECASE), "retardo"),
    (re.compile(r"\bfaltas?\b", re.IGNORECASE), "falta"),
    (re.compile(r"\bseguridad\b", re.IGNORECASE), "seguridad"),
    (re.compile(r"\bcalidad\b", re.IGNORECASE), "calidad"),
    (re.compile(r"\bvacaciones?\b", re.IGNORECASE), "vacaciones"),
)


def _normalize_no_empleado(raw: str) -> str:
    t = raw.strip()
    if t.endswith(".0") and t[:-2].isdigit():
        return t[:-2]
    return t


def _extract_no_empleado(message: str) -> str | None:
    for pattern in _NO_EMPLEADO_PATTERNS:
        match = pattern.search(message)
        if match:
            return _normalize_no_empleado(match.group(1))
    return None


def _extract_tipo(message: str) -> str | None:
    for pattern, tipo in _TIPO_MAP:
        if pattern.search(message):
            return tipo
    return None


def plan_query(user_message: str) -> PlannedQuery | None:
    """Devuelve herramienta + args cuando la intención es clara; si no, None (usa LLM)."""
    text = user_message.strip()
    if not text:
        return None

    tipo = _extract_tipo(text)
    no_empleado = _extract_no_empleado(text)

    if no_empleado:
        if _LIST_HINT.search(text) and not _COUNT_HINT.search(text):
            return PlannedQuery("listar_incidencias", {"no_empleado": no_empleado, "page": 1})
        args: dict[str, Any] = {"no_empleado": no_empleado}
        if tipo:
            args["tipo"] = tipo
        return PlannedQuery("consultar_estadisticas", args)

    if _ATTENTION_HINT.search(text) and re.search(
        r"\bincidencias?\b", text, re.IGNORECASE
    ):
        args = {"tipo": tipo} if tipo else {}
        return PlannedQuery("consultar_estadisticas", args)

    if _COUNT_HINT.search(text) and (
        re.search(r"\bincidencias?\b", text, re.IGNORECASE) or tipo is not None
    ):
        args = {"tipo": tipo} if tipo else {}
        return PlannedQuery("consultar_estadisticas", args)

    return None
