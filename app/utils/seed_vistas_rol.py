"""
Configuración inicial de vistas por rol.

Siembra en `levelup_vistas_rol` una fila por cada par (rol configurable, vista) usando
`defaults_por_rol()`, que reproduce el acceso que cada rol tiene HOY. Es idempotente y
**nunca sobrescribe**: solo inserta las filas que faltan. Así, cuando se agrega una vista
nueva al catálogo, aparece con su valor por defecto (apagada, salvo declaración explícita)
sin tocar lo que el admin RH ya haya configurado.

Se ejecuta desde `app.utils.seed`, desde el lifespan de `app.main` y desde la migración
que crea la tabla.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.vista_rol_registry import ROLES_CONFIGURABLES, defaults_por_rol

logger = logging.getLogger(__name__)


async def ensure_vistas_rol_defaults(db: AsyncSession) -> int:
    """Inserta las filas (rol, vista) que falten. Retorna cuántas creó."""
    from app.models.roles import Rol
    from app.models.vistas_rol import VistaRol

    roles_result = await db.execute(
        select(Rol.id, Rol.nombre).where(Rol.nombre.in_(ROLES_CONFIGURABLES))
    )
    rol_id_por_nombre = {nombre: rol_id for rol_id, nombre in roles_result.all()}
    if not rol_id_por_nombre:
        logger.warning(
            "  No hay roles configurables en levelup_roles — se omite el seed de vistas por rol"
        )
        return 0

    existentes_result = await db.execute(select(VistaRol.rol_id, VistaRol.vista_key))
    existentes = {(rol_id, key) for rol_id, key in existentes_result.all()}

    creadas = 0
    for rol_nombre, vistas in defaults_por_rol().items():
        rol_id = rol_id_por_nombre.get(rol_nombre)
        if rol_id is None:
            logger.warning("  Rol '%s' no existe en BD — omitido", rol_nombre)
            continue
        for vista_key, habilitado in vistas.items():
            if (rol_id, vista_key) in existentes:
                continue
            db.add(VistaRol(rol_id=rol_id, vista_key=vista_key, habilitado=habilitado))
            creadas += 1

    if creadas:
        await db.flush()
        logger.info("  Vistas por rol: %d fila(s) sembrada(s)", creadas)
    return creadas
