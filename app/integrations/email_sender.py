# app/integrations/email_sender.py
"""
Integración SMTP Email — Plataforma RH Leoni Cable.

Principios de diseño:
  - Fire-and-forget: SIEMPRE usar desde BackgroundTasks, nunca bloquear el request
  - Silencioso ante fallos: NUNCA propaga excepciones — las fallas de email no bloquean negocio
  - TLS auto-detectado por puerto (587 → STARTTLS, 465 → SSL)
  - Si SMTP_HOST está vacío → skip silencioso
  - Timeout de conexión: 10 segundos
"""

from __future__ import annotations

import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Brand tokens ──────────────────────────────────────────────────────────────

_COLOR_PRIMARY = "#003087"      # Azul Leoni
_COLOR_SUCCESS = "#28a745"
_COLOR_WARNING = "#ffc107"
_COLOR_DANGER  = "#dc3545"
_COLOR_MUTED   = "#6c757d"

# ── HTML base template ────────────────────────────────────────────────────────

def _html_wrapper(titulo: str, cuerpo_html: str, color_acento: str = _COLOR_PRIMARY) -> str:
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{titulo}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:{color_acento};padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;
                        letter-spacing:0.5px;">Plataforma RH — Leoni Cable</p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                Sistema de Recursos Humanos On-Premise</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              {cuerpo_html}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fa;padding:16px 32px;border-top:1px solid #e9ecef;">
              <p style="margin:0;color:{_COLOR_MUTED};font-size:11px;text-align:center;">
                Este correo fue generado automáticamente por la Plataforma RH Leoni Cable.
                Por favor no responda a este mensaje.<br>
                &copy; {datetime.now().year} Leoni Cable — Plataforma RH
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _badge(texto: str, color: str) -> str:
    return (
        f'<span style="background:{color};color:#fff;padding:4px 12px;'
        f'border-radius:12px;font-size:12px;font-weight:bold;">{texto}</span>'
    )


def _campo(label: str, valor: str) -> str:
    return f"""<tr>
      <td style="padding:6px 0;color:{_COLOR_MUTED};font-size:13px;width:160px;
                 vertical-align:top;">{label}</td>
      <td style="padding:6px 0;font-size:13px;color:#212529;font-weight:500;">{valor}</td>
    </tr>"""


# ── EmailSender ───────────────────────────────────────────────────────────────

