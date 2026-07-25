from app.services.operaciones import calculo
from app.services.operaciones.types import CompetenciaMeta, EmpleadoCompetencias


def _emp(eid, comps, puesto_id=1, puesto_nombre="Crimpado"):
    # comps: dict comp_id -> (actual, requerido)
    return EmpleadoCompetencias(
        empleado_id=eid, no_empleado=eid, nombre=f"Emp{eid}",
        puesto_perfil_id=puesto_id, puesto_nombre=puesto_nombre, competencias=comps,
    )


META = {
    10: CompetenciaMeta(10, "Crimpado manual", "Operación"),
    20: CompetenciaMeta(20, "Bloqueo LOTO", "Seguridad"),
}


def test_cobertura_total_parcial_y_cero():
    empleados = [
        _emp(1, {10: (3, 3), 20: (1, 3)}),  # cubre 10, no 20
        _emp(2, {10: (4, 3), 20: (0, 3)}),  # cubre 10, no 20
        _emp(3, {10: (2, 3)}),              # no cubre 10 (en entrenamiento)
    ]
    cobs = {c.competencia_id: c for c in calculo.cobertura_por_competencia(empleados, META)}
    # comp 10: requieren 3, cubren 2, en_entrenamiento 1 -> 66.7% -> ambar, ok(>=2)
    assert cobs[10].requieren == 3 and cobs[10].cubren == 2 and cobs[10].en_entrenamiento == 1
    assert cobs[10].cobertura_pct == 66.7
    assert cobs[10].semaforo == "ambar" and cobs[10].severidad == "ok"
    # comp 20: requieren 2, cubren 0 -> 0% rojo, severidad hueco
    assert cobs[20].requieren == 2 and cobs[20].cubren == 0
    assert cobs[20].cobertura_pct == 0.0
    assert cobs[20].semaforo == "rojo" and cobs[20].severidad == "hueco"


def test_severidad_punto_unico():
    empleados = [_emp(1, {10: (3, 3)}), _emp(2, {10: (1, 3)})]  # solo 1 cubre
    cob = calculo.cobertura_por_competencia(empleados, META)[0]
    assert cob.cubren == 1 and cob.severidad == "punto_unico"


def test_requisito_cero_se_ignora():
    # requerido 0 = N/A: no cuenta como requerida
    empleados = [_emp(1, {10: (0, 0)})]
    assert calculo.cobertura_por_competencia(empleados, META) == []
    assert calculo.indice_polivalencia_empleado(empleados[0]) is None


def test_indice_polivalencia_empleado():
    e = _emp(1, {10: (3, 3), 20: (1, 3)})  # cumple 1 de 2
    assert calculo.indice_polivalencia_empleado(e) == 50.0


def test_indice_polivalencia_area_excluye_sin_requisitos():
    empleados = [
        _emp(1, {10: (3, 3), 20: (3, 3)}),  # 100
        _emp(2, {10: (0, 3), 20: (0, 3)}),  # 0
        _emp(3, {10: (0, 0)}),              # sin requisitos -> excluido
    ]
    assert calculo.indice_polivalencia_area(empleados) == 50.0


def test_indice_polivalencia_area_sin_evaluables_es_none():
    """Sin dato != 0 %: si ningun empleado del area tiene requisitos evaluables
    la polivalencia no se puede calcular, y devolver 0.0 la pintaria en rojo."""
    assert calculo.indice_polivalencia_area([]) is None
    assert calculo.indice_polivalencia_area([_emp(1, {10: (0, 0)}), _emp(2, {})]) is None


def test_resiliencia_area():
    empleados = [
        _emp(1, {10: (3, 3), 20: (3, 3)}),
        _emp(2, {10: (3, 3), 20: (0, 3)}),  # 20 cubierto por 1 -> punto_unico
    ]
    cobs = calculo.cobertura_por_competencia(empleados, META)
    # comp10 cubren=2 (ok), comp20 cubren=1 (punto_unico) -> 1 de 2 sin punto unico = 50%
    assert calculo.resiliencia_area(cobs) == 50.0


def test_cobertura_dedup_empleado_multi_puesto_misma_area():
    # Emp1 asignado a dos puestos de la misma area: aparece 2 veces con el
    # mismo empleado_id pero distinto puesto_perfil_id. Cubre en un puesto y
    # no en el otro -> debe contar UNA sola vez como "cubre" (no 2 veces).
    empleados = [
        _emp(1, {10: (3, 3)}, puesto_id=1, puesto_nombre="Crimpado"),
        _emp(1, {10: (0, 3)}, puesto_id=2, puesto_nombre="Ensamble"),
        # Emp2 en dos puestos, NO cubre en ninguno -> cuenta una vez como
        # en_entrenamiento (tiene nivel iniciado en al menos una entrada).
        _emp(2, {10: (1, 3)}, puesto_id=1, puesto_nombre="Crimpado"),
        _emp(2, {10: (0, 3)}, puesto_id=3, puesto_nombre="Soldadura"),
    ]
    cob = calculo.cobertura_por_competencia(empleados, META)[0]
    assert cob.requieren == 2
    assert cob.cubren == 1
    assert cob.en_entrenamiento == 1


def test_candidatos_crosstrain_orden_y_limite():
    empleados = [
        _emp(1, {10: (3, 3)}),  # ya cubre -> excluido
        _emp(2, {10: (2, 3)}),  # candidato, nivel 2
        _emp(3, {10: (1, 3)}),  # candidato, nivel 1
        _emp(4, {10: (2, 3)}),  # candidato, nivel 2
    ]
    cands = calculo.candidatos_crosstrain(10, empleados, limite=2)
    # orden: nivel_actual desc, desempate por nombre -> Emp2, Emp4
    assert [c.empleado_id for c in cands] == [2, 4]
