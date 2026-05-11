# app/services/usuario_service.py
"""
Logica de negocio del dominio usuarios.

Flujos principales:
  - Asignar lider/rol: solo RH, PATCH restringido, registrar audit
  - Vista 360: agrega solicitudes, incidencias y actas del empleado
  - Metricas: conteos por estado e incidencias por tipo
"""

import logging
from datetime import date

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.roles import Rol
from app.models.solicitudes import Solicitud
from app.models.incidencias import Incidencia
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.turnos_empleados import TurnoEmpleado
from app.repositories.usuario_repository import ModoEstadoListado, UsuarioRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleados import AreaResponse, PuestoResponse
from app.schemas.usuarios import (
    ActaBrief,
    CatalogoFiltrosResponse,
    IncidenciaBrief,
    MetricasUsuarioResponse,
    RolBrief,
    SolicitudBrief,
    UsuarioAsignacionUpdate,
    UsuarioListItem,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioResponse,
    UsuarioVista360Response,
    Vista360TurnoEmpleado,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)


class UsuarioService:
    def __init__(self, db: AsyncSession):
        self.repo = UsuarioRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    def _require_rh_only(self, current_user: Empleado) -> None:
        if self._get_rol(current_user) != "rh":
            raise ForbiddenError(detail="Solo el rol rh puede usar esta operacion")

    def _require_directorio(self, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol not in ("gerente", "director", "supervisor"):
            raise ForbiddenError(
                detail="Se requiere rol gerente, director o supervisor para esta operacion"
            )

    async def _ids_permitidos_directorio(
        self,
        current_user: Empleado,
        rol: str,
        estados: list[int],
        *,
        alcance_todos_los_estados: bool = False,
    ) -> list[int] | None:
        if rol == "gerente":
            if alcance_todos_los_estados:
                subarbol = await self.empleado_repo.get_ids_subarbol_sin_filtro_estado(
                    current_user.id
                )
            else:
                subarbol = await self.empleado_repo.get_ids_subarbol(
                    current_user.id, estados
                )
            return list(subarbol) + [current_user.id]
        if rol == "supervisor":
            if alcance_todos_los_estados:
                directos = await self.empleado_repo.get_subordinados_directos_ids(
                    current_user.id
                )
                return directos + [current_user.id]
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, estados
            )
            return [e.id for e in subordinados] + [current_user.id]
        return None

    async def _ensure_puede_ver_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
    ) -> None:
        rol = self._get_rol(current_user)
        if rol in ("rh", "gerente", "director"):
            return
        if rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = {e.id for e in subordinados}
            if empleado_id in ids or empleado_id == current_user.id:
                return
            raise ForbiddenError(detail="No tienes acceso a este usuario")
        if empleado_id == current_user.id:
            return
        raise ForbiddenError(detail="No tienes acceso a este usuario")

    def _to_list_item(self, u: Empleado) -> UsuarioListItem:
        base = UsuarioResponse.model_validate(u)
        lider_nombre: str | None = None
        if u.lider:
            lider_nombre = u.lider.nombre or None
        return UsuarioListItem(**base.model_dump(), lider_nombre=lider_nombre)

    async def list_usuarios_page(
        self,
        page: int,
        page_size: int,
        q: str | None,
        area_id: int | None,
        puesto_id: list[int] | None,
        current_user: Empleado,
        activo: bool | None = None,
    ) -> UsuarioPageResponse:
        self._require_rh_only(current_user)
        estados = settings.ESTADOS_ACTIVOS_IDS
        if activo is True:
            modo: ModoEstadoListado = "activos"
        elif activo is False:
            modo = "inactivos"
        else:
            modo = "todos"
        offset = (page - 1) * page_size
        total = await self.repo.count_filtered(
            q, area_id, puesto_id, modo, estados
        )
        items = await self.repo.list_page(
            offset, page_size, q, area_id, puesto_id, modo, estados
        )
        return UsuarioPageResponse(
            items=[self._to_list_item(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def list_directorio_empleados_page(
        self,
        page: int,
        page_size: int,
        q: str | None,
        area_id: int | None,
        puesto_id: list[int] | None,
        current_user: Empleado,
        *,
        estatus_filtro: str | None = None,
        solo_contratos_por_vencer: bool = False,
    ) -> UsuarioPageResponse:
        self._require_directorio(current_user)
        offset = (page - 1) * page_size
        estados = settings.ESTADOS_ACTIVOS_IDS
        permiso_ids = settings.ESTADOS_PERMISO_IDS
        rol = self._get_rol(current_user)
        ef = (estatus_filtro or "activo").strip().lower()
        if ef in ("", "activo", "activos"):
            modo: ModoEstadoListado = "activos"
            ep_arg: list[int] | None = None
        elif ef in ("inactivo", "inactivos"):
            modo = "inactivos"
            ep_arg = None
        elif ef == "permiso":
            modo = "permiso"
            ep_arg = permiso_ids
        else:
            modo = "activos"
            ep_arg = None

        alcance_todos = modo != "activos"
        ids_permitidos = await self._ids_permitidos_directorio(
            current_user, rol, estados, alcance_todos_los_estados=alcance_todos
        )

        hoy = date.today()
        solo_c = bool(solo_contratos_por_vencer)
        total = await self.repo.count_filtered(
            q,
            area_id,
            puesto_id,
            modo,
            estados,
            ids_permitidos=ids_permitidos,
            estados_permiso_ids=ep_arg,
            solo_contrato_por_vencer=solo_c,
            hoy_contrato=hoy if solo_c else None,
        )
        items = await self.repo.list_page(
            offset,
            page_size,
            q,
            area_id,
            puesto_id,
            modo,
            estados,
            ids_permitidos=ids_permitidos,
            estados_permiso_ids=ep_arg,
            solo_contrato_por_vencer=solo_c,
            hoy_contrato=hoy if solo_c else None,
        )
        return UsuarioPageResponse(
            items=[self._to_list_item(u) for u in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def resumen_plantilla(self, current_user: Empleado) -> UsuarioResumenResponse:
        self._require_rh_only(current_user)
        total = await self.repo.count(filters=None)
        estados = settings.ESTADOS_ACTIVOS_IDS
        activos = await self.repo.count_activos(estados)
        inactivos = await self.repo.count_inactivos(estados)
        sin_lider_asignado = await self.repo.count_sin_lider_asignado(estados)
        pct = round((activos / total) * 100, 1) if total else 0.0
        hoy = date.today()
        contratos_pv = await self.repo.count_contratos_por_vencer(
            estados, None, hoy, dias_ventana=30
        )
        return UsuarioResumenResponse(
            total_plantilla=total,
            activos=activos,
            inactivos=inactivos,
            sin_lider_asignado=sin_lider_asignado,
            practicantes=0,
            porcentaje_operatividad=pct,
            colaboradores_total=activos,
            contratos_por_vencer=contratos_pv,
        )

    async def resumen_directorio(self, current_user: Empleado) -> UsuarioResumenResponse:
        self._require_directorio(current_user)
        estados_activos = settings.ESTADOS_ACTIVOS_IDS
        rol = self._get_rol(current_user)
        ids_permitidos = await self._ids_permitidos_directorio(
            current_user, rol, estados_activos
        )
        hoy = date.today()
        activos = await self.repo.count_activos(estados_activos)
        colaboradores_total = await self.repo.count_filtered(
            None, None, None, "activos", estados_activos, ids_permitidos
        )
        contratos_pv = await self.repo.count_contratos_por_vencer(
            estados_activos, ids_permitidos, hoy, dias_ventana=30
        )
        sin_lider_asignado = await self.repo.count_sin_lider_asignado(estados_activos)
        return UsuarioResumenResponse(
            total_plantilla=activos,
            activos=activos,
            inactivos=0,
            sin_lider_asignado=sin_lider_asignado,
            practicantes=0,
            porcentaje_operatividad=100.0 if activos else 0.0,
            colaboradores_total=colaboradores_total,
            contratos_por_vencer=contratos_pv,
        )

    async def catalogo_filtros(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_rh_only(current_user)
        areas = await self.repo.list_areas_activas()
        puestos = await self.repo.list_puestos_activos()
        return CatalogoFiltrosResponse(
            areas=[AreaResponse.model_validate(a) for a in areas],
            puestos=[PuestoResponse.model_validate(p) for p in puestos],
        )

    async def catalogo_directorio(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_directorio(current_user)
        areas = await self.repo.list_areas_activas()
        puestos = await self.repo.list_puestos_activos()
        return CatalogoFiltrosResponse(
            areas=[AreaResponse.model_validate(a) for a in areas],
            puestos=[PuestoResponse.model_validate(p) for p in puestos],
        )

    async def list_roles_rh(self, current_user: Empleado) -> list[RolBrief]:
        self._require_rh_only(current_user)
        result = await self.db.execute(select(Rol).order_by(Rol.nombre))
        rows = list(result.scalars().all())
        return [RolBrief(id=r.id, nombre=r.nombre) for r in rows]

    async def get_usuario(
        self,
        id: int,
        current_user: Empleado,
    ) -> UsuarioResponse:
        self._require_rh_only(current_user)

        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        return UsuarioResponse.model_validate(usuario)

    async def asignar_supervisor_y_rol(
        self,
        id: int,
        data: UsuarioAsignacionUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        self._require_rh_only(current_user)

        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        cambios = data.model_dump(exclude_unset=True)
        if "rol_id" in cambios and cambios["rol_id"] is None:
            del cambios["rol_id"]
        if not cambios:
            return UsuarioResponse.model_validate(usuario)

        datos_antes = {k: getattr(usuario, k) for k in cambios}

        await self.repo.update(id, cambios)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_ASIGNACION_UPDATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues=cambios,
        )

        usuario = await self.repo.get_with_rol(id)
        return UsuarioResponse.model_validate(usuario)

    async def get_vista360(
        self,
        id: int,
        current_user: Empleado,
    ) -> UsuarioVista360Response:
        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        await self._ensure_puede_ver_empleado(current_user, id)

        result = await self.db.execute(
            select(Solicitud)
            .where(Solicitud.empleado_id == id)
            .order_by(Solicitud.id.desc())
            .limit(10)
        )
        solicitudes = list(result.scalars().all())

        result = await self.db.execute(
            select(Incidencia)
            .where(
                Incidencia.empleado_id == id,
                Incidencia.estado.notin_(["closed"]),
            )
            .order_by(Incidencia.id.desc())
        )
        incidencias = list(result.scalars().all())

        result = await self.db.execute(
            select(ActaAdministrativa)
            .where(
                ActaAdministrativa.empleado_id == id,
                ActaAdministrativa.estado.in_(["signed", "archived"]),
            )
            .order_by(ActaAdministrativa.id.desc())
        )
        actas = list(result.scalars().all())

        turno_empleado: Vista360TurnoEmpleado | None = None
        if self._get_rol(current_user) == "rh":
            r_te = await self.db.execute(
                select(TurnoEmpleado).where(TurnoEmpleado.no_empleado == usuario.no_empleado)
            )
            te = r_te.scalar_one_or_none()
            comedor_txt: str | None = None
            turno_txt: str | None = None
            if te is not None:
                if te.comedor is not None:
                    comedor_txt = str(te.comedor)
                if te.turno and str(te.turno).strip():
                    turno_txt = str(te.turno).strip()
            turno_empleado = Vista360TurnoEmpleado(comedor=comedor_txt, turno=turno_txt)

        return UsuarioVista360Response(
            usuario=UsuarioResponse.model_validate(usuario),
            solicitudes_recientes=[SolicitudBrief.model_validate(s) for s in solicitudes],
            incidencias_activas=[IncidenciaBrief.model_validate(i) for i in incidencias],
            actas_firmadas=[ActaBrief.model_validate(a) for a in actas],
            saldo_vacaciones=0,
            turno_empleado=turno_empleado,
        )

    async def get_metricas(
        self,
        id: int,
        current_user: Empleado,
    ) -> MetricasUsuarioResponse:
        usuario = await self.repo.get(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        await self._ensure_puede_ver_empleado(current_user, id)

        from sqlalchemy import func

        result = await self.db.execute(
            select(Solicitud.estado, func.count().label("cnt"))
            .where(Solicitud.empleado_id == id)
            .group_by(Solicitud.estado)
        )
        solicitudes_por_estado = {row.estado: row.cnt for row in result.all()}

        result = await self.db.execute(
            select(Incidencia.tipo, func.count().label("cnt"))
            .where(Incidencia.empleado_id == id)
            .group_by(Incidencia.tipo)
        )
        incidencias_por_tipo = {row.tipo: row.cnt for row in result.all()}

        dias_antiguedad = 0
        if usuario.registro:
            dias_antiguedad = (date.today() - usuario.registro).days

        result = await self.db.execute(
            select(func.count())
            .select_from(ActaAdministrativa)
            .where(ActaAdministrativa.empleado_id == id)
        )
        total_actas = result.scalar_one()

        return MetricasUsuarioResponse(
            solicitudes_por_estado=solicitudes_por_estado,
            incidencias_por_tipo=incidencias_por_tipo,
            dias_antiguedad=dias_antiguedad,
            total_actas=total_actas,
        )
