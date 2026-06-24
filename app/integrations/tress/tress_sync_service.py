# app/integrations/tress/tress_sync_service.py
"""
Servicio de sincronizacion IT Mirror ↔ TRESS SQL Server.

Puede invocarse manualmente o desde scripts; ya no corre en APScheduler.

Politica de conflictos:
  - TRESS es la fuente de verdad para datos de nomina
  - La BD local es la fuente de verdad para roles, permisos y datos RH propios
"""

import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class TressSyncService:
    """
    Sincroniza empleados de TRESS SQL Server a la BD local.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def sincronizar_empleados(self) -> dict:
        from app.core.config import settings
        from app.integrations.tress.tress_sql_client import TressSqlClient
        from app.models.empleados import Empleado
        from app.models.auditoria import ItSyncLog
        from app.repositories.empleado_repository import EmpleadoRepository

        sql_client = TressSqlClient(settings.TRESS_ODBC_CONN)
        repo = EmpleadoRepository(self.db)

        inicio = datetime.now(timezone.utc)
        creados = 0
        actualizados = 0
        errores = 0

        try:
            empleados_tress = await sql_client.get_empleados_activos()

            if not empleados_tress:
                logger.info("TRESS sync: 0 empleados recibidos (stub o BD vacia)")
                return {"creados": 0, "actualizados": 0, "errores": 0, "total_tress": 0}

            logger.info("TRESS sync: procesando %d empleados", len(empleados_tress))

            for emp_data in empleados_tress:
                try:
                    await self._sync_empleado(repo, emp_data)
                    creados += 1
                except Exception as exc:
                    errores += 1
                    logger.error(
                        "Error sincronizando empleado %s: %s",
                        emp_data.get("NumEmpleado"),
                        str(exc),
                    )

            await self.db.flush()

        except Exception as exc:
            logger.error("Error general en sincronizacion TRESS: %s", str(exc), exc_info=True)
            errores += 1
        finally:
            fin = datetime.now(timezone.utc)
            duracion_ms = int((fin - inicio).total_seconds() * 1000)
            try:
                total = len(empleados_tress) if "empleados_tress" in dir() else 0
                sync_log = ItSyncLog(
                    operacion="update",
                    empleado_id="SYNC_BATCH",
                    datos={"total": total, "errores": errores, "duracion_ms": duracion_ms},
                    status="ok" if errores == 0 else "error",
                    error_msg=f"{errores} errores" if errores > 0 else None,
                )
                self.db.add(sync_log)
                await self.db.commit()
            except Exception:
                logger.exception("Error guardando ItSyncLog")

        resultado = {
            "creados": creados,
            "actualizados": actualizados,
            "errores": errores,
            "total_tress": len(empleados_tress) if "empleados_tress" in dir() else 0,
        }
        logger.info("TRESS sync completado: %s", resultado)
        return resultado

    async def _sync_empleado(self, repo, emp_data: dict) -> None:
        from app.core.security import SYNC_PLACEHOLDER_PASSWORD_HASH
        from app.models.roles import Rol
        from sqlalchemy import select

        num = emp_data.get("NumEmpleado") or emp_data.get("num_empleado")
        if not num:
            return

        num_str = str(num)
        existente = await repo.get_by_no_empleado(num_str)

        nom_a = emp_data.get("Nombre") or emp_data.get("nombre", "")
        nom_b = emp_data.get("Apellido") or emp_data.get("apellido", "")
        nombre_completo = f"{nom_a} {nom_b}".strip() or num_str
        email = emp_data.get("Email") or emp_data.get("email") or f"{num_str}@leoni.com"

        campos_tress = {
            "nombre": nombre_completo,
            "email": email,
        }

        if existente:
            await repo.update(existente.id, campos_tress)
        else:
            result = await self.db.execute(
                select(Rol).where(Rol.nombre == "empleado").limit(1)
            )
            rol = result.scalar_one_or_none()
            if not rol:
                logger.warning("Rol 'empleado' no encontrado — saltando empleado %s", num_str)
                return

            empleado_id_ext = abs(hash(num_str)) % 2_147_000_000
            await repo.create({
                **campos_tress,
                "empleado_id": empleado_id_ext,
                "no_empleado": num_str,
                "password_hash": SYNC_PLACEHOLDER_PASSWORD_HASH,
                "rol_id": rol.id,
                "estado_id": 1,
            })
