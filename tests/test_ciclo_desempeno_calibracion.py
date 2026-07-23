"""Tests del modulo de Calibracion de Desempeno."""
from datetime import datetime, timezone

from app.models.ciclo_desempeno import CicloDesempenoResultado


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
