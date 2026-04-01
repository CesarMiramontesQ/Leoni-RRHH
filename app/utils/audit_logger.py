# app/utils/audit_logger.py
"""
Audit logger — Plataforma RH Leoni Cable.

Dos variantes de llamada:

  await log_action(db, ...)       — SINCRONA
    El registro existe antes de retornar la respuesta HTTP.
    Usar para: auth (login/logout), cambio de password, revocacion de tokens.
    Si el log falla, la operacion falla (excepcion propagada).

  audit_background(bg_tasks, db, ...)  — ASINCRONA (fire-and-forget)
    Se encola como BackgroundTask y no bloquea la respuesta.
    Usar para: CRUD de solicitudes, incidencias, actas, comedor, etc.
    Si el log falla en background, la operacion ya retorno exito al cliente.

Regla de oro: incluir datos_antes y datos_despues en UPDATE/DELETE.
No serializar el objeto ORM completo — solo los campos relevantes para el auditor.
"""

import logging
from datetime import datetime, timezone

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.auditoria import AuditLog

logger = logging.getLogger(__name__)


async def log_action(
    db: AsyncSession,
    accion: str,
    modulo: str,
    usuario_id: int | None = None,
    entidad_id: int | None = None,
    datos_antes: dict | None = None,
    datos_despues: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Registra una accion en audit_log de forma sincrona.

    Args:
        db: Sesion activa — el flush ocurre aqui; el commit lo hace get_db
        accion: Identificador de la accion en UPPER_SNAKE_CASE, ej. "SOLICITUD_APPROVED"
        modulo: Nombre del dominio, ej. "solicitudes", "auth"
        usuario_id: ID del Empleado que ejecuto la accion (None si es sistema)
        entidad_id: PK de la entidad afectada
        datos_antes: Estado relevante antes de la mutacion (para UPDATE/DELETE)
        datos_despues: Estado relevante despues de la mutacion (para CREATE/UPDATE)
        ip_address: IP del cliente (obtener del Request en el Router si se necesita)
    """
    try:
        entry = AuditLog(
            usuario_id=usuario_id,
            accion=accion,
            modulo=modulo,
            entidad_id=entidad_id,
            datos_antes=datos_antes,
            datos_despues=datos_despues,
            ip_address=ip_address,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(entry)
        await db.flush()
        logger.debug(
            "AUDIT | usuario=%s | accion=%s | modulo=%s | entidad=%s",
            usuario_id,
            accion,
            modulo,
            entidad_id,
        )
    except Exception:
        # En log sincrono, propagar el error — la operacion de negocio debe fallar tambien
        logger.exception(
            "Error escribiendo audit_log sincrono | accion=%s | modulo=%s", accion, modulo
        )
        raise


def audit_background(
    background_tasks: BackgroundTasks,
    db: AsyncSession,
    accion: str,
    modulo: str,
    usuario_id: int | None = None,
    entidad_id: int | None = None,
    datos_antes: dict | None = None,
    datos_despues: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Encola el registro de auditoria como BackgroundTask.
    No bloquea la respuesta HTTP — uso preferido para mutaciones de negocio ordinarias.

    NOTA: La sesion `db` compartida con el request principal puede estar cerrada
    cuando el background task se ejecute si el commit ya ocurrio. Para evitar esto,
    el BackgroundTask crea su propia sesion de DB.
    """
    background_tasks.add_task(
        _log_action_background,
        accion=accion,
        modulo=modulo,
        usuario_id=usuario_id,
        entidad_id=entidad_id,
        datos_antes=datos_antes,
        datos_despues=datos_despues,
        ip_address=ip_address,
    )


async def _log_action_background(
    accion: str,
    modulo: str,
    usuario_id: int | None = None,
    entidad_id: int | None = None,
    datos_antes: dict | None = None,
    datos_despues: dict | None = None,
    ip_address: str | None = None,
) -> None:
    """
    Worker interno del audit background.
    Abre su propia sesion de DB — independiente del request principal.
    """
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            entry = AuditLog(
                usuario_id=usuario_id,
                accion=accion,
                modulo=modulo,
                entidad_id=entidad_id,
                datos_antes=datos_antes,
                datos_despues=datos_despues,
                ip_address=ip_address,
                timestamp=datetime.now(timezone.utc),
            )
            db.add(entry)
            await db.commit()
            logger.debug(
                "AUDIT (bg) | usuario=%s | accion=%s | modulo=%s | entidad=%s",
                usuario_id,
                accion,
                modulo,
                entidad_id,
            )
    except Exception:
        # En background, loggear sin propagar — la operacion principal ya respondio
        logger.error(
            "Error escribiendo audit_log background | accion=%s | modulo=%s",
            accion,
            modulo,
            exc_info=True,
        )
