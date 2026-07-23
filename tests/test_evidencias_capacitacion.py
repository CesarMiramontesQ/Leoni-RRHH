"""Tests del Motor de Evidencias de Capacitacion."""
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia
from app.schemas.level_up import (
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)


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
