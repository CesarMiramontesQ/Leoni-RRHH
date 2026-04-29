"""Estadísticas comedor: total_comidas (accesos) vs total_registros."""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


ESTADISTICAS_URL = "/api/v1/comedor/estadisticas"


@pytest.mark.asyncio
async def test_estadisticas_total_comidas_suma_accesos_activos(client: AsyncClient, db, monkeypatch):
    from app.models.comedor import (
        Comedor,
        ComedorAcceso,
        ComedorAccesoEstado,
        ComedorRegistro,
        ComedorTipoComida,
    )
    from app.services import comedor_service as cs

    monkeypatch.setattr(cs, "business_today", lambda: date(2026, 4, 23))

    comedor = Comedor(nombre="C stats", activo=True)
    db.add(comedor)
    await db.flush()

    emp = await make_empleado(db, email="emp_stats@test.leoni", password="SecretS!")
    rh = await make_empleado(db, rol="rh", email="rh_stats@test.leoni", password="RhStats!!")
    semana_lunes = date(2026, 4, 27)

    reg = ComedorRegistro(
        empleado_id=emp.id,
        comedor_id=comedor.id,
        semana=semana_lunes,
        tipo_platillo="normal",
        acceso_concedido=False,
    )
    db.add(reg)
    await db.flush()

    for fecha in (date(2026, 4, 28), date(2026, 4, 29)):
        db.add(
            ComedorAcceso(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                comedor_registro_id=reg.id,
                fecha_servicio=fecha,
                tipo_comida=ComedorTipoComida.casera,
                estado_acceso=ComedorAccesoEstado.PENDIENTE,
            )
        )
    await db.commit()

    hdrs = await auth_headers(client, rh, password="RhStats!!")
    r = await client.get(f"{ESTADISTICAS_URL}?semana=2026-04-27", headers=hdrs)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_registros"] == 1
    assert data["total_comidas"] == 2
