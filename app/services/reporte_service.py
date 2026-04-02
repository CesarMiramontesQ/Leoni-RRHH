# app/services/reporte_service.py
"""
Servicio de reportes y exportacion.

Fase actual: implementacion base con datos reales de la BD.
PDF/Excel generacion: stubs — se implementan en fase 5 con weasyprint/openpyxl.

KPIs calculados directamente de las tablas de dominio.
"""

import logging
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError
from app.models.actas import ActaAdministrativa
from app.models.empleados import Empleado
from app.models.incidencias import Incidencia
from app.models.solicitudes import Solicitud

logger = logging.getLogger(__name__)


class ReporteService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_rol(self, user: Empleado) -> str:
        return user.rol.nombre if user.rol else ""

    async def get_kpis(
        self,
        current_user: Empleado,
    ) -> dict:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver KPIs")

        emp_result = await self.db.execute(
            select(func.count()).where(Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS))
        )
        total_empleados = emp_result.scalar_one()

        # Solicitudes por estado
        sol_result = await self.db.execute(
            select(Solicitud.estado, func.count()).group_by(Solicitud.estado)
        )
        solicitudes_por_estado = dict(sol_result.all())

        # Abiertas = open | in_review (no resolved/closed)
        inc_result = await self.db.execute(
            select(func.count()).where(
                Incidencia.estado.in_(["open", "in_review"])
            )
        )
        incidencias_abiertas = inc_result.scalar_one()

        acta_result = await self.db.execute(
            select(func.count()).where(
                ActaAdministrativa.estado.in_(["draft", "pending_sign"])
            )
        )
        actas_pendientes = acta_result.scalar_one()

        return {
            "fecha": str(date.today()),
            "empleados_activos": total_empleados,
            "solicitudes_por_estado": solicitudes_por_estado,
            "incidencias_abiertas": incidencias_abiertas,
            "actas_pendientes_firma": actas_pendientes,
        }

    async def exportar_pdf(
        self,
        modulo: str,
        current_user: Empleado,
    ) -> dict:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para exportar reportes")

        # Stub — generacion PDF implementada en fase 5 con weasyprint
        logger.info(
            "Exportacion PDF solicitada | modulo=%s | usuario=%s",
            modulo,
            current_user.id,
        )
        return {
            "modulo": modulo,
            "formato": "pdf",
            "status": "pendiente",
            "mensaje": "Generacion de PDF en cola. Implementacion completa en fase 5.",
        }

    async def exportar_excel(
        self,
        modulo: str,
        current_user: Empleado,
    ) -> dict:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para exportar reportes")

        # Stub — generacion Excel implementada en fase 5 con openpyxl
        logger.info(
            "Exportacion Excel solicitada | modulo=%s | usuario=%s",
            modulo,
            current_user.id,
        )
        return {
            "modulo": modulo,
            "formato": "excel",
            "status": "pendiente",
            "mensaje": "Generacion de Excel en cola. Implementacion completa en fase 5.",
        }
