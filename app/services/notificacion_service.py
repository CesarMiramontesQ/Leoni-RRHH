# app/services/notificacion_service.py
"""
Servicio de infraestructura de notificaciones.

Reglas de uso:
  - Otros Services llaman a este — nunca el Router directamente
  - Siempre disparar via BackgroundTasks (fire-and-forget)
  - El fallo de email NO debe fallar la operacion de negocio — siempre capturar

Canales:
  - "in_app"  — persiste en tabla notificaciones, leida=False
  - "email"   — envia via SMTP + persiste registro
  - "ambos"   — in_app + email
"""

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import aiosmtplib
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.repositories.notificacion_repository import NotificacionRepository
from app.schemas import PaginatedResponse
from app.schemas.notificaciones import NotificacionResponse
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)


class NotificacionService:
    def __init__(self, db: AsyncSession):
        self.repo = NotificacionRepository(db)
        self.db = db

    async def list_notificaciones(
        self,
        user_id: int,
        cursor: int | None,
        limit: int,
    ) -> PaginatedResponse[NotificacionResponse]:
        items, next_cursor = await self.repo.list_by_user_paginated(
            user_id=user_id,
            cursor=cursor,
            limit=limit,
        )
        total = await self.repo.count_by_user(user_id=user_id)
        return PaginatedResponse(
            items=[NotificacionResponse.model_validate(item) for item in items],
            next_cursor=next_cursor,
            total=total,
        )

    async def list_recientes(
        self,
        user_id: int,
        limit: int = 5,
    ) -> list[NotificacionResponse]:
        items = await self.repo.list_recientes_by_user(user_id=user_id, limit=limit)
        return [NotificacionResponse.model_validate(item) for item in items]

    async def count_no_leidas(self, user_id: int) -> int:
        return await self.repo.count_unread_by_user(user_id=user_id)

    async def marcar_leida(
        self,
        notificacion_id: int,
        user_id: int,
        background_tasks: BackgroundTasks | None = None,
    ) -> NotificacionResponse:
        updated = await self.repo.marcar_leida_for_user(
            notificacion_id=notificacion_id,
            user_id=user_id,
        )
        if not updated:
            raise NotFoundError(entidad="Notificacion", id=notificacion_id)

        if background_tasks:
            audit_background(
                background_tasks=background_tasks,
                db=self.db,
                accion="NOTIFICACION_READ",
                modulo="notificaciones",
                usuario_id=user_id,
                entidad_id=updated.id,
                datos_antes={"is_read": False},
                datos_despues={"is_read": True},
            )

        return NotificacionResponse.model_validate(updated)

    async def marcar_todas_leidas(
        self,
        user_id: int,
        background_tasks: BackgroundTasks | None = None,
    ) -> int:
        marcadas = await self.repo.marcar_todas_leidas_for_user(user_id=user_id)
        if marcadas > 0 and background_tasks:
            audit_background(
                background_tasks=background_tasks,
                db=self.db,
                accion="NOTIFICACION_READ_ALL",
                modulo="notificaciones",
                usuario_id=user_id,
                datos_despues={"marcadas": marcadas},
            )
        return marcadas

    async def crear_notificacion(
        self,
        user_id: int,
        title: str,
        message: str,
        type_: str = "in_app",
        target_url: str | None = None,
        metadata: dict[str, Any] | None = None,
        enviada: bool = True,
    ) -> NotificacionResponse:
        notificacion = await self.repo.create({
            "user_id": user_id,
            "type": type_,
            "title": title,
            "message": message,
            "is_read": False,
            "enviada": enviada,
            "target_url": target_url,
            "metadata_json": metadata,
        })
        return NotificacionResponse.model_validate(notificacion)

    async def enviar(
        self,
        destinatario_id: int,
        asunto: str,
        cuerpo: str,
        canal: str = "in_app",
        email_destino: str | None = None,
        target_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Punto de entrada unico para todas las notificaciones.

        Args:
            destinatario_id: ID del Empleado destinatario
            asunto: Asunto de la notificacion
            cuerpo: Cuerpo en texto plano o HTML
            canal: "in_app" | "email" | "ambos"
            email_destino: Requerido si canal es "email" o "ambos"
        """
        if canal in ("in_app", "ambos"):
            await self.crear_notificacion(
                user_id=destinatario_id,
                title=asunto,
                message=cuerpo,
                type_="in_app",
                target_url=target_url,
                metadata=metadata,
                enviada=True,
            )

        if canal in ("email", "ambos") and email_destino:
            await self._enviar_email(
                destino=email_destino,
                asunto=asunto,
                cuerpo=cuerpo,
                destinatario_id=destinatario_id,
                target_url=target_url,
                metadata=metadata,
            )

    async def _enviar_email(
        self,
        destino: str,
        asunto: str,
        cuerpo: str,
        destinatario_id: int,
        target_url: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Persiste el registro ANTES de intentar el envio.
        Si el envio falla, el registro queda con enviada=False para reintento manual.
        El error de SMTP nunca se propaga — es un fallo no critico.
        """
        notificacion = await self.crear_notificacion(
            user_id=destinatario_id,
            title=asunto,
            message=cuerpo,
            type_="email",
            target_url=target_url,
            metadata=metadata,
            enviada=False,
        )

        if not settings.SMTP_USER:
            logger.warning(
                "SMTP_USER no configurado — notificacion email id=%d no enviada",
                notificacion.id,
            )
            return

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = asunto
            msg["From"] = settings.SMTP_USER
            msg["To"] = destino
            msg.attach(MIMEText(cuerpo, "html", "utf-8"))

            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=True,
                timeout=10,
            )
            await self.repo.update(notificacion.id, {"enviada": True})
            logger.info("Email enviado a %s (notificacion id=%d)", destino, notificacion.id)

        except Exception as e:
            # Fallo no critico — loggear y continuar
            logger.error(
                "Error enviando email a %s (notificacion id=%d): %s",
                destino,
                notificacion.id,
                str(e),
                exc_info=True,
            )
