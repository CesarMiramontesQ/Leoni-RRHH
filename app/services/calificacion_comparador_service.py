"""Motor genérico de comparación de cualificaciones basado en configuración."""

from __future__ import annotations

from typing import Any

from app.models.talento import MetodoCalificacion, OpcionCalificacion
from app.utils.seed_cualificaciones_catalogo import NA_VARIANTS


def _peso_opcion(opciones: list[OpcionCalificacion], valor: str | None) -> int | None:
    if not valor:
        return None
    for op in opciones:
        if op.activo and op.valor == valor:
            return op.peso
    return None


def _es_na(criterio: dict | None, capturado: dict | None) -> bool:
    if criterio and criterio.get("na"):
        return True
    if capturado and capturado.get("na"):
        return True
    return False


def _legacy_a_criterio(
    situacion_deseada: str | None,
    anios_minimos: int | None,
    comparador: str,
) -> dict:
    if situacion_deseada in NA_VARIANTS:
        return {"na": True}
    if comparador == "numeric_gte" and anios_minimos is not None:
        return {"min_anios": anios_minimos}
    if comparador == "ordinal_gte" and situacion_deseada:
        return {"opcion_valor": situacion_deseada}
    if comparador == "boolean_yes":
        val = (situacion_deseada or "").strip().lower()
        if val in ("cumple", "si"):
            return {"opcion_valor": "si"}
        if val in ("no cumple", "no"):
            return {"opcion_valor": "no"}
    if situacion_deseada:
        return {"texto": situacion_deseada}
    return {}


def _legacy_a_capturado(
    situacion_actual: str | None,
    anios_actuales: int | None,
    comparador: str,
) -> dict:
    if situacion_actual in NA_VARIANTS:
        return {"na": True}
    if comparador == "numeric_gte":
        result: dict[str, Any] = {}
        if anios_actuales is not None:
            result["anios"] = anios_actuales
        if situacion_actual:
            result["texto"] = situacion_actual
        return result
    if comparador == "ordinal_gte" and situacion_actual:
        return {"opcion_valor": situacion_actual}
    if comparador == "boolean_yes":
        val = (situacion_actual or "").strip().lower()
        if val in ("cumple", "si"):
            return {"opcion_valor": "si"}
        if val in ("no cumple", "no"):
            return {"opcion_valor": "no"}
        if situacion_actual:
            return {"texto": situacion_actual}
        return {}
    if situacion_actual:
        return {"texto": situacion_actual}
    return {}


def normalizar_criterio(
    criterio_requerido: dict | None,
    *,
    situacion_deseada: str | None = None,
    anios_minimos: int | None = None,
    comparador: str = "none",
) -> dict:
    if criterio_requerido:
        return criterio_requerido
    return _legacy_a_criterio(situacion_deseada, anios_minimos, comparador)


def normalizar_capturado(
    valor_capturado: dict | None,
    *,
    situacion_actual: str | None = None,
    anios_actuales: int | None = None,
    comparador: str = "none",
) -> dict:
    if valor_capturado:
        return valor_capturado
    return _legacy_a_capturado(situacion_actual, anios_actuales, comparador)


def _comparar_ordinal_gte(
    opciones: list[OpcionCalificacion],
    criterio: dict,
    capturado: dict,
) -> bool | None:
    req = criterio.get("opcion_valor")
    act = capturado.get("opcion_valor")
    peso_req = _peso_opcion(opciones, req)
    peso_act = _peso_opcion(opciones, act)
    if peso_req is None or peso_act is None:
        return None
    return peso_act >= peso_req


def _comparar_numeric_gte(criterio: dict, capturado: dict) -> bool | None:
    min_anios = criterio.get("min_anios")
    anios = capturado.get("anios")
    if min_anios is None:
        return None
    if anios is None:
        return None
    try:
        return int(anios) >= int(min_anios)
    except (TypeError, ValueError):
        return None


def _comparar_numeric_range(criterio: dict, capturado: dict) -> bool | None:
    min_anios = criterio.get("min_anios")
    max_anios = criterio.get("max_anios")
    anios = capturado.get("anios")
    if anios is None:
        return None
    try:
        val = int(anios)
    except (TypeError, ValueError):
        return None
    if min_anios is not None and val < int(min_anios):
        return False
    if max_anios is not None and val > int(max_anios):
        return False
    if min_anios is not None or max_anios is not None:
        return True
    return None


def _comparar_exact(criterio: dict, capturado: dict) -> bool | None:
    req = criterio.get("opcion_valor") or criterio.get("texto")
    act = capturado.get("opcion_valor") or capturado.get("texto")
    if req is None or act is None:
        return None
    return str(act).strip().lower() == str(req).strip().lower()


def _comparar_boolean_yes(criterio: dict, capturado: dict) -> bool | None:
    req = (criterio.get("opcion_valor") or "").strip().lower()
    act = (capturado.get("opcion_valor") or "").strip().lower()
    if not act:
        act = (capturado.get("texto") or "").strip().lower()
    if req == "si":
        return act in ("si", "cumple", "1", "true")
    if req == "no":
        return act in ("no", "no cumple", "0", "false")
    if act in ("si", "cumple"):
        return True
    if act in ("no", "no cumple"):
        return False
    return None


def _comparar_set_superset(criterio: dict, capturado: dict) -> bool | None:
    req_vals = criterio.get("opciones_valor") or []
    act_vals = capturado.get("opciones_valor") or []
    if not req_vals:
        return None
    if not act_vals:
        return False
    req_set = {str(v) for v in req_vals}
    act_set = {str(v) for v in act_vals}
    return req_set.issubset(act_set)


def evaluar_cumplimiento(
    metodo: MetodoCalificacion | None,
    opciones: list[OpcionCalificacion],
    criterio_requerido: dict | None,
    valor_capturado: dict | None,
    *,
    situacion_deseada: str | None = None,
    situacion_actual: str | None = None,
    anios_minimos: int | None = None,
    anios_actuales: int | None = None,
) -> bool | None:
    """Evalúa si el valor capturado cumple el criterio requerido."""
    if metodo is None:
        return None

    config = metodo.config or {}
    comparador = config.get("comparador", "none")

    criterio = normalizar_criterio(
        criterio_requerido,
        situacion_deseada=situacion_deseada,
        anios_minimos=anios_minimos,
        comparador=comparador,
    )
    capturado = normalizar_capturado(
        valor_capturado,
        situacion_actual=situacion_actual,
        anios_actuales=anios_actuales,
        comparador=comparador,
    )

    if _es_na(criterio, None) or criterio.get("na"):
        return True
    if not capturado or capturado.get("na"):
        return None

    if comparador == "none":
        return None
    if comparador == "ordinal_gte":
        return _comparar_ordinal_gte(opciones, criterio, capturado)
    if comparador == "numeric_gte":
        return _comparar_numeric_gte(criterio, capturado)
    if comparador == "numeric_range":
        return _comparar_numeric_range(criterio, capturado)
    if comparador == "exact":
        return _comparar_exact(criterio, capturado)
    if comparador == "boolean_yes":
        return _comparar_boolean_yes(criterio, capturado)
    if comparador == "set_superset":
        return _comparar_set_superset(criterio, capturado)

    return None


def resolver_etiqueta_opcion(opciones: list[OpcionCalificacion], valor: str | None) -> str | None:
    if not valor:
        return None
    for op in opciones:
        if op.activo and op.valor == valor:
            return op.etiqueta
    return valor
