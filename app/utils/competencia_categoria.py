# app/utils/competencia_categoria.py
"""Resuelve categoria de competencia (tecnica|blanda) a partir del nombre del grupo."""

import unicodedata


def _normalize_nombre(nombre: str) -> str:
    s = nombre.strip().lower()
    s = "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )
    return " ".join(s.split())


_NOMBRES_TECNICA = frozenset({"tecnica", "tecnicas", "competencias tecnicas"})
_NOMBRES_BLANDA = frozenset(
    {"habilidad blanda", "habilidades blandas", "blanda", "competencias blandas"}
)


def categoria_desde_grupo_nombre(nombre: str) -> str:
    """
    Deriva la categoria de matriz a partir del nombre del grupo de competencia.

    Los grupos semilla usan nombres como 'Técnica' y 'Habilidad blanda'.
    """
    key = _normalize_nombre(nombre)
    if key in _NOMBRES_TECNICA:
        return "tecnica"
    if key in _NOMBRES_BLANDA:
        return "blanda"
    if "tecnica" in key:
        return "tecnica"
    if "blanda" in key or "habilidad" in key:
        return "blanda"
    return "blanda"
