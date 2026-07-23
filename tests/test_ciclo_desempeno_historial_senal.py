"""Tests de la fase 2: historial objetivo como senal del ciclo de desempeno."""
from decimal import Decimal

from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado


def test_ciclo_tiene_peso_historial_default_cero():
    ciclo = CicloDesempeno(nombre="C")
    cols = set(CicloDesempeno.__table__.columns.keys())
    assert "peso_historial" in cols
    assert CicloDesempeno.__table__.columns["peso_historial"].default.arg == Decimal("0")


def test_resultado_tiene_columnas_historial():
    cols = set(CicloDesempenoResultado.__table__.columns.keys())
    assert {"indice_historial", "peso_historial_efectivo"} <= cols
