from sqlalchemy import select

from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.auditoria import AuditLog
from tests.conftest import auth_headers, make_empleado


async def _crear_acta_base(db, *, empleado_id: int, generado_por: int, estado: str = "draft"):
    acta = ActaAdministrativa(
        empleado_id=empleado_id,
        generado_por=generado_por,
        estado=estado,
        descripcion_hechos="Hechos de prueba",
        tipo_falta="Falta de prueba",
    )
    db.add(acta)
    await db.flush()
    await db.refresh(acta)
    return acta


async def test_rh_puede_aprobar_acta_y_genera_log(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_acta_aprueba@leoni.test", nombre="RH Aprobador")
    empleado = await make_empleado(db, rol="empleado", email="emp_acta_aprueba@leoni.test")
    acta = await _crear_acta_base(db, empleado_id=empleado.id, generado_por=rh.id)
    headers = await auth_headers(client, rh)

    response = await client.put(f"/api/v1/actas/{acta.id}/aprobar", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == acta.id
    assert body["estado"] == "archived"

    result_acta = await db.execute(select(ActaAdministrativa).where(ActaAdministrativa.id == acta.id))
    acta_db = result_acta.scalar_one()
    assert acta_db.estado == "archived"

    result_aprobacion = await db.execute(
        select(ActaAprobacion).where(
            ActaAprobacion.acta_id == acta.id,
            ActaAprobacion.firmante_id == rh.id,
        )
    )
    aprobacion = result_aprobacion.scalar_one()
    assert aprobacion.rol_firmante == "rh"
    assert aprobacion.firma_timestamp is not None

    result_log = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.accion == "ACTA_APPROVED",
            AuditLog.entidad_id == acta.id,
        )
        .order_by(AuditLog.id.desc())
    )
    log = result_log.scalar_one_or_none()
    assert log is not None
    assert log.usuario_id == rh.id
    assert log.datos_despues is not None
    assert log.datos_despues["accion"] == "Aprobación de acta"
    assert log.datos_despues["aprobador_id"] == rh.id
    assert log.datos_despues["aprobador_nombre"] == "RH Aprobador"
    assert log.datos_despues["rol"] == "rh"
    assert log.datos_despues["estado"] == "archived"


async def test_no_rh_no_puede_aprobar_acta(client, db):
    supervisor = await make_empleado(db, rol="supervisor", email="sup_acta_aprueba@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_acta_noaprueba@leoni.test")
    acta = await _crear_acta_base(db, empleado_id=empleado.id, generado_por=supervisor.id)
    headers = await auth_headers(client, supervisor)

    response = await client.put(f"/api/v1/actas/{acta.id}/aprobar", headers=headers)

    assert response.status_code == 403


async def test_no_permite_reaprobar_acta_ya_aprobada(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_reaprobacion@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_reaprobacion@leoni.test")
    acta = await _crear_acta_base(db, empleado_id=empleado.id, generado_por=rh.id, estado="archived")
    headers = await auth_headers(client, rh)

    response = await client.put(f"/api/v1/actas/{acta.id}/aprobar", headers=headers)

    assert response.status_code == 409


async def test_no_permite_modificar_ia_si_acta_esta_cerrada(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_ia_cerrada@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_ia_cerrada@leoni.test")
    acta = await _crear_acta_base(db, empleado_id=empleado.id, generado_por=rh.id, estado="archived")
    headers = await auth_headers(client, rh)

    response = await client.post(f"/api/v1/actas/{acta.id}/mejorar-ia", headers=headers)

    assert response.status_code == 409
