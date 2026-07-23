"""Tests del Motor de Evidencias de Capacitacion."""
import pytest

from app.core.exceptions import NotFoundError
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion_service import EvidenciaCapacitacionService
from tests.conftest import make_empleado


def test_derivar_sin_firmas_es_pendiente():
    assert derivar_estado_evidencia([]) == "pendiente"


def test_derivar_alguna_rechazada_es_devuelta():
    assert derivar_estado_evidencia(["firmada", "rechazada", "pendiente"]) == "devuelta"


def test_derivar_todas_firmadas_es_validada():
    assert derivar_estado_evidencia(["firmada", "firmada"]) == "validada"


def test_derivar_hay_pendientes_es_pendiente():
    assert derivar_estado_evidencia(["firmada", "pendiente"]) == "pendiente"


def test_schemas_existen():
    req = EvidenciaCrearRequest(tipo="documento", archivo_url="http://x/y.pdf", empleado_id=10)
    assert req.firmantes == []
    assert FirmarRequest(estado="firmada").comentario is None
    assert FirmanteAsignar(firmante_id=5, rol_firma="instructor").rol_firma == "instructor"
    assert "firmas" in EvidenciaConFirmasResponse.model_fields


# ── Service: gestion (RH) ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_evidencia_con_firmantes_pendiente(db):
    emp = await make_empleado(db)
    f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="documento", archivo_url="http://x/y.pdf", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="instructor")],
    ))
    assert ev.estado == "pendiente"
    assert ev.firmas_total == 1
    assert ev.firmas_firmadas == 0
    assert ev.firmas[0].rol_firma == "instructor"


@pytest.mark.asyncio
async def test_crear_empleado_inexistente_404(db):
    svc = EvidenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=999999))


@pytest.mark.asyncio
async def test_agregar_y_quitar_firmante(db):
    emp = await make_empleado(db)
    f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    ev2 = await svc.agregar_firmante(ev.id, FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe"))
    assert ev2.firmas_total == 1
    ev3 = await svc.quitar_firmante(ev2.firmas[0].id)
    assert ev3.firmas_total == 0


@pytest.mark.asyncio
async def test_actualizar_no_cambia_estado_a_mano(db):
    emp = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    ev2 = await svc.actualizar(ev.id, EvidenciaCapacitacionUpdate(estado="validada", notas="corregido"))
    assert ev2.notas == "corregido"
    assert ev2.estado == "pendiente"  # el estado es derivado, no se setea a mano
