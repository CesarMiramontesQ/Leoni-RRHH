"""Fecha de ingreso en Vista 360, leída de la caché en Bono (`levelup_empleados_tress`).

Antes se consultaba `dbo.COLABORA.CB_FEC_ING` en vivo por ODBC en cada apertura del
detalle. Ahora la escribe el sync de las 04:10 y aquí solo se siembra la fila.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_empleado_tress


@pytest.mark.asyncio
async def test_vista360_incluye_fecha_ingreso_de_la_cache(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="fi-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-emp@test")
    await make_empleado_tress(db, no_empleado=emp.no_empleado, fecha_ingreso=date(2019, 3, 15))
    await db.commit()
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] == "2019-03-15"


@pytest.mark.asyncio
async def test_vista360_fecha_ingreso_null_sin_fila_en_cache(client: AsyncClient, db):
    """Empleado no sincronizado: la Vista 360 sigue en 200 y el campo viaja como null.

    Es la misma degradación que había ante un fallo de la BD externa: este dato nunca
    debe romper el detalle.
    """
    rh = await make_empleado(db, rol="rh", email="fi-null-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-null-emp@test")
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] is None


@pytest.mark.asyncio
async def test_vista360_no_abre_conexion_a_datos_analisis(client: AsyncClient, db, monkeypatch):
    """Regresión del objetivo del cambio: la Vista 360 no debe tocar SQL Server.

    Si alguien reintroduce la lectura en vivo, `create_read_engine` explota y el test cae.
    """
    from app.integrations import datos_analisis_db

    def _prohibido(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("La Vista 360 no debe abrir un engine a datos-analisis")

    monkeypatch.setattr(
        datos_analisis_db.DatosAnalisisReadClient, "create_read_engine", _prohibido
    )

    rh = await make_empleado(db, rol="rh", email="fi-noodbc-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-noodbc-emp@test")
    await make_empleado_tress(db, no_empleado=emp.no_empleado, fecha_ingreso=date(2021, 7, 1))
    await db.commit()
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] == "2021-07-01"
