# tests/test_perfil_funciones.py
"""
Tests para el modulo Perfil de Funciones — endpoints de asignaciones,
tareas, cualificaciones y competencias requeridas.

Cubre:
  - GET asignaciones incluye nombre_empleado y no_empleado (enrich)
  - CRUD tareas por perfil
  - CRUD cualificaciones por perfil
  - CRUD competencias requeridas por perfil
  - PUT evaluaciones con IDs invalidos retorna 422 (no 500)
  - Autorizacion: solo RH/supervisor muta, cualquier auth lee
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import auth_headers, make_empleado
from tests.conftest_talento import make_area, make_puesto_perfil


# ---------------------------------------------------------------------------
# Factories locales
# ---------------------------------------------------------------------------

async def make_perfil_with_empleados(db: AsyncSession, *, count: int = 2):
    """Crea un perfil con N empleados asignados via perfil_funciones."""
    from app.models.talento import PerfilFunciones

    area = await make_area(db, descripcion="Calidad Test")
    rh = await make_empleado(db, rol="rh", email="pf_rh@leoni.test", nombre="RH Admin")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    empleados = []
    for i in range(count):
        emp = await make_empleado(
            db,
            rol="empleado",
            nombre=f"Empleado Prueba {i+1}",
            no_empleado=f"EMP-PF-{i+1:04d}",
        )
        empleados.append(emp)
        asignacion = PerfilFunciones(
            puesto_perfil_id=perfil.id,
            empleado_id=emp.id,
            departamento="Calidad",
            activo=True,
        )
        db.add(asignacion)

    await db.flush()
    return perfil, rh, empleados


async def make_perfil_with_tareas(db: AsyncSession):
    """Crea un perfil con tareas."""
    from app.models.talento import PerfilTarea

    area = await make_area(db, descripcion="Produccion Test")
    rh = await make_empleado(db, rol="rh", email="pf_tareas_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    for i in range(3):
        tarea = PerfilTarea(
            puesto_perfil_id=perfil.id,
            orden=i + 1,
            descripcion=f"Tarea de prueba #{i+1}",
            es_complemento=(i == 2),
        )
        db.add(tarea)

    await db.flush()
    return perfil, rh


async def make_perfil_with_cualificaciones(db: AsyncSession):
    """Crea un perfil con cualificaciones."""
    from app.models.talento import PerfilCualificacion

    area = await make_area(db, descripcion="Ingenieria Test")
    rh = await make_empleado(db, rol="rh", email="pf_cual_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    tipos = ["estudios_finalizados", "experiencia_profesional"]
    for i, tipo in enumerate(tipos):
        cual = PerfilCualificacion(
            puesto_perfil_id=perfil.id,
            tipo=tipo,
            situacion_deseada=f"Requerimiento {i+1}",
            comentarios=f"Comentario {i+1}",
        )
        db.add(cual)

    await db.flush()
    return perfil, rh


async def make_perfil_with_competencias(db: AsyncSession):
    """Crea un perfil con competencias requeridas."""
    from app.models.talento import PerfilCompetenciaRequerida

    area = await make_area(db, descripcion="Logistica Test")
    rh = await make_empleado(db, rol="rh", email="pf_comp_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    categorias = ["informatica", "profesional", "social"]
    for i, cat in enumerate(categorias):
        comp = PerfilCompetenciaRequerida(
            puesto_perfil_id=perfil.id,
            categoria=cat,
            descripcion=f"Competencia {cat} #{i+1}",
            orden=i + 1,
        )
        db.add(comp)

    await db.flush()
    return perfil, rh


# ===========================================================================
# ASIGNACIONES — Enrich con nombre_empleado
# ===========================================================================


@pytest.mark.asyncio
async def test_listar_asignaciones_incluye_nombre_empleado(client: AsyncClient, db):
    """GET /perfiles/{id}/asignaciones incluye nombre_empleado y no_empleado."""
    perfil, rh, empleados = await make_perfil_with_empleados(db, count=3)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/asignaciones",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3

    for item in data:
        assert "nombre_empleado" in item
        assert "no_empleado" in item
        assert item["nombre_empleado"] is not None
        assert item["no_empleado"] is not None
        assert item["nombre_empleado"].startswith("Empleado Prueba")
        assert item["no_empleado"].startswith("EMP-PF-")


@pytest.mark.asyncio
async def test_listar_asignaciones_preserva_campos_originales(client: AsyncClient, db):
    """GET /perfiles/{id}/asignaciones mantiene todos los campos existentes."""
    perfil, rh, _ = await make_perfil_with_empleados(db, count=1)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/asignaciones",
        headers=headers,
    )

    assert response.status_code == 200
    item = response.json()[0]

    required_fields = [
        "id", "puesto_perfil_id", "empleado_id", "departamento",
        "fecha_firma_superior", "fecha_firma_empleado",
        "firma_superior_id", "firma_empleado_id",
        "activo", "created_at", "updated_at",
    ]
    for field in required_fields:
        assert field in item, f"Missing field: {field}"

    assert item["puesto_perfil_id"] == perfil.id
    assert item["activo"] is True
    assert item["departamento"] == "Calidad"


@pytest.mark.asyncio
async def test_listar_asignaciones_perfil_inexistente_retorna_404(client: AsyncClient, db):
    """GET /perfiles/99999/asignaciones con perfil inexistente retorna 404."""
    rh = await make_empleado(db, rol="rh", email="pf_404_rh@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(
        "/api/v1/perfiles/99999/asignaciones",
        headers=headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_listar_asignaciones_vacio(client: AsyncClient, db):
    """GET /perfiles/{id}/asignaciones sin empleados retorna lista vacia."""
    area = await make_area(db, descripcion="Vacia Test")
    rh = await make_empleado(db, rol="rh", email="pf_empty_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/asignaciones",
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == []


# ===========================================================================
# TAREAS
# ===========================================================================


@pytest.mark.asyncio
async def test_listar_tareas_success(client: AsyncClient, db):
    """GET /perfiles/{id}/tareas retorna tareas ordenadas."""
    perfil, rh = await make_perfil_with_tareas(db)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    assert data[0]["orden"] == 1
    assert data[2]["es_complemento"] is True


@pytest.mark.asyncio
async def test_crear_tarea_success(client: AsyncClient, db):
    """POST /perfiles/{id}/tareas crea tarea exitosamente."""
    area = await make_area(db, descripcion="Crear Tarea Test")
    rh = await make_empleado(db, rol="rh", email="pf_ct_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {"orden": 1, "descripcion": "Nueva tarea de prueba", "es_complemento": False}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["descripcion"] == "Nueva tarea de prueba"
    assert data["puesto_perfil_id"] == perfil.id


@pytest.mark.asyncio
async def test_crear_tarea_empleado_no_autorizado(client: AsyncClient, db):
    """POST /perfiles/{id}/tareas con rol empleado retorna 403."""
    area = await make_area(db, descripcion="Auth Tarea Test")
    rh = await make_empleado(db, rol="rh", email="pf_auth_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_auth_emp@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, emp)

    payload = {"orden": 1, "descripcion": "No deberia crearse", "es_complemento": False}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/tareas",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 403


# ===========================================================================
# CUALIFICACIONES
# ===========================================================================


@pytest.mark.asyncio
async def test_listar_cualificaciones_success(client: AsyncClient, db):
    """GET /perfiles/{id}/cualificaciones retorna cualificaciones."""
    perfil, rh = await make_perfil_with_cualificaciones(db)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/cualificaciones",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    tipos = {c["tipo"] for c in data}
    assert "estudios_finalizados" in tipos
    assert "experiencia_profesional" in tipos


@pytest.mark.asyncio
async def test_crear_cualificacion_success(client: AsyncClient, db):
    """POST /perfiles/{id}/cualificaciones crea cualificacion."""
    area = await make_area(db, descripcion="Crear Cual Test")
    rh = await make_empleado(db, rol="rh", email="pf_cc_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {
        "tipo": "formacion_profesional",
        "situacion_deseada": "Tecnico en manufactura",
        "comentarios": "Deseable",
    }
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/cualificaciones",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["tipo"] == "formacion_profesional"
    assert data["situacion_deseada"] == "Tecnico en manufactura"


# ===========================================================================
# COMPETENCIAS REQUERIDAS
# ===========================================================================


@pytest.mark.asyncio
async def test_listar_competencias_success(client: AsyncClient, db):
    """GET /perfiles/{id}/competencias retorna competencias por categoria."""
    perfil, rh = await make_perfil_with_competencias(db)
    headers = await auth_headers(client, rh)

    response = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    categorias = {c["categoria"] for c in data}
    assert categorias == {"informatica", "profesional", "social"}


@pytest.mark.asyncio
async def test_crear_competencia_success(client: AsyncClient, db):
    """POST /perfiles/{id}/competencias crea competencia requerida."""
    area = await make_area(db, descripcion="Crear Comp Test")
    rh = await make_empleado(db, rol="rh", email="pf_ccomp_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {"categoria": "idiomas", "descripcion": "Ingles B2", "orden": 1}
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["categoria"] == "idiomas"
    assert data["descripcion"] == "Ingles B2"


# ===========================================================================
# CREAR ASIGNACION
# ===========================================================================


@pytest.mark.asyncio
async def test_crear_asignacion_success(client: AsyncClient, db):
    """POST /perfiles/{id}/asignaciones asigna empleado al perfil."""
    area = await make_area(db, descripcion="Asignar Test")
    rh = await make_empleado(db, rol="rh", email="pf_asig_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_asig_emp@leoni.test", nombre="Juan Garcia")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {
        "puesto_perfil_id": perfil.id,
        "empleado_id": emp.id,
        "departamento": "Produccion",
    }
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/asignaciones",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["empleado_id"] == emp.id
    assert data["activo"] is True


@pytest.mark.asyncio
async def test_crear_asignacion_empleado_inexistente_retorna_404(client: AsyncClient, db):
    """POST /perfiles/{id}/asignaciones con empleado_id inexistente retorna 404."""
    area = await make_area(db, descripcion="Asignar 404 Test")
    rh = await make_empleado(db, rol="rh", email="pf_asig404_rh@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    headers = await auth_headers(client, rh)

    payload = {
        "puesto_perfil_id": perfil.id,
        "empleado_id": 99999,
        "departamento": "Fantasma",
    }
    response = await client.post(
        f"/api/v1/perfiles/{perfil.id}/asignaciones",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 404


# ===========================================================================
# PUT EVALUACIONES — Validacion de IDs invalidos
# ===========================================================================


async def _setup_asignacion_con_datos(db: AsyncSession):
    """Helper: crea perfil con cualificaciones, competencias y una asignacion activa."""
    from app.models.talento import (
        PerfilCompetenciaRequerida,
        PerfilCualificacion,
        PerfilFunciones,
    )

    area = await make_area(db, descripcion="Eval Suite Test")
    rh = await make_empleado(db, rol="rh", email="pf_evs_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_evs_emp@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    cual = PerfilCualificacion(
        puesto_perfil_id=perfil.id,
        tipo="estudios_finalizados",
        situacion_deseada="Ingenieria industrial",
    )
    db.add(cual)

    comp = PerfilCompetenciaRequerida(
        puesto_perfil_id=perfil.id,
        categoria="informatica",
        descripcion="SAP basico",
        orden=1,
    )
    db.add(comp)

    asignacion = PerfilFunciones(
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        departamento="Test",
        activo=True,
    )
    db.add(asignacion)
    await db.flush()
    await db.refresh(cual)
    await db.refresh(comp)
    await db.refresh(asignacion)

    return perfil, rh, emp, asignacion, cual, comp


@pytest.mark.asyncio
async def test_put_evaluaciones_cualificacion_id_invalido_retorna_422(client: AsyncClient, db):
    """PUT evaluaciones con cualificacion_id inexistente debe retornar 422, no 500."""
    from app.models.talento import PerfilFunciones

    area = await make_area(db, descripcion="Eval Invalid Test")
    rh = await make_empleado(db, rol="rh", email="pf_eval_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_eval_emp@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    asignacion = PerfilFunciones(
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        departamento="Test",
        activo=True,
    )
    db.add(asignacion)
    await db.flush()
    await db.refresh(asignacion)

    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": 99999, "situacion_actual": "No existe"}
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code in (400, 422), (
        f"Expected 400 or 422, got {response.status_code}: {response.text}"
    )


@pytest.mark.asyncio
async def test_put_evaluaciones_competencia_id_invalido_retorna_422(client: AsyncClient, db):
    """PUT evaluaciones con competencia_requerida_id inexistente debe retornar 422, no 500."""
    from app.models.talento import PerfilFunciones

    area = await make_area(db, descripcion="Eval Comp Invalid Test")
    rh = await make_empleado(db, rol="rh", email="pf_evalc_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_evalc_emp@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    asignacion = PerfilFunciones(
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        departamento="Test",
        activo=True,
    )
    db.add(asignacion)
    await db.flush()
    await db.refresh(asignacion)

    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_competencia": [
            {"competencia_requerida_id": 99999, "situacion_actual": "No existe"}
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code in (400, 422), (
        f"Expected 400 or 422, got {response.status_code}: {response.text}"
    )


@pytest.mark.asyncio
async def test_put_evaluaciones_happy_path_crea_evaluacion(client: AsyncClient, db):
    """PUT evaluaciones con IDs validos crea evaluacion exitosamente."""
    perfil, rh, _, asignacion, cual, comp = await _setup_asignacion_con_datos(db)
    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": cual.id, "situacion_actual": "Tiene titulo", "comentarios": "OK"}
        ],
        "evaluaciones_competencia": [
            {"competencia_requerida_id": comp.id, "situacion_actual": "SAP intermedio"}
        ],
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    gap_cual = data["gap_cualificaciones"]
    gap_comp = data["gap_competencias"]
    assert len(gap_cual) == 1
    assert len(gap_comp) == 1
    assert gap_cual[0]["situacion_actual"] == "Tiene titulo"
    assert gap_cual[0]["evaluado"] is True
    assert gap_comp[0]["situacion_actual"] == "SAP intermedio"
    assert gap_comp[0]["evaluado"] is True


@pytest.mark.asyncio
async def test_put_evaluaciones_upsert_actualiza_existente(client: AsyncClient, db):
    """PUT evaluaciones actualiza una evaluacion existente sin duplicar."""
    perfil, rh, _, asignacion, cual, _ = await _setup_asignacion_con_datos(db)
    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": cual.id, "situacion_actual": "Version 1"}
        ],
    }
    await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    payload["evaluaciones_cualificacion"][0]["situacion_actual"] = "Version 2"
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 200
    data = response.json()
    gap_cual = data["gap_cualificaciones"]
    assert len(gap_cual) == 1
    assert gap_cual[0]["situacion_actual"] == "Version 2"


@pytest.mark.asyncio
async def test_put_evaluaciones_cualificacion_de_otro_perfil_retorna_422(client: AsyncClient, db):
    """PUT evaluaciones con cualificacion_id de otro perfil retorna 422."""
    from app.models.talento import PerfilCualificacion, PerfilFunciones

    area = await make_area(db, descripcion="Cross Perfil Test")
    rh = await make_empleado(db, rol="rh", email="pf_cross_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_cross_emp@leoni.test")

    perfil_a = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)
    perfil_b = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    cual_b = PerfilCualificacion(
        puesto_perfil_id=perfil_b.id,
        tipo="experiencia_profesional",
        situacion_deseada="5 anios en manufactura",
    )
    db.add(cual_b)

    asignacion_a = PerfilFunciones(
        puesto_perfil_id=perfil_a.id,
        empleado_id=emp.id,
        departamento="Test",
        activo=True,
    )
    db.add(asignacion_a)
    await db.flush()
    await db.refresh(cual_b)
    await db.refresh(asignacion_a)

    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": cual_b.id, "situacion_actual": "Cross-perfil hack"}
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil_a.id}/asignaciones/{asignacion_a.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_put_evaluaciones_multiples_ids_invalidos_reporta_todos(client: AsyncClient, db):
    """PUT evaluaciones con varios IDs invalidos los reporta todos en el error."""
    from app.models.talento import PerfilFunciones

    area = await make_area(db, descripcion="Multi Invalid Test")
    rh = await make_empleado(db, rol="rh", email="pf_multi_rh@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="pf_multi_emp@leoni.test")
    perfil = await make_puesto_perfil(db, area_id=area.area_id, created_by=rh.id)

    asignacion = PerfilFunciones(
        puesto_perfil_id=perfil.id,
        empleado_id=emp.id,
        departamento="Test",
        activo=True,
    )
    db.add(asignacion)
    await db.flush()
    await db.refresh(asignacion)

    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": 88888, "situacion_actual": "Fake 1"},
            {"cualificacion_id": 77777, "situacion_actual": "Fake 2"},
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 422
    body = response.json()
    assert "88888" in body["detail"]
    assert "77777" in body["detail"]


@pytest.mark.asyncio
async def test_put_evaluaciones_asignacion_inexistente_retorna_404(client: AsyncClient, db):
    """PUT evaluaciones con asignacion_id inexistente retorna 404."""
    perfil, rh, _, _, cual, _ = await _setup_asignacion_con_datos(db)
    headers = await auth_headers(client, rh)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": cual.id, "situacion_actual": "No importa"}
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/99999",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_put_evaluaciones_empleado_no_autorizado_retorna_403(client: AsyncClient, db):
    """PUT evaluaciones con rol empleado retorna 403."""
    perfil, _, emp, asignacion, cual, _ = await _setup_asignacion_con_datos(db)
    headers = await auth_headers(client, emp)

    payload = {
        "evaluaciones_cualificacion": [
            {"cualificacion_id": cual.id, "situacion_actual": "No deberia"}
        ]
    }
    response = await client.put(
        f"/api/v1/perfiles/{perfil.id}/asignaciones/{asignacion.id}",
        json=payload,
        headers=headers,
    )

    assert response.status_code == 403
