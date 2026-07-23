"""Tests de la fase 2: historial objetivo como senal del ciclo de desempeno."""
from datetime import date
from decimal import Decimal

import pytest

from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.schemas.ciclo_desempeno import CicloDesempenoCreate
from app.services.ciclo_desempeno_service import CicloDesempenoService
from app.services.historial_objetivo_service import HistorialObjetivoService
from app.services.metas_service import MetasService
from tests.conftest import make_empleado
from tests.test_ciclo_desempeno_service import (
    _agregar_participante_360,
    _crear_campana_360,
    _crear_meta_ciclo_activo,
    _crear_meta_individual_cerrada,
)


def test_ciclo_tiene_peso_historial_default_cero():
    ciclo = CicloDesempeno(nombre="C")
    cols = set(CicloDesempeno.__table__.columns.keys())
    assert "peso_historial" in cols
    assert CicloDesempeno.__table__.columns["peso_historial"].default.arg == Decimal("0")


def test_resultado_tiene_columnas_historial():
    cols = set(CicloDesempenoResultado.__table__.columns.keys())
    assert {"indice_historial", "peso_historial_efectivo"} <= cols


# ══════════════════════════════════════════════════════════════════════════
# Andamiaje: ciclo activo con ambas senales reales + peso_historial arbitrario
# (reusa los helpers granulares de tests/test_ciclo_desempeno_service.py)
# ══════════════════════════════════════════════════════════════════════════


async def _armar_ciclo_historial(
    db,
    *,
    peso_metas,
    peso_competencias,
    peso_historial,
    calificacion_meta=80,
    calificacion_360=4,
):
    """Ciclo activo con un empleado con metas cerradas + resultado 360, listo
    para leer en vivo o cerrar sin `forzar` (meta_ciclo cerrado, campana 360
    finalizada). Los pesos se configuran a gusto para ejercitar la 3a senal."""
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)

    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_cerrada(
        metas_service, meta_ciclo_id, empleado, jefe, calificacion=calificacion_meta
    )
    await metas_service.cerrar_ciclo(meta_ciclo_id)

    campana = await _crear_campana_360(db, estado="finalizada")
    await _agregar_participante_360(
        db, campana.id, empleado.empleado_id, calificacion_general=calificacion_360
    )

    service = CicloDesempenoService(db)
    data = CicloDesempenoCreate(
        nombre="Ciclo Historial",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 6, 30),
        meta_ciclo_id=meta_ciclo_id,
        eval360_campana_id=campana.id,
        peso_metas=Decimal(str(peso_metas)),
        peso_competencias=Decimal(str(peso_competencias)),
        peso_historial=Decimal(str(peso_historial)),
    )
    ciclo = await service.crear_ciclo(data)
    await service.activar_ciclo(ciclo.id)
    return service, ciclo.id, empleado


def _espia_indices(monkeypatch, *, devuelve):
    """Parcha `indices_historial_por_empleado` para inyectar indices
    deterministas y contar llamadas. `devuelve` = valor por empleado
    (float o None)."""
    llamadas = {"n": 0}

    async def fake_bulk(self, empleado_ids, fi, ff):
        llamadas["n"] += 1
        return {eid: devuelve for eid in empleado_ids}

    monkeypatch.setattr(
        HistorialObjetivoService, "indices_historial_por_empleado", fake_bulk
    )
    return llamadas


# ══════════════════════════════════════════════════════════════════════════
# Service — integracion de la 3a senal
# ══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_peso_historial_cero_no_abre_engine_ni_cambia_score(db, monkeypatch):
    # Ciclo activo con peso_historial=0 (default 60/40) y ambas senales reales.
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=40, peso_historial=0,
        calificacion_meta=80, calificacion_360=4,
    )
    # Espia: NO debe llamarse con peso 0 (no-regresion de costo, no abre bono).
    llamadas = _espia_indices(monkeypatch, devuelve=100.0)

    resultados = await service.resultados_ciclo(ciclo_id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)

    # Identico al calculo previo de dos senales: (60*80 + 40*75)/100 = 78.0.
    assert r.calificacion_desempeno == Decimal("78.00")
    assert r.banda_desempeno == "alto"
    assert r.indice_historial is None
    assert r.peso_historial_efectivo == Decimal("0.00")
    assert llamadas["n"] == 0


@pytest.mark.asyncio
async def test_peso_historial_mayor_cero_incorpora_indice_en_score(db, monkeypatch):
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=20, peso_historial=20,
        calificacion_meta=80, calificacion_360=4,
    )
    llamadas = _espia_indices(monkeypatch, devuelve=100.0)

    resultados = await service.resultados_ciclo(ciclo_id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)

    # (60*80 + 20*75 + 20*100)/100 = 83.0; las 3 senales presentes -> pesos
    # efectivos iguales a los configurados.
    assert r.calificacion_desempeno == Decimal("83.00")
    assert r.banda_desempeno == "alto"
    assert r.indice_historial == Decimal("100.00")
    assert r.peso_historial_efectivo == Decimal("20.00")
    assert r.peso_metas_efectivo == Decimal("60.00")
    assert r.peso_competencias_efectivo == Decimal("20.00")
    assert llamadas["n"] == 1


@pytest.mark.asyncio
async def test_cerrar_congela_indice_historial(db, monkeypatch):
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=20, peso_historial=20,
        calificacion_meta=80, calificacion_360=4,
    )
    _espia_indices(monkeypatch, devuelve=100.0)

    cerrado = await service.cerrar_ciclo(ciclo_id)
    assert cerrado.estado == "cerrado"

    resultados = await service.resultados_ciclo(ciclo_id)  # snapshot congelado
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)
    assert r.calificacion_desempeno == Decimal("83.00")
    assert r.indice_historial == Decimal("100.00")
    assert r.peso_historial_efectivo == Decimal("20.00")
    assert r.snapshot_at is not None


@pytest.mark.asyncio
async def test_indice_none_degrada_a_metas_360(db, monkeypatch):
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=20, peso_historial=20,
        calificacion_meta=80, calificacion_360=4,
    )
    # El bulk devuelve None para el empleado (senal ausente): el score cae a
    # metas+360 con el peso del historial redistribuido proporcionalmente.
    _espia_indices(monkeypatch, devuelve=None)

    resultados = await service.resultados_ciclo(ciclo_id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)

    # (60*80 + 20*75)/80 = 78.75; pesos efectivos re-escalados a sumar 100.
    assert r.calificacion_desempeno == Decimal("78.75")
    assert r.indice_historial is None
    assert r.peso_historial_efectivo == Decimal("0.00")
    assert r.peso_metas_efectivo == Decimal("75.00")
    assert r.peso_competencias_efectivo == Decimal("25.00")


# ══════════════════════════════════════════════════════════════════════════
# Schemas — validacion de la suma de pesos
# ══════════════════════════════════════════════════════════════════════════


def test_create_rechaza_los_tres_pesos_en_cero():
    import pydantic

    with pytest.raises(pydantic.ValidationError):
        CicloDesempenoCreate(
            nombre="C",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 6, 30),
            peso_metas=0,
            peso_competencias=0,
            peso_historial=0,
        )


def test_create_acepta_solo_peso_historial():
    c = CicloDesempenoCreate(
        nombre="C",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 6, 30),
        peso_metas=0,
        peso_competencias=0,
        peso_historial=100,
    )
    assert c.peso_historial == 100
