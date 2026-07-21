# tests/test_encuestas_rh_recordatorios.py
"""Tests de recordatorios automaticos + cierre automatico (Tarea 5).

Cubre:
  - `EncuestasRhService.procesar_recordatorios()`: cierra encuestas vencidas
    (reusa `procesar_cierres_vencidos`) y notifica a participantes pendientes
    respetando la cadencia `recordatorio_cada_dias`.
  - `POST /encuestas/{id}/recordatorios`: fuerza recordatorio a TODOS los
    pendientes sin respetar la cadencia; 409 si la encuesta no esta publicada.

Patron de fixtures / helpers tomado de test_encuestas_rh_service.py (Tarea 2)
y test_encuestas_rh_api.py (Tarea 3): sesion SQLite in-memory (`db`), cliente
HTTP (`client`), `make_empleado`/`auth_headers` de tests/conftest.py.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.exceptions import ConflictError
from app.models.encuestas_rh import Encuesta, EncuestaParticipante
from app.models.notificaciones import Notificacion
from app.schemas.encuestas_rh import (
    AudienciaFiltros,
    EncuestaCreate,
    PreguntaCreate,
    PublicarRequest,
)
from app.services.encuestas_rh_service import EncuestasRhService
from tests.conftest import auth_headers, make_empleado

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/encuestas-rh"


# ── Helpers ──────────────────────────────────────────────────────────────


def _pregunta_likert(orden=1, texto="Pregunta likert"):
    return PreguntaCreate(orden=orden, tipo="likert", texto=texto, requerida=True)


async def _crear_y_publicar(
    service: EncuestasRhService,
    creador,
    filtros: AudienciaFiltros,
    recordatorio_cada_dias: int = 3,
    dias_cierre: int = 7,
):
    data = EncuestaCreate(
        titulo="Encuesta de prueba",
        tipo="clima",
        es_anonima=False,
        creado_por_id=creador.empleado_id,
        recordatorio_cada_dias=recordatorio_cada_dias,
        preguntas=[_pregunta_likert()],
    )
    encuesta = await service.crear_encuesta(data)
    return await service.publicar_encuesta(
        encuesta.id,
        PublicarRequest(
            filtros=filtros,
            fecha_cierre_programada=date.today() + timedelta(days=dias_cierre),
        ),
    )


async def _get_participante(db, encuesta_id: int, empleado_id: int) -> EncuestaParticipante:
    result = await db.execute(
        select(EncuestaParticipante).where(
            EncuestaParticipante.encuesta_id == encuesta_id,
            EncuestaParticipante.empleado_id == empleado_id,
        )
    )
    return result.scalar_one()


def _hace_dias(dias: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=dias)


# ══════════════════════════════════════════════════════════════════════════
# procesar_recordatorios — cierre automatico
# ══════════════════════════════════════════════════════════════════════════
async def test_procesar_recordatorios_cierra_encuestas_vencidas(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(service, creador, AudienciaFiltros(roles=["empleado"]))
    encuesta_obj = await db.get(Encuesta, publicada.id)
    encuesta_obj.fecha_cierre_programada = date.today() - timedelta(days=1)
    await db.flush()

    resultado = await service.procesar_recordatorios()

    assert resultado.encuestas_cerradas == 1
    refrescada = await service.obtener_encuesta(publicada.id)
    assert refrescada.estado == "cerrada"


# ══════════════════════════════════════════════════════════════════════════
# procesar_recordatorios — cadencia de recordatorios
# ══════════════════════════════════════════════════════════════════════════
async def test_procesar_recordatorios_respeta_cadencia_no_toca_reciente(db):
    """ultimo_recordatorio_at hace menos dias que la cadencia -> NO recibe."""
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(
        service, creador, AudienciaFiltros(roles=["empleado"]), recordatorio_cada_dias=3
    )
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    participante.ultimo_recordatorio_at = _hace_dias(1)
    participante.recordatorios_enviados = 1
    await db.flush()

    resultado = await service.procesar_recordatorios()

    assert resultado.recordatorios_enviados == 0
    await db.refresh(participante)
    assert participante.recordatorios_enviados == 1


async def test_procesar_recordatorios_respeta_cadencia_toca_vencido(db):
    """ultimo_recordatorio_at hace >= dias que la cadencia -> SI recibe."""
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(
        service, creador, AudienciaFiltros(roles=["empleado"]), recordatorio_cada_dias=3
    )
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    participante.ultimo_recordatorio_at = _hace_dias(3)
    participante.recordatorios_enviados = 1
    await db.flush()

    resultado = await service.procesar_recordatorios()

    assert resultado.recordatorios_enviados == 1
    await db.refresh(participante)
    assert participante.recordatorios_enviados == 2
    ultimo = participante.ultimo_recordatorio_at
    if ultimo.tzinfo is None:
        ultimo = ultimo.replace(tzinfo=timezone.utc)
    assert ultimo > _hace_dias(1)

    result = await db.execute(
        select(Notificacion).where(Notificacion.user_id == empleado.empleado_id)
    )
    notifs = result.scalars().all()
    assert any(n.target_url == "#/talento/mis-encuestas" for n in notifs)


async def test_procesar_recordatorios_pendiente_nunca_recordado_notificado_at_viejo(db):
    """ultimo_recordatorio_at NULL + notificado_at viejo (>= cadencia) -> SI recibe."""
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(
        service, creador, AudienciaFiltros(roles=["empleado"]), recordatorio_cada_dias=3
    )
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    assert participante.ultimo_recordatorio_at is None
    participante.notificado_at = _hace_dias(5)
    await db.flush()

    resultado = await service.procesar_recordatorios()

    assert resultado.recordatorios_enviados == 1
    await db.refresh(participante)
    assert participante.recordatorios_enviados == 1
    assert participante.ultimo_recordatorio_at is not None


async def test_procesar_recordatorios_pendiente_notificado_at_reciente_no_recibe(db):
    """ultimo_recordatorio_at NULL + notificado_at reciente (< cadencia) -> NO recibe."""
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(
        service, creador, AudienciaFiltros(roles=["empleado"]), recordatorio_cada_dias=3
    )
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    # notificado_at ya viene poblado por publicar_encuesta (recien materializado).
    assert participante.notificado_at is not None

    resultado = await service.procesar_recordatorios()

    assert resultado.recordatorios_enviados == 0


async def test_procesar_recordatorios_no_notifica_respondida(db):
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(
        service, creador, AudienciaFiltros(roles=["empleado"]), recordatorio_cada_dias=3
    )
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    participante.estado = "respondida"
    participante.notificado_at = _hace_dias(30)
    await db.flush()

    resultado = await service.procesar_recordatorios()

    assert resultado.recordatorios_enviados == 0
    await db.refresh(participante)
    assert participante.recordatorios_enviados == 0
    assert participante.ultimo_recordatorio_at is None


# ══════════════════════════════════════════════════════════════════════════
# Endpoint manual — POST /encuestas/{id}/recordatorios
# ══════════════════════════════════════════════════════════════════════════
async def test_endpoint_forzar_recordatorios_ignora_cadencia(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rec_rh1@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="encrh_rec_emp1@leoni.test")
    headers = await auth_headers(client, rh)

    resp = await client.post(
        f"{BASE}/encuestas",
        json={
            "titulo": "Encuesta recordatorios",
            "tipo": "clima",
            "es_anonima": False,
            "recordatorio_cada_dias": 30,
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    encuesta_id = resp.json()["id"]

    resp_p = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/preguntas",
        json={"orden": 1, "tipo": "likert", "texto": "Pregunta", "requerida": True},
        headers=headers,
    )
    assert resp_p.status_code == 201, resp_p.text

    resp_pub = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/publicar",
        json={
            "filtros": {"roles": ["empleado"]},
            "fecha_cierre_programada": (date.today() + timedelta(days=7)).isoformat(),
        },
        headers=headers,
    )
    assert resp_pub.status_code == 200, resp_pub.text

    # Recien materializado: notificado_at es reciente (< cadencia de 30 dias),
    # por lo que procesar_recordatorios() normal NO lo tocaria.
    resp_forzar = await client.post(f"{BASE}/encuestas/{encuesta_id}/recordatorios", headers=headers)
    assert resp_forzar.status_code == 200, resp_forzar.text
    assert resp_forzar.json()["recordatorios_enviados"] == 1

    participante = await _get_participante(db, encuesta_id, empleado.empleado_id)
    assert participante.recordatorios_enviados == 1
    assert participante.ultimo_recordatorio_at is not None

    # Forzar de nuevo: sigue enviando (no respeta cadencia).
    resp_forzar_2 = await client.post(
        f"{BASE}/encuestas/{encuesta_id}/recordatorios", headers=headers
    )
    assert resp_forzar_2.status_code == 200
    assert resp_forzar_2.json()["recordatorios_enviados"] == 1
    await db.refresh(participante)
    assert participante.recordatorios_enviados == 2


async def test_endpoint_forzar_recordatorios_404_si_no_existe(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rec_rh2@leoni.test")
    headers = await auth_headers(client, rh)
    resp = await client.post(f"{BASE}/encuestas/999999/recordatorios", headers=headers)
    assert resp.status_code == 404


async def test_endpoint_forzar_recordatorios_409_si_borrador(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rec_rh3@leoni.test")
    headers = await auth_headers(client, rh)
    resp = await client.post(
        f"{BASE}/encuestas",
        json={"titulo": "Encuesta borrador", "tipo": "clima", "es_anonima": False},
        headers=headers,
    )
    assert resp.status_code == 201, resp.text
    encuesta_id = resp.json()["id"]

    resp_forzar = await client.post(f"{BASE}/encuestas/{encuesta_id}/recordatorios", headers=headers)
    assert resp_forzar.status_code == 409, resp_forzar.text


async def test_endpoint_forzar_recordatorios_409_si_cerrada(client, db):
    rh = await make_empleado(db, rol="rh", email="encrh_rec_rh4@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="encrh_rec_emp4@leoni.test")
    service = EncuestasRhService(db)
    publicada = await _crear_y_publicar(service, rh, AudienciaFiltros(roles=["empleado"]))
    await service.cerrar_encuesta(publicada.id)

    headers = await auth_headers(client, rh)
    resp = await client.post(f"{BASE}/encuestas/{publicada.id}/recordatorios", headers=headers)
    assert resp.status_code == 409, resp.text


async def test_service_forzar_recordatorios_solo_pendientes(db):
    """El endpoint/service solo notifica a pendientes; respondida no recibe."""
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)

    publicada = await _crear_y_publicar(service, creador, AudienciaFiltros(roles=["empleado"]))
    participante = await _get_participante(db, publicada.id, empleado.empleado_id)
    participante.estado = "respondida"
    await db.flush()

    enviados = await service.forzar_recordatorios(publicada.id)

    assert enviados == 0
