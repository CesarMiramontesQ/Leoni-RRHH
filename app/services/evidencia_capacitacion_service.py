"""Motor de Evidencias de Capacitacion: gestion (RH) + firma (self-service)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.level_up import EvidenciaCapacitacion, EvidenciaFirma
from app.models.talento import Capacitacion
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    EvidenciaFirmaItem,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia


class EvidenciaCapacitacionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    # ── helpers ──
    async def _get_o_404(self, evidencia_id: int) -> EvidenciaCapacitacion:
        stmt = (
            select(EvidenciaCapacitacion)
            .where(EvidenciaCapacitacion.id == evidencia_id)
            .options(selectinload(EvidenciaCapacitacion.firmas))
        )
        ev = (await self.db.execute(stmt)).scalar_one_or_none()
        if ev is None:
            raise NotFoundError("EvidenciaCapacitacion", evidencia_id)
        return ev

    async def _validar_empleado(self, empleado_id: int) -> None:
        if await self.empleado_repo.get_by_empleado_id(empleado_id) is None:
            raise NotFoundError("Empleado", empleado_id)

    async def _validar_capacitacion(self, capacitacion_id: Optional[int]) -> None:
        if capacitacion_id is None:
            return
        if await self.db.get(Capacitacion, capacitacion_id) is None:
            raise NotFoundError("Capacitacion", capacitacion_id)

    async def _recalcular_estado(self, ev: EvidenciaCapacitacion) -> None:
        estados = [f.estado.value if hasattr(f.estado, "value") else str(f.estado) for f in ev.firmas]
        ev.estado = derivar_estado_evidencia(estados)

    async def _to_response(self, ev: EvidenciaCapacitacion) -> EvidenciaConFirmasResponse:
        emp_ids = {ev.empleado_id} | {f.firmante_id for f in ev.firmas}
        nombres = await self.empleado_repo.get_nombres_por_empleado_ids(list(emp_ids))
        cap_nombre = None
        if ev.capacitacion_id is not None:
            cap = await self.db.get(Capacitacion, ev.capacitacion_id)
            cap_nombre = cap.nombre if cap is not None else None
        firmas = [
            EvidenciaFirmaItem(
                id=f.id, firmante_id=f.firmante_id,
                firmante_nombre=_nombre(nombres, f.firmante_id),
                rol_firma=f.rol_firma,
                estado=f.estado.value if hasattr(f.estado, "value") else str(f.estado),
                fecha_firma=f.fecha_firma, comentario=f.comentario,
            )
            for f in ev.firmas
        ]
        firmadas = sum(1 for f in firmas if f.estado == "firmada")
        return EvidenciaConFirmasResponse(
            id=ev.id,
            tipo=ev.tipo.value if hasattr(ev.tipo, "value") else str(ev.tipo),
            archivo_url=ev.archivo_url,
            capacitacion_id=ev.capacitacion_id, capacitacion_nombre=cap_nombre,
            empleado_id=ev.empleado_id, empleado_nombre=_nombre(nombres, ev.empleado_id),
            estado=ev.estado.value if hasattr(ev.estado, "value") else str(ev.estado),
            fecha_subida=ev.fecha_subida, notas=ev.notas,
            firmas=firmas, firmas_total=len(firmas), firmas_firmadas=firmadas,
        )

    # ── gestion (RH) ──
    async def listar(self, empleado_id=None, capacitacion_id=None, estado=None):
        stmt = select(EvidenciaCapacitacion).options(selectinload(EvidenciaCapacitacion.firmas))
        if empleado_id is not None:
            stmt = stmt.where(EvidenciaCapacitacion.empleado_id == empleado_id)
        if capacitacion_id is not None:
            stmt = stmt.where(EvidenciaCapacitacion.capacitacion_id == capacitacion_id)
        if estado is not None:
            stmt = stmt.where(EvidenciaCapacitacion.estado == estado)
        stmt = stmt.order_by(EvidenciaCapacitacion.fecha_subida.desc())
        evs = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(ev) for ev in evs]

    async def obtener(self, evidencia_id: int) -> EvidenciaConFirmasResponse:
        return await self._to_response(await self._get_o_404(evidencia_id))

    async def crear(self, data: EvidenciaCrearRequest) -> EvidenciaConFirmasResponse:
        await self._validar_empleado(data.empleado_id)
        await self._validar_capacitacion(data.capacitacion_id)
        ev = EvidenciaCapacitacion(
            tipo=data.tipo, archivo_url=data.archivo_url,
            capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id,
            notas=data.notas,
        )
        for fa in data.firmantes:
            await self._validar_empleado(fa.firmante_id)
            ev.firmas.append(EvidenciaFirma(firmante_id=fa.firmante_id, rol_firma=fa.rol_firma))
        await self._recalcular_estado(ev)
        self.db.add(ev)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def actualizar(self, evidencia_id: int, data: EvidenciaCapacitacionUpdate):
        ev = await self._get_o_404(evidencia_id)
        campos = data.model_dump(exclude_unset=True)
        # El estado es derivado: nunca se setea a mano.
        campos.pop("estado", None)
        for k, v in campos.items():
            setattr(ev, k, v)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def eliminar(self, evidencia_id: int) -> None:
        ev = await self._get_o_404(evidencia_id)
        await self.db.delete(ev)
        await self.db.flush()

    async def agregar_firmante(self, evidencia_id: int, data: FirmanteAsignar):
        ev = await self._get_o_404(evidencia_id)
        await self._validar_empleado(data.firmante_id)
        if any(f.firmante_id == data.firmante_id and f.rol_firma == data.rol_firma for f in ev.firmas):
            raise ConflictError("Ese firmante ya esta asignado con ese rol")
        ev.firmas.append(EvidenciaFirma(firmante_id=data.firmante_id, rol_firma=data.rol_firma))
        await self._recalcular_estado(ev)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def quitar_firmante(self, firma_id: int) -> EvidenciaConFirmasResponse:
        firma = await self.db.get(EvidenciaFirma, firma_id)
        if firma is None:
            raise NotFoundError("EvidenciaFirma", firma_id)
        evidencia_id = firma.evidencia_id
        await self.db.delete(firma)
        await self.db.flush()
        ev = await self._get_o_404(evidencia_id)
        await self._recalcular_estado(ev)
        await self.db.flush()
        return await self._to_response(ev)

    # ── firma (self-service) ──
    async def mis_firmas_pendientes(self, firmante_id: int):
        stmt = (
            select(EvidenciaCapacitacion)
            .join(EvidenciaFirma, EvidenciaFirma.evidencia_id == EvidenciaCapacitacion.id)
            .where(EvidenciaFirma.firmante_id == firmante_id, EvidenciaFirma.estado == "pendiente")
            .options(selectinload(EvidenciaCapacitacion.firmas))
            .distinct()
            .order_by(EvidenciaCapacitacion.fecha_subida.desc())
        )
        evs = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(ev) for ev in evs]

    async def firmar(self, firma_id: int, firmante_id: int, data: FirmarRequest):
        firma = await self.db.get(EvidenciaFirma, firma_id)
        if firma is None:
            raise NotFoundError("EvidenciaFirma", firma_id)
        if firma.firmante_id != firmante_id:
            raise ForbiddenError("No puedes firmar una fila que no es tuya")
        estado_actual = firma.estado.value if hasattr(firma.estado, "value") else str(firma.estado)
        if estado_actual != "pendiente":
            raise ConflictError("Esta firma ya fue resuelta")
        firma.estado = data.estado
        firma.fecha_firma = datetime.now(timezone.utc)
        firma.comentario = data.comentario
        await self.db.flush()
        ev = await self._get_o_404(firma.evidencia_id)
        await self._recalcular_estado(ev)
        await self.db.flush()
        return await self._to_response(ev)


def _nombre(nombres: dict, empleado_id: int) -> Optional[str]:
    val = nombres.get(empleado_id)
    if val is None:
        return None
    # get_nombres_por_empleado_ids devuelve (no_empleado, nombre) o str segun repo;
    # normaliza a str legible.
    if isinstance(val, tuple):
        return val[1]
    return val
