# tests/test_global_grade.py
"""
Tests del Global Grade: catalogo, equivalencias Career Level ↔ Global Grade,
autocompletado en el perfil e historial de clasificacion.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import (
    make_grado_puesto,
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
async def test_eliminar_global_grade_con_equivalencia_409(client: AsyncClient, db):
    """
    Lo que retiene a un global grade son sus EQUIVALENCIAS, no los perfiles.

    El perfil dejo de guardar un global grade: lo hereda del tramo de su career
    level, y el que lleva cada persona se asigna aparte.
    """
    rh = await make_empleado(db, rol="rh", email="gg_del_eq@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[1], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG-DEL", orden=41)
    await make_equivalencia(
        db, career_level_id=grados[0].id, global_grade_id=grade.id
    )
    headers = await auth_headers(client, rh)

    response = await client.delete(f"{BASE}/global-grades/{grade.id}", headers=headers)

    assert response.status_code == 409
    assert "equivalencia" in response.json()["detail"].lower()

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
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG10", orden=10)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["global_grade_codigo"] == "GG10"
    assert body["career_path_codigo"] == "P"


@pytest.mark.asyncio
async def test_un_career_level_puede_equivaler_a_varios_global_grades(
    client: AsyncClient, db
):
    """
    Un nivel abarca un TRAMO de grades: M4 puede ser GG17 y GG18.

    Es la razon por la que dos empleados en M4 pueden estar clasificados
    distinto: el nivel dice el tamano del puesto y el grade lo afina dentro.
    """
    rh = await make_empleado(db, rol="rh", email="eq_varios@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    gg17 = await make_global_grade(db, codigo="GG17", orden=17)
    gg18 = await make_global_grade(db, codigo="GG18", orden=18)
    headers = await auth_headers(client, rh)

    for grade in (gg17, gg18):
        r = await client.post(
            f"{BASE}/equivalencias",
            json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
            headers=headers,
        )
        assert r.status_code == 201, r.text

    resuelto = await client.get(
        f"{BASE}/equivalencias/resolver?career_level_id={grados[0].id}", headers=headers
    )
    assert resuelto.status_code == 200
    # Ordenados por `orden`: el primero marca la posicion del nivel.
    assert [e["global_grade_codigo"] for e in resuelto.json()] == ["GG17", "GG18"]


@pytest.mark.asyncio
async def test_el_mismo_par_nivel_grade_no_se_repite_409(client: AsyncClient, db):
    """Lo unico que no se puede repetir es el PAR, no el nivel."""
    rh = await make_empleado(db, rol="rh", email="eq_dup@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG20", orden=20)
    await make_equivalencia(
        db, career_level_id=grados[0].id, global_grade_id=grade.id
    )
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )

    assert response.status_code == 409
    assert "ya equivale" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_equivalencia_con_global_grade_inactivo_falla(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="eq_inactivo@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG-OFF", orden=90, activo=False)
    headers = await auth_headers(client, rh)

    response = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
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
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG08", orden=8)
    headers = await auth_headers(client, rh)

    creada = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )
    assert creada.status_code == 201

    resuelta = await client.get(
        f"{BASE}/equivalencias/resolver?career_level_id={grados[0].id}",
        headers=headers,
    )
    assert resuelta.status_code == 200
    assert [e["global_grade_codigo"] for e in resuelta.json()] == ["GG08"]


@pytest.mark.asyncio
async def test_resolver_sin_equivalencia_devuelve_lista_vacia(client: AsyncClient, db):
    """Sin equivalencias no es un error: la UI deja el global grade libre."""
    rh = await make_empleado(db, rol="rh", email="eq_null@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[42], con_equivalencia=False)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"{BASE}/equivalencias/resolver?career_level_id={grados[0].id}",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == []


# ── Clasificacion del perfil ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_el_perfil_hereda_el_tramo_de_su_career_level(client: AsyncClient, db):
    """
    El perfil no guarda global grade: expone el TRAMO del nivel, informativo.

    El global grade concreto lo lleva cada persona, dentro de ese tramo — por eso
    dos personas del mismo puesto pueden estar en GG distinto.
    """
    rh = await make_empleado(db, rol="rh", email="pp_gg_auto@leoni.test")
    area = await make_area(db, descripcion="Area GG Auto")
    nivel = await make_grado_puesto(
        db, codigo="P10", nombre="Specialist", orden=10, ordenes_extra=[11]
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
            "career_path_id": nivel.career_path_id,
            "funcion_id": funcion.id,
            "disciplina_id": disciplina.id,
            "grado_id": nivel.id,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["global_grade_id"] is None, "el perfil ya no guarda un global grade"
    assert body["global_grade_codigo"] == "GG10 - GG11"
    assert body["clasificacion_completa"] is True

@pytest.mark.asyncio
async def test_nivel_sin_equivalencia_no_se_puede_usar_en_un_perfil(
    client: AsyncClient, db
):
    """
    Un career level sin equivalencia no tiene posicion, asi que no puede formar
    parte del rango de un perfil — ni siquiera mandando el global grade a mano.

    Es la consecuencia de que el nivel dejara de tener orden propio: quien lo
    ubica es el global grade al que equivale. El mensaje apunta a Ajustes.
    """
    rh = await make_empleado(db, rol="rh", email="pp_gg_manual@leoni.test")
    area = await make_area(db, descripcion="Area GG Manual")
    clasificacion = await make_clasificacion_payload(
        db, ordenes=[20, 21], con_equivalencia=False
    )
    grade = await make_global_grade(db, codigo="GG-MAN", orden=55)
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

    # Mandar el global grade a mano tampoco alcanza: el rango sigue sin poder
    # ubicarse porque los niveles no tienen posicion.
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
    assert con_grade.status_code in (400, 422)
    assert "equivalencia" in con_grade.text.lower()


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
async def test_career_levels_de_otro_career_path_falla(client: AsyncClient, db):
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
            **{**clasificacion, "grado_id": management[0].id},
        },
        headers=headers,
    )

    assert response.status_code in (400, 422)
    assert "career path" in response.text.lower()


@pytest.mark.asyncio
async def test_enviar_global_grade_al_perfil_ya_no_hace_nada(client: AsyncClient, db):
    """
    El campo salio del perfil: un cliente viejo que lo mande no rompe ni ensucia.

    Y sobre todo, el perfil queda con la clasificacion COMPLETA sin el: exigirlo
    marcaria como pendiente a todo perfil nuevo.
    """
    rh = await make_empleado(db, rol="rh", email="pp_gg_off@leoni.test")
    area = await make_area(db, descripcion="Area GG Off")
    clasificacion = await make_clasificacion_payload(db, ordenes=[1])
    grade = await make_global_grade(db, codigo="GG-OFF2", orden=91, activo=False)
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "GG-OFF-01",
            "nombre": "Perfil GG Ignorado",
            "area_id": area.area_id,
            "global_grade_id": grade.id,
            **clasificacion,
        },
        headers=headers,
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["global_grade_id"] is None
    assert body["clasificacion_completa"] is True

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

    # Cambio de career level con motivo. El global grade ya no es un campo del
    # perfil, asi que el historial registra lo que si lo es.
    otros = await make_grados_consecutivos(db, ordenes=[1, 2])
    cambio = await client.put(
        f"/api/v1/puestos-perfil/{perfil_id}",
        json={
            "grado_id": otros[1].id,
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
    nivel_cambio = next(c for c in ultimo["cambios"] if c["campo"] == "career_level")
    assert nivel_cambio["nuevo"] != nivel_cambio["anterior"]


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
    """
    El filtro por global grade se resuelve por el TRAMO del career level.

    El perfil ya no guarda un global grade, pero la pregunta que responde el
    filtro es la misma: que puestos pesan esto.
    """
    rh = await make_empleado(db, rol="rh", email="pp_filtros@leoni.test")
    area = await make_area(db, descripcion="Area Filtros GG")
    nivel = await make_grado_puesto(
        db, codigo="P14", nombre="P14", orden=14, ordenes_extra=[15]
    )
    gg15 = await make_global_grade(db, codigo="GG15", orden=15)
    funcion = await make_funcion_puesto(db)
    disciplina = await make_disciplina_puesto(db, funcion_id=funcion.id)
    headers = await auth_headers(client, rh)

    creado = await client.post(
        "/api/v1/puestos-perfil",
        json={
            "codigo": "FILT-01",
            "nombre": "Perfil Clasificado Filtro",
            "area_id": area.area_id,
            "career_path_id": nivel.career_path_id,
            "funcion_id": funcion.id,
            "disciplina_id": disciplina.id,
            "grado_id": nivel.id,
        },
        headers=headers,
    )
    assert creado.status_code == 201, creado.text
    # Se filtra por el grade ALTO del tramo: el perfil no lo tiene guardado, lo
    # cubre su nivel.
    global_grade_id = gg15.id

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
async def test_editar_perfil_legacy_sin_career_levels(client: AsyncClient, db):
    """
    Un perfil sin ningún career level se puede seguir editando.

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


