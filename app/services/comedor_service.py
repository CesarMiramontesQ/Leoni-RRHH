# app/services/comedor_service.py
"""
Servicio del dominio comedor.

Responsabilidades:
  - Publicar menu semanal (RH)
  - Registrar seleccion de platillo del empleado
  - Validar acceso via lector de huella (FAIL OPEN)
  - Estadisticas y proyecciones de consumo
"""

import calendar
import logging
import secrets
import uuid
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone, tzinfo
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.models.comedor import ComedorAccesoEstado, ComedorTipoComida
from app.models.empleados import Empleado
from app.models.roles import Rol
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.comedor_repository import (
    ComedorAccesoRepository,
    ComedorCodigoExternoRepository,
    ComedorExternoCorrelativoRepository,
    ComedorRegistroRepository,
    ComedorRepository,
    MenuSemanalRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.core.config import settings
from app.schemas import PaginatedResponse
from app.schemas.comedor import (
    ComedorAccesoReservaCreate,
    ComedorAccesoReservaResponse,
    ComedorAccesoReservaUpdate,
    ComedorAsignadoResponse,
    ComedorCreate,
    ComedorUpdate,
    ComedorMisFechasOcupadasResponse,
    ComedorEquipoReservaItem,
    ComedorEquipoBeneficiarioItem,
    ComedorMisReservaItem,
    ComedorResumenDiarioItem,
    ComedorRhSemanaRegistrosFuturosItem,
    ComedorRhProximoRegistroItem,
    ComedorRhProximosRegistrosPage,
    ComedorRhCredencialTemporal,
    ComedorRhPaseExternoItem,
    ComedorRhRegistroCreate,
    ComedorRhRegistroResponse,
    ComedorCodigoExternoItem,
    ComedorPrimeraFechaReservaResponse,
    ComedorRegistroCreate,
    ComedorRegistroResponse,
    ComedorResponse,
    ComedorTerminalAccederRequest,
    ComedorTerminalAccederResponse,
    ComedorTerminalConsumirRequest,
    ComedorTerminalConsumirResponse,
    HuellaValidarRequest,
    HuellaValidarResponse,
    MenuSemanalCreate,
    MenuSemanalResponse,
)
from app.services.auth_service import authenticate_user
from app.utils.audit_logger import audit_background
from app.utils.business_time import (
    business_now,
    business_today,
    dentro_ventana_acceso_comedor,
    primera_fecha_reserva_comedor_permitida,
    primer_lunes_reserva_comedor_permitido,
)

logger = logging.getLogger(__name__)

_MENSAJE_FECHA_LIMITE_COMEDOR = (
    "La fecha límite para modificar este servicio de comedor ya venció "
    "(jueves de la semana anterior)."
)


class ComedorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.comedor_repo = ComedorRepository(db)
        self.menu_repo = MenuSemanalRepository(db)
        self.registro_repo = ComedorRegistroRepository(db)
        self.acceso_repo = ComedorAccesoRepository(db)
        self.codigo_externo_repo = ComedorCodigoExternoRepository(db)
        self.externo_corr_repo = ComedorExternoCorrelativoRepository(db)
        self.empleado_repo = EmpleadoRepository(db)

    async def _get_rol(self, user: Empleado) -> str:
        """Fuente de verdad: rol_id en BD (evita relación ORM cacheada o no cargada)."""
        rol_result = await self.db.execute(select(Rol).where(Rol.id == user.rol_id))
        rol = rol_result.scalar_one_or_none()
        return rol.nombre if rol else "empleado"

    @staticmethod
    def _nombre_corto(nombre_completo: str | None) -> str:
        raw = (nombre_completo or "").strip()
        if not raw:
            return "Sin nombre"

        def _title(word: str) -> str:
            w = word.strip()
            if not w:
                return ""
            return w[:1].upper() + w[1:].lower()

        # Formato esperado en DB: "APELLIDOS, NOMBRES"
        if "," in raw:
            apellidos_raw, nombres_raw = raw.split(",", 1)
            primer_apellido = (apellidos_raw.strip().split() or [""])[0]
            primer_nombre = (nombres_raw.strip().split() or [""])[0]
            nombre = _title(primer_nombre)
            apellido = _title(primer_apellido)
            if nombre and apellido:
                return f"{nombre} {apellido}"
            if nombre:
                return nombre
            if apellido:
                return apellido

        # Fallback robusto para formatos inesperados sin coma.
        tokens = [t for t in raw.split() if t]
        if not tokens:
            return "Sin nombre"
        if len(tokens) == 1:
            return _title(tokens[0])
        return f"{_title(tokens[0])} {_title(tokens[1])}"

    @staticmethod
    def _normalizar_fecha_transaccion(fecha_transaccion: datetime) -> datetime:
        if fecha_transaccion.tzinfo is not None:
            return fecha_transaccion
        tz = ZoneInfo(settings.APP_TIMEZONE)
        return fecha_transaccion.replace(tzinfo=tz)

    @staticmethod
    def _calcular_deadline_modificacion(fecha_servicio: date, tz: tzinfo) -> datetime:
        inicio_semana_servicio = fecha_servicio - timedelta(days=fecha_servicio.weekday())
        jueves_semana_previa = inicio_semana_servicio - timedelta(days=4)
        return datetime.combine(
            jueves_semana_previa,
            time(hour=23, minute=59, second=59),
            tzinfo=tz,
        )

    def _validar_ventana_modificacion_reserva(
        self,
        fecha_servicio: date,
        fecha_transaccion: datetime | None = None,
    ) -> None:
        transaccion = self._normalizar_fecha_transaccion(
            fecha_transaccion or business_now()
        )
        tz = transaccion.tzinfo
        if tz is None:
            tz = ZoneInfo(settings.APP_TIMEZONE)
            transaccion = transaccion.replace(tzinfo=tz)
        deadline = self._calcular_deadline_modificacion(fecha_servicio, tz)
        if transaccion > deadline:
            raise DomainValidationError(detail=_MENSAJE_FECHA_LIMITE_COMEDOR)

    def _validar_ventana_modificacion_reservas(
        self,
        fechas_servicio: list[date],
        fecha_transaccion: datetime | None = None,
    ) -> None:
        transaccion = fecha_transaccion or business_now()
        for fecha in fechas_servicio:
            self._validar_ventana_modificacion_reserva(
                fecha_servicio=fecha,
                fecha_transaccion=transaccion,
            )

    async def _resolver_beneficiario_reserva(
        self,
        current_user: Empleado,
        target_user_id: int | None,
    ) -> int:
        rol = await self._get_rol(current_user)
        beneficiario_id = target_user_id or current_user.id

        if rol == "empleado":
            if beneficiario_id != current_user.id:
                raise ForbiddenError(detail="No puedes registrar comida para otro empleado")
            return current_user.id

        if rol == "gerente":
            if beneficiario_id != current_user.id:
                raise ForbiddenError(
                    detail="Solo el rol supervisor puede registrar comida para terceros",
                )
            return current_user.id

        if rol != "supervisor":
            raise ForbiddenError(detail="No tienes permiso para registrar reservas")

        if beneficiario_id == current_user.id:
            return beneficiario_id

        subordinados = await self.empleado_repo.get_subordinados(
            current_user.empleado_id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        subordinados_ids = {emp.id for emp in subordinados}
        if beneficiario_id not in subordinados_ids:
            raise ForbiddenError(
                detail="Solo puedes registrar para ti o para un integrante directo de tu equipo",
            )
        return beneficiario_id

    async def _resolver_comedor_id_asignado(self, empleado_id: int) -> int:
        """ID en `comedores` según `turnos_empleados.comedor` del empleado."""
        empleado = await self.empleado_repo.get(empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        result = await self.db.execute(
            select(TurnoEmpleado).where(TurnoEmpleado.no_empleado == empleado.no_empleado)
        )
        turno = result.scalar_one_or_none()
        if turno is None or turno.comedor is None:
            raise ConflictError(
                detail=(
                    "No hay comedor asignado para este empleado en turnos. "
                    "Contacta a Recursos Humanos."
                ),
            )

        comedor = await self.comedor_repo.get(turno.comedor)
        if not comedor:
            raise ConflictError(
                detail=(
                    f"El comedor asignado en turno ({turno.comedor}) no está registrado "
                    "en el sistema. Contacta a Recursos Humanos."
                ),
            )
        if not comedor.activo:
            raise ConflictError(
                detail=(
                    "El comedor asignado a este empleado no está activo. "
                    "Contacta a Recursos Humanos."
                ),
            )
        return comedor.id

    def _validar_comedor_coincide_asignado(
        self,
        comedor_id_enviado: int | None,
        comedor_id_asignado: int,
    ) -> None:
        if comedor_id_enviado is not None and comedor_id_enviado != comedor_id_asignado:
            raise ConflictError(
                detail="El comedor indicado no coincide con el asignado a este empleado.",
            )

    async def get_comedor_asignado(
        self,
        current_user: Empleado,
        target_user_id: int | None = None,
    ) -> ComedorAsignadoResponse:
        beneficiario_id = await self._resolver_beneficiario_reserva(
            current_user=current_user,
            target_user_id=target_user_id,
        )
        comedor_id = await self._resolver_comedor_id_asignado(beneficiario_id)
        comedor = await self.comedor_repo.get(comedor_id)
        if not comedor:
            raise NotFoundError(entidad="Comedor", id=comedor_id)
        return ComedorAsignadoResponse(
            comedor_id=comedor.id,
            comedor_nombre=comedor.nombre,
        )

    async def list_equipo_beneficiarios_directos(
        self,
        current_user: Empleado,
    ) -> list[ComedorEquipoBeneficiarioItem]:
        if await self._get_rol(current_user) != "supervisor":
            raise ForbiddenError(detail="Solo supervisor puede consultar beneficiarios")
        subordinados = await self.empleado_repo.get_subordinados(
            current_user.empleado_id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        rows = [current_user, *sorted(subordinados, key=lambda x: (x.nombre or "").lower())]
        return [
            ComedorEquipoBeneficiarioItem(
                empleado_id=row.id,
                no_empleado=row.no_empleado or "",
                nombre=row.nombre or "Sin nombre",
                nombre_corto=self._nombre_corto(row.nombre),
            )
            for row in rows
        ]

    # ── Comedores ──────────────────────────────────────────────

    async def list_comedores(self) -> list[ComedorResponse]:
        comedores = await self.comedor_repo.get_activos()
        return [ComedorResponse.model_validate(c) for c in comedores]

    async def crear_comedor(
        self,
        data: ComedorCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorResponse:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede registrar comedores")

        ubic = (data.ubicacion or "").strip() or None
        comedor = await self.comedor_repo.create({
            "nombre": data.nombre.strip(),
            "ubicacion": ubic,
            "capacidad": data.capacidad,
            "activo": data.activo,
            "turno_ids": None,
        })
        await self.db.flush()

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_CREADO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=comedor.id,
            datos_despues={"nombre": data.nombre, "activo": data.activo},
        )
        return ComedorResponse.model_validate(comedor)

    async def editar_comedor(
        self,
        comedor_id: int,
        data: ComedorUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorResponse:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede editar comedores")

        comedor = await self.comedor_repo.get(comedor_id)
        if comedor is None:
            raise NotFoundError(entidad="Comedor", id=comedor_id)

        datos_antes = {
            "nombre": comedor.nombre,
            "ubicacion": comedor.ubicacion,
            "capacidad": comedor.capacidad,
            "activo": comedor.activo,
        }
        comedor = await self.comedor_repo.update(comedor_id, {
            "nombre": data.nombre.strip(),
            "ubicacion": (data.ubicacion or "").strip() or None,
            "capacidad": data.capacidad,
            "activo": data.activo,
        })
        if comedor is None:
            raise NotFoundError(entidad="Comedor", id=comedor_id)

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_ACTUALIZADO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=comedor.id,
            datos_antes=datos_antes,
            datos_despues={
                "nombre": comedor.nombre,
                "ubicacion": comedor.ubicacion,
                "capacidad": comedor.capacidad,
                "activo": comedor.activo,
            },
        )
        return ComedorResponse.model_validate(comedor)

    # ── Menú ───────────────────────────────────────────────────

    async def get_menu(
        self,
        comedor_id: int,
        semana: date,
    ) -> list[MenuSemanalResponse]:
        menus = await self.menu_repo.get_menu_semana(comedor_id=comedor_id, semana=semana)
        return [MenuSemanalResponse.model_validate(m) for m in menus]

    async def publicar_menu(
        self,
        data: MenuSemanalCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> MenuSemanalResponse:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede publicar menus")

        payload = {
            **data.model_dump(),
            "created_by": current_user.id,
        }
        menu = await self.menu_repo.upsert_menu(payload)
        await self.db.flush()

        logger.debug(
            "Menú semanal upsert | comedor=%s semana=%s dia=%s tipo=%s id=%s",
            data.comedor_id,
            data.semana,
            data.dia,
            data.tipo,
            menu.id,
        )

        audit_background(
            background_tasks,
            self.db,
            accion="MENU_PUBLICADO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=menu.id,
            datos_despues={"comedor_id": data.comedor_id, "semana": str(data.semana), "dia": data.dia},
        )
        return MenuSemanalResponse.model_validate(menu)

    # ── Selección de platillo ──────────────────────────────────

    async def registrar_seleccion(
        self,
        data: ComedorRegistroCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorRegistroResponse:
        comedor_id = await self._resolver_comedor_id_asignado(current_user.id)
        self._validar_comedor_coincide_asignado(data.comedor_id, comedor_id)

        # Solo un registro por empleado/semana/comedor
        existente = await self.registro_repo.get_registro_semana(
            empleado_id=current_user.id,
            semana=data.semana,
        )
        if existente:
            raise ConflictError(
                detail=f"Ya existe un registro para la semana {data.semana}"
            )

        registro = await self.registro_repo.create({
            "comedor_id": comedor_id,
            "semana": data.semana,
            "tipo_platillo": data.tipo_platillo,
            "empleado_id": current_user.id,
            "acceso_concedido": False,
        })
        await self.db.flush()

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_SELECCION",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=registro.id,
        )
        return ComedorRegistroResponse.model_validate(registro)

    # ── Reserva diaria (comedor_accesos) ───────────────────────

    def primera_fecha_reserva_permitida(self) -> ComedorPrimeraFechaReservaResponse:
        return ComedorPrimeraFechaReservaResponse(
            fecha_iso=primera_fecha_reserva_comedor_permitida(business_now()),
        )

    async def list_mis_reservas_mes(
        self,
        current_user: Empleado,
        anio: int,
        mes: int,
    ) -> list[ComedorMisReservaItem]:
        desde = date(anio, mes, 1)
        ultimo = calendar.monthrange(anio, mes)[1]
        hasta = date(anio, mes, ultimo)
        rows = await self.acceso_repo.list_accesos_empleado_rango(
            empleado_id=current_user.id,
            desde=desde,
            hasta=hasta,
        )
        return [ComedorMisReservaItem.model_validate(r) for r in rows]

    async def list_mis_fechas_ocupadas(
        self,
        current_user: Empleado,
        desde: date,
        hasta: date,
    ) -> ComedorMisFechasOcupadasResponse:
        fechas = await self.acceso_repo.list_fechas_reserva_activa(
            empleado_id=current_user.id,
            desde=desde,
            hasta=hasta,
        )
        return ComedorMisFechasOcupadasResponse(fechas=fechas)

    async def list_mis_proximas_reservas(
        self,
        current_user: Empleado,
        limite: int = 5,
    ) -> list[ComedorMisReservaItem]:
        rows = await self.acceso_repo.list_proximos_accesos_empleado(
            empleado_id=current_user.id,
            desde=business_today(),
            limite=limite,
        )
        return [ComedorMisReservaItem.model_validate(r) for r in rows]

    async def list_equipo_proximas_reservas(
        self,
        current_user: Empleado,
        limite: int = 50,
    ) -> list[ComedorEquipoReservaItem]:
        if await self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar reservas de equipo")
        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.empleado_id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        equipo_ids.add(current_user.id)
        if not equipo_ids:
            return []
        rows = await self.acceso_repo.list_proximos_accesos_equipo(
            empleado_ids=list(equipo_ids),
            desde=business_today(),
            limite=limite,
        )
        return [
            ComedorEquipoReservaItem(
                id=row.id,
                empleado_id=row.empleado_id,
                empleado_nombre=row.empleado.nombre if row.empleado else "Sin nombre",
                empleado_nombre_corto=self._nombre_corto(row.empleado.nombre if row.empleado else None),
                fecha_servicio=row.fecha_servicio,
                tipo_comida=row.tipo_comida.value if hasattr(row.tipo_comida, "value") else str(row.tipo_comida),
                estado_acceso=row.estado_acceso.value if hasattr(row.estado_acceso, "value") else str(row.estado_acceso),
            )
            for row in rows
        ]

    async def list_equipo_reservas_mes(
        self,
        current_user: Empleado,
        anio: int,
        mes: int,
    ) -> list[ComedorEquipoReservaItem]:
        if await self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar reservas de equipo")
        desde = date(anio, mes, 1)
        ultimo = calendar.monthrange(anio, mes)[1]
        hasta = date(anio, mes, ultimo)
        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.empleado_id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        equipo_ids.add(current_user.id)
        if not equipo_ids:
            return []
        rows = await self.acceso_repo.list_accesos_equipo_mes(
            empleado_ids=list(equipo_ids),
            desde=desde,
            hasta=hasta,
        )
        return [
            ComedorEquipoReservaItem(
                id=row.id,
                empleado_id=row.empleado_id,
                empleado_nombre=row.empleado.nombre if row.empleado else "Sin nombre",
                empleado_nombre_corto=self._nombre_corto(row.empleado.nombre if row.empleado else None),
                fecha_servicio=row.fecha_servicio,
                tipo_comida=row.tipo_comida.value if hasattr(row.tipo_comida, "value") else str(row.tipo_comida),
                estado_acceso=row.estado_acceso.value if hasattr(row.estado_acceso, "value") else str(row.estado_acceso),
            )
            for row in rows
        ]

    async def get_equipo_metricas_dashboard(
        self,
        current_user: Empleado,
    ) -> dict[str, int]:
        if await self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar métricas de equipo")
        hoy = business_today()
        inicio_semana_actual = hoy - timedelta(days=hoy.weekday())
        fin_semana_actual = inicio_semana_actual + timedelta(days=6)
        inicio_semana_siguiente = inicio_semana_actual + timedelta(days=7)
        fin_semana_siguiente = inicio_semana_siguiente + timedelta(days=6)

        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.empleado_id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        equipo_ids.add(current_user.id)
        metricas = await self.acceso_repo.get_metricas_reservas_activas_equipo(
            empleado_ids=list(equipo_ids),
            semana_actual_inicio=inicio_semana_actual,
            semana_actual_fin=fin_semana_actual,
            semana_siguiente_inicio=inicio_semana_siguiente,
            semana_siguiente_fin=fin_semana_siguiente,
        )
        total_activas = metricas["total_activas"]
        total_semana_actual = metricas["total_semana_actual"]
        total_asistencias = metricas["total_asistencias"]
        if total_activas <= 0:
            porcentaje_caseras = 0
            porcentaje_saludables = 0
            porcentaje_asistencia = 0
        else:
            porcentaje_caseras = round((metricas["total_caseras"] / total_activas) * 100)
            porcentaje_saludables = round((metricas["total_saludables"] / total_activas) * 100)
            porcentaje_asistencia = round((total_asistencias / total_activas) * 100)

        return {
            "semana_actual_total": total_semana_actual,
            "semana_proxima_total": metricas["total_semana_siguiente"],
            "total_asistencias": total_asistencias,
            "porcentaje_asistencia": int(porcentaje_asistencia),
            "porcentaje_caseras": int(porcentaje_caseras),
            "porcentaje_saludables": int(porcentaje_saludables),
            "total_activas": total_activas,
        }

    async def list_resumen_diario_rh(
        self,
        current_user: Empleado,
        desde: date,
        hasta: date,
    ) -> list[ComedorResumenDiarioItem]:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar resumen diario global")
        if hasta < desde:
            raise ConflictError(detail="El rango de fechas es inválido")
        rows = await self.acceso_repo.list_resumen_diario_global(desde=desde, hasta=hasta)
        resumen_por_fecha: dict[date, dict[str, int | date]] = {
            row["fecha"]: {
                "fecha": row["fecha"],
                "caseras": int(row["caseras"]),
                "saludables": int(row["saludables"]),
                "registros": int(row["registros"]),
                "asistencias": int(row["asistencias"]),
            }
            for row in rows
        }

        codigos_externos = await self.codigo_externo_repo.list_codigos_externos(
            desde=desde,
            hasta=hasta,
        )
        for codigo in codigos_externos:
            fecha_inicio = codigo.get("fecha_inicio")
            fecha_fin = codigo.get("fecha_fin")
            if not isinstance(fecha_inicio, date) or not isinstance(fecha_fin, date):
                continue
            inicio = max(desde, fecha_inicio)
            fin = min(hasta, fecha_fin)
            if fin < inicio:
                continue
            cantidad_personas = int(codigo.get("cantidad_personas") or 0)
            if cantidad_personas <= 0:
                continue
            tipo_comida_raw = codigo.get("tipo_comida")
            tipo_comida = (
                tipo_comida_raw.value
                if hasattr(tipo_comida_raw, "value")
                else str(tipo_comida_raw or "").strip().lower()
            )
            dia = inicio
            while dia <= fin:
                celda = resumen_por_fecha.setdefault(
                    dia,
                    {
                        "fecha": dia,
                        "caseras": 0,
                        "saludables": 0,
                        "registros": 0,
                        "asistencias": 0,
                    },
                )
                if tipo_comida == ComedorTipoComida.saludable.value:
                    celda["saludables"] = int(celda["saludables"]) + cantidad_personas
                else:
                    celda["caseras"] = int(celda["caseras"]) + cantidad_personas
                celda["registros"] = int(celda["registros"]) + cantidad_personas
                dia += timedelta(days=1)

        ordenado = [resumen_por_fecha[k] for k in sorted(resumen_por_fecha.keys())]
        out: list[ComedorResumenDiarioItem] = []
        for row in ordenado:
            registros = int(row["registros"])
            if registros <= 0:
                registros = int(row["caseras"]) + int(row["saludables"])
            out.append(
                ComedorResumenDiarioItem(
                    fecha=row["fecha"],
                    caseras=int(row["caseras"]),
                    saludables=int(row["saludables"]),
                    registros=registros,
                    asistencias=int(row["asistencias"]),
                )
            )
        return out

    async def list_registros_futuros_por_semana_rh(
        self,
        current_user: Empleado,
        *,
        semanas: int = 8,
    ) -> list[ComedorRhSemanaRegistrosFuturosItem]:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar registros futuros por semana")
        hoy = date.today()
        limite = max(1, min(semanas, 16))
        filas = await self.acceso_repo.count_accesos_activos_por_dia_desde(hoy)
        por_semana: dict[date, int] = {}
        for fecha, cnt in filas:
            lunes = fecha - timedelta(days=fecha.weekday())
            por_semana[lunes] = por_semana.get(lunes, 0) + cnt
        ordenadas = sorted(por_semana.items(), key=lambda x: x[0])[:limite]
        return [
            ComedorRhSemanaRegistrosFuturosItem(semana_inicio=inicio, total=total)
            for inicio, total in ordenadas
            if total > 0
        ]

    def _estados_proximos_rh_filtro(
        self, filtro_estado: Literal["todos", "confirmado", "cancelado"]
    ) -> tuple[ComedorAccesoEstado, ...]:
        if filtro_estado == "confirmado":
            return (ComedorAccesoEstado.ACCEDIDO,)
        if filtro_estado == "cancelado":
            return (ComedorAccesoEstado.EXPIRADO,)
        return (ComedorAccesoEstado.PENDIENTE, ComedorAccesoEstado.ACCEDIDO)

    def _estados_registros_reporte_rh_filtro(
        self, filtro_estado: Literal["todos", "confirmado", "cancelado"]
    ) -> tuple[ComedorAccesoEstado, ...]:
        """Reporte RH: «todos» incluye EXPIRADO y REPETIDO; confirmado incluye acceso repetido."""
        if filtro_estado == "confirmado":
            return (ComedorAccesoEstado.ACCEDIDO, ComedorAccesoEstado.REPETIDO)
        if filtro_estado == "cancelado":
            return (ComedorAccesoEstado.EXPIRADO,)
        return (
            ComedorAccesoEstado.PENDIENTE,
            ComedorAccesoEstado.ACCEDIDO,
            ComedorAccesoEstado.EXPIRADO,
            ComedorAccesoEstado.REPETIDO,
        )

    async def list_proximos_registros_rh_paginated(
        self,
        current_user: Empleado,
        page: int,
        page_size: int,
        buscar: str | None = None,
        filtro_estado: Literal["todos", "confirmado", "cancelado"] = "todos",
    ) -> ComedorRhProximosRegistrosPage:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar próximos registros de comedor")
        if page_size not in (5, 10, 50):
            raise ConflictError(detail="page_size debe ser 5, 10 o 50")
        desde = business_today()
        offset = (page - 1) * page_size
        estados = self._estados_proximos_rh_filtro(filtro_estado)
        buscar_norm = buscar.strip() if buscar else None
        if buscar_norm == "":
            buscar_norm = None
        total = await self.acceso_repo.count_proximos_accesos_global_rh(
            desde=desde, estados=estados, buscar=buscar_norm
        )
        rows = await self.acceso_repo.list_proximos_accesos_global_rh(
            desde=desde,
            offset=offset,
            limit=page_size,
            estados=estados,
            buscar=buscar_norm,
        )
        items: list[ComedorRhProximoRegistroItem] = []
        for row in rows:
            emp = row.empleado
            nombre = (emp.nombre if emp else "") or "Sin nombre"
            no_emp = (emp.no_empleado if emp else "") or ""
            area_txt = ""
            if emp and emp.area and getattr(emp.area, "descripcion", None):
                area_txt = str(emp.area.descripcion).strip()
            comedor_nombre = (row.comedor.nombre if row.comedor else "") or ""
            tipo = row.tipo_comida.value if hasattr(row.tipo_comida, "value") else str(row.tipo_comida)
            estado = (
                row.estado_acceso.value if hasattr(row.estado_acceso, "value") else str(row.estado_acceso)
            )
            items.append(
                ComedorRhProximoRegistroItem(
                    id=row.id,
                    empleado_id=row.empleado_id,
                    empleado_nombre=nombre,
                    no_empleado=no_emp,
                    area=area_txt,
                    comedor_nombre=comedor_nombre,
                    fecha_servicio=row.fecha_servicio,
                    tipo_comida=tipo,
                    estado_acceso=estado,
                )
            )
        return ComedorRhProximosRegistrosPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def list_registros_reporte_rh_paginated(
        self,
        current_user: Empleado,
        desde: date,
        hasta: date,
        page: int,
        page_size: int,
        buscar: str | None = None,
        filtro_estado: Literal["todos", "confirmado", "cancelado"] = "todos",
    ) -> ComedorRhProximosRegistrosPage:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar registros de reporte de comedor")
        if hasta < desde:
            raise ConflictError(detail="El rango de fechas es inválido")
        if page_size not in (5, 10, 50):
            raise ConflictError(detail="page_size debe ser 5, 10 o 50")
        offset = (page - 1) * page_size
        estados = self._estados_registros_reporte_rh_filtro(filtro_estado)
        buscar_norm = buscar.strip() if buscar else None
        if buscar_norm == "":
            buscar_norm = None
        total = await self.acceso_repo.count_accesos_global_rh_en_rango(
            desde=desde,
            hasta=hasta,
            estados=estados,
            buscar=buscar_norm,
        )
        rows = await self.acceso_repo.list_accesos_global_rh_en_rango(
            desde=desde,
            hasta=hasta,
            offset=offset,
            limit=page_size,
            estados=estados,
            buscar=buscar_norm,
        )
        items: list[ComedorRhProximoRegistroItem] = []
        for row in rows:
            emp = row.empleado
            nombre = (emp.nombre if emp else "") or "Sin nombre"
            no_emp = (emp.no_empleado if emp else "") or ""
            area_txt = ""
            if emp and emp.area and getattr(emp.area, "descripcion", None):
                area_txt = str(emp.area.descripcion).strip()
            comedor_nombre = (row.comedor.nombre if row.comedor else "") or ""
            tipo = row.tipo_comida.value if hasattr(row.tipo_comida, "value") else str(row.tipo_comida)
            estado = (
                row.estado_acceso.value if hasattr(row.estado_acceso, "value") else str(row.estado_acceso)
            )
            items.append(
                ComedorRhProximoRegistroItem(
                    id=row.id,
                    empleado_id=row.empleado_id,
                    empleado_nombre=nombre,
                    no_empleado=no_emp,
                    area=area_txt,
                    comedor_nombre=comedor_nombre,
                    fecha_servicio=row.fecha_servicio,
                    tipo_comida=tipo,
                    estado_acceso=estado,
                )
            )
        return ComedorRhProximosRegistrosPage(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def _crear_codigos_externos_temporales(
        self,
        cantidad: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> ComedorRhCredencialTemporal:
        lote_id = str(uuid.uuid4())
        numeros = await self.externo_corr_repo.reservar_siguientes(cantidad)
        pases: list[ComedorRhPaseExternoItem] = []
        # PIN numérico de 4 dígitos (0000–9999), únicos dentro del mismo lote.
        rng = secrets.SystemRandom()
        pin_enteros = rng.sample(range(10_000), cantidad)

        for num, pin_int in zip(numeros, pin_enteros, strict=True):
            token = f"CEXT{num}"
            password_temporal = f"{pin_int:04d}"
            pases.append(
                ComedorRhPaseExternoItem(
                    codigo_acceso=token,
                    password_temporal=password_temporal,
                ),
            )

        return ComedorRhCredencialTemporal(
            lote_id=lote_id,
            valido_desde=fecha_inicio,
            valido_hasta=fecha_fin,
            pases=pases,
        )

    async def _crear_reservas_para_empleados(
        self,
        empleado_ids: list[int],
        comedor_id: int,
        fechas: list[date],
        tipo_enum: ComedorTipoComida,
    ) -> int:
        self._validar_ventana_modificacion_reservas(fechas)
        creados = 0
        for empleado_id in empleado_ids:
            semanas = sorted({f - timedelta(days=f.weekday()) for f in fechas})
            registros_por_semana: dict[date, object] = {}
            for inicio_semana in semanas:
                registro = await self.registro_repo.get_registro_semana_comedor(
                    empleado_id=empleado_id,
                    comedor_id=comedor_id,
                    semana=inicio_semana,
                )
                if not registro:
                    registro = await self.registro_repo.create({
                        "empleado_id": empleado_id,
                        "comedor_id": comedor_id,
                        "semana": inicio_semana,
                        "tipo_platillo": "normal",
                        "acceso_concedido": False,
                    })
                    await self.db.flush()
                registros_por_semana[inicio_semana] = registro

            existentes = await self.acceso_repo.list_accesos_por_empleado_y_fechas(
                empleado_id=empleado_id,
                fechas_servicio=fechas,
            )
            existentes_por_fecha = {row.fecha_servicio: row for row in existentes}
            for fecha_servicio in fechas:
                existente = existentes_por_fecha.get(fecha_servicio)
                if existente and existente.estado_acceso in (
                    ComedorAccesoEstado.PENDIENTE,
                    ComedorAccesoEstado.ACCEDIDO,
                ):
                    raise ConflictError(detail="Ya existe un registro activo para una de las fechas seleccionadas")
                if existente and existente.estado_acceso == ComedorAccesoEstado.EXPIRADO:
                    await self.acceso_repo.update(
                        existente.id,
                        {
                            "comedor_id": comedor_id,
                            "comedor_registro_id": registros_por_semana[
                                fecha_servicio - timedelta(days=fecha_servicio.weekday())
                            ].id,
                            "tipo_comida": tipo_enum,
                            "estado_acceso": ComedorAccesoEstado.PENDIENTE,
                            "hora_entrada": None,
                        },
                    )
                    await self.db.flush()
                    creados += 1
                    continue
                await self.acceso_repo.create({
                    "empleado_id": empleado_id,
                    "comedor_id": comedor_id,
                    "comedor_registro_id": registros_por_semana[
                        fecha_servicio - timedelta(days=fecha_servicio.weekday())
                    ].id,
                    "fecha_servicio": fecha_servicio,
                    "tipo_comida": tipo_enum,
                    "estado_acceso": ComedorAccesoEstado.PENDIENTE,
                })
                await self.db.flush()
                creados += 1
        return creados

    async def crear_registro_rh(
        self,
        data: ComedorRhRegistroCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorRhRegistroResponse:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede crear registros de este tipo")
        comedor = await self.comedor_repo.get(data.comedor_id)
        if not comedor:
            raise NotFoundError(entidad="Comedor", id=data.comedor_id)

        fechas = sorted(set(data.fechas_servicio))
        if not fechas:
            raise ConflictError(detail="Debes enviar al menos una fecha")

        tipo_enum = ComedorTipoComida(data.tipo_comida)
        if data.person_type == "interno":
            if not data.target_user_id:
                raise ConflictError(detail="Debes seleccionar un empleado válido")
            empleado = await self.empleado_repo.get_with_rol(data.target_user_id)
            if not empleado:
                raise NotFoundError(entidad="Empleado", id=data.target_user_id)
            comedor_id = await self._resolver_comedor_id_asignado(empleado.id)
            self._validar_comedor_coincide_asignado(data.comedor_id, comedor_id)
            creados = await self._crear_reservas_para_empleados(
                empleado_ids=[empleado.id],
                comedor_id=comedor_id,
                fechas=fechas,
                tipo_enum=tipo_enum,
            )
            audit_background(
                background_tasks,
                self.db,
                accion="COMEDOR_RH_REGISTRO_INTERNO",
                modulo="comedor",
                usuario_id=current_user.id,
                entidad_id=empleado.id,
                datos_despues={
                    "fechas": [str(f) for f in fechas],
                    "tipo_comida": data.tipo_comida,
                    "observaciones": data.observaciones or "",
                },
            )
            return ComedorRhRegistroResponse(
                total_registros_creados=creados,
                modo="interno",
                credenciales_temporales=None,
            )

        cantidad = data.external_people_count or 0
        if cantidad <= 0:
            raise ConflictError(detail="Debes indicar una cantidad válida de personal externo")
        credenciales = await self._crear_codigos_externos_temporales(
            cantidad=cantidad,
            fecha_inicio=fechas[0],
            fecha_fin=fechas[-1],
        )
        codigos_creados = len(credenciales.pases)
        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_RH_REGISTRO_EXTERNO",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=data.comedor_id,
            datos_despues={
                "cantidad_externos": cantidad,
                "fechas": [str(f) for f in fechas],
                "tipo_comida": data.tipo_comida,
                "lote_id": credenciales.lote_id,
                "pases_generados": codigos_creados,
                "observaciones": data.observaciones or "",
            },
        )
        for pase in credenciales.pases:
            await self.codigo_externo_repo.create({
                "comedor_id": data.comedor_id,
                "created_by": current_user.id,
                "empleado_id": None,
                "lote_id": credenciales.lote_id,
                "fecha_inicio": fechas[0],
                "fecha_fin": fechas[-1],
                "cantidad_personas": 1,
                "tipo_comida": tipo_enum,
                "codigo_acceso": pase.codigo_acceso,
                "password_temporal": pase.password_temporal,
            })
        await self.db.flush()
        return ComedorRhRegistroResponse(
            total_registros_creados=codigos_creados,
            modo="externo",
            credenciales_temporales=credenciales,
        )

    async def list_codigos_externos_rh(
        self,
        current_user: Empleado,
        desde: date | None = None,
        hasta: date | None = None,
        estatus: str | None = None,
    ) -> list[ComedorCodigoExternoItem]:
        if await self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar códigos externos")
        if desde and hasta and hasta < desde:
            raise ConflictError(detail="El rango de fechas es inválido")
        rows = await self.codigo_externo_repo.list_codigos_externos(
            desde=desde,
            hasta=hasta,
            estatus=estatus,
        )
        return [ComedorCodigoExternoItem(**row) for row in rows]

    async def reservar_acceso_dia(
        self,
        data: ComedorAccesoReservaCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> list[ComedorAccesoReservaResponse]:
        beneficiario_id = await self._resolver_beneficiario_reserva(
            current_user=current_user,
            target_user_id=data.target_user_id,
        )

        fechas = list(data.fechas_servicio or [])
        if data.fecha_servicio is not None:
            fechas.append(data.fecha_servicio)
        fechas = sorted(set(fechas))
        if not fechas:
            raise ConflictError(detail="Debes seleccionar al menos una fecha de servicio")

        self._validar_ventana_modificacion_reservas(fechas)

        tipo_enum = ComedorTipoComida(data.tipo_comida)

        comedor_id = await self._resolver_comedor_id_asignado(beneficiario_id)
        self._validar_comedor_coincide_asignado(data.comedor_id, comedor_id)

        comedor = await self.comedor_repo.get(comedor_id)
        if not comedor:
            raise NotFoundError(entidad="Comedor", id=comedor_id)

        semanas = sorted({f - timedelta(days=f.weekday()) for f in fechas})
        registros_por_semana: dict[date, object] = {}
        for inicio_semana in semanas:
            registro = await self.registro_repo.get_registro_semana_comedor(
                empleado_id=beneficiario_id,
                comedor_id=comedor_id,
                semana=inicio_semana,
            )
            if not registro:
                if await self._get_rol(current_user) in ("supervisor", "gerente"):
                    registro = await self.registro_repo.create({
                        "empleado_id": beneficiario_id,
                        "comedor_id": comedor_id,
                        "semana": inicio_semana,
                        "tipo_platillo": "normal",
                        "acceso_concedido": False,
                    })
                    await self.db.flush()
                else:
                    raise ConflictError(
                        detail="Primero debes registrar tu selección semanal para este comedor",
                    )
            registros_por_semana[inicio_semana] = registro

        existentes = await self.acceso_repo.list_accesos_por_empleado_y_fechas(
            empleado_id=beneficiario_id,
            fechas_servicio=fechas,
        )
        existentes_por_fecha = {row.fecha_servicio: row for row in existentes}
        for fecha_servicio in fechas:
            existente = existentes_por_fecha.get(fecha_servicio)
            if not existente:
                continue
            if existente.estado_acceso in (
                ComedorAccesoEstado.ACCEDIDO,
                ComedorAccesoEstado.PENDIENTE,
            ):
                detail = "Ya tienes un registro para este día"
                if beneficiario_id != current_user.id:
                    beneficiario = await self.empleado_repo.get(beneficiario_id)
                    nombre_beneficiario = self._nombre_corto(
                        beneficiario.nombre if beneficiario else None
                    )
                    detail = (
                        f"El empleado {nombre_beneficiario} ya tiene una comida registrada "
                        "para este día"
                    )
                raise ConflictError(
                    detail=detail,
                )

        reservados: list[ComedorAccesoReservaResponse] = []
        for fecha_servicio in fechas:
            inicio_semana = fecha_servicio - timedelta(days=fecha_servicio.weekday())
            registro = registros_por_semana[inicio_semana]
            existente = existentes_por_fecha.get(fecha_servicio)
            if existente and existente.estado_acceso == ComedorAccesoEstado.EXPIRADO:
                acc = await self.acceso_repo.update(
                    existente.id,
                    {
                        "comedor_id": comedor_id,
                        "comedor_registro_id": registro.id,
                        "tipo_comida": tipo_enum,
                        "estado_acceso": ComedorAccesoEstado.PENDIENTE,
                        "hora_entrada": None,
                    },
                )
                await self.db.flush()
                if acc:
                    reservados.append(ComedorAccesoReservaResponse.model_validate(acc))
                    audit_background(
                        background_tasks,
                        self.db,
                        accion="COMEDOR_ACCESO_RESERVA",
                        modulo="comedor",
                        usuario_id=current_user.id,
                        entidad_id=acc.id,
                        datos_despues={
                            "reactivado": True,
                            "beneficiario_id": beneficiario_id,
                            "fecha_servicio": str(fecha_servicio),
                            "tipo_comida": data.tipo_comida,
                        },
                    )
                continue

            acceso = await self.acceso_repo.create({
                "empleado_id": beneficiario_id,
                "comedor_id": comedor_id,
                "comedor_registro_id": registro.id,
                "fecha_servicio": fecha_servicio,
                "tipo_comida": tipo_enum,
                "estado_acceso": ComedorAccesoEstado.PENDIENTE,
            })
            await self.db.flush()
            reservados.append(ComedorAccesoReservaResponse.model_validate(acceso))
            audit_background(
                background_tasks,
                self.db,
                accion="COMEDOR_ACCESO_RESERVA",
                modulo="comedor",
                usuario_id=current_user.id,
                entidad_id=acceso.id,
                datos_despues={
                    "beneficiario_id": beneficiario_id,
                    "comedor_id": comedor_id,
                    "fecha_servicio": str(fecha_servicio),
                    "tipo_comida": data.tipo_comida,
                },
            )

        return reservados

    async def editar_mi_reserva(
        self,
        acceso_id: int,
        data: ComedorAccesoReservaUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ComedorAccesoReservaResponse:
        acceso = await self.acceso_repo.get_by_id_empleado(acceso_id, current_user.id)
        if not acceso:
            raise NotFoundError(entidad="Acceso comedor", id=acceso_id)

        primer_lunes = primer_lunes_reserva_comedor_permitido(business_today())
        if acceso.fecha_servicio < primer_lunes:
            raise ConflictError(
                detail="Solo puedes editar reservas de semanas futuras",
            )
        if acceso.estado_acceso != ComedorAccesoEstado.PENDIENTE:
            raise ConflictError(
                detail="Solo puedes editar reservas pendientes",
            )

        actualizado = await self.acceso_repo.update(
            acceso.id,
            {"tipo_comida": ComedorTipoComida(data.tipo_comida)},
        )
        await self.db.flush()
        if not actualizado:
            raise NotFoundError(entidad="Acceso comedor", id=acceso_id)

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_ACCESO_EDICION",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=actualizado.id,
            datos_despues={
                "fecha_servicio": str(actualizado.fecha_servicio),
                "tipo_comida": data.tipo_comida,
            },
        )
        return ComedorAccesoReservaResponse.model_validate(actualizado)

    async def cancelar_mi_reserva(
        self,
        acceso_id: int,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> None:
        acceso = await self.acceso_repo.get_by_id_empleado(acceso_id, current_user.id)
        if not acceso:
            raise NotFoundError(entidad="Acceso comedor", id=acceso_id)

        self._validar_ventana_modificacion_reserva(acceso.fecha_servicio)
        if acceso.estado_acceso != ComedorAccesoEstado.PENDIENTE:
            raise ConflictError(
                detail="Solo puedes cancelar reservas pendientes",
            )

        deleted = await self.acceso_repo.delete_by_id_empleado(acceso.id, current_user.id)
        if deleted == 0:
            raise NotFoundError(entidad="Acceso comedor", id=acceso_id)

        audit_background(
            background_tasks,
            self.db,
            accion="COMEDOR_ACCESO_CANCELACION",
            modulo="comedor",
            usuario_id=current_user.id,
            entidad_id=acceso_id,
            datos_despues={"fecha_servicio": str(acceso.fecha_servicio)},
        )

    # ── Terminal comedor (usuario + contraseña) ───────────────

    async def terminal_acceder(
        self,
        data: ComedorTerminalAccederRequest,
    ) -> ComedorTerminalAccederResponse:
        try:
            empleado = await authenticate_user(
                data.username, data.password, self.db
            )
        except HTTPException as exc:
            if exc.status_code == 401:
                raise UnauthorizedError(
                    detail=str(exc.detail)
                    if exc.detail
                    else "Credenciales incorrectas",
                ) from exc
            if exc.status_code == 403:
                raise ForbiddenError(
                    detail=str(exc.detail) if exc.detail else "Empleado inactivo",
                ) from exc
            raise

        comedor = await self.comedor_repo.get(data.comedor_id)
        if not comedor:
            raise NotFoundError(entidad="Comedor", id=data.comedor_id)

        ahora = business_now()
        if not dentro_ventana_acceso_comedor(ahora):
            raise ForbiddenError(detail="Fuera del horario de acceso al comedor")

        dia = business_today()
        acceso = await self.acceso_repo.get_pendiente_para_dia(
            empleado_id=empleado.id,
            comedor_id=data.comedor_id,
            fecha_servicio=dia,
            tipo_comida_preferido=None,
        )
        if not acceso or acceso.registro is None:
            raise ForbiddenError(detail="No tienes reserva para hoy en este comedor")

        return ComedorTerminalAccederResponse(
            permitido=True,
            acceso_id=acceso.id,
            empleado_nombre=empleado.nombre,
            tipo_platillo=acceso.registro.tipo_platillo,
        )

    async def terminal_consumir(
        self,
        data: ComedorTerminalConsumirRequest,
    ) -> ComedorTerminalConsumirResponse:
        dia = business_today()
        n = await self.acceso_repo.consumir_si_pendiente(data.acceso_id, dia)
        if n == 0:
            n = await self.acceso_repo.marcar_repetido_si_accedido(data.acceso_id, dia)
        if n == 0:
            raise ConflictError(detail="Acceso no disponible o ya utilizado")
        acceso = await self.acceso_repo.get(data.acceso_id)
        return ComedorTerminalConsumirResponse(
            ok=True,
            hora_entrada=acceso.hora_entrada if acceso else None,
        )

    # ── Validación de huella ───────────────────────────────────

    async def validar_huella(
        self,
        data: HuellaValidarRequest,
    ) -> HuellaValidarResponse:
        """
        FAIL OPEN: si no se encuentra el empleado o hay un error de DB,
        se concede acceso para no bloquear el comedor.
        Timeout de 500ms gestionado a nivel de router/nginx.
        """
        try:
            empleado = await self.registro_repo.get_by_huella(data.huella_id)
            if not empleado:
                logger.warning(
                    "Huella no reconocida: %s — FAIL OPEN", data.huella_id
                )
                return HuellaValidarResponse(acceso=True, empleado=None, tipo_platillo="normal")

            # Buscar registro de seleccion de la semana actual
            from datetime import timedelta
            inicio_semana = data.timestamp.date() - timedelta(
                days=data.timestamp.weekday()
            )
            registro = await self.registro_repo.get_registro_semana(
                empleado_id=empleado.id,
                semana=inicio_semana,
            )

            tipo_platillo = registro.tipo_platillo if registro else "normal"

            # Marcar acceso concedido
            if registro:
                await self.registro_repo.update(registro.id, {
                    "acceso_concedido": True,
                    "huella_timestamp": data.timestamp,
                })

            return HuellaValidarResponse(
                acceso=True,
                empleado=empleado.nombre,
                tipo_platillo=tipo_platillo,
            )

        except Exception as exc:
            # FAIL OPEN — nunca bloquear acceso al comedor por error de sistema
            logger.error("Error en validacion de huella — FAIL OPEN: %s", str(exc))
            return HuellaValidarResponse(acceso=True, empleado=None, tipo_platillo="normal")

    # ── Estadísticas ───────────────────────────────────────────

    async def get_estadisticas(
        self,
        current_user: Empleado,
        semana: date | None = None,
    ) -> dict:
        if await self._get_rol(current_user) not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver estadisticas de comedor")

        semana_ref = semana or date.today()
        inicio_semana = semana_ref - timedelta(days=semana_ref.weekday())
        fin_semana = inicio_semana + timedelta(days=6)

        registros = await self.registro_repo.get_registros_semana(semana=inicio_semana)
        total = len(registros)
        normal = sum(1 for r in registros if r.tipo_platillo == "normal")
        dieta = sum(1 for r in registros if r.tipo_platillo == "dieta")
        acceso = sum(1 for r in registros if r.acceso_concedido)
        total_comidas = await self.acceso_repo.count_comidas_activas_en_rango(
            inicio_semana,
            fin_semana,
        )
        codigos_externos = await self.codigo_externo_repo.list_codigos_externos(
            desde=inicio_semana,
            hasta=fin_semana,
        )
        total_comidas_externas = 0
        for codigo in codigos_externos:
            fecha_inicio = codigo.get("fecha_inicio")
            fecha_fin = codigo.get("fecha_fin")
            if not isinstance(fecha_inicio, date) or not isinstance(fecha_fin, date):
                continue
            inicio = max(inicio_semana, fecha_inicio)
            fin = min(fin_semana, fecha_fin)
            if fin < inicio:
                continue
            cantidad_personas = int(codigo.get("cantidad_personas") or 0)
            if cantidad_personas <= 0:
                continue
            dias_vigencia = (fin - inicio).days + 1
            total_comidas_externas += cantidad_personas * dias_vigencia

        return {
            "semana": str(inicio_semana),
            "total_registros": total,
            "total_comidas": total_comidas + total_comidas_externas,
            "normal": normal,
            "dieta": dieta,
            "acceso_concedido": acceso,
        }

    async def get_proyecciones(
        self,
        current_user: Empleado,
    ) -> dict:
        if await self._get_rol(current_user) not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver proyecciones")

        registros = await self.registro_repo.get_registros_semanas_recientes(n=4)

        semanas: dict[str, dict[str, int]] = defaultdict(lambda: {"normal": 0, "dieta": 0})
        for r in registros:
            k = str(r.semana)
            semanas[k][r.tipo_platillo] = semanas[k].get(r.tipo_platillo, 0) + 1

        if semanas:
            totales = [v["normal"] + v["dieta"] for v in semanas.values()]
            promedio = sum(totales) / len(totales)
        else:
            promedio = 0

        return {
            "ultimas_4_semanas": dict(semanas),
            "promedio_semanal": round(promedio, 1),
        }
