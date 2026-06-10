"""Tests del agente vertical de incidencias (Ollama mockeado)."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.incidencias.tools import IncidenciasAgentTools
from app.models.empleados import Empleado
from app.services.incidencia_service import IncidenciaService
from tests.conftest import auth_headers, make_empleado, make_incidencia


@pytest.mark.asyncio
async def test_agent_chat_requires_auth(client: AsyncClient):
    r = await client.post(
        "/api/v1/incidencias/agent/chat",
        json={"messages": [{"role": "user", "content": "¿Cuántas incidencias hay?"}]},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_agent_chat_ollama_unavailable(client: AsyncClient, db, empleado_rh):
    headers = await auth_headers(client, empleado_rh)
    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=False),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.diagnose",
        new=AsyncMock(return_value=(False, "Ollama no disponible en tests")),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={"messages": [{"role": "user", "content": "Total de incidencias"}]},
            headers=headers,
        )
    assert r.status_code == 503
    assert "Ollama" in r.json()["detail"]


@pytest.mark.asyncio
async def test_agent_chat_success_with_tool(client: AsyncClient, db, empleado_rh):
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="tardanza")
    headers = await auth_headers(client, empleado_rh)

    responses = [
        '{"action":"consultar_estadisticas","args":{}}',
        '{"action":"final","answer":"Hay incidencias registradas en tu alcance."}',
    ]

    async def mock_chat(_messages):
        return responses.pop(0)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=mock_chat),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={"messages": [{"role": "user", "content": "¿Cuántas incidencias hay?"}]},
            headers=headers,
        )

    assert r.status_code == 200, r.text
    data = r.json()
    assert data["message"]["role"] == "assistant"
    assert "1 incidencia" in data["message"]["content"].lower()
    assert data["tool_trace"]
    assert data["tool_trace"][0]["tool"] == "consultar_estadisticas"
    assert data["tool_trace"][0]["ok"] is True


@pytest.mark.asyncio
async def test_agent_rejects_unknown_tool_name(client: AsyncClient, db, empleado_rh):
    headers = await auth_headers(client, empleado_rh)

    responses = [
        '{"action":"eliminar_incidencias","args":{}}',
        '{"action":"final","answer":"No puedo ejecutar esa acción."}',
    ]

    async def mock_chat(_messages):
        return responses.pop(0)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=mock_chat),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={"messages": [{"role": "user", "content": "Elimina todo"}]},
            headers=headers,
        )

    assert r.status_code == 200
    trace = r.json()["tool_trace"]
    assert trace[0]["tool"] == "eliminar_incidencias"
    assert trace[0]["ok"] is False


@pytest.mark.asyncio
async def test_tools_estadisticas_respect_supervisor_scope(db: AsyncSession):
    gerente = await make_empleado(db, rol="gerente", email="agent_ge@leoni.test")
    supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="agent_sup@leoni.test",
        lider_id=gerente.empleado_id,
    )
    otro_supervisor = await make_empleado(
        db,
        rol="supervisor",
        email="agent_sup2@leoni.test",
        lider_id=gerente.empleado_id,
    )
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email="agent_sub@leoni.test",
        lider_id=supervisor.empleado_id,
    )
    ajeno = await make_empleado(
        db,
        rol="empleado",
        email="agent_ajeno@leoni.test",
        lider_id=otro_supervisor.empleado_id,
    )

    await make_incidencia(db, empleado_id=subordinado.id, tipo="tardanza")
    await make_incidencia(db, empleado_id=subordinado.id, tipo="tardanza")
    await make_incidencia(db, empleado_id=ajeno.id, tipo="tardanza")

    svc = IncidenciaService(db)
    tools = IncidenciasAgentTools(svc, supervisor)
    result, ok = await tools.execute("consultar_estadisticas", {})
    assert ok is True
    data = json.loads(result)
    assert data["total_incidencias"] == 2


@pytest.mark.asyncio
async def test_agent_synthesizes_after_tool_when_model_loops_tools(
    client: AsyncClient, db, empleado_rh
):
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="tardanza")
    headers = await auth_headers(client, empleado_rh)

    responses = [
        '{"action":"consultar_estadisticas","args":{}}',
        '{"action":"final","answer":"Hay 1 incidencia en tu alcance."}',
    ]

    async def mock_chat(_messages):
        return responses.pop(0)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=mock_chat),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={"messages": [{"role": "user", "content": "¿Cuántas incidencias hay?"}]},
            headers=headers,
        )

    assert r.status_code == 200, r.text
    data = r.json()
    assert "1 incidencia" in data["message"]["content"].lower()
    assert data["tool_trace"][0]["tool"] == "consultar_estadisticas"


@pytest.mark.asyncio
async def test_format_tool_answer_from_estadisticas_json():
    from app.agents.incidencias.answer_format import format_tool_answer

    answer = format_tool_answer(
        "consultar_estadisticas",
        {},
        '{"total_incidencias": 7, "incidencias_por_tipo": []}',
    )
    assert answer is not None
    assert "7" in answer


@pytest.mark.asyncio
async def test_tools_employee_query_ignores_context_date_filters(db: AsyncSession, empleado_rh):
    from datetime import date

    emp = await make_empleado(
        db,
        rol="empleado",
        email="agent_4652@leoni.test",
        no_empleado="4652.0",
    )
    for _ in range(2):
        inc = await make_incidencia(db, empleado_id=emp.id, tipo="Retardo")
        inc.fecha = None
        inc.no_empleado = "4652"
    await db.flush()

    svc = IncidenciaService(db)
    tools = IncidenciasAgentTools(
        svc,
        empleado_rh,
        context_filters={
            "fecha_inicio": date(2026, 1, 1).isoformat(),
            "fecha_fin": date(2026, 6, 10).isoformat(),
        },
    )
    result, ok = await tools.execute("consultar_estadisticas", {"no_empleado": "4652"})
    assert ok is True
    data = json.loads(result)
    assert data["total_incidencias"] == 2


@pytest.mark.asyncio
async def test_merge_context_filters_drops_dates_on_employee_args():
    from app.agents.incidencias.context_filters import merge_context_filters

    merged = merge_context_filters(
        {"no_empleado": "4652"},
        {
            "fecha_inicio": "2026-01-01",
            "fecha_fin": "2026-06-10",
            "area": "Calidad",
        },
        user_message="cuantas incidencias tiene el empleado 4652",
    )
    assert merged == {"no_empleado": "4652"}


def test_plan_query_employee_count():
    from app.agents.incidencias.query_planner import plan_query

    planned = plan_query(
        "cuantas incidencias tiene el empleado con numero de empleado 4652"
    )
    assert planned is not None
    assert planned.tool == "consultar_estadisticas"
    assert planned.args["no_empleado"] == "4652"


def test_format_estadisticas_employee_answer():
    from app.agents.incidencias.answer_format import format_tool_answer

    payload = json.dumps(
        {
            "total_incidencias": 83,
            "incidencias_por_tipo": [
                {"tipo": "Retardo", "total": 77},
                {"tipo": "Falta Justificada", "total": 5},
            ],
            "empleados_con_mas_incidencias": [
                {"no_empleado": "4652", "nombre": "BLASCO SANCHEZ, ADALBERTO", "total": 83}
            ],
        }
    )
    answer = format_tool_answer(
        "consultar_estadisticas",
        {"no_empleado": "4652"},
        payload,
    )
    assert answer is not None
    assert "83" in answer
    assert "4652" in answer
    assert "Retardo" in answer


@pytest.mark.asyncio
async def test_agent_planned_attention_ranking_without_llm(client: AsyncClient, db, empleado_rh):
    emp_alto = await make_empleado(
        db, rol="empleado", email="agent_alto@leoni.test", no_empleado="9001"
    )
    emp_bajo = await make_empleado(
        db, rol="empleado", email="agent_bajo@leoni.test", no_empleado="9002"
    )
    for _ in range(3):
        inc = await make_incidencia(db, empleado_id=emp_alto.id, tipo="Retardo")
        inc.no_empleado = "9001"
    inc2 = await make_incidencia(db, empleado_id=emp_bajo.id, tipo="Retardo")
    inc2.no_empleado = "9002"
    await db.flush()
    headers = await auth_headers(client, empleado_rh)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=AssertionError("LLM no debe llamarse en consulta planificada")),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": (
                            "En cual empleado deberia de poner mas atencion "
                            "por motivos de sus incidencias y por que?"
                        ),
                    }
                ],
            },
            headers=headers,
        )

    assert r.status_code == 200, r.text
    data = r.json()
    content = data["message"]["content"]
    assert "9001" in content
    assert "requiere más atención" in content.lower() or "requiere mas atencion" in content.lower()
    assert data["tool_trace"][0]["tool"] == "consultar_estadisticas"


@pytest.mark.asyncio
async def test_agent_planned_plant_retardos_without_llm(client: AsyncClient, db, empleado_rh):
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="Retardo")
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="Retardo")
    await make_incidencia(db, empleado_id=empleado_rh.id, tipo="Falta Justificada")
    headers = await auth_headers(client, empleado_rh)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=AssertionError("LLM no debe llamarse en consulta planificada")),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "Cuantos retardos hay en total en toda la planta",
                    }
                ],
                "context_filters": {"no_empleado": "4652"},
            },
            headers=headers,
        )

    assert r.status_code == 200, r.text
    data = r.json()
    content = data["message"]["content"].lower()
    assert "2 retardo" in content or "2 retardos" in content
    assert "toda la planta" in content
    assert "4652" not in content
    assert data["tool_trace"][0]["args"] == {"tipo": "retardo"}


@pytest.mark.asyncio
async def test_agent_planned_employee_query_without_llm(client: AsyncClient, db, empleado_rh):
    emp = await make_empleado(
        db,
        rol="empleado",
        email="agent_planned@leoni.test",
        no_empleado="4652.0",
    )
    for _ in range(3):
        inc = await make_incidencia(db, empleado_id=emp.id, tipo="Retardo")
        inc.no_empleado = "4652"
    await db.flush()
    headers = await auth_headers(client, empleado_rh)

    with patch(
        "app.agents.base.ollama_chat.OllamaChatClient.health_check",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.agents.base.ollama_chat.OllamaChatClient.chat",
        new=AsyncMock(side_effect=AssertionError("LLM no debe llamarse en consulta planificada")),
    ):
        r = await client.post(
            "/api/v1/incidencias/agent/chat",
            json={
                "messages": [
                    {
                        "role": "user",
                        "content": "cuantas incidencias tiene el empleado con numero de empleado 4652",
                    }
                ],
                "context_filters": {
                    "fecha_inicio": "2026-01-01",
                    "fecha_fin": "2026-06-10",
                },
            },
            headers=headers,
        )

    assert r.status_code == 200, r.text
    data = r.json()
    assert "3" in data["message"]["content"]
    assert data["tool_trace"][0]["tool"] == "consultar_estadisticas"
    assert data["tool_trace"][0]["args"]["no_empleado"] == "4652"


@pytest.mark.asyncio
async def test_tools_invalid_args_returns_error(db, empleado_rh: Empleado):
    svc = IncidenciaService(db)
    tools = IncidenciasAgentTools(svc, empleado_rh)
    result, ok = await tools.execute("obtener_incidencia", {"id": 0})
    assert ok is False
    assert "error" in result.lower() or "Argumentos" in result
