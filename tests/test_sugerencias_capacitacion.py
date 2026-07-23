"""Tests del Motor de Sugerencias de Capacitacion."""
from app.models.level_up import SugerenciaCapacitacion
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
)


def test_modelo_tiene_curso_id():
    cols = set(SugerenciaCapacitacion.__table__.columns.keys())
    assert "curso_id" in cols


def test_schemas_tienen_curso_id():
    c = SugerenciaCapacitacionCreate(titulo="XX", curso_id=5)
    assert c.curso_id == 5
    assert "curso_id" in SugerenciaCapacitacionResponse.model_fields
    assert "curso_nombre" in SugerenciaCapacitacionResponse.model_fields


def test_generar_request_default_umbral_cero():
    r = GenerarDesdeBrechasRequest(area_id=1)
    assert r.umbral_brecha == 0
