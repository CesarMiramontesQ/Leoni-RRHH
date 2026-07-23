"""Tests del modulo Manejo de OPLs."""
import pytest

from app.core.exceptions import ConflictError, NotFoundError
from app.schemas.level_up import (
    OPLConVersionesResponse,
    OPLCreate,
    OPLUpdate,
    OPLVersionAgregar,
    OPLVersionItem,
)
from app.services.opl_service import OPLService
from tests.conftest import make_empleado


def test_schemas_opl_existen():
    assert "versiones" in OPLConVersionesResponse.model_fields
    assert "version_actual" in OPLConVersionesResponse.model_fields
    assert "total_versiones" in OPLConVersionesResponse.model_fields
    assert "aprobador_nombre" in OPLConVersionesResponse.model_fields
    v = OPLVersionAgregar(archivo_url="http://x/y.pdf")
    assert v.cambios_descripcion is None
    assert "creado_por_nombre" in OPLVersionItem.model_fields


@pytest.mark.asyncio
async def test_crear_opl_borrador(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-001", titulo="Cambio de dado"))
    assert opl.estado_aprobacion == "borrador"
    assert opl.total_versiones == 0


@pytest.mark.asyncio
async def test_crear_codigo_duplicado_409(db):
    svc = OPLService(db)
    await svc.crear(OPLCreate(codigo="OPL-DUP", titulo="Aa"))
    with pytest.raises(ConflictError):
        await svc.crear(OPLCreate(codigo="OPL-DUP", titulo="Bb"))


@pytest.mark.asyncio
async def test_agregar_version_autoincrementa_y_resetea(db):
    autor = await make_empleado(db)
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-V", titulo="Aa"))
    o1 = await svc.agregar_version(opl.id, OPLVersionAgregar(archivo_url="http://x/1.pdf"), autor.empleado_id)
    o2 = await svc.agregar_version(opl.id, OPLVersionAgregar(archivo_url="http://x/2.pdf"), autor.empleado_id)
    assert o1.total_versiones == 1
    assert o2.total_versiones == 2
    assert [v.version_num for v in o2.versiones] == [2, 1]  # desc
    assert o2.version_actual.version_num == 2
    assert o2.estado_aprobacion == "borrador"


@pytest.mark.asyncio
async def test_actualizar_no_cambia_estado(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-U", titulo="Aa"))
    upd = await svc.actualizar(opl.id, OPLUpdate(titulo="Bb", estado_aprobacion="aprobada"))
    assert upd.titulo == "Bb"
    assert upd.estado_aprobacion == "borrador"  # el estado no se toca a mano


@pytest.mark.asyncio
async def test_crear_aprobador_inexistente_404(db):
    svc = OPLService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(OPLCreate(codigo="OPL-AP", titulo="Aa", aprobador_id=999999))


@pytest.mark.asyncio
async def test_eliminar(db):
    svc = OPLService(db)
    opl = await svc.crear(OPLCreate(codigo="OPL-DEL", titulo="Aa"))
    await svc.eliminar(opl.id)
    with pytest.raises(NotFoundError):
        await svc.obtener(opl.id)
