# tests/test_grados_puesto.py
"""Tests del catalogo de grados de puesto."""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    get_default_grado,
    make_global_grade,
    make_career_path,
    make_competencia,
    make_competencia_requisito,
    make_grado_puesto,
    make_perfil_funciones,
    make_puesto_perfil,
)


@pytest.mark.asyncio
async def test_crear_grado_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_crear@leoni.test")
    career_path = await make_career_path(db)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={
            "career_path_id": career_path.id,
            "codigo": "P10",
            "nombre": "Grado Especial",
        },
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["nombre"] == "Grado Especial"
    assert data["codigo"] == "P10"
    # El nivel nace sin posicion: se la da la equivalencia con el global grade.
    # Recien creado no tiene equivalencias, asi que no tiene posicion.
    assert data["global_grades"] == []
    assert data["posicion_desde"] is None
    assert data["posicion_hasta"] is None
    assert data["career_path_id"] == career_path.id
    assert data["career_path_codigo"] == "P"
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_grado_puesto_duplicado_nombre(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_dup@leoni.test")
    career_path = await make_career_path(db)
    await make_grado_puesto(
        db, nombre="Grado Dup Test", orden=11, career_path_id=career_path.id
    )
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={
            "career_path_id": career_path.id,
            "codigo": "P12",
            "nombre": "Grado Dup Test",
        },
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_un_p10_y_un_m1_pueden_pesar_lo_mismo(client, db):
    """
    Dos career levels de paths distintos pueden equivaler al mismo global grade.

    Es la razon de ser de la equivalencia: el ordenador del sistema Towers es el
    global grade, no una escala interna de cada career path. Por eso el nivel ya
    no lleva `orden` propio.
    """
    rh = await make_empleado(db, rol="rh", email="gp_paths@leoni.test")
    professional = await make_career_path(db, codigo="P")
    management = await make_career_path(db, codigo="M", nombre="Management")
    grade = await make_global_grade(db, codigo="GG10", orden=10)
    headers = await auth_headers(client, rh)

    creados = []
    for path, codigo in ((professional, "P10"), (management, "M1")):
        r = await client.post(
            "/api/v1/career-levels",
            json={"career_path_id": path.id, "codigo": codigo, "nombre": codigo},
            headers=headers,
        )
        assert r.status_code == 201, r.text
        creados.append(r.json()["id"])

    # Ambos apuntan al MISMO global grade.
    for nivel_id in creados:
        eq = await client.post(
            "/api/v1/clasificacion-puesto/equivalencias",
            json={"career_level_id": nivel_id, "global_grade_id": grade.id},
            headers=headers,
        )
        assert eq.status_code == 201, eq.text

    listado = await client.get("/api/v1/career-levels", headers=headers)
    por_codigo = {i["codigo"]: i for i in listado.json()["items"]}
    assert por_codigo["P10"]["posicion_desde"] == 10
    assert por_codigo["M1"]["posicion_desde"] == 10


@pytest.mark.asyncio
async def test_codigo_duplicado_en_el_mismo_career_path_409(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_cod_dup@leoni.test")
    path = await make_career_path(db, codigo="P")
    await make_grado_puesto(db, codigo="P7", nombre="P7", orden=7, career_path_id=path.id)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": path.id, "codigo": "P7", "nombre": "Otro"},
        headers=headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_listar_grados_puesto_filtra_por_career_path(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_filtro_path@leoni.test")
    professional = await make_career_path(db, codigo="P")
    management = await make_career_path(db, codigo="M", nombre="Management")
    await make_grado_puesto(db, nombre="P5", orden=5, career_path_id=professional.id)
    await make_grado_puesto(db, nombre="M5", orden=5, career_path_id=management.id)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/career-levels?career_path_id={management.id}", headers=headers
    )

    assert response.status_code == 200
    items = response.json()["items"]
    assert items
    assert all(i["career_path_id"] == management.id for i in items)


@pytest.mark.asyncio
async def test_listar_grados_puesto(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_list@leoni.test")
    await make_grado_puesto(db, nombre="Grado List A", orden=21)
    await make_grado_puesto(db, nombre="Grado List B", orden=22)
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/career-levels", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] >= 2


@pytest.mark.asyncio
async def test_eliminar_grado_puesto_en_uso(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_del_use@leoni.test")
    grado = await make_grado_puesto(db, nombre="Grado En Uso", orden=31)
    perfil = await make_puesto_perfil(db, nombre="Perfil con grado")
    comp = await make_competencia(db, nombre="Comp Grado", categoria="tecnica")
    await make_competencia_requisito(
        db,
        competencia_id=comp.id,
        puesto_perfil_id=perfil.id,
        grado_id=grado.id,
    )
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/career-levels/{grado.id}",
        headers=headers,
    )

    assert response.status_code == 409


@pytest.mark.asyncio
async def test_eliminar_grado_puesto_success(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_del_ok@leoni.test")
    grado = await make_grado_puesto(db, nombre="Grado Libre", orden=41)
    headers = await auth_headers(client, rh)

    response = await client.delete(
        f"/api/v1/career-levels/{grado.id}",
        headers=headers,
    )

    assert response.status_code == 204


@pytest.mark.asyncio
async def test_competencias_por_grado_y_gap_filtrado(client: AsyncClient, db):
    """Requisitos distintos por grado y gap filtrado por grado de asignacion."""
    rh = await make_empleado(db, rol="rh", email="gp_gap@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="gp_emp@leoni.test")
    headers = await auth_headers(client, rh)

    grado1 = await get_default_grado(db)
    grado2 = await make_grado_puesto(db, nombre="Grado 2 Test", orden=2)
    perfil = await make_puesto_perfil(
        db, nombre="Puesto Grados", grado_ids=[grado1.id, grado2.id]
    )
    comp1 = await make_competencia(db, nombre="Comp G1", categoria="tecnica")
    comp2 = await make_competencia(db, nombre="Comp G2", categoria="tecnica")

    await make_competencia_requisito(
        db, competencia_id=comp1.id, puesto_perfil_id=perfil.id, grado_id=grado1.id
    )
    await make_competencia_requisito(
        db, competencia_id=comp2.id, puesto_perfil_id=perfil.id, grado_id=grado2.id
    )

    asignacion = await make_perfil_funciones(
        db,
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        grado_id=grado2.id,
    )

    resp_g1 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado1.id}",
        headers=headers,
    )
    resp_g2 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado2.id}",
        headers=headers,
    )
    assert resp_g1.status_code == 200
    assert resp_g2.status_code == 200
    assert len(resp_g1.json()) == 1
    assert len(resp_g2.json()) == 1
    assert resp_g1.json()[0]["competencia_nombre"] == "Comp G1"
    assert resp_g2.json()[0]["competencia_nombre"] == "Comp G2"

    gap_resp = await client.get(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        headers=headers,
    )
    assert gap_resp.status_code == 200
    gap = gap_resp.json()
    assert len(gap["gap_competencias"]) == 1
    assert gap["gap_competencias"][0]["competencia_nombre"] == "Comp G2"
    assert gap["asignacion"]["grado_id"] == grado2.id


@pytest.mark.asyncio
async def test_sync_competencias_no_borra_otro_grado(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="gp_sync@leoni.test")
    headers = await auth_headers(client, rh)

    grado1 = await get_default_grado(db)
    grado2 = await make_grado_puesto(db, nombre="Grado 2 Sync", orden=3)
    perfil = await make_puesto_perfil(
        db, nombre="Puesto Sync Grado", grado_ids=[grado1.id, grado2.id]
    )
    from tests.conftest_talento import make_tipo_competencia

    tipo = await make_tipo_competencia(db, nombre="Tipo Sync Grado")
    tipo_id = tipo.id
    comp_a = await make_competencia(
        db, nombre="Sync A", categoria="tecnica", tipo_competencia_id=tipo_id
    )
    comp_b = await make_competencia(
        db, nombre="Sync B", categoria="tecnica", tipo_competencia_id=tipo_id
    )

    await make_competencia_requisito(
        db, competencia_id=comp_a.id, puesto_perfil_id=perfil.id, grado_id=grado1.id
    )
    await make_competencia_requisito(
        db, competencia_id=comp_b.id, puesto_perfil_id=perfil.id, grado_id=grado2.id
    )

    sync_resp = await client.put(
        f"/api/v1/perfiles/{perfil.id}/competencias/sync",
        json={
            "grado_id": grado1.id,
            "tipo_competencia_id": tipo_id,
            "competencias": [{"competencia_id": comp_a.id, "nivel_requerido": 2}],
        },
        headers=headers,
    )
    assert sync_resp.status_code == 200

    still_g2 = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias?grado_id={grado2.id}",
        headers=headers,
    )
    assert still_g2.status_code == 200
    assert len(still_g2.json()) == 1
    assert still_g2.json()[0]["competencia_id"] == comp_b.id


