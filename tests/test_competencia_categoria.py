# tests/test_competencia_categoria.py
"""Tests del resolver de categoria desde nombre de grupo."""

from app.utils.competencia_categoria import categoria_desde_grupo_nombre


def test_categoria_desde_grupo_tecnica():
    assert categoria_desde_grupo_nombre("Técnica") == "tecnica"
    assert categoria_desde_grupo_nombre("TECNICA") == "tecnica"


def test_categoria_desde_grupo_blanda():
    assert categoria_desde_grupo_nombre("Habilidad blanda") == "blanda"
    assert categoria_desde_grupo_nombre("Competencias blandas") == "blanda"
