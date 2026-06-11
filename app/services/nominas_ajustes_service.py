"""Lógica de negocio: Ajustes de Nóminas (autorización de registro de horas extra)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import DomainValidationError
from app.models.empleados import Empleado
from app.repositories.nominas_ajustes_repository import NominasAjustesRepository
from app.schemas.nominas_ajustes import (
    HorasExtraAutorizacionUpdate,
    HorasExtraAutorizacionUpdateResponse,
    HorasExtraAutorizadoItem,
    HorasExtraAutorizadosFiltro,
    HorasExtraAutorizadosListResponse,
    HorasExtraAutorizadosStats,
)

RECIENTES_DIAS = 7


class NominasAjustesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NominasAjustesRepository(db)

    @staticmethod
    def _filtro_to_autorizado(filtro: HorasExtraAutorizadosFiltro) -> bool | None:
        if filtro == "autorizados":
            return True
        if filtro == "no_autorizados":
            return False
        return None

    @staticmethod
    def _to_item(emp: Empleado) -> HorasExtraAutorizadoItem:
        autorizado_por = (
            emp.horas_extra_autorizado_por
            if emp.horas_extra_autorizado_por_id is not None
            else None
        )
        return HorasExtraAutorizadoItem(
            id=emp.id,
            no_empleado=emp.no_empleado,
            nombre=emp.nombre,
            rol=emp.rol.nombre if emp.rol else "empleado",
            email=emp.email,
            area_descripcion=emp.area.descripcion if emp.area else None,
            puesto_descripcion=emp.puesto.descripcion if emp.puesto else None,
            autorizado=emp.puede_registrar_horas_extra,
            fecha_autorizacion=emp.horas_extra_autorizado_en,
            autorizado_por=autorizado_por.nombre if autorizado_por else None,
        )

    async def _build_stats(self) -> HorasExtraAutorizadosStats:
        estados = settings.ESTADOS_ACTIVOS_IDS
        total_autorizados = await self.repo.count_total_autorizados()
        activas = await self.repo.count_empleados(estados, autorizado=True)
        sin_autorizacion = await self.repo.count_empleados(estados, autorizado=False)
        desde = datetime.now(timezone.utc) - timedelta(days=RECIENTES_DIAS)
        recientes = await self.repo.count_autorizados_recientes(desde)
        return HorasExtraAutorizadosStats(
            total_autorizados=total_autorizados,
            autorizaciones_activas=activas,
            sin_autorizacion=sin_autorizacion,
            autorizaciones_recientes=recientes,
        )

    async def listar_autorizados(
        self,
        *,
        q: str | None = None,
        filtro: HorasExtraAutorizadosFiltro = "todos",
        page: int = 1,
        page_size: int = 10,
    ) -> HorasExtraAutorizadosListResponse:
        estados = settings.ESTADOS_ACTIVOS_IDS
        autorizado = self._filtro_to_autorizado(filtro)
        offset = (page - 1) * page_size

        empleados = await self.repo.list_empleados(
            estados, q=q, autorizado=autorizado, offset=offset, limit=page_size
        )
        total = await self.repo.count_empleados(estados, q=q, autorizado=autorizado)

        return HorasExtraAutorizadosListResponse(
            items=[self._to_item(e) for e in empleados],
            total=total,
            page=page,
            page_size=page_size,
            stats=await self._build_stats(),
        )

    async def actualizar_autorizacion(
        self, data: HorasExtraAutorizacionUpdate, current_user: Empleado
    ) -> HorasExtraAutorizacionUpdateResponse:
        estados = settings.ESTADOS_ACTIVOS_IDS
        ids = list(dict.fromkeys(data.empleado_ids))

        empleados = await self.repo.get_activos_by_ids(estados, ids)
        encontrados = {e.id for e in empleados}
        faltantes = [i for i in ids if i not in encontrados]
        if faltantes:
            raise DomainValidationError(
                detail=(
                    "Empleados no encontrados o inactivos: "
                    f"{', '.join(str(i) for i in faltantes)}."
                )
            )

        if data.autorizado:
            ya_autorizados = [e for e in empleados if e.puede_registrar_horas_extra]
            if ya_autorizados:
                nombres = ", ".join(e.nombre for e in ya_autorizados)
                raise DomainValidationError(
                    detail=f"Empleados ya autorizados: {nombres}."
                )

        actualizados = await self.repo.set_autorizacion(
            empleados,
            data.autorizado,
            autorizado_por_id=current_user.id,
            fecha=datetime.now(timezone.utc),
        )
        await self.db.commit()

        return HorasExtraAutorizacionUpdateResponse(
            actualizados=actualizados,
            stats=await self._build_stats(),
        )