class EmailSender:
    """
    Cliente SMTP async para notificaciones.
    Usa aiosmtplib. Todos los fallos son silenciosos (log + continue).
    """

    # ── Core send ─────────────────────────────────────────────────────────────

    async def send(
        self,
        destinatarios: list[str],
        asunto: str,
        cuerpo_html: str,
        cuerpo_texto: str | None = None,
    ) -> bool:
        """
        Envía email. Retorna True si exitoso, False si falla.
        NUNCA propaga excepción — las fallas de email no deben bloquear el negocio.
        """
        if not settings.SMTP_HOST:
            logger.info("EMAIL | event=SKIP | razon=SMTP no configurado")
            return False

        if not destinatarios:
            logger.warning("EMAIL | event=SKIP | razon=lista de destinatarios vacía")
            return False

        try:
            return await self._enviar(destinatarios, asunto, cuerpo_html, cuerpo_texto)
        except Exception as exc:
            logger.error(
                "EMAIL | event=SEND_FAILED | asunto=%s | destinatarios=%s | "
                "error=%s | tipo=%s",
                asunto,
                ",".join(destinatarios),
                str(exc),
                type(exc).__name__,
                exc_info=True,
            )
            return False

    async def _enviar(
        self,
        destinatarios: list[str],
        asunto: str,
        cuerpo_html: str,
        cuerpo_texto: str | None,
    ) -> bool:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = asunto
        msg["From"] = settings.SMTP_USER or f"noreply@leoni-rh.local"
        msg["To"] = ", ".join(destinatarios)

        # Parte texto plano (fallback para clientes sin HTML)
        texto_plain = cuerpo_texto or _strip_tags(cuerpo_html)
        msg.attach(MIMEText(texto_plain, "plain", "utf-8"))
        msg.attach(MIMEText(cuerpo_html, "html", "utf-8"))

        use_tls = settings.SMTP_PORT == 465
        use_starttls = settings.SMTP_PORT == 587

        logger.info(
            "EMAIL | event=SEND_START | asunto=%s | destinatarios=%d | "
            "host=%s | port=%d",
            asunto,
            len(destinatarios),
            settings.SMTP_HOST,
            settings.SMTP_PORT,
        )

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=use_tls,
            start_tls=use_starttls,
            timeout=10,
        )

        logger.info(
            "EMAIL | event=SEND_OK | asunto=%s | destinatarios=%d",
            asunto,
            len(destinatarios),
        )
        return True

    # ── Template methods ──────────────────────────────────────────────────────

    async def notificar_solicitud_creada(
        self, solicitud, empleado, aprobador_email: str
    ) -> bool:
        """Notifica al aprobador que hay una nueva solicitud pendiente de revisión."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:#212529;font-size:20px;">
          Nueva Solicitud Pendiente de Aprobación
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Una solicitud requiere su atención.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("Empleado", f"{empleado.nombre} {empleado.apellido}")}
          {_campo("No. Empleado", empleado.num_empleado)}
          {_campo("Departamento", empleado.departamento or "N/A")}
          {_campo("Tipo", solicitud.tipo.replace("_", " ").title())}
          {_campo("Fecha Inicio", str(solicitud.fecha_inicio))}
          {_campo("Fecha Fin", str(solicitud.fecha_fin))}
          {_campo("Estado", _badge("PENDIENTE", _COLOR_WARNING))}
          {_campo("ID Solicitud", f"#{solicitud.id}")}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Por favor ingrese a la plataforma para aprobar o rechazar esta solicitud.
        </p>
        """
        return await self.send(
            destinatarios=[aprobador_email],
            asunto=f"[RH Leoni] Nueva solicitud de {solicitud.tipo} — "
                   f"{empleado.nombre} {empleado.apellido}",
            cuerpo_html=_html_wrapper("Nueva Solicitud", cuerpo, _COLOR_WARNING),
        )

    async def notificar_solicitud_aprobada(self, solicitud, empleado_email: str) -> bool:
        """Notifica al empleado que su solicitud fue aprobada."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_SUCCESS};font-size:20px;">
          Solicitud Aprobada
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Su solicitud ha sido aprobada exitosamente.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("Tipo", solicitud.tipo.replace("_", " ").title())}
          {_campo("Fecha Inicio", str(solicitud.fecha_inicio))}
          {_campo("Fecha Fin", str(solicitud.fecha_fin))}
          {_campo("Estado", _badge("APROBADA", _COLOR_SUCCESS))}
          {_campo("ID Solicitud", f"#{solicitud.id}")}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Si tiene alguna pregunta, comuníquese con el área de Recursos Humanos.
        </p>
        """
        return await self.send(
            destinatarios=[empleado_email],
            asunto=f"[RH Leoni] Solicitud aprobada — {solicitud.tipo.replace('_', ' ').title()}",
            cuerpo_html=_html_wrapper("Solicitud Aprobada", cuerpo, _COLOR_SUCCESS),
        )

    async def notificar_solicitud_rechazada(
        self, solicitud, empleado_email: str, motivo: str
    ) -> bool:
        """Notifica al empleado que su solicitud fue rechazada."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_DANGER};font-size:20px;">
          Solicitud Rechazada
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Su solicitud no fue aprobada.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("Tipo", solicitud.tipo.replace("_", " ").title())}
          {_campo("Fecha Inicio", str(solicitud.fecha_inicio))}
          {_campo("Fecha Fin", str(solicitud.fecha_fin))}
          {_campo("Estado", _badge("RECHAZADA", _COLOR_DANGER))}
          {_campo("ID Solicitud", f"#{solicitud.id}")}
          {_campo("Motivo", motivo)}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Para más información comuníquese con su supervisor o con el área de Recursos Humanos.
        </p>
        """
        return await self.send(
            destinatarios=[empleado_email],
            asunto=f"[RH Leoni] Solicitud rechazada — {solicitud.tipo.replace('_', ' ').title()}",
            cuerpo_html=_html_wrapper("Solicitud Rechazada", cuerpo, _COLOR_DANGER),
        )

    async def notificar_override_jerarquico(
        self, solicitud, emails_involucrados: list[str]
    ) -> bool:
        """Notifica a todos los involucrados cuando se aplica un override jerárquico."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_PRIMARY};font-size:20px;">
          Override Jerárquico Aplicado
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Se ha aplicado un override jerárquico a la siguiente solicitud.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("ID Solicitud", f"#{solicitud.id}")}
          {_campo("Tipo", solicitud.tipo.replace("_", " ").title())}
          {_campo("Fecha Inicio", str(solicitud.fecha_inicio))}
          {_campo("Fecha Fin", str(solicitud.fecha_fin))}
          {_campo("Estado Final", _badge(solicitud.estado.upper(), _COLOR_PRIMARY))}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Este mensaje es informativo. Para más detalles consulte la plataforma RH.
        </p>
        """
        return await self.send(
            destinatarios=emails_involucrados,
            asunto="[RH Leoni] Override jerárquico aplicado — "
                   f"Solicitud #{solicitud.id}",
            cuerpo_html=_html_wrapper("Override Jerárquico", cuerpo),
        )

    async def notificar_incidencia_registrada(
        self, incidencia, rh_email: str, gerente_email: str
    ) -> bool:
        """Notifica a RH y gerente cuando se registra una incidencia."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_DANGER};font-size:20px;">
          Nueva Incidencia Registrada
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Se ha registrado una nueva incidencia que requiere atención.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("ID Incidencia", f"#{incidencia.id}")}
          {_campo("Tipo", incidencia.tipo)}
          {_campo("Estado", _badge("ABIERTA", _COLOR_DANGER))}
          {_campo("Descripción", incidencia.descripcion[:200] + ("..." if len(incidencia.descripcion) > 200 else ""))}
          {_campo("Fecha", str(incidencia.created_at.strftime("%d/%m/%Y %H:%M") if incidencia.created_at else "N/A"))}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Por favor ingrese a la plataforma para revisar y gestionar esta incidencia.
        </p>
        """
        destinatarios = list({rh_email, gerente_email} - {""})
        if not destinatarios:
            return False
        return await self.send(
            destinatarios=destinatarios,
            asunto=f"[RH Leoni] Nueva incidencia registrada #{incidencia.id} — {incidencia.tipo}",
            cuerpo_html=_html_wrapper("Nueva Incidencia", cuerpo, _COLOR_DANGER),
        )

    async def notificar_acta_lista_para_firma(
        self, acta, firmante_emails: list[str]
    ) -> bool:
        """Notifica a los firmantes que un acta está pendiente de firma."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_PRIMARY};font-size:20px;">
          Acta Administrativa Pendiente de Firma
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Un acta administrativa requiere su firma digital.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("ID Acta", f"#{acta.id}")}
          {_campo("Estado", _badge("PENDIENTE FIRMA", _COLOR_WARNING))}
          {_campo("Fecha Generación", str(acta.created_at.strftime("%d/%m/%Y %H:%M") if acta.created_at else "N/A"))}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          Por favor ingrese a la plataforma RH para revisar y firmar el acta.
        </p>
        """
        return await self.send(
            destinatarios=firmante_emails,
            asunto=f"[RH Leoni] Acta administrativa #{acta.id} pendiente de firma",
            cuerpo_html=_html_wrapper("Acta Pendiente de Firma", cuerpo),
        )

    async def notificar_acta_firmada_completa(
        self, acta, empleado_email: str, rh_email: str
    ) -> bool:
        """Notifica al empleado y a RH cuando el acta fue firmada completamente."""
        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_SUCCESS};font-size:20px;">
          Acta Administrativa Firmada Completamente
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          El acta administrativa ha sido firmada por todos los involucrados.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("ID Acta", f"#{acta.id}")}
          {_campo("Estado", _badge("FIRMADA", _COLOR_SUCCESS))}
          {_campo("Fecha", datetime.now().strftime("%d/%m/%Y %H:%M"))}
        </table>
        <p style="margin:0;color:#495057;font-size:13px;">
          El documento queda en archivo. Puede consultarlo en la plataforma RH.
        </p>
        """
        destinatarios = list({empleado_email, rh_email} - {""})
        if not destinatarios:
            return False
        return await self.send(
            destinatarios=destinatarios,
            asunto=f"[RH Leoni] Acta #{acta.id} firmada completamente",
            cuerpo_html=_html_wrapper("Acta Firmada", cuerpo, _COLOR_SUCCESS),
        )

    async def notificar_sync_it_error(
        self, error_msg: str, rh_admin_email: str
    ) -> bool:
        """Notifica al administrador de RH cuando hay un error en la sincronización IT Mirror."""
        if not rh_admin_email:
            logger.warning(
                "EMAIL | event=SKIP_NOTIF_IT | razon=rh_admin_email vacío"
            )
            return False

        cuerpo = f"""
        <h2 style="margin:0 0 8px;color:{_COLOR_DANGER};font-size:20px;">
          Alerta: Error en Sincronización IT Mirror
        </h2>
        <p style="margin:0 0 24px;color:{_COLOR_MUTED};">
          Se detectó un problema durante la sincronización con el sistema IT.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
          {_campo("Timestamp", datetime.now().strftime("%d/%m/%Y %H:%M:%S"))}
          {_campo("Sistema", "IT Mirror Sync")}
          {_campo("Severidad", _badge("ATENCIÓN REQUERIDA", _COLOR_DANGER))}
        </table>
        <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;
                    padding:16px;margin-bottom:16px;">
          <p style="margin:0;font-size:13px;color:#856404;font-family:monospace;
                    word-break:break-all;">
            {error_msg}
          </p>
        </div>
        <p style="margin:0;color:#495057;font-size:13px;">
          Revise los logs del sistema y verifique la conectividad con la BD IT Mirror.
        </p>
        """
        return await self.send(
            destinatarios=[rh_admin_email],
            asunto="[RH Leoni] ALERTA: Error sincronización IT Mirror",
            cuerpo_html=_html_wrapper("Alerta IT Mirror", cuerpo, _COLOR_DANGER),
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_tags(html: str) -> str:
    """Extrae texto plano de HTML básico para el fallback de clientes sin HTML."""
    import re
    sin_tags = re.sub(r"<[^>]+>", " ", html)
    sin_espacios = re.sub(r"\s+", " ", sin_tags).strip()
    return sin_espacios


# ── Singleton ─────────────────────────────────────────────────────────────────

email_sender = EmailSender()
