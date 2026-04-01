# app/services/usuario_service.py
"""
Logica de negocio del dominio usuarios.

Flujos principales:
  - Crear usuario: hash de password, asignar rol, registrar audit
  - Actualizar usuario: solo RH puede modificar campos soft, registrar audit
  - Desactivar usuario: soft delete, cancela solicitudes PENDING del empleado
  - Vista 360: agrega solicitudes, incidencias y actas del empleado
  - Metricas: conteos por estado e incidencias por tipo
"""

import logging
from datetime import date, datetime, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password as get_password_hash
from app.models.empleados import Empleado
from app.models.roles import Rol
from app.models.solicitudes import Solicitud
from app.models.incidencias import Incidencia
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.repositories.usuario_repository import UsuarioRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.usuarios import (
    ActaBrief,
    CatalogoFiltrosResponse,
    IncidenciaBrief,
    MetricasUsuarioResponse,
    RolBrief,
    SolicitudBrief,
    UsuarioCreate,
    UsuarioListItem,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioResponse,
    UsuarioUpdate,
    UsuarioVista360Response,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

_ROLES_PRIVILEGIADOS = ("director", "rh", "gerente", "supervisor")


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
        """Subconjunto del directorio: gerente, director o supervisor (solo activos).
        RH accede al directorio via la rama list_usuarios_page del router — si llega aqui es un error de llamada."""
        rol = self._get_rol(current_user)
        if rol not in ("gerente", "director", "supervisor"):
            raise ForbiddenError(
                detail="Se requiere rol gerente, director o supervisor para esta operacion"
            )

    async def _ensure_puede_ver_empleado(
        self,
        current_user: Empleado,
        empleado_id: int,
    ) -> None:
        """Misma regla que get_usuario: rh/gerente/director amplio; supervisor subordinados + sí mismo; resto solo sí mismo."""
        rol = self._get_rol(current_user)
        if rol in ("rh", "gerente", "director"):
            return
        if rol == "supervisor":
            subordinados = await self.empleado_repo.get_subordinados(current_user.id)
            ids = {e.id for e in subordinados}
            if empleado_id in ids or empleado_id == current_user.id:
                return
            raise ForbiddenError(detail="No tienes acceso a este usuario")
        if empleado_id == current_user.id:
            return
        raise ForbiddenError(detail="No tienes acceso a este usuario")

    def _to_list_item(self, u: Empleado) -> UsuarioListItem:
        base = UsuarioResponse.model_validate(u)
        sup: str | None = None
        if u.supervisor:
            sup = f"{u.supervisor.nombre} {u.supervisor.apellido}".strip() or None
        return UsuarioListItem(**base.model_dump(), supervisor_nombre=sup)

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_usuarios_page(
        self,
        page: int,
        page_size: int,
        q: str | None,
        departamento: str | None,
        puesto: str | None,
        activo: bool | None,
        current_user: Empleado,
    ) -> UsuarioPageResponse:
        self._require_rh_only(current_user)
        offset = (page - 1) * page_size
        total = await self.repo.count_filtered(q, departamento, puesto, activo)
        items = await self.repo.list_page(
            offset, page_size, q, departamento, puesto, activo
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
        departamento: str | None,
        puesto: str | None,
        current_user: Empleado,
    ) -> UsuarioPageResponse:
        """Listado solo empleados activos para gerente / director / supervisor."""
        self._require_directorio(current_user)
        offset = (page - 1) * page_size
        activo = True
        total = await self.repo.count_filtered(q, departamento, puesto, activo)
        items = await self.repo.list_page(
            offset, page_size, q, departamento, puesto, activo
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
        activos = await self.repo.count(
            filters=[Empleado.activo == True]  # noqa: E712
        )
        pct = round((activos / total) * 100, 1) if total else 0.0
        return UsuarioResumenResponse(
            total_plantilla=total,
            activos=activos,
            capacitacion_pendiente=0,
            practicantes=0,
            porcentaje_operatividad=pct,
        )

    async def resumen_directorio(self, current_user: Empleado) -> UsuarioResumenResponse:
        """KPIs del directorio: solo cuentas de empleados activos."""
        self._require_directorio(current_user)
        activos = await self.repo.count(
            filters=[Empleado.activo == True]  # noqa: E712
        )
        return UsuarioResumenResponse(
            total_plantilla=activos,
            activos=activos,
            capacitacion_pendiente=0,
            practicantes=0,
            porcentaje_operatividad=100.0 if activos else 0.0,
        )

    async def catalogo_filtros(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_rh_only(current_user)
        return CatalogoFiltrosResponse(
            departamentos=await self.repo.distinct_departamentos(solo_activos=False),
            puestos=await self.repo.distinct_puestos(solo_activos=False),
        )

    async def catalogo_directorio(self, current_user: Empleado) -> CatalogoFiltrosResponse:
        self._require_directorio(current_user)
        return CatalogoFiltrosResponse(
            departamentos=await self.repo.distinct_departamentos(solo_activos=True),
            puestos=await self.repo.distinct_puestos(solo_activos=True),
        )

    async def list_roles_rh(self, current_user: Empleado) -> list[RolBrief]:
        """Catálogo de roles para formularios de alta (solo RH)."""
        self._require_rh_only(current_user)
        result = await self.db.execute(select(Rol).order_by(Rol.nombre))
        rows = list(result.scalars().all())
        return [RolBrief(id=r.id, nombre=r.nombre) for r in rows]

    # ── Obtener uno ──────────────────────────────────────────────────────────

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

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear_usuario(
        self,
        data: UsuarioCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear usuarios")

        # Verificar unicidad de email
        existente = await self.repo.get_by_email(data.email)
        if existente:
            raise ConflictError(detail=f"Ya existe un usuario con email '{data.email}'")

        # Verificar unicidad de num_empleado
        existente_num = await self.repo.get_by_num_empleado(data.num_empleado)
        if existente_num:
            raise ConflictError(
                detail=f"Ya existe un usuario con num_empleado '{data.num_empleado}'"
            )

        password_hash = get_password_hash(data.password)
        usuario = await self.repo.create({
            "num_empleado": data.num_empleado,
            "nombre": data.nombre,
            "apellido": data.apellido,
            "email": data.email,
            "password_hash": password_hash,
            "departamento": data.departamento,
            "puesto": data.puesto,
            "rol_id": data.rol_id,
            "supervisor_id": data.supervisor_id,
            "fecha_ingreso": data.fecha_ingreso,
            "activo": True,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_CREATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=usuario.id,
            datos_despues={
                "num_empleado": usuario.num_empleado,
                "email": usuario.email,
                "rol_id": usuario.rol_id,
            },
        )

        # Recargar con rol para la respuesta
        usuario = await self.repo.get_with_rol(usuario.id)
        return UsuarioResponse.model_validate(usuario)

    # ── Actualizar ────────────────────────────────────────────────────────────

    async def actualizar_usuario(
        self,
        id: int,
        data: UsuarioUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar usuarios")

        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        datos_antes = {
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "departamento": usuario.departamento,
            "puesto": usuario.puesto,
            "rol_id": usuario.rol_id,
        }

        cambios = data.model_dump(exclude_none=True)
        if not cambios:
            return UsuarioResponse.model_validate(usuario)

        usuario = await self.repo.update(id, cambios)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_UPDATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues=cambios,
        )

        usuario = await self.repo.get_with_rol(id)
        return UsuarioResponse.model_validate(usuario)

    # ── Desactivar ────────────────────────────────────────────────────────────

    async def desactivar_usuario(
        self,
        id: int,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede desactivar usuarios")

        usuario = await self.repo.get(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)
        if not usuario.activo:
            raise ConflictError(detail="El usuario ya se encuentra inactivo")

        # Cancelar solicitudes PENDING del empleado
        from sqlalchemy import select, update
        await self.db.execute(
            update(Solicitud)
            .where(
                Solicitud.empleado_id == id,
                Solicitud.estado == "pending",
            )
            .values(estado="cancelled")
        )

        await self.repo.update(id, {"activo": False})
        await self.db.commit()

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_DEACTIVATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes={"activo": True},
            datos_despues={"activo": False},
        )

    # ── Vista 360 ────────────────────────────────────────────────────────────

    async def get_vista360(
        self,
        id: int,
        current_user: Empleado,
    ) -> UsuarioVista360Response:
        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        await self._ensure_puede_ver_empleado(current_user, id)

        from sqlalchemy import select

        # Ultimas 10 solicitudes
        result = await self.db.execute(
            select(Solicitud)
            .where(Solicitud.empleado_id == id)
            .order_by(Solicitud.id.desc())
            .limit(10)
        )
        solicitudes = list(result.scalars().all())

        # Incidencias activas (estado != closed)
        result = await self.db.execute(
            select(Incidencia)
            .where(
                Incidencia.empleado_id == id,
                Incidencia.estado.notin_(["closed"]),
            )
            .order_by(Incidencia.id.desc())
        )
        incidencias = list(result.scalars().all())

        # Actas firmadas (estado == signed)
        result = await self.db.execute(
            select(ActaAdministrativa)
            .where(
                ActaAdministrativa.empleado_id == id,
                ActaAdministrativa.estado == "signed",
            )
            .order_by(ActaAdministrativa.id.desc())
        )
        actas = list(result.scalars().all())

        return UsuarioVista360Response(
            usuario=UsuarioResponse.model_validate(usuario),
            solicitudes_recientes=[SolicitudBrief.model_validate(s) for s in solicitudes],
            incidencias_activas=[IncidenciaBrief.model_validate(i) for i in incidencias],
            actas_firmadas=[ActaBrief.model_validate(a) for a in actas],
            saldo_vacaciones=0,  # Stub — se implementa con integracion TRESS
        )

    # ── Metricas ─────────────────────────────────────────────────────────────

    async def get_metricas(
        self,
        id: int,
        current_user: Empleado,
    ) -> MetricasUsuarioResponse:
        usuario = await self.repo.get(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        await self._ensure_puede_ver_empleado(current_user, id)

        from sqlalchemy import func, select

        # Solicitudes por estado
        result = await self.db.execute(
            select(Solicitud.estado, func.count().label("cnt"))
            .where(Solicitud.empleado_id == id)
            .group_by(Solicitud.estado)
        )
        solicitudes_por_estado = {row.estado: row.cnt for row in result.all()}

        # Incidencias por tipo
        result = await self.db.execute(
            select(Incidencia.tipo, func.count().label("cnt"))
            .where(Incidencia.empleado_id == id)
            .group_by(Incidencia.tipo)
        )
        incidencias_por_tipo = {row.tipo: row.cnt for row in result.all()}

        # Dias de antiguedad
        dias_antiguedad = 0
        if usuario.fecha_ingreso:
            dias_antiguedad = (date.today() - usuario.fecha_ingreso).days

        # Total actas
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
