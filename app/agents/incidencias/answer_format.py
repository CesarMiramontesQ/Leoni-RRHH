"""Respuestas determinísticas a partir de JSON de herramientas (sin depender del LLM)."""

from __future__ import annotations

import json
import re
from typing import Any

_FIELD_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
_ATTENTION_HINT = re.compile(
    r"\b("
    r"m[aá]s\s+atenci[oó]n|"
    r"poner\s+atenci[oó]n|"
    r"deber[ií]a\s+de\s+poner|"
    r"prioriz|"
    r"preocup|"
    r"empleado\s+con\s+m[aá]s|"
    r"cu[aá]l\s+empleado|"
    r"en\s+cual\s+empleado|"
    r"a\s+qui[eé]n"
    r")\b",
    re.IGNORECASE,
)


def is_valid_user_answer(answer: str) -> bool:
    text = (answer or "").strip()
    if len(text) < 8:
        return False
    if _FIELD_NAME_RE.fullmatch(text):
        return False
    return True


def _parse_tool_json(tool_results: str) -> dict[str, Any] | None:
    try:
        data = json.loads(tool_results)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        marker = "…[truncado]"
        if marker in tool_results:
            trimmed = tool_results.split(marker, 1)[0].rstrip()
            last_obj = trimmed.rfind("}")
            if last_obj > 0:
                try:
                    data = json.loads(trimmed[: last_obj + 1])
                    return data if isinstance(data, dict) else None
                except json.JSONDecodeError:
                    pass
        return None


def format_tool_answer(
    tool: str,
    args: dict[str, Any],
    tool_results: str,
    *,
    user_message: str = "",
) -> str | None:
    data = _parse_tool_json(tool_results)
    if data is None:
        return None
    if not isinstance(data, dict):
        return None
    if data.get("error"):
        return f"No pude completar la consulta: {data['error']}."

    if tool == "consultar_estadisticas":
        return _format_estadisticas(data, args, user_message=user_message)
    if tool == "listar_incidencias":
        return _format_listado(data, args)
    if tool == "obtener_incidencia":
        return _format_detalle(data)
    if tool in ("listar_tipos", "listar_areas", "listar_subareas"):
        items = data.get("items") or []
        if not items:
            return "No hay registros en el catálogo consultado."
        preview = ", ".join(str(x) for x in items[:8])
        suffix = f" y {len(items) - 8} más" if len(items) > 8 else ""
        label = {
            "listar_tipos": "tipos",
            "listar_areas": "áreas",
            "listar_subareas": "subáreas",
        }[tool]
        return f"Hay {len(items)} {label} registradas: {preview}{suffix}."

    return None


def _args_target_employee(args: dict[str, Any]) -> bool:
    for key in ("no_empleado", "nombre", "empleado_id"):
        val = args.get(key)
        if val is None:
            continue
        if isinstance(val, str) and not val.strip():
            continue
        return True
    return False


def _is_attention_query(user_message: str) -> bool:
    return bool(
        _ATTENTION_HINT.search(user_message)
        and re.search(r"\bincidencias?\b", user_message, re.IGNORECASE)
    )


def _format_top_empleado_attention(data: dict[str, Any]) -> str:
    empleados = data.get("empleados_con_mas_incidencias") or []
    if not empleados:
        return "No hay empleados con incidencias registradas para priorizar."

    top = empleados[0]
    nombre = str(top.get("nombre") or "Sin nombre").strip()
    no_emp = str(top.get("no_empleado") or "—").strip()
    total_top = int(top.get("total") or 0)

    lines = [
        f"El empleado que requiere más atención es {nombre} (no. {no_emp}), "
        f"con {total_top} incidencia(s) registrada(s)."
    ]

    if len(empleados) > 1:
        segundo = empleados[1]
        nombre2 = str(segundo.get("nombre") or "Sin nombre").strip()
        total2 = int(segundo.get("total") or 0)
        diff = total_top - total2
        if diff > 0:
            lines.append(
                f"Concentra {diff} incidencia(s) más que el siguiente en el ranking "
                f"({nombre2}, {total2})."
            )
        if len(empleados) > 2:
            otros = [
                f"{str(e.get('nombre') or '?').strip()} ({int(e.get('total') or 0)})"
                for e in empleados[1:3]
            ]
            lines.append(f"Siguientes: {', '.join(otros)}.")

    tipos = data.get("incidencias_por_tipo") or []
    if tipos:
        chunks = [f"{t.get('tipo', '?')}: {t.get('total', 0)}" for t in tipos[:4]]
        lines.append(
            "En la planta, los tipos más frecuentes son: "
            + ", ".join(chunks)
            + ". Revisa si este empleado repite alguno de esos patrones."
        )

    seg = int(data.get("incidencias_seguridad") or 0)
    cal = int(data.get("incidencias_calidad") or 0)
    if seg > 0 or cal > 0:
        lines.append(
            f"Contexto general: {seg} incidencia(s) de seguridad y {cal} de calidad en el alcance consultado."
        )

    return " ".join(lines)


