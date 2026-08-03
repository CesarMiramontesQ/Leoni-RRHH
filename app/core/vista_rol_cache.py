"""
Caché en memoria de la configuración de vistas por rol.

La configuración deliberadamente NO viaja en el JWT: así un cambio del admin RH aplica sin
obligar a los usuarios a volver a iniciar sesión (a diferencia de los permisos por módulo,
que sí lo exigen). El precio es leerla de BD, y por eso se cachea.

Con varios workers, un cambio tarda hasta `TTL_SEGUNDOS` en propagarse a los procesos que
no atendieron la escritura; el que la atiende invalida su copia de inmediato.
"""

from __future__ import annotations

import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.vista_rol_registry import ROLES_CONFIGURABLES, VISTAS_ROL, defaults_por_rol

TTL_SEGUNDOS = 30.0

_config: dict[str, dict[str, bool]] | None = None
_cargado_en: float = 0.0


def invalidate() -> None:
    """Fuerza la relectura en la siguiente consulta (tras guardar cambios)."""
    global _config, _cargado_en
    _config = None
    _cargado_en = 0.0


def _vigente() -> bool:
    return _config is not None and (time.monotonic() - _cargado_en) < TTL_SEGUNDOS


async def _leer_de_bd(db: AsyncSession) -> dict[str, dict[str, bool]]:
    """Config completa por rol.

    Un rol sin ninguna fila cae a sus valores por defecto —el acceso que tiene de
    origen—, no a "todo apagado": es el mismo criterio que `effective_modules` para los
    permisos por módulo, y evita dejar sin acceso a todo un rol si la migración o el
    seed no llegaron a correr. Una vista suelta sin fila sí cuenta como apagada.
    """
    from app.models.roles import Rol
    from app.models.vistas_rol import VistaRol

    config: dict[str, dict[str, bool]] = {
        rol: {key: False for key in VISTAS_ROL} for rol in ROLES_CONFIGURABLES
    }
    con_filas: set[str] = set()
    result = await db.execute(
        select(Rol.nombre, VistaRol.vista_key, VistaRol.habilitado).join(
            Rol, Rol.id == VistaRol.rol_id
        )
    )
    for rol_nombre, vista_key, habilitado in result.all():
        if rol_nombre not in config:
            continue
        con_filas.add(rol_nombre)
        if vista_key in config[rol_nombre]:
            config[rol_nombre][vista_key] = bool(habilitado)

    defaults = defaults_por_rol()
    for rol in ROLES_CONFIGURABLES:
        if rol not in con_filas:
            config[rol] = defaults[rol]
    return config


async def get_config(db: AsyncSession) -> dict[str, dict[str, bool]]:
    """Config cacheada `{rol: {vista_key: habilitado}}`."""
    global _config, _cargado_en
    if _vigente():
        return _config  # type: ignore[return-value]
    _config = await _leer_de_bd(db)
    _cargado_en = time.monotonic()
    return _config


async def get_config_con_sesion_propia() -> dict[str, dict[str, bool]]:
    """Igual que `get_config`, abriendo sesión propia (para el middleware).

    Si la BD falla, cae a los valores por defecto —el acceso actual de cada rol— en vez de
    dejar la aplicación inaccesible.
    """
    global _config, _cargado_en
    if _vigente():
        return _config  # type: ignore[return-value]

    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as session:
            _config = await _leer_de_bd(session)
            # Cierra la transacción de lectura con COMMIT en vez de dejar que el
            # context manager haga ROLLBACK: si la conexión está compartida (los
            # tests usan StaticPool), un rollback aquí descartaría trabajo ajeno.
            await session.commit()
    except Exception:  # noqa: BLE001 - fail-safe: nunca tumbar el request por el caché
        return defaults_por_rol()
    _cargado_en = time.monotonic()
    return _config


def vista_habilitada_en(
    config: dict[str, dict[str, bool]], rol_nombre: str, vista_key: str
) -> bool:
    return bool(config.get(rol_nombre, {}).get(vista_key, False))


async def vista_habilitada_para_rol(
    db: AsyncSession, rol_nombre: str, vista_key: str
) -> bool:
    config = await get_config(db)
    return vista_habilitada_en(config, rol_nombre, vista_key)