@pytest.mark.asyncio
async def test_codigo_debe_empezar_con_el_codigo_del_career_path_422(client, db):
    """
    El codigo de un career level lo dicta su career path: 'P' + numero.

    Sin esta regla nada impedia capturar 'M7' bajo Professional, y el codigo es
    justo la etiqueta con la que el nivel aparece en el rango de un perfil.
    """
    rh = await make_empleado(db, rol="rh", email="gp_cod_prefijo@leoni.test")
    professional = await make_career_path(db, codigo="P")
    headers = await auth_headers(client, rh)

    for codigo in ("M7", "Nivel 3", "P", "P0", "P01"):
        response = await client.post(
            "/api/v1/career-levels",
            json={"career_path_id": professional.id, "codigo": codigo, "nombre": codigo},
            headers=headers,
        )
        assert response.status_code == 422, f"{codigo}: {response.text}"


@pytest.mark.asyncio
async def test_el_codigo_se_guarda_con_el_prefijo_del_career_path(client, db):
    """Capturar 'p10' bajo el path 'P' guarda 'P10', no 'p10'."""
    rh = await make_empleado(db, rol="rh", email="gp_cod_norm@leoni.test")
    professional = await make_career_path(db, codigo="P")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": professional.id, "codigo": "p10", "nombre": "P10"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["codigo"] == "P10"


