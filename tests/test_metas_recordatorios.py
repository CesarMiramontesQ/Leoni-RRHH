# tests/test_metas_recordatorios.py
"""Tests de recordatorios automaticos + endpoint manual (Tarea 5).

Cubre:
  - `MetasService.procesar_recordatorios()`: notifica a empleados con metas
    INDIVIDUALES no cerradas de un ciclo ACTIVO cuando el ciclo esta proximo
    a cerrar (`fecha_fin` dentro de `dias_cierre` dias) y/o algun resultado
    clave de la meta lleva `>= dias_sin_checkin` dias sin check-in.
  - `POST /ciclos/{id}/recordatorios`: fuerza recordatorio a TODOS los
    pendientes del ciclo, sin evaluar esas ventanas.

Sin sleeps: las fechas se manipulan directamente (fecha_fin del ciclo,
`created_at` de la meta/check-in) igual que
`tests/test_encuestas_rh_recordatorios.py`. `NotificacionService` no se
mockea con una libreria de mocks: el canal usado es "in_app", que solo
persiste una fila en `levelup_notificaciones` (sin SMTP), asi que se verifica
leyendo esa tabla directamente — mismo patron que los tests de recordatorios
de Encuestas RH / Eval360 ya existentes.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.metas import Meta, MetaCheckin, MetaResultadoClave
from app.models.notificaciones import Notificacion
from app.schemas.metas import MetaCicloCreate, MetaCreate, ResultadoClaveCreate
from app.services.metas_service import MetasService, _dt_utc
from tests.conftest import auth_headers, make_empleado

pytestmark = pytest.mark.asyncio

BASE = "/api/v1/metas"
MIS_METAS_TARGET_URL = "#/talento/mis-metas"


# ── Helpers ──────────────────────────────────────────────────────────────


async def _crear_ciclo_activo(service: MetasService, creador, fecha_fin: date, **overrides):
    data = MetaCicloCreate(
        nombre=overrides.pop("nombre", "Ciclo recordatorios"),
        descripcion=None,
        fecha_inicio=overrides.pop("fecha_inicio", date.today() - timedelta(days=30)),
        fecha_fin=fecha_fin,
        creado_por_id=creador.empleado_id,
    )
    ciclo = await service.crear_ciclo(data)
    return await service.activar_ciclo(ciclo.id)


def _rc_data(valor_actual=None) -> ResultadoClaveCreate:
    return ResultadoClaveCreate(
        orden=1,
        titulo="OPLs",
        tipo_metrica="numero",
        direccion="subir",
        valor_inicial=Decimal("0"),
        valor_objetivo=Decimal("8"),
        valor_actual=valor_actual,
    )


async def _crear_meta_individual(service: MetasService, ciclo_id: int, empleado, jefe):
    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="individual",
        empleado_id=empleado.empleado_id,
        titulo="Meta individual",
        peso=Decimal("100"),
        asignada_por_id=jefe.empleado_id,
        resultados_clave=[_rc_data()],
    )
    return await service.crear_meta(data)


async def _set_meta_created_at(db, meta_id: int, cuando: datetime) -> None:
    meta = await db.get(Meta, meta_id)
    meta.created_at = cuando
    await db.flush()


async def _set_ultimo_checkin_created_at(db, meta_id: int, cuando: datetime) -> None:
    """Ajusta el `created_at` del check-in mas reciente del (unico) RC de la
    meta — usado para simular "hace M dias" sin sleeps."""
    result = await db.execute(
        select(MetaCheckin)
        .join(MetaResultadoClave, MetaCheckin.resultado_clave_id == MetaResultadoClave.id)
        .where(MetaResultadoClave.meta_id == meta_id)
        .order_by(MetaCheckin.id.desc())
    )
    checkin = result.scalars().first()
    assert checkin is not None
    checkin.created_at = cuando
    await db.flush()


def _hace_dias(dias: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=dias)


async def _notificaciones_de(db, empleado_id: int) -> list[Notificacion]:
    result = await db.execute(
        select(Notificacion).where(Notificacion.user_id == empleado_id)
    )
    return list(result.scalars().all())


# ══════════════════════════════════════════════════════════════════════════
# procesar_recordatorios — ciclo proximo a cerrar
# ══════════════════════════════════════════════════════════════════════════
async def test_notifica_meta_de_ciclo_activo_proximo_a_cerrar(db):
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe1@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp1@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=2))
    await _crear_meta_individual(service, ciclo.id, empleado, jefe)

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1
    assert resultado.ciclos_por_cerrar == 1
    notifs = await _notificaciones_de(db, empleado.empleado_id)
    assert len(notifs) == 1
    assert notifs[0].target_url == MIS_METAS_TARGET_URL


async def test_no_notifica_si_ciclo_lejos_de_cerrar_y_checkin_reciente(db):
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe2@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp2@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=30))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    rc_id = meta.resultados_clave[0].id
    await service.registrar_checkin(rc_id, autor_id=empleado.empleado_id, valor=Decimal("2"))

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert resultado.ciclos_por_cerrar == 0
    assert await _notificaciones_de(db, empleado.empleado_id) == []


async def test_ciclos_por_cerrar_cuenta_aunque_no_haya_metas_pendientes(db):
    """Un ciclo proximo a cerrar sin metas pendientes (nunca se asigno
    ninguna) sigue contando en `ciclos_por_cerrar`, pero no notifica."""
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe3@leoni.test")
    service = MetasService(db)

    await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert resultado.ciclos_por_cerrar == 1


# ══════════════════════════════════════════════════════════════════════════
# procesar_recordatorios — RC sin check-in reciente
# ══════════════════════════════════════════════════════════════════════════
async def test_notifica_meta_con_rc_sin_checkin_desde_hace_m_dias(db):
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe4@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp4@leoni.test"
    )
    service = MetasService(db)

    # Ciclo lejos de cerrar: el UNICO motivo posible es el estancamiento.
    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=60))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    # Nunca hubo check-in: la referencia es `meta.created_at` -> se envejece.
    await _set_meta_created_at(db, meta.id, _hace_dias(8))

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1
    assert resultado.ciclos_por_cerrar == 0
    notifs = await _notificaciones_de(db, empleado.empleado_id)
    assert len(notifs) == 1


async def test_notifica_meta_con_checkin_viejo_pero_no_reciente(db):
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe5@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp5@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=60))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    rc_id = meta.resultados_clave[0].id
    await service.registrar_checkin(rc_id, autor_id=empleado.empleado_id, valor=Decimal("2"))
    await _set_ultimo_checkin_created_at(db, meta.id, _hace_dias(10))

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1


async def test_no_notifica_dos_veces_cuando_aplican_ambos_motivos(db):
    """Ciclo proximo a cerrar Y meta estancada -> un solo empleado notificado
    (un unico mensaje combinado), no dos notificaciones separadas."""
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe6@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp6@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    await _set_meta_created_at(db, meta.id, _hace_dias(8))

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1
    assert resultado.ciclos_por_cerrar == 1
    notifs = await _notificaciones_de(db, empleado.empleado_id)
    assert len(notifs) == 1


# ══════════════════════════════════════════════════════════════════════════
# procesar_recordatorios — metas/ciclos que NUNCA deben notificar
# ══════════════════════════════════════════════════════════════════════════
async def test_no_notifica_meta_cerrada(db):
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe7@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp7@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    await service.cerrar_meta(meta.id, calificacion=Decimal("90"), actor_id=jefe.empleado_id)

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert resultado.ciclos_por_cerrar == 1  # el ciclo si cuenta; la meta cerrada no notifica
    assert await _notificaciones_de(db, empleado.empleado_id) == []


async def test_no_notifica_metas_de_ciclo_no_activo(db):
    """Una meta de un ciclo que ya no esta "activo" (forzado directo a BD,
    fuera del flujo normal de `cerrar_ciclo`) nunca se considera: el job solo
    recorre `list_ciclos(estado="activo")`."""
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe8@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp8@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    await _crear_meta_individual(service, ciclo.id, empleado, jefe)

    from app.models.metas import MetaCiclo

    ciclo_obj = await db.get(MetaCiclo, ciclo.id)
    ciclo_obj.estado = "borrador"
    await db.flush()

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert resultado.ciclos_por_cerrar == 0
    assert await _notificaciones_de(db, empleado.empleado_id) == []


async def test_no_notifica_meta_de_equipo(db):
    """Solo metas nivel individual notifican (una meta de equipo no tiene
    `empleado_id`, no hay a quien notificar)."""
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe9@leoni.test")
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    data = MetaCreate(
        ciclo_id=ciclo.id,
        nivel="equipo",
        area_id=10,
        lider_id=jefe.empleado_id,
        titulo="Meta de equipo",
        peso=Decimal("100"),
        asignada_por_id=jefe.empleado_id,
        resultados_clave=[],
    )
    await service.crear_meta(data)

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert resultado.ciclos_por_cerrar == 1


# ══════════════════════════════════════════════════════════════════════════
# Endpoint manual — POST /ciclos/{id}/recordatorios
# ══════════════════════════════════════════════════════════════════════════
async def _rh(db, **kw):
    return await make_empleado(db, rol="rh", modulos_rh={"metas": True}, **kw)


async def test_endpoint_forzar_recordatorios_ignora_ventanas(client, db):
    rh = await _rh(db, email="mrec_rh1@leoni.test")
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe10@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp10@leoni.test"
    )
    service = MetasService(db)

    # Ciclo lejos de cerrar + check-in reciente: `procesar_recordatorios`
    # normal NO notificaria a nadie (ver test equivalente arriba).
    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=60))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    rc_id = meta.resultados_clave[0].id
    await service.registrar_checkin(rc_id, autor_id=empleado.empleado_id, valor=Decimal("2"))
    await db.commit()

    headers_rh = await auth_headers(client, rh)
    resp = await client.post(f"{BASE}/ciclos/{ciclo.id}/recordatorios", headers=headers_rh)

    assert resp.status_code == 200, resp.text
    assert resp.json()["notificados"] == 1

    notifs = await _notificaciones_de(db, empleado.empleado_id)
    assert len(notifs) == 1
    assert notifs[0].target_url == MIS_METAS_TARGET_URL

    # Forzar de nuevo: sigue notificando (no respeta cadencia/ventanas).
    resp2 = await client.post(f"{BASE}/ciclos/{ciclo.id}/recordatorios", headers=headers_rh)
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["notificados"] == 1
    assert len(await _notificaciones_de(db, empleado.empleado_id)) == 2


async def test_endpoint_forzar_recordatorios_actualiza_ultimo_recordatorio_at(client, db):
    """`forzar_recordatorios_ciclo` re-notifica aunque este dentro de la
    cadencia (`RECORDATORIO_CADENCIA_DIAS`) Y actualiza
    `ultimo_recordatorio_at` (fix post-revision, dedupe temporal)."""
    from app.models.metas import Meta as MetaModel

    rh = await _rh(db, email="mrec_rh4@leoni.test")
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe12@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp12@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=60))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    # Recordatorio reciente (dentro de la cadencia): el job automatico NO
    # volveria a notificar, pero el endpoint manual si debe hacerlo.
    meta_obj = await db.get(MetaModel, meta.id)
    meta_obj.ultimo_recordatorio_at = _hace_dias(1)
    await db.flush()
    await db.commit()

    headers_rh = await auth_headers(client, rh)
    resp = await client.post(f"{BASE}/ciclos/{ciclo.id}/recordatorios", headers=headers_rh)

    assert resp.status_code == 200, resp.text
    assert resp.json()["notificados"] == 1
    assert len(await _notificaciones_de(db, empleado.empleado_id)) == 1

    meta_refrescada = await db.get(MetaModel, meta.id)
    await db.refresh(meta_refrescada)
    assert meta_refrescada.ultimo_recordatorio_at is not None
    assert (datetime.now(timezone.utc) - _dt_utc(meta_refrescada.ultimo_recordatorio_at)) < timedelta(
        minutes=1
    )


# ══════════════════════════════════════════════════════════════════════════
# Dedupe temporal (fix post-revision) — cadencia RECORDATORIO_CADENCIA_DIAS
# ══════════════════════════════════════════════════════════════════════════
async def test_no_renotifica_meta_notificada_hoy(db):
    """Una meta con `ultimo_recordatorio_at` = ahora (recien notificada) NO
    se vuelve a notificar en la misma corrida/dia (dedupe de cadencia)."""
    from app.models.metas import Meta as MetaModel

    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe13@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp13@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    await _set_meta_created_at(db, meta.id, _hace_dias(8))  # tambien estancada

    meta_obj = await db.get(MetaModel, meta.id)
    meta_obj.ultimo_recordatorio_at = datetime.now(timezone.utc)
    await db.flush()

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 0
    assert await _notificaciones_de(db, empleado.empleado_id) == []


async def test_renotifica_meta_con_ultimo_recordatorio_fuera_de_cadencia(db):
    """Una meta con `ultimo_recordatorio_at` de hace >= cadencia dias SI se
    vuelve a notificar (la condicion original sigue vigente)."""
    from app.services.metas_service import RECORDATORIO_CADENCIA_DIAS
    from app.models.metas import Meta as MetaModel

    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe14@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp14@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)

    meta_obj = await db.get(MetaModel, meta.id)
    meta_obj.ultimo_recordatorio_at = _hace_dias(RECORDATORIO_CADENCIA_DIAS + 1)
    await db.flush()

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1
    notifs = await _notificaciones_de(db, empleado.empleado_id)
    assert len(notifs) == 1

    meta_refrescada = await db.get(MetaModel, meta.id)
    await db.refresh(meta_refrescada)
    assert meta_refrescada.ultimo_recordatorio_at is not None


async def test_notifica_meta_nunca_notificada_ultimo_recordatorio_null(db):
    """`ultimo_recordatorio_at` NULL (nunca notificada) SI entra: el dedupe
    de cadencia no bloquea el primer recordatorio."""
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe15@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp15@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=1))
    await _crear_meta_individual(service, ciclo.id, empleado, jefe)

    resultado = await service.procesar_recordatorios(dias_cierre=3, dias_sin_checkin=7)

    assert resultado.notificados == 1
    assert len(await _notificaciones_de(db, empleado.empleado_id)) == 1


async def test_endpoint_forzar_recordatorios_404_si_ciclo_no_existe(client, db):
    rh = await _rh(db, email="mrec_rh2@leoni.test")
    headers_rh = await auth_headers(client, rh)

    resp = await client.post(f"{BASE}/ciclos/999999/recordatorios", headers=headers_rh)

    assert resp.status_code == 404


async def test_endpoint_forzar_recordatorios_no_notifica_metas_cerradas(client, db):
    rh = await _rh(db, email="mrec_rh3@leoni.test")
    jefe = await make_empleado(db, rol="supervisor", email="mrec_jefe11@leoni.test")
    empleado = await make_empleado(
        db, rol="empleado", lider_id=jefe.empleado_id, email="mrec_emp11@leoni.test"
    )
    service = MetasService(db)

    ciclo = await _crear_ciclo_activo(service, jefe, fecha_fin=date.today() + timedelta(days=60))
    meta = await _crear_meta_individual(service, ciclo.id, empleado, jefe)
    await service.cerrar_meta(meta.id, calificacion=Decimal("80"), actor_id=jefe.empleado_id)
    await db.commit()

    headers_rh = await auth_headers(client, rh)
    resp = await client.post(f"{BASE}/ciclos/{ciclo.id}/recordatorios", headers=headers_rh)

    assert resp.status_code == 200, resp.text
    assert resp.json()["notificados"] == 0
    assert await _notificaciones_de(db, empleado.empleado_id) == []
