# tests/test_global_grade.py
"""
Tests del Global Grade: catalogo, equivalencias Global Level ↔ Global Grade,
autocompletado en el perfil e historial de clasificacion.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_area,
    make_clasificacion_payload,
    make_disciplina_puesto,
    make_equivalencia,
    make_funcion_puesto,
    make_global_grade,
    make_grados_consecutivos,
    make_puesto_perfil,
)

BASE = "/api/v1/clasificacion-puesto"


# ── Catalogo de Global Grades ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_global_grade_success(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="gg_crear@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/global-grades",
        json={
            "codigo": "GG10",
            "nombre": "Global Grade 10",
            "descripcion": "Clasificacion organizacional",
            "orden": 10,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["codigo"] == "GG10"
    assert body["orden"] == 10
    assert body["activo"] is True


@pytest.mark.asyncio
async def test_crear_global_grade_codigo_duplicado_409(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="gg_dup@leoni.test")
    await make_global_grade(db, codigo="GG11", orden=11)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/global-grades",
        json={"codigo": "GG11", "nombre": "Otro", "orden": 99},
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_listar_global_grades_ordenados(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="gg_list@leoni.test")
    await make_global_grade(db, codigo="GG03", orden=3)
    await make_global_grade(db, codigo="GG01", orden=1)
    await make_global_grade(db, codigo="GG02", orden=2)
    headers = await auth_headers(client, rh)

    response = await client.get(f"{BASE}/global-grades", headers=headers)

    assert response.status_code == 200
    codigos = [i["codigo"] for i in response.json()["items"]]
    assert codigos == ["GG01", "GG02", "GG03"]


@pytest.mark.asyncio
async def test_eliminar_global_grade_asignado_a_perfil_409(client: AsyncClient, db):
    """Un global grade en uso por un perfil no se puede eliminar."""
    rh = await make_empleado(db, rol="rh", email="gg_del_perfil@leoni.test")
    area = await make_area(db, descripcion="Area GG Del")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-DEL-01",
            "nombre": "Perfil con GG",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert creado.status_code == 201, creado.text
    global_grade_id = creado.json()["global_grade_id"]

    response = await client.delete(
        f"{BASE}/global-grades/{global_grade_id}", headers=headers
    )
    assert response.status_code == 409
    assert "en uso" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_empleado_sin_modulo_no_puede_crear_global_grade(client: AsyncClient, db):
    empleado = await make_empleado(db, rol="empleado", email="gg_emp@leoni.test")
    headers = await auth_headers(client, empleado)

    response = await client.post(
        f"{BASE}/global-grades",
        json={"codigo": "GGX", "nombre": "Prohibido", "orden": 77},
        headers=headers,
    )

    assert response.status_code in (401, 403)


# ── Equivalencias ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_crear_equivalencia_success(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="eq_crear@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10])
    grade = await make_global_grade(db, codigo="GG10", orden=10)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"global_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["global_grade_codigo"] == "GG10"
    assert body["career_path_codigo"] == "P"


@pytest.mark.asyncio
async def test_equivalencia_duplicada_por_nivel_409(client: AsyncClient, db):
    """Un global level solo puede tener una equivalencia."""
    rh = await make_empleado(db, rol="rh", email="eq_dup@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10])
    await make_equivalencia(db, global_level_id=grados[0].id)
    otro_grade = await make_global_grade(db, codigo="GG20", orden=20)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"global_level_id": grados[0].id, "global_grade_id": otro_grade.id},
        headers=headers,
    )

    assert response.status_code == 409
    assert "equivalencia" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_equivalencia_con_global_grade_inactivo_falla(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="eq_inactivo@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10])
    grade = await make_global_grade(db, codigo="GG-OFF", orden=90, activo=False)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"global_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )

    assert response.status_code in (400, 422)
    assert "inactivo" in response.text.lower()


@pytest.mark.asyncio
async def test_la_equivalencia_no_asume_correspondencia_por_numero(
    client: AsyncClient, db
):
    """P10 puede equivaler a GG08: la correspondencia la define RH, no el sistema."""
    rh = await make_empleado(db, rol="rh", email="eq_libre@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10])
    grade = await make_global_grade(db, codigo="GG08", orden=8)
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"{BASE}/equivalencias",
        json={"global_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )
    assert creada.status_code == 201

    resuelta = await client.get(
        f"{BASE}/equivalencias/resolver?global_level_id={grados[0].id}",
        headers=headers,
    )
    assert resuelta.status_code == 200
    assert resuelta.json()["global_grade_codigo"] == "GG08"


@pytest.mark.asyncio
async def test_resolver_sin_equivalencia_devuelve_null(client: AsyncClient, db):
    """Sin equivalencia configurada no es un error: la UI pide elegir a mano."""
    rh = await make_empleado(db, rol="rh", email="eq_null@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[42])
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"{BASE}/equivalencias/resolver?global_level_id={grados[0].id}",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() is None


# ── Clasificacion del perfil ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_alta_autocompleta_global_grade_desde_la_equivalencia(
    client: AsyncClient, db
):
    rh = await make_empleado(db, rol="rh", email="pp_gg_auto@leoni.test")
    area = await make_area(db, descripcion="Area GG Auto")
    grados = await make_grados_consecutivos(db, ordenes=[10, 11])
    grade = await make_global_grade(db, codigo="GG10", orden=10)
    await make_equivalencia(
        db, global_level_id=grados[0].id, global_grade_id=grade.id
    )
    funcion = await make_funcion_puesto(db)
    disciplina = await make_disciplina_puesto(db, funcion_id=funcion.id)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-AUTO-01",
            "nombre": "Ingeniero Clasificado",
            "area_id": area.area_id,
            "career_path_id": grados[0].career_path_id,
            "funcion_id": funcion.id,
            "disciplina_id": disciplina.id,
            "grado_ids": [g.id for g in grados],
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    # No se envio global_grade_id: salio de la equivalencia.
    assert body["global_grade_id"] == grade.id
    assert body["global_grade_codigo"] == "GG10"
    assert body["clasificacion_completa"] is True


@pytest.mark.asyncio
async def test_alta_sin_equivalencia_pide_global_grade_explicito(
    client: AsyncClient, db
):
    rh = await make_empleado(db, rol="rh", email="pp_gg_manual@leoni.test")
    area = await make_area(db, descripcion="Area GG Manual")
    clasificacion = await make_clasificacion_payload(
        db, ordenes=[20, 21], con_equivalencia=False
    )
    headers = await auth_headers(client, rh)

    sin_grade = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-MAN-01",
            "nombre": "Perfil Sin Equivalencia",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert sin_grade.status_code in (400, 422)
    assert "equivalencia" in sin_grade.text.lower()

    grade = await make_global_grade(db, codigo="GG-MAN", orden=55)
    con_grade = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-MAN-01",
            "nombre": "Perfil Sin Equivalencia",
            "area_id": area.area_id,
            "global_grade_id": grade.id,
            **clasificacion,
        },
        headers=headers,
    )
    assert con_grade.status_code == 201, con_grade.text
    assert con_grade.json()["global_grade_codigo"] == "GG-MAN"


@pytest.mark.asyncio
async def test_alta_sin_clasificacion_422(client: AsyncClient, db):
    """Career path, funcion y disciplina son obligatorios al crear."""
    rh = await make_empleado(db, rol="rh", email="pp_sin_clasif@leoni.test")
    area = await make_area(db, descripcion="Area Sin Clasif")
    grados = await make_grados_consecutivos(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "SIN-CLASIF-01",
            "nombre": "Perfil Sin Clasificacion",
            "area_id": area.area_id,
            "grado_ids": [g.id for g in grados],
        },
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_editar_perfil_viejo_sin_clasificacion_es_posible(
    client: AsyncClient, db
):
    """
    Los perfiles anteriores a WTW se pueden seguir editando sin clasificar.

    Se marcan como pendientes en la UI, pero no bloquean el trabajo de RH.
    """
    rh = await make_empleado(db, rol="rh", email="pp_viejo@leoni.test")
    area = await make_area(db, descripcion="Area Perfil Viejo")
    perfil = await make_puesto_perfil(
        db, nombre="Perfil Legacy", area_id=area.area_id
    )
    headers = await auth_headers(client, rh)

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"nombre": "Perfil Legacy Renombrado"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["nombre"] == "Perfil Legacy Renombrado"
    assert body["clasificacion_completa"] is False


@pytest.mark.asyncio
async def test_disciplina_de_otra_funcion_falla(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pp_disc_mala@leoni.test")
    area = await make_area(db, descripcion="Area Disc Mala")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    otra_funcion = await make_funcion_puesto(db)
    disciplina_ajena = await make_disciplina_puesto(db, funcion_id=otra_funcion.id)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "DISC-MALA-01",
            "nombre": "Perfil Disciplina Ajena",
            "area_id": area.area_id,
            **{**clasificacion, "disciplina_id": disciplina_ajena.id},
        },
        headers=headers,
    )

    assert response.status_code in (400, 422)
    assert "disciplina" in response.text.lower()


@pytest.mark.asyncio
async def test_global_levels_de_otro_career_path_falla(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pp_path_malo@leoni.test")
    area = await make_area(db, descripcion="Area Path Malo")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    management = await make_grados_consecutivos(
        db, ordenes=[1], career_path_codigo="M"
    )
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "PATH-MALO-01",
            "nombre": "Perfil Path Cruzado",
            "area_id": area.area_id,
            **{**clasificacion, "grado_ids": [management[0].id]},
        },
        headers=headers,
    )

    assert response.status_code in (400, 422)
    assert "career path" in response.text.lower()


@pytest.mark.asyncio
async def test_global_grade_inactivo_no_se_puede_asignar(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pp_gg_off@leoni.test")
    area = await make_area(db, descripcion="Area GG Off")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    grade = await make_global_grade(db, codigo="GG-OFF2", orden=91, activo=False)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-OFF-01",
            "nombre": "Perfil GG Inactivo",
            "area_id": area.area_id,
            "global_grade_id": grade.id,
            **clasificacion,
        },
        headers=headers,
    )

    assert response.status_code in (400, 422)
    assert "inactivo" in response.text.lower()


# ── Historial de clasificacion ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_historial_registra_alta_y_diff_del_cambio(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pp_hist@leoni.test")
    area = await make_area(db, descripcion="Area Historial")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "HIST-01",
            "nombre": "Perfil Historial",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert creado.status_code == 201, creado.text
    perfil_id = creado.json()["id"]

    # Cambio de global grade con motivo.
    nuevo_grade = await make_global_grade(db, codigo="GG-NUEVO", orden=60)
    cambio = await client.put(
        f"/api/v1/puestos-perfil/{perfil_id}",
        json={
            "global_grade_id": nuevo_grade.id,
            "motivo_clasificacion": "Revaluacion anual",
        },
        headers=headers,
    )
    assert cambio.status_code == 200, cambio.text

    historial = await client.get(
        f"/api/v1/puestos-perfil/{perfil_id}/clasificacion-historial", headers=headers
    )
    assert historial.status_code == 200
    items = historial.json()["items"]
    assert len(items) == 2  # alta + cambio

    ultimo = items[0]
    assert ultimo["motivo"] == "Revaluacion anual"
    assert ultimo["changed_by"] == rh.id
    assert ultimo["changed_by_nombre"]
    grade_cambio = next(c for c in ultimo["cambios"] if c["campo"] == "global_grade")
    assert grade_cambio["nuevo"] == "GG-NUEVO"
    assert grade_cambio["anterior"] != "GG-NUEVO"


@pytest.mark.asyncio
async def test_cambiar_solo_el_nombre_no_escribe_historial(client: AsyncClient, db):
    """La bitacora es de clasificacion: renombrar el puesto no la ensucia."""
    rh = await make_empleado(db, rol="rh", email="pp_hist_nombre@leoni.test")
    area = await make_area(db, descripcion="Area Historial Nombre")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "HIST-NOM-01",
            "nombre": "Perfil Historial Nombre",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    perfil_id = creado.json()["id"]

    await client.put(
        f"/api/v1/puestos-perfil/{perfil_id}",
        json={"nombre": "Otro Nombre"},
        headers=headers,
    )

    historial = await client.get(
        f"/api/v1/puestos-perfil/{perfil_id}/clasificacion-historial", headers=headers
    )
    assert historial.json()["total"] == 1  # solo el alta


@pytest.mark.asyncio
async def test_detalle_expone_quien_y_cuando_clasifico(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="pp_clasif_por@leoni.test")
    area = await make_area(db, descripcion="Area Clasificado Por")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "CLASIF-POR-01",
            "nombre": "Perfil Clasificado",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    perfil_id = creado.json()["id"]

    detalle = await client.get(
        f"/api/v1/puestos-perfil/{perfil_id}", headers=headers
    )
    assert detalle.status_code == 200
    body = detalle.json()
    assert body["clasificado_por"] == rh.nombre
    assert body["clasificado_en"]


# ── Filtros del listado ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_listado_filtra_por_global_grade_y_clasificacion_pendiente(
    client: AsyncClient, db
):
    rh = await make_empleado(db, rol="rh", email="pp_filtros@leoni.test")
    area = await make_area(db, descripcion="Area Filtros GG")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1, 2])
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "FILT-01",
            "nombre": "Perfil Clasificado Filtro",
            "area_id": area.area_id,
            **clasificacion,
        },
        headers=headers,
    )
    assert creado.status_code == 201, creado.text
    global_grade_id = creado.json()["global_grade_id"]

    # Perfil legacy sin clasificar.
    await make_puesto_perfil(db, nombre="Perfil Legacy Filtro", area_id=area.area_id)

    por_grade = await client.get(
        f"/api/v1/puestos-perfil?global_grade_id={global_grade_id}", headers=headers
    )
    assert por_grade.status_code == 200
    assert [i["codigo"] for i in por_grade.json()["items"]] == ["FILT-01"]

    pendientes = await client.get(
        "/api/v1/puestos-perfil?clasificacion_pendiente=true", headers=headers
    )
    assert pendientes.status_code == 200
    nombres = [i["nombre"] for i in pendientes.json()["items"]]
    assert "Perfil Legacy Filtro" in nombres
    assert "Perfil Clasificado Filtro" not in nombres


@pytest.mark.asyncio
async def test_editar_perfil_legacy_sin_global_levels(client: AsyncClient, db):
    """
    Un perfil sin ningún global level se puede seguir editando.

    La factory `make_puesto_perfil` siempre asigna un grado por defecto, así que
    este caso solo aparece con datos reales: perfiles anteriores a la metodología
    que nunca tuvieron rango. La validación de consecutividad reventaba con
    IndexError sobre la lista vacía.
    """
    from app.models.talento import PuestoPerfil, PuestoPerfilGrado
    from sqlalchemy import delete

    rh = await make_empleado(db, rol="rh", email="pp_sin_niveles@leoni.test")
    area = await make_area(db, descripcion="Area Sin Niveles")
    perfil = await make_puesto_perfil(
        db, codigo="LEGACY-SN", nombre="Perfil Sin Niveles", area_id=area.area_id
    )
    await db.execute(
        delete(PuestoPerfilGrado).where(
            PuestoPerfilGrado.puesto_perfil_id == perfil.id
        )
    )
    await db.flush()
    headers = await auth_headers(client, rh)

    response = await client.put(
        f"/api/v1/puestos-perfil/{perfil.id}",
        json={"nombre": "Perfil Sin Niveles Renombrado"},
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["nombre"] == "Perfil Sin Niveles Renombrado"
    assert body["grados"] == []
    assert body["clasificacion_completa"] is False