@pytest.mark.asyncio
async def test_el_catalogo_no_duplica_un_nivel_con_varios_grades(
    client: AsyncClient, db
):
    """
    Regresion del orden por subquery.

    Ordenar con un join a las equivalencias producia una fila por grade: el
    nivel salia repetido y el `total` dejaba de cuadrar con la paginacion.
    """
    rh = await make_empleado(db, rol="rh", email="cat_tramo@leoni.test")
    await make_grado_puesto(
        db, codigo="M4", nombre="M4", orden=17, ordenes_extra=[18, 19],
        career_path_codigo="M",
    )
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/career-levels", headers=headers)

    assert response.status_code == 200, response.text
    body = response.json()
    m4 = [i for i in body["items"] if i["codigo"] == "M4"]
    assert len(m4) == 1
    assert body["total"] == len(body["items"])
    assert [g["codigo"] for g in m4[0]["global_grades"]] == ["GG17", "GG18", "GG19"]
    assert (m4[0]["posicion_desde"], m4[0]["posicion_hasta"]) == (17, 19)


@pytest.mark.asyncio
async def test_recrear_una_equivalencia_borrada_funciona(client: AsyncClient, db):
    """Borrar y volver a crear el mismo par no puede responder "ya existe".

    El borrado es logico (`activo = False`) y la unique de la tabla no filtra por
    `activo`, asi que la fila muerta sigue ahi: la validacion la veia y devolvia 409
    sobre una equivalencia que el usuario ya no puede ver en la pantalla.
    """
    rh = await make_empleado(db, rol="rh", email="eq_recrear@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG30", orden=30)
    headers = await auth_headers(client, rh)
    payload = {"career_level_id": grados[0].id, "global_grade_id": grade.id}

    creada = await client.post(f"{BASE}/equivalencias", json=payload, headers=headers)
    assert creada.status_code == 201, creada.text
    borrada = await client.delete(
        f"{BASE}/equivalencias/{creada.json()['id']}", headers=headers
    )
    assert borrada.status_code in (200, 204), borrada.text

    recreada = await client.post(f"{BASE}/equivalencias", json=payload, headers=headers)

    assert recreada.status_code == 201, recreada.text
    resuelta = await client.get(
        f"{BASE}/equivalencias/resolver?career_level_id={grados[0].id}", headers=headers
    )
    assert [e["global_grade_codigo"] for e in resuelta.json()] == ["GG30"]


