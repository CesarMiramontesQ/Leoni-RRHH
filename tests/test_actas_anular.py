from sqlalchemy import select

from app.models.actas import ActaAdministrativa
from tests.conftest import auth_headers, make_empleado


async def _crear_acta(db, *, empleado_id: int, generado_por: int, estado: str = "pending_sign"):
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


async def test_rh_anula_acta_pending_sign(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_anula@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_anula@leoni.test")
    acta = await _crear_acta(db, empleado_id=empleado.id, generado_por=rh.id)
    headers = await auth_headers(client, rh)

    response = await client.put(f"/api/v1/actas/{acta.id}/anular", headers=headers, json={"motivo": "Prueba"})

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == acta.id
    assert body["estado"] == "cancelled"

    result = await db.execute(select(ActaAdministrativa).where(ActaAdministrativa.id == acta.id))
    assert result.scalar_one().estado == "cancelled"


async def test_no_anula_acta_ya_archivada(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_no_anula_arch@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_no_anula_arch@leoni.test")
    acta = await _crear_acta(db, empleado_id=empleado.id, generado_por=rh.id, estado="archived")
    headers = await auth_headers(client, rh)

    response = await client.put(f"/api/v1/actas/{acta.id}/anular", headers=headers, json={})

    assert response.status_code == 409


async def test_no_aprobar_acta_anulada(client, db):
    rh = await make_empleado(db, rol="rh", email="rh_apruebe_anul@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_apruebe_anul@leoni.test")
    acta = await _crear_acta(db, empleado_id=empleado.id, generado_por=rh.id, estado="cancelled")
    headers = await auth_headers(client, rh)

    response = await client.put(f"/api/v1/actas/{acta.id}/aprobar", headers=headers)

    assert response.status_code == 409
