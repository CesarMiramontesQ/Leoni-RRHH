"""Service del modulo Manejo de OPLs: gestion (RH) + aprobacion (self-service)."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.models.level_up import OPL, EstadoAprobacionOPL, OPLVersion
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.level_up import (
    OPLConVersionesResponse,
    OPLCreate,
    OPLUpdate,
    OPLVersionAgregar,
    OPLVersionItem,
)


def _nombre(nombres: dict, empleado_id: Optional[int]) -> Optional[str]:
    if empleado_id is None:
        return None
    val = nombres.get(empleado_id)
    if val is None:
        return None
    if isinstance(val, tuple):
        return val[1]
    return val


class OPLService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    async def _get_o_404(self, opl_id: int) -> OPL:
        stmt = select(OPL).where(OPL.id == opl_id).options(selectinload(OPL.versiones))
        opl = (await self.db.execute(stmt)).scalar_one_or_none()
        if opl is None:
            raise NotFoundError("OPL", opl_id)
        return opl

    async def _validar_aprobador(self, aprobador_id: Optional[int]) -> None:
        if aprobador_id is None:
            return
        if await self.empleado_repo.get_by_empleado_id(aprobador_id) is None:
            raise NotFoundError("Empleado", aprobador_id)

    async def _to_response(self, opl: OPL) -> OPLConVersionesResponse:
        emp_ids = set()
        if opl.aprobador_id is not None:
            emp_ids.add(opl.aprobador_id)
        for v in opl.versiones:
            if v.creado_por_id is not None:
                emp_ids.add(v.creado_por_id)
        nombres = await self.empleado_repo.get_nombres_por_empleado_ids(list(emp_ids))
        versiones = sorted(opl.versiones, key=lambda v: v.version_num, reverse=True)
        items = [
            OPLVersionItem(
                id=v.id, version_num=v.version_num, archivo_url=v.archivo_url,
                cambios_descripcion=v.cambios_descripcion, fecha=v.fecha,
                creado_por_id=v.creado_por_id,
                creado_por_nombre=_nombre(nombres, v.creado_por_id),
            )
            for v in versiones
        ]
        return OPLConVersionesResponse(
            id=opl.id, codigo=opl.codigo, titulo=opl.titulo,
            proceso=opl.proceso, maquina=opl.maquina,
            aprobador_id=opl.aprobador_id,
            aprobador_nombre=_nombre(nombres, opl.aprobador_id),
            estado_aprobacion=(
                opl.estado_aprobacion.value
                if hasattr(opl.estado_aprobacion, "value")
                else str(opl.estado_aprobacion)
            ),
            created_at=opl.created_at,
            versiones=items, version_actual=items[0] if items else None,
            total_versiones=len(items),
        )

    async def listar(self, codigo=None, estado=None, proceso=None, maquina=None):
        if estado and estado not in {e.value for e in EstadoAprobacionOPL}:
            # Estado fuera del enum: no existen OPLs en ese estado.
            # Evita construir la query con un valor invalido (500 en Postgres
            # con columna Enum nativa; ver revision final del modulo OPLs).
            return []
        stmt = select(OPL).options(selectinload(OPL.versiones))
        if codigo:
            stmt = stmt.where(OPL.codigo.ilike(f"%{codigo}%"))
        if estado:
            stmt = stmt.where(OPL.estado_aprobacion == estado)
        if proceso:
            stmt = stmt.where(OPL.proceso.ilike(f"%{proceso}%"))
        if maquina:
            stmt = stmt.where(OPL.maquina.ilike(f"%{maquina}%"))
        stmt = stmt.order_by(OPL.created_at.desc())
        opls = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(o) for o in opls]

    async def obtener(self, opl_id: int) -> OPLConVersionesResponse:
        return await self._to_response(await self._get_o_404(opl_id))

    async def crear(self, data: OPLCreate) -> OPLConVersionesResponse:
        dup = (
            await self.db.execute(select(OPL).where(OPL.codigo == data.codigo))
        ).scalar_one_or_none()
        if dup is not None:
            raise ConflictError("Ya existe una OPL con ese codigo")
        await self._validar_aprobador(data.aprobador_id)
        opl = OPL(
            codigo=data.codigo, titulo=data.titulo, proceso=data.proceso,
            maquina=data.maquina, aprobador_id=data.aprobador_id,
        )
        self.db.add(opl)
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def actualizar(self, opl_id: int, data: OPLUpdate) -> OPLConVersionesResponse:
        opl = await self._get_o_404(opl_id)
        campos = data.model_dump(exclude_unset=True)
        campos.pop("estado_aprobacion", None)  # el estado se mueve por el workflow
        if "aprobador_id" in campos:
            await self._validar_aprobador(campos["aprobador_id"])
        for k, v in campos.items():
            setattr(opl, k, v)
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def eliminar(self, opl_id: int) -> None:
        opl = await self._get_o_404(opl_id)
        await self.db.delete(opl)
        await self.db.flush()

    async def agregar_version(
        self, opl_id: int, data: OPLVersionAgregar, creado_por_id: Optional[int]
    ) -> OPLConVersionesResponse:
        opl = await self._get_o_404(opl_id)
        siguiente = max((v.version_num for v in opl.versiones), default=0) + 1
        opl.versiones.append(
            OPLVersion(
                version_num=siguiente, archivo_url=data.archivo_url,
                cambios_descripcion=data.cambios_descripcion, creado_por_id=creado_por_id,
            )
        )
        opl.estado_aprobacion = "borrador"  # contenido nuevo -> re-aprobacion
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def listar_versiones(self, opl_id: int) -> list[OPLVersionItem]:
        return (await self._to_response(await self._get_o_404(opl_id))).versiones

    async def enviar_a_revision(self, opl_id: int) -> OPLConVersionesResponse:
        opl = await self._get_o_404(opl_id)
        estado = opl.estado_aprobacion.value if hasattr(opl.estado_aprobacion, "value") else str(opl.estado_aprobacion)
        if estado != "borrador":
            raise ConflictError("Solo se puede enviar a revision una OPL en borrador")
        if not opl.versiones:
            raise DomainValidationError("La OPL necesita al menos una version")
        if opl.aprobador_id is None:
            raise DomainValidationError("La OPL necesita un aprobador designado")
        opl.estado_aprobacion = "revision"
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def _resolver_revision(self, opl_id: int, aprobador_id: int) -> OPL:
        opl = await self._get_o_404(opl_id)
        if opl.aprobador_id != aprobador_id:
            raise ForbiddenError("Solo el aprobador designado puede resolver esta OPL")
        estado = opl.estado_aprobacion.value if hasattr(opl.estado_aprobacion, "value") else str(opl.estado_aprobacion)
        if estado != "revision":
            raise ConflictError("La OPL no esta en revision")
        return opl

    async def aprobar(self, opl_id: int, aprobador_id: int) -> OPLConVersionesResponse:
        opl = await self._resolver_revision(opl_id, aprobador_id)
        opl.estado_aprobacion = "aprobada"
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def regresar_a_borrador(self, opl_id: int, aprobador_id: int) -> OPLConVersionesResponse:
        opl = await self._resolver_revision(opl_id, aprobador_id)
        opl.estado_aprobacion = "borrador"
        await self.db.flush()
        await self.db.refresh(opl, attribute_names=["versiones"])
        return await self._to_response(opl)

    async def mis_aprobaciones_pendientes(self, aprobador_id: int):
        stmt = (
            select(OPL)
            .where(OPL.aprobador_id == aprobador_id, OPL.estado_aprobacion == "revision")
            .options(selectinload(OPL.versiones))
            .order_by(OPL.created_at.desc())
        )
        opls = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(o) for o in opls]
