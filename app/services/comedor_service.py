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
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.models.comedor import ComedorAccesoEstado, ComedorTipoComida
from app.models.empleados import Empleado
from app.repositories.comedor_repository import (
    ComedorAccesoRepository,
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
    ComedorCreate,
    ComedorUpdate,
    ComedorMisFechasOcupadasResponse,
    ComedorEquipoReservaItem,
    ComedorEquipoBeneficiarioItem,
    ComedorMisReservaItem,
    ComedorResumenDiarioItem,
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
    primer_lunes_reserva_comedor_permitido,
)

logger = logging.getLogger(__name__)


class ComedorService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.comedor_repo = ComedorRepository(db)
        self.menu_repo = MenuSemanalRepository(db)
        self.registro_repo = ComedorRegistroRepository(db)
        self.acceso_repo = ComedorAccesoRepository(db)
        self.empleado_repo = EmpleadoRepository(db)

    def _get_rol(self, user: Empleado) -> str:
        return user.rol.nombre if user.rol else ""

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

    async def _resolver_beneficiario_reserva(
        self,
        current_user: Empleado,
        target_user_id: int | None,
    ) -> int:
        rol = self._get_rol(current_user)
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
            current_user.id,
            settings.ESTADOS_ACTIVOS_IDS,
        )
        subordinados_ids = {emp.id for emp in subordinados}
        if beneficiario_id not in subordinados_ids:
            raise ForbiddenError(
                detail="Solo puedes registrar para ti o para un integrante directo de tu equipo",
            )
        return beneficiario_id

    async def list_equipo_beneficiarios_directos(
        self,
        current_user: Empleado,
    ) -> list[ComedorEquipoBeneficiarioItem]:
        if self._get_rol(current_user) != "supervisor":
            raise ForbiddenError(detail="Solo supervisor puede consultar beneficiarios")
        subordinados = await self.empleado_repo.get_subordinados(
            current_user.id,
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
        if self._get_rol(current_user) != "rh":
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
        if self._get_rol(current_user) != "rh":
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
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede publicar menus")

        menu = await self.menu_repo.create({
            **data.model_dump(),
            "created_by": current_user.id,
        })
        await self.db.flush()

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
            **data.model_dump(),
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
        hoy = business_today()
        return ComedorPrimeraFechaReservaResponse(
            fecha_iso=primer_lunes_reserva_comedor_permitido(hoy),
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
        if self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar reservas de equipo")
        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.id,
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
        if self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar reservas de equipo")
        desde = date(anio, mes, 1)
        ultimo = calendar.monthrange(anio, mes)[1]
        hasta = date(anio, mes, ultimo)
        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.id,
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
        if self._get_rol(current_user) not in ("supervisor", "gerente"):
            raise ForbiddenError(detail="Solo supervisor o gerente pueden consultar métricas de equipo")
        hoy = business_today()
        inicio_semana_actual = hoy - timedelta(days=hoy.weekday())
        fin_semana_actual = inicio_semana_actual + timedelta(days=6)
        inicio_semana_siguiente = inicio_semana_actual + timedelta(days=7)
        fin_semana_siguiente = inicio_semana_siguiente + timedelta(days=6)

        equipo_ids = await self.empleado_repo.get_ids_subarbol(
            current_user.id,
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
        if total_activas <= 0:
            porcentaje_caseras = 0
            porcentaje_saludables = 0
        else:
            porcentaje_caseras = round((metricas["total_caseras"] / total_activas) * 100)
            porcentaje_saludables = round((metricas["total_saludables"] / total_activas) * 100)

        return {
            "semana_actual_total": metricas["total_semana_actual"],
            "semana_proxima_total": metricas["total_semana_siguiente"],
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
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo RH puede consultar resumen diario global")
        if hasta < desde:
            raise ConflictError(detail="El rango de fechas es inválido")
        rows = await self.acceso_repo.list_resumen_diario_global(desde=desde, hasta=hasta)
        return [ComedorResumenDiarioItem(**row) for row in rows]

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

        hoy = business_today()
        primer_lunes = primer_lunes_reserva_comedor_permitido(hoy)
        for fecha_servicio in fechas:
            if fecha_servicio < primer_lunes:
                raise ForbiddenError(
                    detail="Solo puedes agendar comidas a partir del lunes de la semana siguiente",
                )
            if fecha_servicio.weekday() >= 5:
                raise ConflictError(
                    detail="No se permiten reservaciones de comedor en fines de semana",
                )

        tipo_enum = ComedorTipoComida(data.tipo_comida)

        comedor = await self.comedor_repo.get(data.comedor_id)
        if not comedor:
            raise NotFoundError(entidad="Comedor", id=data.comedor_id)

        semanas = sorted({f - timedelta(days=f.weekday()) for f in fechas})
        registros_por_semana: dict[date, object] = {}
        for inicio_semana in semanas:
            registro = await self.registro_repo.get_registro_semana_comedor(
                empleado_id=beneficiario_id,
                comedor_id=data.comedor_id,
                semana=inicio_semana,
            )
            if not registro:
                if self._get_rol(current_user) in ("supervisor", "gerente"):
                    registro = await self.registro_repo.create({
                        "empleado_id": beneficiario_id,
                        "comedor_id": data.comedor_id,
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
                        "comedor_id": data.comedor_id,
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
                "comedor_id": data.comedor_id,
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
                    "comedor_id": data.comedor_id,
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

        primer_lunes = primer_lunes_reserva_comedor_permitido(business_today())
        if acceso.fecha_servicio < primer_lunes:
            raise ConflictError(
                detail="Solo puedes cancelar reservas de semanas futuras",
            )
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
        if self._get_rol(current_user) not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="No tienes permiso para ver estadisticas de comedor")

        semana_ref = semana or date.today()
        from datetime import timedelta
        inicio_semana = semana_ref - timedelta(days=semana_ref.weekday())

        registros = await self.registro_repo.get_registros_semana(semana=inicio_semana)
        total = len(registros)
        normal = sum(1 for r in registros if r.tipo_platillo == "normal")
        dieta = sum(1 for r in registros if r.tipo_platillo == "dieta")
        acceso = sum(1 for r in registros if r.acceso_concedido)

        return {
            "semana": str(inicio_semana),
            "total_registros": total,
            "normal": normal,
            "dieta": dieta,
            "acceso_concedido": acceso,
        }

    async def get_proyecciones(
        self,
        current_user: Empleado,
    ) -> dict:
        if self._get_rol(current_user) not in ("rh", "gerente", "director"):
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
