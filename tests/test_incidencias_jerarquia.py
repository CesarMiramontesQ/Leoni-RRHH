"""Alcance de incidencias por rol en la capa de fuentes (sin conectar a bono)."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.incidencia_fuentes_service import IncidenciaFuentesService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_scope_gerente_incluye_subarbol(db: AsyncSession):
    gerente = await make_empleado(db, rol="gerente", email="inc_jer_g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer_s@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="inc_jer_e@leoni.test", lider_id=supervisor.empleado_id
    )
    svc = IncidenciaFuentesService(db)
    scope = await svc._empleado_ids_scope(gerente, None)
    assert scope is not None
    assert empleado.empleado_id in scope
    assert supervisor.empleado_id in scope
    assert gerente.empleado_id in scope


@pytest.mark.asyncio
async def test_scope_supervisor_solo_su_subarbol(db: AsyncSession):
    gerente = await make_empleado(db, rol="gerente", email="inc_jer2_g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer2_s@leoni.test", lider_id=gerente.empleado_id
    )
    otro_supervisor = await make_empleado(
        db, rol="supervisor", email="inc_jer2_s2@leoni.test", lider_id=gerente.empleado_id
    )
    empleado_directo = await make_empleado(
        db, rol="empleado", email="inc_jer2_ed@leoni.test", lider_id=supervisor.empleado_id
    )
    empleado_indirecto = await make_empleado(
        db, rol="empleado", email="inc_jer2_ei@leoni.test", lider_id=otro_supervisor.empleado_id
    )
    svc = IncidenciaFuentesService(db)
    scope = await svc._empleado_ids_scope(supervisor, None)
    assert scope is not None
    assert empleado_directo.empleado_id in scope
    assert supervisor.empleado_id in scope
    assert empleado_indirecto.empleado_id not in scope


@pytest.mark.asyncio
async def test_scope_rh_sin_restriccion(db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="inc_rh_scope@leoni.test")
    svc = IncidenciaFuentesService(db)
    scope = await svc._empleado_ids_scope(rh, None)
    assert scope is None


@pytest.mark.asyncio
async def test_scope_no_rh_con_modulo_incidencias_ve_global(db: AsyncSession):
    """No-RH con el módulo 'incidencias' otorgado → sin restricción (vista global)."""
    grantee = await make_empleado(
        db,
        rol="supervisor",
        email="inc_grant@leoni.test",
        modulos_rh={"incidencias": True},
        inscrito_modulos_rh=True,
    )
    svc = IncidenciaFuentesService(db)
    scope = await svc._empleado_ids_scope(grantee, None)
    assert scope is None
