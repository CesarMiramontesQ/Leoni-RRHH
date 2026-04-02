# app/integrations/it_mirror.py
"""
Integración IT Mirror — Plataforma RH Leoni Cable.

La BD de IT es la fuente de verdad para empleados y catálogos.
Este módulo sincroniza cada IT_SYNC_INTERVAL_MINUTES hacia la BD local.

Invariantes de seguridad:
  - NUNCA sobreescribir: rol_id, lider_id, password_hash
  - Si estado deja de ser activo y el empleado tiene solicitudes PENDING → cancelarlas y notificar
  - Si la conexión falla → loggear + registrar en it_sync_log + NO propagar excepción
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import SYNC_PLACEHOLDER_PASSWORD_HASH

logger = logging.getLogger(__name__)


def _slog(level: str, event: str, **kwargs) -> None:
    extras = " | ".join(f"{k}={v}" for k, v in kwargs.items())
    msg = f"IT_MIRROR | event={event}" + (f" | {extras}" if extras else "")
    getattr(logger, level)(msg)


class ITMirrorClient:
    """
    Cliente de sincronización con la BD espejo de IT.
    """

    async def sync_empleados(self) -> dict:
        resultado = {"insertados": 0, "actualizados": 0, "desactivados": 0, "errores": 0}

        if not settings.IT_MIRROR_DB_URL:
            _slog("info", "IT_MIRROR_SKIP", razon="IT_MIRROR_DB_URL no configurado")
            return resultado

        _slog("info", "SYNC_START")
        inicio = datetime.now(timezone.utc)

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

        from app.core.database import AsyncSessionLocal

        try:
            async with it_session_factory() as it_db, AsyncSessionLocal() as rh_db:
                await self._sync_catalogos(it_db, rh_db)

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
                            no_empleado=emp_it.get("no_empleado"),
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

    async def _sync_catalogos(
        self, it_db: AsyncSession, rh_db: AsyncSession
    ) -> None:
        from app.models.catalogos import (
            Area,
            Categoria,
            ClasificacionEmpleado,
            EstadoEmpleado,
            Puesto,
            Subarea,
        )

        plan = [
            ("areas", "area_id", Area),
            ("categorias", "categoria_id", Categoria),
            ("subareas", "subarea_id", Subarea),
            ("puestos", "puesto_id", Puesto),
            ("estados_empleados", "estado_id", EstadoEmpleado),
            ("clasificacion_empleado", "clasificacion_id", ClasificacionEmpleado),
        ]

        for tabla, pk_field, Model in plan:
            try:
                rows = await self._leer_tabla_catalogo(it_db, tabla)
                if rows is None:
                    _slog("warning", "CATALOGO_READ_FAILED", tabla=tabla)
                    continue
                for row in rows:
                    await self._upsert_catalogo(rh_db, Model, pk_field, row)
                _slog("info", "CATALOGO_SYNCED", tabla=tabla, count=len(rows))
            except Exception as exc:
                _slog("error", "CATALOGO_SYNC_ERROR", tabla=tabla, error=str(exc))

    async def _leer_tabla_catalogo(
        self, it_db: AsyncSession, tabla: str
    ) -> list[dict] | None:
        try:
            result = await it_db.execute(text(f"SELECT * FROM {tabla}"))  # noqa: S608
            rows = result.mappings().all()
            return [dict(row) for row in rows]
        except Exception as exc:
            _slog("error", "READ_CATALOGO_FAILED", tabla=tabla, error=str(exc))
            return None

    async def _upsert_catalogo(
        self,
        rh_db: AsyncSession,
        Model,
        pk_field: str,
        row: dict,
    ) -> None:
        pk_value = row[pk_field]
        stmt = select(Model).where(getattr(Model, pk_field) == pk_value)
        result = await rh_db.execute(stmt)
        local = result.scalar_one_or_none()

        if local is None:
            clean = {k: v for k, v in row.items() if hasattr(Model, k)}
            rh_db.add(Model(**clean))
        else:
            for campo, valor in row.items():
                if hasattr(local, campo):
                    setattr(local, campo, valor)

    async def _leer_empleados_it(self, it_db: AsyncSession) -> list[dict] | None:
        try:
            result = await it_db.execute(
                text(
                    """
                    SELECT empleado_id, no_empleado, no_sap, nombre, usuario,
                           categoria_id, subarea_id, puesto_id, estado_id,
                           area_id, clasificacion_id, lider_id, centrocosto_id,
                           foto, recibe_bono, brigada, registro,
                           a_restringido, requiere_cambio_password
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
        from app.models.empleados import Empleado
        from app.models.roles import Rol

        no_emp = emp_it["no_empleado"]

        stmt = select(Empleado).where(Empleado.no_empleado == no_emp)
        result = await rh_db.execute(stmt)
        emp_local = result.scalar_one_or_none()

        lider_local_id: int | None = None
        if emp_it.get("lider_id"):
            lider_stmt = select(Empleado).where(
                Empleado.empleado_id == emp_it["lider_id"]
            )
            lider_result = await rh_db.execute(lider_stmt)
            lider = lider_result.scalar_one_or_none()
            if lider:
                lider_local_id = lider.id

        campos_sync = {
            "empleado_id": emp_it["empleado_id"],
            "no_sap": emp_it.get("no_sap"),
            "nombre": emp_it["nombre"],
            "usuario": emp_it.get("usuario"),
            "categoria_id": emp_it.get("categoria_id"),
            "subarea_id": emp_it.get("subarea_id"),
            "puesto_id": emp_it.get("puesto_id"),
            "estado_id": emp_it.get("estado_id"),
            "area_id": emp_it.get("area_id"),
            "clasificacion_id": emp_it.get("clasificacion_id"),
            "lider_id": lider_local_id,
            "centrocosto_id": emp_it.get("centrocosto_id"),
            "foto": emp_it.get("foto"),
            "recibe_bono": emp_it.get("recibe_bono"),
            "brigada": emp_it.get("brigada"),
            "registro": emp_it.get("registro"),
            "a_restringido": emp_it.get("a_restringido"),
            "requiere_cambio_password": emp_it.get("requiere_cambio_password"),
        }

        if emp_local is None:
            rol_stmt = select(Rol).where(Rol.nombre == "empleado")
            rol_result = await rh_db.execute(rol_stmt)
            rol = rol_result.scalar_one_or_none()
            if rol is None:
                raise ValueError("Rol 'empleado' no encontrado — verificar seed de roles")

            nuevo = Empleado(
                no_empleado=no_emp,
                password_hash=SYNC_PLACEHOLDER_PASSWORD_HASH,
                rol_id=rol.id,
                **campos_sync,
            )
            rh_db.add(nuevo)
            _slog("info", "EMPLEADO_INSERT", no_empleado=no_emp)
            return "insertados"

        era_activo = emp_local.estado_id in (settings.ESTADOS_ACTIVOS_IDS or [1])
        hubo_cambio = False

        for campo, valor in campos_sync.items():
            if getattr(emp_local, campo) != valor:
                setattr(emp_local, campo, valor)
                hubo_cambio = True

        ahora_activo = emp_it.get("estado_id") in (settings.ESTADOS_ACTIVOS_IDS or [1])
        if era_activo and not ahora_activo:
            await self._cancelar_solicitudes_pending(rh_db, emp_local.id, no_emp)
            return "desactivados"

        if hubo_cambio:
            _slog("info", "EMPLEADO_UPDATE", no_empleado=no_emp)
        return "actualizados"

    async def _cancelar_solicitudes_pending(
        self, rh_db: AsyncSession, empleado_id: int, no_empleado: str
    ) -> None:
        from app.models.solicitudes import Solicitud
        from sqlalchemy import update

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
                no_empleado=no_empleado,
                solicitud_ids=str(ids),
                count=len(ids),
            )
            await self._notificar_baja_con_solicitudes(no_empleado, ids)

    async def _notificar_baja_con_solicitudes(
        self, no_empleado: str, solicitud_ids: list[int]
    ) -> None:
        try:
            from app.integrations.email_sender import email_sender

            await email_sender.notificar_sync_it_error(
                error_msg=(
                    f"Empleado {no_empleado} fue dado de baja en IT. "
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
        duracion_ms = int((datetime.now(timezone.utc) - inicio).total_seconds() * 1000)
        try:
            from app.core.database import AsyncSessionLocal
            from app.models.auditoria import ItSyncLog

            async with AsyncSessionLocal() as db:
                db.add(
                    ItSyncLog(
                        operacion="update",
                        empleado_id=operacion[:50],
                        datos={
                            "detalle": detalle[:2000],
                            "duracion_ms": duracion_ms,
                            "fase": operacion,
                        },
                        status="ok" if status == "ok" else "error",
                        error_msg=None if status == "ok" else detalle[:2000],
                    )
                )
                await db.commit()
        except Exception as exc:
            _slog("warning", "SYNC_LOG_WRITE_FAILED", error=str(exc))


_client = ITMirrorClient()


async def run_it_mirror_sync() -> None:
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
        logger.error(
            "IT_MIRROR | event=JOB_UNHANDLED_ERROR | error=%s",
            str(exc),
            exc_info=True,
        )
