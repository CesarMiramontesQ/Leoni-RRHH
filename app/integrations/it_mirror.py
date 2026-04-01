# app/integrations/it_mirror.py
"""
Integración IT Mirror — Plataforma RH Leoni Cable.

La BD de IT es la fuente de verdad para empleados activos.
Este módulo sincroniza cada IT_SYNC_INTERVAL_MINUTES la tabla de empleados
desde la BD espejo de IT hacia la BD local de la plataforma RH.

Invariantes de seguridad:
  - NUNCA sobreescribir: rol_id, supervisor_id, password_hash
  - Si activo=False en IT y el empleado tiene solicitudes PENDING → cancelarlas y notificar
  - Si la conexión falla → loggear + registrar en it_sync_log + NO propagar excepción
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Structured log helper ─────────────────────────────────────────────────────

def _slog(level: str, event: str, **kwargs) -> None:
    """Emite una línea de log estructurada para la integración IT Mirror."""
    extras = " | ".join(f"{k}={v}" for k, v in kwargs.items())
    msg = f"IT_MIRROR | event={event}" + (f" | {extras}" if extras else "")
    getattr(logger, level)(msg)


# ── ITMirrorClient ────────────────────────────────────────────────────────────

class ITMirrorClient:
    """
    Cliente de sincronización con la BD espejo de IT.
    La BD IT es fuente de verdad para empleados activos.

    Diseño de resiliencia:
      - Nunca propaga excepciones al scheduler
      - Registra en it_sync_log independientemente del resultado
      - Opera con sesiones independientes para IT Mirror y BD local
    """

    # Columnas que el sync puede actualizar — rol_id, supervisor_id, password_hash excluidos
    _CAMPOS_SYNC: tuple[str, ...] = (
        "nombre",
        "apellido",
        "email",
        "departamento",
        "puesto",
        "fecha_ingreso",
        "activo",
    )

    async def sync_empleados(self) -> dict:
        """
        Sincroniza empleados desde IT Mirror a BD local.

        Retorna: {insertados: int, actualizados: int, desactivados: int, errores: int}
        """
        resultado = {"insertados": 0, "actualizados": 0, "desactivados": 0, "errores": 0}

        if not settings.IT_MIRROR_DB_URL:
            _slog("info", "IT_MIRROR_SKIP", razon="IT_MIRROR_DB_URL no configurado")
            return resultado

        _slog("info", "SYNC_START")
        inicio = datetime.now(timezone.utc)

        # Sesión hacia BD IT Mirror (fuente de verdad)
        try:
            it_engine = create_async_engine(settings.IT_MIRROR_DB_URL, pool_pre_ping=True)
            it_session_factory = async_sessionmaker(it_engine, class_=AsyncSession, expire_on_commit=False)
        except Exception as exc:
            _slog("error", "IT_ENGINE_CREATE_FAILED", error=str(exc))
            await self._registrar_sync_log(
                status="error",
                operacion="engine_create",
                detalle=str(exc),
                inicio=inicio,
            )
            return resultado

        # Sesión hacia BD local RH
        from app.core.database import AsyncSessionLocal

        try:
            async with it_session_factory() as it_db, AsyncSessionLocal() as rh_db:
                empleados_it = await self._leer_empleados_it(it_db)

                if empleados_it is None:
                    resultado["errores"] += 1
                    await self._registrar_sync_log(
                        status="error",
                        operacion="read_it_mirror",
                        detalle="No se pudo leer la tabla de empleados de IT",
                        inicio=inicio,
                    )
                    return resultado

                _slog("info", "IT_ROWS_READ", count=len(empleados_it))

                for emp_it in empleados_it:
                    try:
                        op = await self._sync_empleado(rh_db, emp_it)
                        resultado[op] += 1
                    except Exception as exc_emp:
                        resultado["errores"] += 1
                        _slog(
                            "error",
                            "EMPLEADO_SYNC_ERROR",
                            num_empleado=emp_it.get("num_empleado"),
                            error=str(exc_emp),
                        )

                await rh_db.commit()

        except Exception as exc:
            _slog("error", "SYNC_FAILED", error=str(exc))
            resultado["errores"] += 1
            await self._registrar_sync_log(
                status="error",
                operacion="sync_loop",
                detalle=str(exc),
                inicio=inicio,
            )
            return resultado
        finally:
            await it_engine.dispose()

        duracion_ms = int((datetime.now(timezone.utc) - inicio).total_seconds() * 1000)
        _slog(
            "info",
            "SYNC_COMPLETE",
            insertados=resultado["insertados"],
            actualizados=resultado["actualizados"],
            desactivados=resultado["desactivados"],
            errores=resultado["errores"],
            duracion_ms=duracion_ms,
        )

        await self._registrar_sync_log(
            status="ok",
            operacion="sync_full",
            detalle=(
                f"insertados={resultado['insertados']} actualizados={resultado['actualizados']} "
                f"desactivados={resultado['desactivados']} errores={resultado['errores']}"
            ),
            inicio=inicio,
        )

        return resultado

    async def _leer_empleados_it(self, it_db: AsyncSession) -> list[dict] | None:
        """Lee todos los empleados de la tabla IT Mirror."""
        try:
            result = await it_db.execute(
                text(
                    """
                    SELECT num_empleado, nombre, apellido, email,
                           departamento, puesto, activo, fecha_ingreso
                    FROM empleados
                    """
                )
            )
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:
            _slog("error", "READ_IT_FAILED", error=str(exc))
            return None

    async def _sync_empleado(self, rh_db: AsyncSession, emp_it: dict) -> str:
        """
        Sincroniza un empleado individual.
        Retorna: 'insertados' | 'actualizados' | 'desactivados'
        """
        from app.models.empleados import Empleado
        from app.models.roles import Rol
        from sqlalchemy import select

        num = emp_it["num_empleado"]

        # Buscar empleado existente en BD local
        stmt = select(Empleado).where(Empleado.num_empleado == num)
        result = await rh_db.execute(stmt)
        emp_local = result.scalar_one_or_none()

        if emp_local is None:
            # INSERT — obtener rol_id por defecto ('empleado')
            rol_stmt = select(Rol).where(Rol.nombre == "empleado")
            rol_result = await rh_db.execute(rol_stmt)
            rol = rol_result.scalar_one_or_none()
            if rol is None:
                raise ValueError("Rol 'empleado' no encontrado en BD local — verificar seed de roles")

            nuevo = Empleado(
                num_empleado=num,
                nombre=emp_it["nombre"],
                apellido=emp_it["apellido"],
                email=emp_it["email"],
                departamento=emp_it.get("departamento"),
                puesto=emp_it.get("puesto"),
                activo=emp_it.get("activo", True),
                fecha_ingreso=emp_it.get("fecha_ingreso"),
                rol_id=rol.id,
                # password_hash temporal — debe ser cambiado en primer login
                password_hash="$2b$12$PLACEHOLDER_CHANGE_ON_FIRST_LOGIN",
                supervisor_id=None,
            )
            rh_db.add(nuevo)
            _slog("info", "EMPLEADO_INSERT", num_empleado=num)
            return "insertados"

        else:
            # Detectar cambios en campos permitidos
            hubo_cambio = False
            era_activo = emp_local.activo

            for campo in self._CAMPOS_SYNC:
                valor_it = emp_it.get(campo)
                if getattr(emp_local, campo) != valor_it:
                    setattr(emp_local, campo, valor_it)
                    hubo_cambio = True

            # Si el empleado fue desactivado y tenía solicitudes pending → cancelar
            if era_activo and not emp_it.get("activo", True):
                await self._cancelar_solicitudes_pending(rh_db, emp_local.id, num)
                return "desactivados"

            if hubo_cambio:
                _slog("info", "EMPLEADO_UPDATE", num_empleado=num)
                return "actualizados"

            # Sin cambios — contar como actualizado igualmente (operación idempotente)
            return "actualizados"

    async def _cancelar_solicitudes_pending(
        self, rh_db: AsyncSession, empleado_id: int, num_empleado: str
    ) -> None:
        """Cancela solicitudes PENDING de un empleado dado de baja en IT."""
        from app.models.solicitudes import Solicitud
        from sqlalchemy import select, update

        stmt = (
            update(Solicitud)
            .where(Solicitud.empleado_id == empleado_id)
            .where(Solicitud.estado == "pending")
            .values(
                estado="cancelled",
                comentarios="Cancelado automáticamente por baja en sistema IT",
            )
            .returning(Solicitud.id)
        )
        result = await rh_db.execute(stmt)
        canceladas = result.fetchall()

        if canceladas:
            ids = [row[0] for row in canceladas]
            _slog(
                "warning",
                "SOLICITUDES_CANCELADAS_BAJA",
                num_empleado=num_empleado,
                solicitud_ids=str(ids),
                count=len(ids),
            )
            # Notificar a RH sobre la cancelación (fire-and-forget)
            await self._notificar_baja_con_solicitudes(num_empleado, ids)

    async def _notificar_baja_con_solicitudes(
        self, num_empleado: str, solicitud_ids: list[int]
    ) -> None:
        """Notifica a RH cuando se cancela solicitudes por baja de empleado."""
        try:
            from app.integrations.email_sender import email_sender
            await email_sender.notificar_sync_it_error(
                error_msg=(
                    f"Empleado {num_empleado} fue dado de baja en IT. "
                    f"Se cancelaron automáticamente las solicitudes PENDING: {solicitud_ids}"
                ),
                rh_admin_email=settings.SMTP_USER or "",
            )
        except Exception as exc:
            _slog("warning", "NOTIF_BAJA_FAILED", error=str(exc))

    async def _registrar_sync_log(
        self,
        status: str,
        operacion: str,
        detalle: str,
        inicio: datetime,
    ) -> None:
        """Registra el resultado del sync en it_sync_log."""
        duracion_ms = int((datetime.now(timezone.utc) - inicio).total_seconds() * 1000)
        try:
            from app.core.database import AsyncSessionLocal

            async with AsyncSessionLocal() as db:
                await db.execute(
                    text(
                        """
                        INSERT INTO it_sync_log
                            (status, operacion, detalle, duracion_ms, created_at)
                        VALUES
                            (:status, :operacion, :detalle, :duracion_ms, :created_at)
                        """
                    ),
                    {
                        "status": status,
                        "operacion": operacion,
                        "detalle": detalle[:2000],  # truncar para evitar overflow
                        "duracion_ms": duracion_ms,
                        "created_at": datetime.now(timezone.utc),
                    },
                )
                await db.commit()
        except Exception as exc:
            # El log de sync no debe tirar el proceso principal
            _slog("warning", "SYNC_LOG_WRITE_FAILED", error=str(exc))


# ── Scheduler job ─────────────────────────────────────────────────────────────

_client = ITMirrorClient()


async def run_it_mirror_sync() -> None:
    """
    Job de APScheduler — sync IT Mirror cada IT_SYNC_INTERVAL_MINUTES minutos.

    NUNCA propaga excepciones — diseñado para correr en BackgroundScheduler.
    Todos los errores son capturados, loggeados y absorbidos.
    """
    try:
        resultado = await _client.sync_empleados()
        _slog(
            "info",
            "JOB_COMPLETE",
            insertados=resultado["insertados"],
            actualizados=resultado["actualizados"],
            desactivados=resultado["desactivados"],
            errores=resultado["errores"],
        )
    except Exception as exc:
        # Última línea de defensa — el scheduler nunca debe caer
        logger.error(
            "IT_MIRROR | event=JOB_UNHANDLED_ERROR | error=%s",
            str(exc),
            exc_info=True,
        )
