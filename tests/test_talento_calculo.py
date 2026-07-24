"""Tests puros de la agregacion del Dashboard de Talento (sin DB, sin HTTP)."""
import pytest

from app.services.talento import calculo
from app.services.talento.constants import MAX_EMPLEADOS_FOCO
from app.services.talento.types import SenalesEmpleado


# ── semaforo_pct ──────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "pct,esperado",
    [
        (100.0, "verde"),
        (80.0, "verde"),
        (79.9, "ambar"),
        (50.0, "ambar"),
        (49.9, "rojo"),
        (0.0, "rojo"),
    ],
)
def test_semaforo_pct_limites(pct, esperado):
    assert calculo.semaforo_pct(pct) == esperado


def test_semaforo_pct_none_es_none():
    """Sin dato no hay semaforo: la UI pinta n/d, no rojo."""
    assert calculo.semaforo_pct(None) is None


# ── promedios ─────────────────────────────────────────────────────────────
def test_promedio_redondea_a_un_decimal():
    assert calculo.promedio([70.0, 80.0, 91.0]) == 80.3


def test_promedio_lista_vacia_es_none():
    assert calculo.promedio([]) is None


def test_promedio_ponderado_usa_los_pesos():
    """Un area de 90 personas al 100% y otra de 10 al 0% dan 90, no 50."""
    assert calculo.promedio_ponderado([(100.0, 90), (0.0, 10)]) == 90.0


def test_promedio_ponderado_ignora_pesos_cero():
    assert calculo.promedio_ponderado([(80.0, 5), (10.0, 0)]) == 80.0


def test_promedio_ponderado_todos_peso_cero_es_none():
    assert calculo.promedio_ponderado([(80.0, 0)]) is None


def test_promedio_ponderado_lista_vacia_es_none():
    assert calculo.promedio_ponderado([]) is None


# ── senales de empleado ───────────────────────────────────────────────────
def _senales(**kwargs) -> SenalesEmpleado:
    base = dict(empleado_id=1, no_empleado=100, nombre="Ana", puesto_nombre="Crimpado")
    base.update(kwargs)
    return SenalesEmpleado(**base)


def test_n_senales_cuenta_solo_true():
    s = _senales(desempeno_bajo=True, polivalencia_baja=False, pdi_vencido=True)
    assert s.n_senales == 2
    assert s.senales_activas == ["desempeno_bajo", "pdi_vencido"]


def test_senal_none_no_cuenta_como_mala():
    """Sin ciclo activo, `desempeno_bajo` es None y no debe inflar el riesgo."""
    s = _senales(desempeno_bajo=None, polivalencia_baja=True)
    assert s.n_senales == 1


# ── empleados_en_foco ─────────────────────────────────────────────────────
def test_en_foco_requiere_dos_senales():
    una = _senales(empleado_id=1, nombre="Ana", desempeno_bajo=True)
    dos = _senales(empleado_id=2, nombre="Beto", desempeno_bajo=True, pdi_vencido=True)
    foco = calculo.empleados_en_foco([una, dos])
    assert [e.empleado_id for e in foco] == [2]


def test_en_foco_ordena_por_numero_de_senales_desc():
    dos = _senales(empleado_id=1, nombre="Ana", desempeno_bajo=True, pdi_vencido=True)
    cuatro = _senales(
        empleado_id=2, nombre="Beto", desempeno_bajo=True, polivalencia_baja=True,
        capacitacion_pendiente=True, pdi_vencido=True,
    )
    tres = _senales(
        empleado_id=3, nombre="Caro", desempeno_bajo=True, polivalencia_baja=True,
        capacitacion_pendiente=True,
    )
    foco = calculo.empleados_en_foco([dos, cuatro, tres])
    assert [e.empleado_id for e in foco] == [2, 3, 1]


def test_en_foco_desempata_por_nombre():
    a = _senales(empleado_id=1, nombre="Zoe", desempeno_bajo=True, pdi_vencido=True)
    b = _senales(empleado_id=2, nombre="Ana", desempeno_bajo=True, pdi_vencido=True)
    foco = calculo.empleados_en_foco([a, b])
    assert [e.nombre for e in foco] == ["Ana", "Zoe"]


def test_en_foco_aplica_tope():
    muchos = [
        _senales(empleado_id=i, nombre=f"Emp{i:02d}", desempeno_bajo=True, pdi_vencido=True)
        for i in range(MAX_EMPLEADOS_FOCO + 5)
    ]
    assert len(calculo.empleados_en_foco(muchos)) == MAX_EMPLEADOS_FOCO


def test_en_foco_lista_vacia():
    assert calculo.empleados_en_foco([]) == []


def test_en_foco_nadie_califica():
    assert calculo.empleados_en_foco([_senales(desempeno_bajo=True)]) == []
