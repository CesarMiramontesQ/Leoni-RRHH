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

import aiosmtplib
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.notificacion_repository import NotificacionRepository

logger = logging.getLogger(__name__)


class NotificacionService:
    def __init__(self, db: AsyncSession):
        self.repo = NotificacionRepository(db)
        self.db = db

    async def enviar(
        self,
        destinatario_id: int,
        asunto: str,
        cuerpo: str,
        canal: str = "in_app",
        email_destino: str | None = None,
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
            await self.repo.create({
                "destinatario_id": destinatario_id,
                "tipo": "in_app",
                "asunto": asunto,
                "cuerpo": cuerpo,
                "leida": False,
                "enviada": True,
            })

        if canal in ("email", "ambos") and email_destino:
            await self._enviar_email(
                destino=email_destino,
                asunto=asunto,
                cuerpo=cuerpo,
                destinatario_id=destinatario_id,
            )

    async def _enviar_email(
        self,
        destino: str,
        asunto: str,
        cuerpo: str,
        destinatario_id: int,
    ) -> None:
        """
        Persiste el registro ANTES de intentar el envio.
        Si el envio falla, el registro queda con enviada=False para reintento manual.
        El error de SMTP nunca se propaga — es un fallo no critico.
        """
        notificacion = await self.repo.create({
            "destinatario_id": destinatario_id,
            "tipo": "email",
            "asunto": asunto,
            "cuerpo": cuerpo,
            "leida": False,
            "enviada": False,
        })

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
