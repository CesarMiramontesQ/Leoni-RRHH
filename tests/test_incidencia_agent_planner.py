import json

from app.agents.incidencias.answer_format import format_tool_answer, is_valid_user_answer
from app.agents.incidencias.context_filters import merge_context_filters
from app.agents.incidencias.query_planner import plan_query


def test_plan_query_extracts_no_empleado_variants():
    planned = plan_query("incidencias del empleado 4652")
    assert planned is not None
    assert planned.args["no_empleado"] == "4652"


def test_plan_query_plant_retardos():
    planned = plan_query("Cuantos retardos hay en total en toda la planta")
    assert planned is not None
    assert planned.tool == "consultar_estadisticas"
    assert planned.args == {"tipo": "retardo"}
    assert "no_empleado" not in planned.args


def test_format_global_retardos_no_employee():
    payload = json.dumps(
        {
            "total_incidencias": 1044,
            "incidencias_por_tipo": [{"tipo": "Retardo", "total": 1044}],
            "empleados_con_mas_incidencias": [
                {"no_empleado": "4652", "nombre": "BLASCO SANCHEZ, ADALBERTO", "total": 83}
            ],
        }
    )
    answer = format_tool_answer("consultar_estadisticas", {"tipo": "retardo"}, payload)
    assert answer is not None
    assert "1044" in answer
    assert "toda la planta" in answer
    assert "BLASCO" not in answer
    assert "4652" not in answer


def test_context_strips_employee_on_plant_query():
    merged = merge_context_filters(
        {"tipo": "retardo"},
        {"no_empleado": "4652", "fecha_inicio": "2026-01-01"},
        user_message="Cuantos retardos hay en total en toda la planta",
    )
    assert merged == {"tipo": "retardo"}


def test_plan_query_attention_ranking():
    planned = plan_query(
        "En cual empleado deberia de poner mas atencion por motivos de sus incidencias y por que?"
    )
    assert planned is not None
    assert planned.tool == "consultar_estadisticas"
    assert planned.args == {}


def test_format_attention_ranking_answer():
    payload = json.dumps(
        {
            "total_incidencias": 200,
            "incidencias_seguridad": 5,
            "incidencias_calidad": 3,
            "incidencias_por_tipo": [
                {"tipo": "Retardo", "total": 150},
                {"tipo": "Falta Justificada", "total": 50},
            ],
            "empleados_con_mas_incidencias": [
                {"no_empleado": "4652", "nombre": "BLASCO SANCHEZ, ADALBERTO", "total": 83},
                {"no_empleado": "1200", "nombre": "PEREZ LOPEZ, JUAN", "total": 40},
                {"no_empleado": "3300", "nombre": "GARCIA, MARIA", "total": 25},
            ],
        }
    )
    answer = format_tool_answer(
        "consultar_estadisticas",
        {},
        payload,
        user_message=(
            "En cual empleado deberia de poner mas atencion por motivos de sus incidencias y por que?"
        ),
    )
    assert answer is not None
    assert "BLASCO" in answer
    assert "4652" in answer
    assert "83" in answer
    assert "43" in answer or "más que el siguiente" in answer


def test_is_valid_user_answer_rejects_field_names():
    assert is_valid_user_answer("no_empleado") is False
    assert is_valid_user_answer("El empleado 4652 tiene 83 incidencias.") is True
