"""Tests de la fase 2: historial objetivo como senal del ciclo de desempeno."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.schemas.ciclo_desempeno import (
    BandaAjusteItem,
    CicloDesempenoCreate,
    PotencialUpdateItem,
)
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


# ══════════════════════════════════════════════════════════════════════════
# Cierre de huecos de cobertura (Tarea 6)
# ══════════════════════════════════════════════════════════════════════════
# Hueco 1 (regresion end-to-end sin ajuste): YA CUBIERTO por
# `test_peso_historial_cero_no_abre_engine_ni_cambia_score`, que fija un ciclo
# con peso_historial=0 y verifica que calificacion_desempeno == Decimal("78.00")
# y banda_desempeno == "alto", identico al calculo de 2 senales (60*80+40*75)/100,
# ademas de no abrir el engine (llamadas == 0). No se duplica aqui.


def _espia_indices_captura(monkeypatch, *, devuelve):
    """Como `_espia_indices` pero captura ADEMAS el rango (fi, ff) con el que se
    invoca `indices_historial_por_empleado`, para verificar que el service pasa
    las fechas del ciclo (o la ventana de 365 dias cuando faltan)."""
    capturado = {"n": 0, "fi": None, "ff": None, "empleado_ids": None}

    async def fake_bulk(self, empleado_ids, fi, ff):
        capturado["n"] += 1
        capturado["fi"] = fi
        capturado["ff"] = ff
        capturado["empleado_ids"] = list(empleado_ids)
        return {eid: devuelve for eid in empleado_ids}

    monkeypatch.setattr(
        HistorialObjetivoService, "indices_historial_por_empleado", fake_bulk
    )
    return capturado


@pytest.mark.asyncio
async def test_rango_historial_usa_fechas_del_ciclo(db, monkeypatch):
    # Hueco 2: con peso_historial>0, el bulk recibe fecha_inicio/fecha_fin del
    # ciclo tal cual (2026-01-01 .. 2026-06-30), no una ventana inventada.
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=20, peso_historial=20,
    )
    cap = _espia_indices_captura(monkeypatch, devuelve=100.0)

    await service.resultados_ciclo(ciclo_id)

    assert cap["n"] == 1
    assert cap["fi"] == date(2026, 1, 1)
    assert cap["ff"] == date(2026, 6, 30)
    assert empleado.empleado_id in cap["empleado_ids"]


@pytest.mark.asyncio
async def test_rango_historial_sin_fechas_usa_ventana_365(db, monkeypatch):
    # Hueco 2 (borde): un ciclo activo sin fechas (columnas anuladas tras
    # activar) cae a una ventana de ~365 dias que termina hoy.
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=60, peso_competencias=20, peso_historial=20,
    )
    ciclo = await service.repo.get_ciclo(ciclo_id)
    ciclo.fecha_inicio = None
    ciclo.fecha_fin = None
    await service.repo.update_ciclo(ciclo)

    cap = _espia_indices_captura(monkeypatch, devuelve=100.0)
    await service.resultados_ciclo(ciclo_id)

    assert cap["n"] == 1
    assert cap["ff"] == date.today()
    assert (cap["ff"] - cap["fi"]).days == 365


@pytest.mark.asyncio
async def test_ciclo_cerrado_legacy_indice_none_no_crashea(db):
    # Hueco 3: un ciclo cerrado ANTES de la fase 2 tiene indice_historial y
    # peso_historial_efectivo NULL en su snapshot. La lectura del snapshot debe
    # exponerlos como None sin reventar (no recalcula: estado cerrado).
    ciclo = CicloDesempeno(
        nombre="Cerrado legacy", estado="cerrado", umbral_medio=50, umbral_alto=75
    )
    db.add(ciclo)
    await db.flush()
    repo = CicloDesempenoRepository(db)
    await repo.upsert_resultado(
        ciclo.id,
        10,
        calificacion_desempeno=Decimal("78.00"),
        banda_desempeno="alto",
        snapshot_at=datetime.now(timezone.utc),
    )
    await db.commit()

    service = CicloDesempenoService(db)
    resultados = await service.resultados_ciclo(ciclo.id)
    r = next(x for x in resultados if x.empleado_id == 10)

    assert r.indice_historial is None
    assert r.peso_historial_efectivo is None
    assert r.calificacion_desempeno == Decimal("78.00")
    assert r.banda_desempeno == "alto"
    assert r.banda_desempeno_efectiva == "alto"


@pytest.mark.asyncio
async def test_historial_en_banda_y_calibracion_override_gana(db, monkeypatch):
    # Hueco 4: con peso_historial>0 el historial ENTRA en la banda calculada
    # (metas=40, 360=0, hist=100 con pesos 20/20/60 -> score 68 -> "medio";
    # sin historial seria (20*40+20*0)/40 = 20 -> "bajo"), y aun asi el override
    # de calibracion sigue ganando: la banda efectiva es la ajustada, no la
    # calculada, y el 9box agrupa por la efectiva.
    service, ciclo_id, empleado = await _armar_ciclo_historial(
        db, peso_metas=20, peso_competencias=20, peso_historial=60,
        calificacion_meta=40, calificacion_360=1,
    )
    _espia_indices(monkeypatch, devuelve=100.0)
    admin = await make_empleado(db, rol="rh")

    # Banda calculada incorpora el historial: "medio", distinta de la "bajo" de
    # dos senales.
    resultados = await service.resultados_ciclo(ciclo_id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)
    assert r.calificacion_desempeno == Decimal("68.00")
    assert r.banda_desempeno == "medio"
    assert r.indice_historial == Decimal("100.00")

    # Potencial alto para que el segmento 9box sea significativo.
    await service.set_potencial(
        ciclo_id,
        [PotencialUpdateItem(empleado_id=empleado.empleado_id, potencial=Decimal("90"))],
        current_user_id=admin.empleado_id,
    )
    # Override de calibracion: sube la banda a "alto".
    out = await service.ajustar_banda(
        ciclo_id,
        [BandaAjusteItem(empleado_id=empleado.empleado_id, banda_ajustada="alto", motivo="corrige sesgo")],
        current_user_id=admin.empleado_id,
    )
    aj = next(x for x in out if x.empleado_id == empleado.empleado_id)
    assert aj.banda_desempeno == "medio"            # calculada (con historial) intacta
    assert aj.banda_desempeno_ajustada == "alto"
    assert aj.banda_desempeno_efectiva == "alto"    # el override gana

    # El 9box agrupa por la banda EFECTIVA (alto), no por la calculada (medio).
    nb = await service.construir_9box(ciclo_id)

    def _emp_en(bd, bp):
        celda = next(
            c for c in nb.celdas if c.banda_desempeno == bd and c.banda_potencial == bp
        )
        return {e.empleado_id for e in celda.empleados}

    assert _emp_en("alto", "alto") == {empleado.empleado_id}
    assert _emp_en("medio", "alto") == set()