@pytest.mark.asyncio
async def test_recrear_una_equivalencia_borrada_no_duplica_la_fila(
    client: AsyncClient, db
):
    """La unique (career_level_id, global_grade_id) no filtra por `activo`.

    Si el arreglo insertara una fila nueva en vez de revivir la borrada, el INSERT
    reventaria contra esa unique con un 500.
    """
    from sqlalchemy import select

    from app.models.clasificacion_puesto import CareerLevelGradeMapping

    rh = await make_empleado(db, rol="rh", email="eq_recrear_una@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG31", orden=31)
    headers = await auth_headers(client, rh)
    payload = {"career_level_id": grados[0].id, "global_grade_id": grade.id}

    creada = await client.post(f"{BASE}/equivalencias", json=payload, headers=headers)
    await client.delete(f"{BASE}/equivalencias/{creada.json()['id']}", headers=headers)
    await client.post(f"{BASE}/equivalencias", json=payload, headers=headers)

    filas = (
        await db.execute(
            select(CareerLevelGradeMapping).where(
                CareerLevelGradeMapping.career_level_id == grados[0].id,
                CareerLevelGradeMapping.global_grade_id == grade.id,
            )
        )
    ).scalars().all()
    assert len(filas) == 1
    assert filas[0].activo is True


@pytest.mark.asyncio
async def test_editar_una_equivalencia_hacia_un_par_borrado_funciona(
    client: AsyncClient, db
):
    """Mismo choque que al crear, por el camino del PATCH.

    Si la validacion deja pasar la fila muerta pero el UPDATE no la retira, el par
    destino ya esta tomado en la tabla y la unique responde con un 500.
    """
    rh = await make_empleado(db, rol="rh", email="eq_editar@leoni.test")
    grados = await make_grados_consecutivos(db, ordenes=[10, 20], con_equivalencia=False)
    grade = await make_global_grade(db, codigo="GG32", orden=32)
    headers = await auth_headers(client, rh)

    # El par (grados[0], grade) se crea y se borra: queda la fila muerta.
    muerta = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )
    await client.delete(f"{BASE}/equivalencias/{muerta.json()['id']}", headers=headers)

    # Otra equivalencia viva se edita justo hacia ese par.
    viva = await client.post(
        f"{BASE}/equivalencias",
        json={"career_level_id": grados[1].id, "global_grade_id": grade.id},
        headers=headers,
    )
    assert viva.status_code == 201, viva.text

    editada = await client.patch(
        f"{BASE}/equivalencias/{viva.json()['id']}",
        json={"career_level_id": grados[0].id, "global_grade_id": grade.id},
        headers=headers,
    )

    assert editada.status_code == 200, editada.text
    assert editada.json()["career_level_id"] == grados[0].id
