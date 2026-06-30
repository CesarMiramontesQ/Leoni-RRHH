"""Unit tests para el conteo de brechas/cumplimiento de perfiles de puesto.

Brecha = requisito no satisfecho = no cumple el mínimo O aún sin evaluar.
brechas = requeridos - cumplen.
"""

from app.services.perfil_funciones_service import _parse_nivel, contar_cumplimiento_gap


def _cualif(evaluado: bool, cumple):
    return {"evaluado": evaluado, "cumple": cumple}


def _comp(evaluado: bool, situacion_actual, nivel_requerido: int):
    return {
        "evaluado": evaluado,
        "situacion_actual": situacion_actual,
        "nivel_requerido": nivel_requerido,
    }


def test_parse_nivel():
    assert _parse_nivel("3") == 3
    assert _parse_nivel(2) == 2
    assert _parse_nivel(" 4 ") == 4
    assert _parse_nivel(None) is None
    assert _parse_nivel("cumple") is None
    assert _parse_nivel("") is None


def test_cualificaciones_cumple_y_no_cumple():
    cualif = [
        _cualif(True, True),    # cumple
        _cualif(True, False),   # no cumple -> brecha
        _cualif(True, None),    # evaluado pero indeterminado -> brecha
        _cualif(False, None),   # sin evaluar -> brecha
    ]
    req, cum = contar_cumplimiento_gap(cualif, [])
    assert req == 4
    assert cum == 1  # solo el primero
    # brechas = 4 - 1 = 3


def test_competencias_nivel_vs_requerido():
    comps = [
        _comp(True, "4", 4),   # cumple (>=)
        _comp(True, "3", 4),   # por debajo -> brecha
        _comp(True, "0", 1),   # N/A / cero -> brecha
        _comp(False, None, 2), # sin evaluar -> brecha
    ]
    req, cum = contar_cumplimiento_gap([], comps)
    assert req == 4
    assert cum == 1
    # brechas = 4 - 1 = 3


def test_mezcla_cualif_y_comp():
    cualif = [_cualif(True, True), _cualif(True, False)]
    comps = [_comp(True, "2", 2), _comp(True, "1", 3)]
    req, cum = contar_cumplimiento_gap(cualif, comps)
    assert req == 4
    assert cum == 2  # cualif[0] + comp[0]
    assert req - cum == 2  # brechas


def test_todo_cumple_cero_brechas():
    cualif = [_cualif(True, True)]
    comps = [_comp(True, "3", 3)]
    req, cum = contar_cumplimiento_gap(cualif, comps)
    assert req - cum == 0


def test_sin_requisitos():
    assert contar_cumplimiento_gap([], []) == (0, 0)
