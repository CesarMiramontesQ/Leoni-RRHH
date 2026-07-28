# tests/test_perfil_tareas_competencias.py
"""
Fase 3 de la refactorizacion WTW: responsabilidades del puesto (categoria,
prioridad, frecuencia, % de dedicacion) y evidencia en las competencias.

Nada de esto implementa reglas automaticas: son datos que RH captura y que
despues alimentaran el analisis del puesto.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    ensure_metodos_calificacion_competencia,
    get_default_grado,
    make_categoria_tarea,
    make_competencia,
    make_grados_consecutivos,
    make_puesto_perfil,
)


async def _perfil(db, nombre: str):
    await ensure_metodos_calificacion_competencia(db)
    return await make_puesto_perfil(db, nombre=nombre)


# ── Tareas: categoria, prioridad, frecuencia y % ─────────────────────────────


@pytest.mark.asyncio
async def test_crear_tarea_con_todos_los_atributos(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pt_full@leoni.test")
    perfil = await _perfil(db, "Perfil Tareas Full")
    categoria = await make_categoria_tarea(db, nombre="Operativa")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={
            "orden": 1,
            "descripcion": "Optimizar procesos de la linea",
            "categoria_tarea_id": categoria.id,
            "prioridad": "alta",
            "frecuencia": "semanal",
            "porcentaje_dedicacion": 25,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["categoria_tarea_id"] == categoria.id
    assert body["categoria_tarea_nombre"] == "Operativa"
    assert body["prioridad"] == "alta"
    assert body["frecuencia"] == "semanal"
    assert body["porcentaje_dedicacion"] == 25


@pytest.mark.asyncio
async def test_tarea_sin_atributos_opcionales_sigue_funcionando(
    client: AsyncClient, db
):
    """Los campos nuevos son opcionales: el alta minima no cambia."""
    rh = await make_empleado(db, rol="rh", email="pt_min@leoni.test")
    perfil = await _perfil(db, "Perfil Tarea Minima")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={"orden": 1, "descripcion": "Tarea sin atributos"},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["prioridad"] is None
    assert body["frecuencia"] is None
    assert body["porcentaje_dedicacion"] is None
    assert body["categoria_tarea_id"] is None


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("prioridad", "urgentisima"),
        ("frecuencia", "cada_luna_llena"),
        ("porcentaje_dedicacion", 101),
        ("porcentaje_dedicacion", -1),
    ],
)
@pytest.mark.asyncio
async def test_valores_invalidos_rechazados(client: AsyncClient, db, campo, valor):
    rh = await make_empleado(db, rol="rh", email=f"pt_inv_{campo}_{valor}@leoni.test")
    perfil = await _perfil(db, f"Perfil Invalido {campo} {valor}")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={"orden": 1, "descripcion": "Tarea invalida", campo: valor},
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_actualizar_atributos_de_tarea(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pt_upd@leoni.test")
    perfil = await _perfil(db, "Perfil Tarea Update")
    categoria = await make_categoria_tarea(db, nombre="Estrategica")
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={"orden": 1, "descripcion": "Tarea a modificar", "prioridad": "baja"},
        headers=headers,
    )
    tarea_id = creada.json()["id"]

    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/tareas/{tarea_id}",
        json={
            "prioridad": "alta",
            "frecuencia": "mensual",
            "porcentaje_dedicacion": 40,
            "categoria_tarea_id": categoria.id,
        },
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["prioridad"] == "alta"
    assert body["frecuencia"] == "mensual"
    assert body["porcentaje_dedicacion"] == 40
    assert body["categoria_tarea_nombre"] == "Estrategica"


@pytest.mark.asyncio
async def test_quitar_la_categoria_con_null_explicito(client: AsyncClient, db):
    """null quita la categoria; omitir el campo la deja como esta."""
    rh = await make_empleado(db, rol="rh", email="pt_null@leoni.test")
    perfil = await _perfil(db, "Perfil Tarea Null")
    categoria = await make_categoria_tarea(db, nombre="Temporal")
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={
            "orden": 1,
            "descripcion": "Tarea con categoria",
            "categoria_tarea_id": categoria.id,
        },
        headers=headers,
    )
    tarea_id = creada.json()["id"]

    # Omitir el campo no la toca.
    sin_tocar = await client.put(
        f"/api/v1/perfiles/{perfil.id}/tareas/{tarea_id}",
        json={"prioridad": "media"},
        headers=headers,
    )
    assert sin_tocar.json()["categoria_tarea_id"] == categoria.id

    # Null explicito la quita.
    quitada = await client.put(
        f"/api/v1/perfiles/{perfil.id}/tareas/{tarea_id}",
        json={"categoria_tarea_id": None},
        headers=headers,
    )
    assert quitada.status_code == 200, quitada.text
    assert quitada.json()["categoria_tarea_id"] is None


@pytest.mark.asyncio
async def test_categoria_inactiva_no_se_puede_asignar(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pt_cat_off@leoni.test")
    perfil = await _perfil(db, "Perfil Categoria Inactiva")
    categoria = await make_categoria_tarea(db, nombre="Retirada", activo=False)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={
            "orden": 1,
            "descripcion": "Tarea con categoria muerta",
            "categoria_tarea_id": categoria.id,
        },
        headers=headers,
    )

    assert response.status_code in (400, 404, 422)


# ── Resumen de dedicacion ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_resumen_dedicacion_suma_por_alcance(client: AsyncClient, db):
    """
    El total de un career level incluye las tareas generales.

    Una tarea general la ejecuta también ese nivel, así que cuenta para su carga.
    """
    rh = await make_empleado(db, rol="rh", email="pt_ded@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2])
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Dedicacion", grado_ids=[g.id for g in grados]
    )
    headers = await auth_headers(client, rh)

    async def crear(descripcion, porcentaje, grado_id=None):
        payload = {"orden": 1, "descripcion": descripcion}
        if porcentaje is not None:
            payload["porcentaje_dedicacion"] = porcentaje
        if grado_id is not None:
            payload["grado_id"] = grado_id
        r = await client.post(
            f"/api/v1/perfiles/{perfil.id}/tareas", json=payload, headers=headers
        )
        assert r.status_code == 201, r.text

    await crear("General 30", 30)
    await crear("Especifica G1 50", 50, grados[0].id)
    await crear("Especifica G1 sin porcentaje", None, grados[0].id)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas/dedicacion", headers=headers
    )

    assert response.status_code == 200, response.text
    resumenes = {
        (r["grado_id"] if not r["es_general"] else "general"): r
        for r in response.json()
    }

    general = resumenes["general"]
    assert general["total_porcentaje"] == 30
    assert general["tareas_con_porcentaje"] == 1

    nivel1 = resumenes[grados[0].id]
    assert nivel1["total_porcentaje"] == 80  # 50 propia + 30 general
    assert nivel1["tareas_sin_porcentaje"] == 1


@pytest.mark.asyncio
async def test_resumen_dedicacion_no_bloquea_cuando_no_suma_100(
    client: AsyncClient, db
):
    """La suma distinta de 100% es informativa, no un error."""
    rh = await make_empleado(db, rol="rh", email="pt_ded_libre@leoni.test")
    perfil = await _perfil(db, "Perfil Dedicacion Libre")
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json={"orden": 1, "descripcion": "Solo el 10%", "porcentaje_dedicacion": 10},
        headers=headers,
    )
    assert creada.status_code == 201, creada.text

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas/dedicacion", headers=headers
    )
    assert response.status_code == 200
    general = next(r for r in response.json() if r["es_general"])
    assert general["total_porcentaje"] == 10


# ── Evidencia en competencias ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_competencia_con_evidencia(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pc_evid@leoni.test")
    perfil = await _perfil(db, "Perfil Evidencia")
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="Excel avanzado", categoria="tecnica")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={
            "competencia_id": comp.id,
            "grado_id": grado.id,
            "nivel_requerido": 3,
            "evidencia": "Certificado interno vigente",
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["evidencia"] == "Certificado interno vigente"


@pytest.mark.asyncio
async def test_evidencia_es_opcional(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pc_evid_opt@leoni.test")
    perfil = await _perfil(db, "Perfil Evidencia Opcional")
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="Trabajo en equipo", categoria="blanda")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={"competencia_id": comp.id, "grado_id": grado.id, "nivel_requerido": 2},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    assert response.json()["evidencia"] is None


@pytest.mark.asyncio
async def test_actualizar_evidencia_de_competencia(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pc_evid_upd@leoni.test")
    perfil = await _perfil(db, "Perfil Evidencia Update")
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="SPC", categoria="tecnica")
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={
            "competencia_id": comp.id,
            "grado_id": grado.id,
            "nivel_requerido": 2,
            "evidencia": "Evidencia original",
        },
        headers=headers,
    )
    requisito_id = creada.json()["id"]

    response = await client.patch(
        f"/api/v1/perfiles/{perfil.id}/competencias/{requisito_id}",
        json={"nivel_requerido": 3, "evidencia": "Evidencia corregida"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["nivel_requerido"] == 3
    assert body["evidencia"] == "Evidencia corregida"


@pytest.mark.asyncio
async def test_sync_no_borra_la_evidencia_capturada(client: AsyncClient, db):
    """
    Un sync que no manda evidencia conserva la que RH ya había capturado.

    El sync existe para ajustar niveles en bloque; no debería tirar el trabajo
    de captura por omitir un campo opcional.
    """
    rh = await make_empleado(db, rol="rh", email="pc_evid_sync@leoni.test")
    perfil = await _perfil(db, "Perfil Evidencia Sync")
    grado = await get_default_grado(db)
    comp = await make_competencia(db, nombre="Lean", categoria="tecnica")
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json={
            "competencia_id": comp.id,
            "grado_id": grado.id,
            "nivel_requerido": 2,
            "evidencia": "No me borres",
        },
        headers=headers,
    )
    assert creada.status_code == 201, creada.text

    sync = await client.put(
        f"/api/v1/perfiles/{perfil.id}/competencias/sync",
        json={
            "grado_id": grado.id,
            "tipo_competencia_id": comp.tipo_competencia_id,
            "competencias": [{"competencia_id": comp.id, "nivel_requerido": 4}],
        },
        headers=headers,
    )
    assert sync.status_code == 200, sync.text

    item = next(c for c in sync.json() if c["competencia_id"] == comp.id)
    assert item["nivel_requerido"] == 4
    assert item["evidencia"] == "No me borres"
