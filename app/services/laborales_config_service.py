"""Configuración laborales: reglas de home office por área y días festivos."""

from __future__ import annotations

from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.catalogos import Area
from app.models.dias_festivos import DiaFestivo
from app.models.empleados import Empleado
from app.models.homeoffice_reglas_area import HomeOfficeReglaArea
from app.repositories.dias_festivos_repository import DiasFestivosRepository
from app.repositories.homeoffice_reglas_area_repository import (
    AREA_ESTATUS_ACTIVO,
    HomeOfficeReglasAreaRepository,
)
from app.schemas.laborales_config import (
    DiaFestivoCreate,
    DiaFestivoGuardadoResponse,
    DiaFestivoItem,
    DiaFestivoPublico,
    DiaFestivoUpdate,
    DiasFestivosCargaOficialesResponse,
    DiasFestivosListResponse,
    DiasFestivosPublicosResponse,
    HomeOfficeReglaAreaItem,
    HomeOfficeReglaAreaUpdate,
    HomeOfficeReglasAreaListResponse,
)
from app.utils.audit_logger import log_action
from app.utils.dias_festivos_lft import festivos_oficiales_lft

AUDIT_MODULO = "laborales_config"
AUDIT_ACCION_REGLA_HO = "LABORALES_CONFIG_HO_REGLA_AREA_UPDATED"
AUDIT_ACCION_FESTIVO_CREATED = "LABORALES_CONFIG_DIA_FESTIVO_CREATED"
AUDIT_ACCION_FESTIVO_UPDATED = "LABORALES_CONFIG_DIA_FESTIVO_UPDATED"

# Solicitudes «vivas» que un festivo nuevo o reactivado dejaría con un conteo distinto
# al que tenían al crearse. No se recalculan; solo se advierte a RH.
_TIPOS_AFECTADOS_POR_FESTIVO = ["vacaciones", "home_office"]
_ESTADOS_AFECTADOS_POR_FESTIVO = ["pending", "changes_requested", "approved"]


