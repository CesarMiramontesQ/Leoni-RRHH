"""Tests del modulo de Calibracion de Desempeno."""
from datetime import datetime, timezone

from app.models.ciclo_desempeno import CicloDesempenoResultado
from app.services.ciclo_desempeno_service import (
    DISTRIBUCION_OBJETIVO_DEFAULT,
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
