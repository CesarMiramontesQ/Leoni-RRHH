"""Helper central `effective_data_scope_for_module`: un módulo otorgado eleva el
scope a vista global ("rh") para un no-admin con rol base distinto de "rh",
preservando la simulación de modo del admin y el modo de los usuarios rol "rh".
"""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import effective_data_scope_for_module
from app.core.rh_ui_mode import (
    RH_UI_MODE_EMPLEADO,
    RH_UI_MODE_OPERATIVO,
    has_rh_plantilla_data_scope,
)
from app.services.horas_extra_service import HorasExtraService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_no_admin_con_modulo_otorgado_ve_global(db: AsyncSession):
    emp = await make_empleado(
        db,
        rol="empleado",
        email="ds_grant@leoni.test",
        modulos_rh={"incidencias": True},
        inscrito_modulos_rh=True,
    )
    assert effective_data_scope_for_module(emp, "incidencias") == "rh"


@pytest.mark.asyncio
async def test_supervisor_con_modulo_otorgado_ve_global(db: AsyncSession):
    sup = await make_empleado(
        db,
        rol="supervisor",
        email="ds_grant_sup@leoni.test",
        modulos_rh={"actas": True},
        inscrito_modulos_rh=True,
    )
    assert effective_data_scope_for_module(sup, "actas") == "rh"


@pytest.mark.asyncio
async def test_no_admin_sin_ese_modulo_conserva_rol_base(db: AsyncSession):
    sup = await make_empleado(
        db,
        rol="supervisor",
        email="ds_nogrant@leoni.test",
        modulos_rh={"actas": True},
        inscrito_modulos_rh=True,
    )
    # Tiene "actas" pero NO "incidencias": para incidencias conserva su rol base.
    assert effective_data_scope_for_module(sup, "incidencias") == "supervisor"


@pytest.mark.asyncio
async def test_no_inscrito_no_eleva(db: AsyncSession):
    emp = await make_empleado(
        db,
        rol="empleado",
        email="ds_noenroll@leoni.test",
        modulos_rh={"incidencias": True},
        inscrito_modulos_rh=False,
    )
    assert effective_data_scope_for_module(emp, "incidencias") == "empleado"


@pytest.mark.asyncio
async def test_admin_en_modo_empleado_conserva_modo(db: AsyncSession):
    admin = await make_empleado(
        db,
        rol="director",
        email="ds_admin@leoni.test",
        puede_administrar_permisos_rh=True,
    )
    # Admin operativo = global; admin simulando empleado = solo lo suyo (no se eleva).
    assert effective_data_scope_for_module(admin, "incidencias", RH_UI_MODE_OPERATIVO) == "rh"
    assert effective_data_scope_for_module(admin, "incidencias", RH_UI_MODE_EMPLEADO) == "empleado"


@pytest.mark.asyncio
async def test_rol_rh_en_modo_empleado_conserva_modo(db: AsyncSession):
    rh = await make_empleado(
        db,
        rol="rh",
        email="ds_rh@leoni.test",
        puede_administrar_permisos_rh=False,
    )
    # Usuario rol "rh" en Modo Empleado ve solo lo suyo (no se eleva por módulo).
    assert effective_data_scope_for_module(rh, "incidencias", RH_UI_MODE_EMPLEADO) == "empleado"


@pytest.mark.asyncio
async def test_has_rh_plantilla_data_scope_module_aware(db: AsyncSession):
    """Patrón de enrutado (empleados): el grantee se enruta a la plantilla global."""
    grantee = await make_empleado(
        db,
        rol="supervisor",
        email="ds_plantilla@leoni.test",
        modulos_rh={"empleados": True},
        inscrito_modulos_rh=True,
    )
    assert has_rh_plantilla_data_scope(grantee, None, module_key="empleados") is True
    # Sin module_key conserva el comportamiento por rol (supervisor → directorio).
    assert has_rh_plantilla_data_scope(grantee, None) is False


@pytest.mark.asyncio
async def test_horas_extra_grantee_sin_restriccion(db: AsyncSession):
    """Patrón role-set 403 (nominas-horas-extra): el grantee no recibe 403 y ve global."""
    grantee = await make_empleado(
        db,
        rol="empleado",
        email="ds_he@leoni.test",
        modulos_rh={"nominas-horas-extra": True},
        inscrito_modulos_rh=True,
    )
    svc = HorasExtraService(db)
    svc._require_acceso(grantee, None)  # no levanta ForbiddenError
    assert await svc._ids_permitidos(grantee, None) is None  # sin restricción
