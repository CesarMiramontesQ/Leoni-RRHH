"""Helper centralizado `empleado_ids_scope_por_modulo` (app/core/data_scope.py).

Replica exactamente la lógica triplicada en `_empleado_ids_scope` de
IncidenciaFuentesService / FaltasRetardosService / ViajesLaboralesService,
parametrizada por `module_key` vía `effective_data_scope_for_module`.
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.repositories.empleado_repository import EmpleadoRepository
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_director_ve_universo_sin_restriccion(db: AsyncSession):
    director = await make_empleado(db, rol="director", email="ho_scope_dir@leoni.test")
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, director, "incidencias", None)
    assert scope is None


@pytest.mark.asyncio
async def test_rh_ve_universo_sin_restriccion(db: AsyncSession):
    rh = await make_empleado(db, rol="rh", email="ho_scope_rh@leoni.test")
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, rh, "incidencias", None)
    assert scope is None


@pytest.mark.asyncio
async def test_supervisor_ve_reportes_directos_y_el_mismo(db: AsyncSession):
    gerente = await make_empleado(db, rol="gerente", email="ho_scope_g@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="ho_scope_s@leoni.test", lider_id=gerente.empleado_id
    )
    otro_supervisor = await make_empleado(
        db, rol="supervisor", email="ho_scope_s2@leoni.test", lider_id=gerente.empleado_id
    )
    empleado_directo = await make_empleado(
        db, rol="empleado", email="ho_scope_ed@leoni.test", lider_id=supervisor.empleado_id
    )
    empleado_indirecto = await make_empleado(
        db, rol="empleado", email="ho_scope_ei@leoni.test", lider_id=otro_supervisor.empleado_id
    )
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, supervisor, "incidencias", None)
    assert scope is not None
    assert set(scope) == {supervisor.empleado_id, empleado_directo.empleado_id}
    assert empleado_indirecto.empleado_id not in scope


@pytest.mark.asyncio
async def test_gerente_ve_subarbol_completo_y_el_mismo(db: AsyncSession):
    gerente = await make_empleado(db, rol="gerente", email="ho_scope_g2@leoni.test")
    supervisor = await make_empleado(
        db, rol="supervisor", email="ho_scope_s3@leoni.test", lider_id=gerente.empleado_id
    )
    empleado = await make_empleado(
        db, rol="empleado", email="ho_scope_e2@leoni.test", lider_id=supervisor.empleado_id
    )
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, gerente, "incidencias", None)
    assert scope is not None
    assert set(scope) == {gerente.empleado_id, supervisor.empleado_id, empleado.empleado_id}


@pytest.mark.asyncio
async def test_empleado_base_solo_ve_su_propio_id(db: AsyncSession):
    empleado = await make_empleado(db, rol="empleado", email="ho_scope_e3@leoni.test")
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, empleado, "incidencias", None)
    assert scope == [empleado.empleado_id]


@pytest.mark.asyncio
async def test_no_rh_con_modulo_otorgado_ve_universo(db: AsyncSession):
    """No-RH con `module_key` otorgado → scope elevado a 'rh' → sin restricción."""
    grantee = await make_empleado(
        db,
        rol="supervisor",
        email="ho_scope_grant@leoni.test",
        modulos_rh={"incidencias": True},
        inscrito_modulos_rh=True,
    )
    repo = EmpleadoRepository(db)
    scope = await empleado_ids_scope_por_modulo(repo, grantee, "incidencias", None)
    assert scope is None
