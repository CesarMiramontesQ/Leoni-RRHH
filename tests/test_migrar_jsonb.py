# tests/test_migrar_jsonb.py
"""
Tests para la migración de datos JSONB a perfil_competencias_requeridas.
Valida la función extract_items y el flujo completo de migración via API.
"""

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.models.talento import PerfilCompetenciaRequerida, PuestoPerfil
from app.utils.jsonb_migration import CATEGORY_MAP, extract_items
from tests.conftest import auth_headers, make_empleado


# ── Unit tests para extract_items ───────────────────────────────────────────


def test_extract_items_from_string_list():
    raw = ["Excel avanzado", "SAP", "AutoCAD"]
    result = extract_items(raw)
    assert result == ["Excel avanzado", "SAP", "AutoCAD"]


def test_extract_items_from_dict_list():
    raw = [
        {"nombre": "Excel", "nivel": "avanzado"},
        {"nombre": "SAP", "nivel": "intermedio"},
    ]
    result = extract_items(raw)
    assert result == ["Excel (avanzado)", "SAP (intermedio)"]


def test_extract_items_from_dict_with_arrays():
    raw = {
        "software": ["Excel", "SAP"],
        "maquinas": ["Torno CNC"],
    }
    result = extract_items(raw)
    assert "Excel" in result
    assert "SAP" in result
    assert "Torno CNC" in result


def test_extract_items_empty_list():
    assert extract_items([]) == []


def test_extract_items_empty_dict():
    assert extract_items({}) == []


def test_extract_items_none():
    assert extract_items(None) == []


def test_extract_items_strips_whitespace():
    raw = ["  Excel  ", " SAP ", ""]
    result = extract_items(raw)
    assert result == ["Excel", "SAP"]


def test_extract_items_mixed_types_in_list():
    raw = ["Python", {"nombre": "JavaScript", "nivel": "avanzado"}, "SQL"]
    result = extract_items(raw)
    assert result == ["Python", "JavaScript (avanzado)", "SQL"]


# ── Integration tests ───────────────────────────────────────────────────────


@pytest_asyncio.fixture
async def perfil_con_jsonb(db):
    """Crea un PuestoPerfil con datos JSONB para testear la migración."""
    perfil = PuestoPerfil(
        codigo="PRF-TEST-001",
        nombre="Operador de Producción Test",
        competencias_tecnicas=["Manejo de CNC", "Lectura de planos", "Control estadístico"],
        habilidades_blandas=["Trabajo en equipo", "Comunicación efectiva"],
        maquinas_herramientas=["Torno CNC", "Fresadora", "Calibrador digital"],
        version=1,
        activo=True,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)
    return perfil


@pytest.mark.asyncio
async def test_migracion_crea_competencias_requeridas(db, perfil_con_jsonb):
    """Simula la lógica de migración y verifica que se crean las filas correctas."""
    perfil = perfil_con_jsonb

    for col_name, categoria in CATEGORY_MAP.items():
        raw = getattr(perfil, col_name)
        items = extract_items(raw)
        for orden, descripcion in enumerate(items, start=1):
            comp = PerfilCompetenciaRequerida(
                puesto_perfil_id=perfil.id,
                categoria=categoria,
                descripcion=descripcion,
                orden=orden,
            )
            db.add(comp)

    await db.flush()

    result = await db.execute(
        select(PerfilCompetenciaRequerida)
        .where(PerfilCompetenciaRequerida.puesto_perfil_id == perfil.id)
        .order_by(PerfilCompetenciaRequerida.categoria, PerfilCompetenciaRequerida.orden)
    )
    rows = result.scalars().all()

    assert len(rows) == 8  # 3 + 2 + 3

    profesional = [r for r in rows if r.categoria == "profesional"]
    assert len(profesional) == 3
    assert profesional[0].descripcion == "Manejo de CNC"
    assert profesional[1].descripcion == "Lectura de planos"
    assert profesional[2].descripcion == "Control estadístico"

    social = [r for r in rows if r.categoria == "social"]
    assert len(social) == 2
    assert social[0].descripcion == "Trabajo en equipo"

    complementos = [r for r in rows if r.categoria == "complementos"]
    assert len(complementos) == 3
    assert complementos[0].descripcion == "Torno CNC"


@pytest.mark.asyncio
async def test_migracion_idempotente(db, perfil_con_jsonb):
    """Ejecutar la migración dos veces no duplica datos."""
    perfil = perfil_con_jsonb

    for _ in range(2):
        for col_name, categoria in CATEGORY_MAP.items():
            existing = await db.execute(
                select(PerfilCompetenciaRequerida).where(
                    PerfilCompetenciaRequerida.puesto_perfil_id == perfil.id,
                    PerfilCompetenciaRequerida.categoria == categoria,
                )
            )
            if existing.scalars().first():
                continue

            raw = getattr(perfil, col_name)
            items = extract_items(raw)
            for orden, descripcion in enumerate(items, start=1):
                comp = PerfilCompetenciaRequerida(
                    puesto_perfil_id=perfil.id,
                    categoria=categoria,
                    descripcion=descripcion,
                    orden=orden,
                )
                db.add(comp)
            await db.flush()

    result = await db.execute(
        select(PerfilCompetenciaRequerida)
        .where(PerfilCompetenciaRequerida.puesto_perfil_id == perfil.id)
    )
    rows = result.scalars().all()
    assert len(rows) == 8


@pytest.mark.asyncio
async def test_migracion_datos_dict_format(db):
    """Migración con formato dict (categorías como keys)."""
    perfil = PuestoPerfil(
        codigo="PRF-TEST-002",
        nombre="Supervisor de Línea Test",
        competencias_tecnicas={
            "software": ["Excel", "SAP"],
            "procesos": ["Lean Manufacturing"],
        },
        habilidades_blandas=["Liderazgo", "Resolución de conflictos"],
        maquinas_herramientas=[],
        version=1,
        activo=True,
    )
    db.add(perfil)
    await db.flush()
    await db.refresh(perfil)

    items_tecnicas = extract_items(perfil.competencias_tecnicas)
    assert len(items_tecnicas) == 3
    assert "Excel" in items_tecnicas
    assert "SAP" in items_tecnicas
    assert "Lean Manufacturing" in items_tecnicas

    items_blandas = extract_items(perfil.habilidades_blandas)
    assert items_blandas == ["Liderazgo", "Resolución de conflictos"]

    items_maquinas = extract_items(perfil.maquinas_herramientas)
    assert items_maquinas == []


@pytest.mark.asyncio
async def test_endpoint_competencias_muestra_migrados(db, client, perfil_con_jsonb):
    """Las competencias migradas aparecen en el endpoint GET competencias."""
    perfil = perfil_con_jsonb
    rh = await make_empleado(db, rol="rh", nombre="Admin RH Migración")
    headers = await auth_headers(client, rh)

    for col_name, categoria in CATEGORY_MAP.items():
        raw = getattr(perfil, col_name)
        items = extract_items(raw)
        for orden, descripcion in enumerate(items, start=1):
            comp = PerfilCompetenciaRequerida(
                puesto_perfil_id=perfil.id,
                categoria=categoria,
                descripcion=descripcion,
                orden=orden,
            )
            db.add(comp)
    await db.flush()

    resp = await client.get(
        f"/api/v1/perfiles/{perfil.id}/competencias",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 8
    categorias = {item["categoria"] for item in data}
    assert categorias == {"profesional", "social", "complementos"}
