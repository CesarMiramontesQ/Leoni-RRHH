"""POST /api/v1/actas — alta desde formulario RH."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado

PAYLOAD = {
    "empleado_id": 0,
    "numero_empleado": "0",
    "area_departamento": "Producción",
    "supervisor_directo": "SUPERVISOR TEST",
    "tipo_falta": "Falta administrativa leve",
    "fundamento_legal": "Reglamento Interior de Trabajo",
    "articulo_inciso": "Art. 42",
    "fecha_evento": "2026-05-10",
    "lugar_incidente": "Planta",
    "descripcion_hechos": "Descripción de hechos de prueba.",
    "personas_involucradas": None,
    "testigos": "Testigo A",
    "responsable_rh": "rh-responsable",
    "evidencia": None,
}


@pytest.mark.asyncio
async def test_create_acta_desde_formulario_retorna_201(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_acta_create@test.leoni")
    emp = await make_empleado(
        db,
        rol="empleado",
        email="emp_acta_create@test.leoni",
        no_empleado=1259,
    )
    headers = await auth_headers(client, rh)
    body = {
        **PAYLOAD,
        "empleado_id": emp.id,
        "numero_empleado": str(emp.no_empleado),
    }

    response = await client.post("/api/v1/actas", json=body, headers=headers)

    assert response.status_code == 201, response.text
    data = response.json()
    assert data["empleado_id"] == emp.id
    assert data["numero_empleado"] == str(emp.no_empleado)
    assert data["estado"] == "pending_sign"