class LaboralesConfigService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = HomeOfficeReglasAreaRepository(db)
        self.festivos_repo = DiasFestivosRepository(db)

    @staticmethod
    def _to_item(area: Area, regla: HomeOfficeReglaArea | None) -> HomeOfficeReglaAreaItem:
        if regla is None:
            return HomeOfficeReglaAreaItem(
                area_id=area.area_id, area_descripcion=area.descripcion
            )
        return HomeOfficeReglaAreaItem(
            area_id=area.area_id,
            area_descripcion=area.descripcion,
            dias_permitidos=regla.dias_permitidos,
            periodo_semanas=regla.periodo_semanas,
            activo=regla.activo,
            actualizado_en=regla.updated_at,
            actualizado_por=regla.actualizado_por.nombre if regla.actualizado_por else None,
        )

    async def listar_reglas_home_office(self) -> HomeOfficeReglasAreaListResponse:
        """Todas las áreas activas de Bono, con su regla si la tienen. Las áreas
        inactivas no se listan: su regla, si existía, queda huérfana e inofensiva."""
        areas = await self.repo.list_areas_activas()
        reglas = {r.area_id: r for r in await self.repo.list_reglas()}
        items = [self._to_item(a, reglas.get(a.area_id)) for a in areas]
        return HomeOfficeReglasAreaListResponse(items=items, total=len(items))

    async def actualizar_regla_home_office(
        self,
        area_id: int,
        data: HomeOfficeReglaAreaUpdate,
        current_user: Empleado,
        ip_address: str | None = None,
    ) -> HomeOfficeReglaAreaItem:
        area = await self.repo.get_area(area_id)
        if area is None or area.estatus_id != AREA_ESTATUS_ACTIVO:
            raise NotFoundError("Área", area_id)

        anterior = await self.repo.get_by_area(area_id)
        datos_antes = (
            {
                "dias_permitidos": anterior.dias_permitidos,
                "periodo_semanas": anterior.periodo_semanas,
                "activo": anterior.activo,
            }
            if anterior is not None
            else None
        )
        regla = await self.repo.upsert(
            area_id=area_id,
            dias_permitidos=data.dias_permitidos,
            periodo_semanas=data.periodo_semanas,
            activo=data.activo,
            actualizado_por_empleado_id=current_user.empleado_id,
        )
        await log_action(
            self.db,
            accion=AUDIT_ACCION_REGLA_HO,
            modulo=AUDIT_MODULO,
            usuario_id=current_user.empleado_id,
            entidad_id=area_id,
            datos_antes=datos_antes,
            datos_despues={
                "dias_permitidos": regla.dias_permitidos,
                "periodo_semanas": regla.periodo_semanas,
                "activo": regla.activo,
            },
            ip_address=ip_address,
        )
        return self._to_item(area, regla)

    # ── Días festivos ────────────────────────────────────────────────────────

    @staticmethod
    def _festivo_to_item(f: DiaFestivo) -> DiaFestivoItem:
        return DiaFestivoItem(
            id=f.id,
            fecha=f.fecha,
            descripcion=f.descripcion,
            activo=f.activo,
            actualizado_en=f.updated_at,
            actualizado_por=f.actualizado_por.nombre if f.actualizado_por else None,
        )

    @staticmethod
    def _festivo_snapshot(f: DiaFestivo) -> dict:
        return {"fecha": f.fecha.isoformat(), "descripcion": f.descripcion, "activo": f.activo}

    async def _solicitudes_afectadas(self, festivo: DiaFestivo) -> int:
        if not festivo.activo:
            return 0
        return await self.festivos_repo.count_solicitudes_que_incluyen(
            festivo.fecha,
            tipos=_TIPOS_AFECTADOS_POR_FESTIVO,
            estados=_ESTADOS_AFECTADOS_POR_FESTIVO,
        )

    async def listar_dias_festivos(self, anio: int) -> DiasFestivosListResponse:
        items = [self._festivo_to_item(f) for f in await self.festivos_repo.list_by_anio(anio)]
        return DiasFestivosListResponse(anio=anio, items=items, total=len(items))

    async def listar_dias_festivos_publicos(self, anio: int) -> DiasFestivosPublicosResponse:
        """Solo activos, sin metadatos: es lo que consume el calendario de solicitudes."""
        festivos = await self.festivos_repo.list_by_anio(anio, solo_activos=True)
        return DiasFestivosPublicosResponse(
            anio=anio,
            items=[DiaFestivoPublico(fecha=f.fecha, descripcion=f.descripcion) for f in festivos],
        )

    async def crear_dia_festivo(
        self, data: DiaFestivoCreate, current_user: Empleado, ip_address: str | None = None
    ) -> DiaFestivoGuardadoResponse:
        existente = await self.festivos_repo.get_by_fecha(data.fecha)
        if existente is not None:
            raise ConflictError(
                detail=(
                    f"Ya existe un festivo el {data.fecha.isoformat()} "
                    f"({existente.descripcion}); edítalo o reactívalo en la lista."
                )
            )
        festivo = await self.festivos_repo.add(
            DiaFestivo(
                fecha=data.fecha,
                descripcion=data.descripcion,
                activo=True,
                actualizado_por_empleado_id=current_user.empleado_id,
            )
        )
        await log_action(
            self.db,
            accion=AUDIT_ACCION_FESTIVO_CREATED,
            modulo=AUDIT_MODULO,
            usuario_id=current_user.empleado_id,
            entidad_id=festivo.id,
            datos_antes=None,
            datos_despues=self._festivo_snapshot(festivo),
            ip_address=ip_address,
        )
        return DiaFestivoGuardadoResponse(
            item=self._festivo_to_item(festivo),
            solicitudes_afectadas=await self._solicitudes_afectadas(festivo),
        )

    async def actualizar_dia_festivo(
        self,
        festivo_id: int,
        data: DiaFestivoUpdate,
        current_user: Empleado,
        ip_address: str | None = None,
    ) -> DiaFestivoGuardadoResponse:
        festivo = await self.festivos_repo.get(festivo_id)
        if festivo is None:
            raise NotFoundError("Día festivo", festivo_id)
        datos_antes = self._festivo_snapshot(festivo)
        festivo.descripcion = data.descripcion
        festivo.activo = data.activo
        festivo.actualizado_por_empleado_id = current_user.empleado_id
        await self.festivos_repo.save(festivo)
        await log_action(
            self.db,
            accion=AUDIT_ACCION_FESTIVO_UPDATED,
            modulo=AUDIT_MODULO,
            usuario_id=current_user.empleado_id,
            entidad_id=festivo.id,
            datos_antes=datos_antes,
            datos_despues=self._festivo_snapshot(festivo),
            ip_address=ip_address,
        )
        return DiaFestivoGuardadoResponse(
            item=self._festivo_to_item(festivo),
            solicitudes_afectadas=await self._solicitudes_afectadas(festivo),
        )

    async def cargar_festivos_oficiales(
        self, anio: int, current_user: Empleado, ip_address: str | None = None
    ) -> DiasFestivosCargaOficialesResponse:
        """Inserta los festivos LFT del año que aún no existan (activos, editables).

        Una fecha ya capturada —activa o apagada— se respeta tal cual: RH pudo haberla
        renombrado o desactivado a propósito.
        """
        existentes = {f.fecha for f in await self.festivos_repo.list_by_anio(anio)}
        agregados: list[DiaFestivoItem] = []
        omitidos = 0
        for fecha, descripcion in festivos_oficiales_lft(anio):
            if fecha in existentes:
                omitidos += 1
                continue
            festivo = await self.festivos_repo.add(
                DiaFestivo(
                    fecha=fecha,
                    descripcion=descripcion,
                    activo=True,
                    actualizado_por_empleado_id=current_user.empleado_id,
                )
            )
            await log_action(
                self.db,
                accion=AUDIT_ACCION_FESTIVO_CREATED,
                modulo=AUDIT_MODULO,
                usuario_id=current_user.empleado_id,
                entidad_id=festivo.id,
                datos_antes=None,
                datos_despues=self._festivo_snapshot(festivo),
                ip_address=ip_address,
            )
            agregados.append(self._festivo_to_item(festivo))
        return DiasFestivosCargaOficialesResponse(
            anio=anio, agregados=agregados, omitidos=omitidos
        )
