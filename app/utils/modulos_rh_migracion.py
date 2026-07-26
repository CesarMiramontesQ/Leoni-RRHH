"""Transformaciones puras sobre el JSONB `levelup_empleados_config.modulos_rh`.

Vive fuera de la migración para poder probarse: una migración de permisos que
se equivoque otorga o quita accesos a gente real, y `alembic upgrade` no es un
sitio cómodo para descubrirlo.
"""

from __future__ import annotations

CLAVE_VIEJA = "capacidades"
CLAVE_NUEVA = "competencias"


def fusionar_capacidades_en_competencias(modulos: dict | None) -> tuple[dict, bool]:
    """Funde el permiso `capacidades` dentro de `competencias`.

    Devuelve `(modulos_nuevos, cambio)`. Reglas:

    - `capacidades` y `competencias` se combinan con **OR**: quien tuviera solo
      la matriz de multihabilidades conserva su acceso, ahora bajo la clave que
      queda. Es la única forma de no quitarle nada a nadie, y significa que ese
      usuario **gana** también el catálogo y las brechas de Competencias — el
      efecto que hay que contar y reportar antes de correr esto en producción.
    - La clave vieja se elimina siempre que esté presente, aunque valga `False`:
      dejarla sería ruido que el catálogo ya no reconoce.
    - Un dict vacío o `None` se deja como está: en este sistema significa
      "acceso completo" (`effective_modules`), no "sin permisos".
    """
    if not modulos:
        return {}, False
    if CLAVE_VIEJA not in modulos:
        return dict(modulos), False

    nuevos = dict(modulos)
    tenia_matriz = bool(nuevos.pop(CLAVE_VIEJA))
    if tenia_matriz:
        nuevos[CLAVE_NUEVA] = True
    else:
        nuevos.setdefault(CLAVE_NUEVA, False)
    return nuevos, True


def revertir_fusion(modulos: dict | None) -> tuple[dict, bool]:
    """Inverso posible de la fusión: reponer `capacidades` con el valor de
    `competencias`.

    No es un inverso exacto y no puede serlo — la fusión pierde la distinción
    entre "solo la matriz" y "ambas". Reponer el valor combinado es lo que
    menos accesos rompe si hay que volver atrás.
    """
    if not modulos or CLAVE_NUEVA not in modulos:
        return dict(modulos or {}), False
    nuevos = dict(modulos)
    nuevos[CLAVE_VIEJA] = bool(nuevos.get(CLAVE_NUEVA))
    return nuevos, True