@pytest.mark.asyncio
async def test_normalizar_no_deja_pasar_un_duplicado_con_otra_caja(client, db):
    """
    'p10' y 'P10' son el mismo career level.

    Regresion: si la unicidad se comprobara con el codigo tal cual llego, en vez
    de con el normalizado, ambos entrarian y el path tendria dos 'P10'.
    """
    rh = await make_empleado(db, rol="rh", email="gp_cod_caja@leoni.test")
    path = await make_career_path(db, codigo="P")
    await make_grado_puesto(db, codigo="P10", nombre="P10", orden=10, career_path_id=path.id)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": path.id, "codigo": "p10", "nombre": "Otro"},
        headers=headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_mover_un_nivel_de_path_exige_el_prefijo_del_path_nuevo(client, db):
    """Al editar, el prefijo que manda es el del career path del payload."""
    rh = await make_empleado(db, rol="rh", email="gp_cod_mover@leoni.test")
    professional = await make_career_path(db, codigo="P")
    management = await make_career_path(db, codigo="M", nombre="Management")
    grado = await make_grado_puesto(
        db, codigo="P5", nombre="P5", orden=5, career_path_id=professional.id
    )
    headers = await auth_headers(client, rh)

    # Mover a Management conservando el codigo 'P5' ya no es valido.
    invalido = await client.patch(
        f"/api/v1/career-levels/{grado.id}",
        json={"career_path_id": management.id, "codigo": "P5", "nombre": "P5"},
        headers=headers,
    )
    assert invalido.status_code == 422, invalido.text

    valido = await client.patch(
        f"/api/v1/career-levels/{grado.id}",
        json={"career_path_id": management.id, "codigo": "M5", "nombre": "M5"},
        headers=headers,
    )
    assert valido.status_code == 200, valido.text
    assert valido.json()["codigo"] == "M5"


@pytest.mark.asyncio
async def test_crear_sobre_un_nivel_desactivado_lo_reactiva(client, db):
    """
    Un nivel desactivado sigue ocupando su codigo: las uniques de la tabla no
    distinguen `activo`.

    Antes la validacion solo miraba los activos, el duplicado llegaba al INSERT
    y salia un 500. Ahora se reactiva la MISMA fila (mismo id), que es lo que
    implica un borrado suave: nada de lo que la referenciaba queda huerfano.
    """
    rh = await make_empleado(db, rol="rh", email="gp_reactivar@leoni.test")
    path = await make_career_path(db, codigo="M", nombre="Management")
    grado = await make_grado_puesto(
        db, codigo="M1", nombre="M1", orden=1, career_path_id=path.id, activo=False
    )
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": path.id, "codigo": "M1", "nombre": "Team Leader"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] == grado.id, "debe reactivar la fila existente, no crear otra"
    assert body["activo"] is True
    assert body["nombre"] == "Team Leader"
    # La respuesta lo dice: fue una restauracion, no un alta.
    assert body["reactivado"] is True


@pytest.mark.asyncio
async def test_crear_uno_nuevo_no_se_marca_como_reactivado(client, db):
    rh = await make_empleado(db, rol="rh", email="gp_no_react@leoni.test")
    path = await make_career_path(db, codigo="P")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": path.id, "codigo": "P3", "nombre": "P3"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    assert response.json()["reactivado"] is False


@pytest.mark.asyncio
async def test_nombre_ocupado_por_un_nivel_desactivado_da_409_no_500(client, db):
    """El nombre tiene su propia unique, y tampoco distingue `activo`."""
    rh = await make_empleado(db, rol="rh", email="gp_nom_desact@leoni.test")
    path = await make_career_path(db, codigo="P")
    await make_grado_puesto(
        db, codigo="P1", nombre="Team Leader", orden=1, career_path_id=path.id, activo=False
    )
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/career-levels",
        json={"career_path_id": path.id, "codigo": "P2", "nombre": "Team Leader"},
        headers=headers,
    )
    assert response.status_code == 409, response.text
    assert "desactivado" in response.json()["detail"]


@pytest.mark.asyncio
async def test_editar_hacia_un_codigo_desactivado_da_409_no_reactiva(client, db):
    """
    Reactivar solo tiene sentido al CREAR. Al editar significaria fusionar dos
    filas, asi que choca.
    """
    rh = await make_empleado(db, rol="rh", email="gp_edit_desact@leoni.test")
    path = await make_career_path(db, codigo="P")
    await make_grado_puesto(
        db, codigo="P1", nombre="Viejo", orden=1, career_path_id=path.id, activo=False
    )
    vivo = await make_grado_puesto(
        db, codigo="P2", nombre="Vivo", orden=2, career_path_id=path.id
    )
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/career-levels/{vivo.id}",
        json={"career_path_id": path.id, "codigo": "P1", "nombre": "Vivo"},
        headers=headers,
    )
    assert response.status_code == 409, response.text
