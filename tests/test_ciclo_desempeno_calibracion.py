"""Tests del modulo de Calibracion de Desempeno."""
from datetime import datetime, timezone

import pydantic
import pytest

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.schemas.ciclo_desempeno import BandaAjusteItem
from app.services.ciclo_desempeno_service import (
    DISTRIBUCION_OBJETIVO_DEFAULT,
    CicloDesempenoService,
    banda_efectiva,
    distribucion_bandas,
)


def test_modelo_resultado_tiene_columnas_de_ajuste():
    r = CicloDesempenoResultado(ciclo_id=1, empleado_id=10)
    r.banda_desempeno_ajustada = "alto"
    r.banda_ajuste_motivo = "corrige sesgo del jefe"
    r.banda_ajustada_por_id = 99
    r.banda_ajustada_at = datetime.now(timezone.utc)
    assert r.banda_desempeno_ajustada == "alto"
    assert r.banda_ajuste_motivo == "corrige sesgo del jefe"
    assert r.banda_ajustada_por_id == 99
    assert r.banda_ajustada_at is not None

    cols = set(CicloDesempenoResultado.__table__.columns.keys())
    assert {
        "banda_desempeno_ajustada",
        "banda_ajuste_motivo",
        "banda_ajustada_por_id",
        "banda_ajustada_at",
    } <= cols


def test_banda_efectiva_ajustada_gana():
    assert banda_efectiva("bajo", "alto") == "alto"


def test_banda_efectiva_sin_ajuste_usa_calculada():
    assert banda_efectiva("medio", None) == "medio"


def test_banda_efectiva_ambas_none():
    assert banda_efectiva(None, None) is None


def test_distribucion_bandas_mezcla():
    d = distribucion_bandas(["alto", "alto", "medio", "bajo", None])
    assert d["alto"] == 2 and d["medio"] == 1 and d["bajo"] == 1
    assert d["total"] == 4  # None se ignora
    assert d["pct"]["alto"] == 50.0
    assert d["pct"]["medio"] == 25.0
    assert d["pct"]["bajo"] == 25.0


def test_distribucion_bandas_vacia():
    d = distribucion_bandas([])
    assert d["total"] == 0
    assert d["pct"] == {"bajo": 0.0, "medio": 0.0, "alto": 0.0}


def test_distribucion_objetivo_default_suma_100():
    assert sum(DISTRIBUCION_OBJETIVO_DEFAULT.values()) == 100.0


async def _ciclo_activo_con_resultado(db, banda="medio", potencial=None, banda_potencial=None):
    """Crea un ciclo activo con un resultado ya poblado (banda_desempeno set)
    sin depender de fuentes metas/360."""
    ciclo = CicloDesempeno(nombre="C1", estado="activo", umbral_medio=50, umbral_alto=75)
    db.add(ciclo)
    await db.flush()
    repo = CicloDesempenoRepository(db)
    await repo.upsert_resultado(
        ciclo.id, 10,
        calificacion_desempeno=60,
        banda_desempeno=banda,
        potencial=potencial,
        banda_potencial=banda_potencial,
        segmento_9box=(f"{banda}_{banda_potencial}" if banda_potencial else None),
    )
    await db.commit()
    return ciclo


@pytest.mark.asyncio
async def test_ajustar_banda_sube_banda_y_audita(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id,
        [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="corrige sesgo")],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada == "alto"
    assert out[0].banda_desempeno_efectiva == "alto"
    # Sin meta_ciclo_id/eval360_campana_id vinculados, la banda CALCULADA en
    # vivo es None (sin senales); la efectiva viene del override.
    assert out[0].banda_desempeno is None
    assert out[0].banda_ajuste_motivo == "corrige sesgo"
    assert out[0].banda_ajustada_por_id == 99
    assert out[0].banda_ajustada_at is not None


@pytest.mark.asyncio
async def test_ajustar_banda_reversion_limpia_columnas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada=None, motivo=None)],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada is None
    assert out[0].banda_ajuste_motivo is None
    assert out[0].banda_ajustada_por_id is None
    assert out[0].banda_ajustada_at is None
    # Sin override y sin senales vinculadas, la efectiva vuelve a la
    # calculada en vivo, que es None (mismo motivo que el test anterior).
    assert out[0].banda_desempeno_efectiva is None


@pytest.mark.asyncio
async def test_ajustar_banda_motivo_vacio_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(DomainValidationError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="  ")],
            current_user_id=99,
        )


def test_bandaajusteitem_banda_invalida_rechaza():
    """`banda_ajustada` invalida se rechaza al CONSTRUIR el schema (field_validator,
    autoridad unica), sin llegar al service."""
    with pytest.raises(pydantic.ValidationError):
        BandaAjusteItem(empleado_id=10, banda_ajustada="excelente", motivo="x")


@pytest.mark.asyncio
async def test_ajustar_banda_ciclo_no_activo_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    ciclo.estado = "cerrado"
    db.add(ciclo)
    await db.commit()
    svc = CicloDesempenoService(db)
    with pytest.raises(ConflictError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_empleado_fuera_del_ciclo_404(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(NotFoundError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=777, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_recompone_segmento_con_efectiva(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio", potencial=90, banda_potencial="alto")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    assert out[0].segmento_9box == "alto_alto"  # banda efectiva (alto), no la calculada (medio)


@pytest.mark.asyncio
async def test_distribucion_ciclo_cuenta_bandas_efectivas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="bajo")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    dist = await svc.distribucion_ciclo(ciclo.id)
    assert dist.actual.alto == 1
    assert dist.actual.bajo == 0  # la calculada era bajo, pero cuenta la efectiva (alto)
    assert dist.objetivo["alto"] == 20.0
    assert dist.desviacion["alto"] == round(100.0 - 20.0, 2)
