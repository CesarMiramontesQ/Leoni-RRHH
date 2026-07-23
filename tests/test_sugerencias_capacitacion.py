"""Tests del Motor de Sugerencias de Capacitacion."""
from app.models.level_up import SugerenciaCapacitacion
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
)
from app.services.sugerencia_capacitacion_service import prioridad_desde_brecha


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


def test_prioridad_desde_brecha_bandas():
    assert prioridad_desde_brecha(0) == 1       # sin brecha -> mantener
    assert prioridad_desde_brecha(15) == 3      # 1-30
    assert prioridad_desde_brecha(30) == 3
    assert prioridad_desde_brecha(45) == 4      # 31-50
    assert prioridad_desde_brecha(50) == 4
    assert prioridad_desde_brecha(80) == 5      # >50