def _format_estadisticas(
    data: dict[str, Any],
    args: dict[str, Any],
    *,
    user_message: str = "",
) -> str:
    total = int(data.get("total_incidencias") or 0)
    tipo_filtro = str(args.get("tipo") or "").strip()
    employee_query = _args_target_employee(args)

    if not employee_query and _is_attention_query(user_message):
        return _format_top_empleado_attention(data)

    if employee_query:
        no_empleado = str(args.get("no_empleado") or "").strip()
        nombre = str(args.get("nombre") or "").strip()
        empleados = data.get("empleados_con_mas_incidencias") or []
        if empleados and not nombre and no_empleado:
            top = empleados[0]
            if str(top.get("no_empleado") or "").strip() in {no_empleado, f"{no_empleado}.0"}:
                nombre = str(top.get("nombre") or "").strip()

        if nombre and no_empleado:
            subject = f"El empleado {nombre} (no. {no_empleado})"
        elif nombre:
            subject = f"El empleado {nombre}"
        else:
            subject = f"El empleado con número {no_empleado}"

        if total == 0:
            return f"{subject} no tiene incidencias registradas."

        tipos = data.get("incidencias_por_tipo") or []
        tipo_txt = ""
        if tipos:
            chunks = [f"{t.get('tipo', '?')}: {t.get('total', 0)}" for t in tipos[:6]]
            tipo_txt = f" Desglose: {', '.join(chunks)}."
        return f"{subject} tiene {total} incidencia(s) registrada(s).{tipo_txt}"

    if total == 0:
        if tipo_filtro:
            return f"No hay registros de tipo «{tipo_filtro}» en toda la planta."
        return "No hay incidencias registradas en toda la planta."

    if tipo_filtro:
        label = tipo_filtro.lower()
        if label == "retardo":
            return f"Hay {total} retardo(s) registrados en toda la planta."
        return f"Hay {total} incidencia(s) de tipo «{tipo_filtro}» en toda la planta."

    tipos = data.get("incidencias_por_tipo") or []
    if tipos:
        chunks = [f"{t.get('tipo', '?')}: {t.get('total', 0)}" for t in tipos[:6]]
        return (
            f"Hay {total} incidencia(s) en toda la planta. "
            f"Desglose: {', '.join(chunks)}."
        )
    return f"Hay {total} incidencia(s) registradas en toda la planta."


def _format_listado(data: dict[str, Any], args: dict[str, Any]) -> str:
    total = int(data.get("total") or 0)
    items = data.get("items") or []
    no_empleado = str(args.get("no_empleado") or "").strip()
    if total == 0:
        if no_empleado:
            return f"No hay incidencias registradas para el empleado {no_empleado}."
        return "No hay incidencias que coincidan con la consulta."

    lines = [f"Encontré {total} incidencia(s). Mostrando {len(items)} en esta página:"]
    for item in items[:5]:
        tipo = item.get("tipo") or "—"
        fecha = item.get("fecha") or "sin fecha"
        detalle = (item.get("detalle") or "")[:80]
        lines.append(f"- {tipo} ({fecha}){': ' + detalle if detalle else ''}")
    if total > len(items):
        lines.append(f"… y {total - len(items)} más (pide otra página si necesitas el listado completo).")
    return "\n".join(lines)


def _format_detalle(data: dict[str, Any]) -> str:
    tipo = data.get("tipo") or "—"
    nombre = data.get("nombre") or "—"
    no_empleado = data.get("no_empleado") or "—"
    fecha = data.get("fecha") or "sin fecha"
    area = data.get("area") or "—"
    detalle = (data.get("detalle") or "—")[:300]
    return (
        f"Incidencia #{data.get('id', '—')}: {tipo} de {nombre} (no. {no_empleado}), "
        f"fecha {fecha}, área {area}. Detalle: {detalle}"
    )
