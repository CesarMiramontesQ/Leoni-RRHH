"""Tests del Motor de Sugerencias de Capacitacion."""
import pytest

from app.core.exceptions import NotFoundError
from app.models.level_up import SugerenciaCapacitacion
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
from app.services.sugerencia_capacitacion_service import (
    SugerenciaCapacitacionService,
    prioridad_desde_brecha,
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


def test_prioridad_desde_brecha_bandas():
    assert prioridad_desde_brecha(0) == 1       # sin brecha -> mantener
    assert prioridad_desde_brecha(15) == 3      # 1-30
    assert prioridad_desde_brecha(30) == 3
    assert prioridad_desde_brecha(45) == 4      # 31-50
    assert prioridad_desde_brecha(50) == 4
    assert prioridad_desde_brecha(80) == 5      # >50


@pytest.mark.asyncio
async def test_crear_y_listar(db):
    svc = SugerenciaCapacitacionService(db)
    creada = await svc.crear(SugerenciaCapacitacionCreate(titulo="Curso A", prioridad=4))
    assert creada.id is not None
    assert creada.estado == "activa"
    todas = await svc.listar()
    assert any(s.id == creada.id for s in todas)


@pytest.mark.asyncio
async def test_listar_filtra_por_estado_y_prioridad(db):
    svc = SugerenciaCapacitacionService(db)
    await svc.crear(SugerenciaCapacitacionCreate(titulo="AA", prioridad=5))
    b = await svc.crear(SugerenciaCapacitacionCreate(titulo="BB", prioridad=2))
    await svc.actualizar(b.id, SugerenciaCapacitacionUpdate(estado="descartada"))
    activas = await svc.listar(estado="activa")
    assert all(s.estado == "activa" for s in activas)
    prio5 = await svc.listar(prioridad=5)
    assert all(s.prioridad == 5 for s in prio5)


@pytest.mark.asyncio
async def test_actualizar_cambia_estado(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="AA"))
    upd = await svc.actualizar(s.id, SugerenciaCapacitacionUpdate(estado="aprobada"))
    assert upd.estado == "aprobada"


@pytest.mark.asyncio
async def test_crear_con_curso_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(SugerenciaCapacitacionCreate(titulo="AA", curso_id=999999))


@pytest.mark.asyncio
async def test_eliminar(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="AA"))
    await svc.eliminar(s.id)
    assert all(x.id != s.id for x in await svc.listar())


@pytest.mark.asyncio
async def test_actualizar_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.actualizar(999999, SugerenciaCapacitacionUpdate(estado="aprobada"))
