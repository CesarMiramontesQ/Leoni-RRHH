import json

from app.agents.incidencias.answer_format import format_tool_answer
from app.agents.incidencias.tools import _compact_json, _slim_estadisticas_payload
from app.schemas.incidencias import IncidenciasEstadisticasResponse


def test_slim_estadisticas_stays_parseable_with_large_series():
    huge_series = [
        {"periodo": f"2020-{m:02d}", "tipo": f"Tipo {t}", "total": 1}
        for m in range(1, 13)
        for t in range(50)
    ]
    stats = IncidenciasEstadisticasResponse(
        total_incidencias=5000,
        incidencias_seguridad=10,
        incidencias_calidad=8,
        areas_con_mas_incidencias=[],
        subareas_con_mas_incidencias=[],
        empleados_con_mas_incidencias=[
            {
                "empleado_id": 1,
                "no_empleado": "4652",
                "nombre": "BLASCO SANCHEZ, ADALBERTO",
                "total": 83,
            }
        ],
        incidencias_por_tipo=[{"tipo": "Retardo", "total": 4000, "porcentaje": 80.0}],
        incidencias_por_mes=[{"periodo": "2026-01", "total": 100}],
        incidencias_por_mes_y_tipo=huge_series,
        incidencias_por_periodo_y_tipo=huge_series,
    )

    full_raw = json.dumps(stats.model_dump(mode="json"))
    assert len(full_raw) > 4000

    slim = _slim_estadisticas_payload(stats)
    compact = _compact_json(slim)
    parsed = json.loads(compact)
    assert parsed["total_incidencias"] == 5000
    assert parsed["empleados_con_mas_incidencias"][0]["no_empleado"] == "4652"

    answer = format_tool_answer(
        "consultar_estadisticas",
        {},
        compact,
        user_message=(
            "En cual empleado deberia de poner mas atencion "
            "por motivos de sus incidencias y por que?"
        ),
    )
    assert answer is not None
    assert "BLASCO" in answer
    assert "4652" in answer
