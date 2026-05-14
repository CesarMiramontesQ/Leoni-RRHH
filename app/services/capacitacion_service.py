# app/services/capacitacion_service.py
"""
Logica de negocio para Capacitaciones — Modulo Talento Fase 3.
"""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados import Empleado
from app.models.talento import Capacitacion, Inscripcion
from app.repositories.capacitacion_repository import CapacitacionRepository, InscripcionRepository
from app.schemas.capacitaciones import (
    CapacitacionCreate,
    CapacitacionListResponse,
    CapacitacionResponse,
    CapacitacionUpdate,
    InscripcionCreate,
    InscripcionListResponse,
    InscripcionResponse,
    InscripcionUpdate,
)


class CapacitacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CapacitacionRepository(db)
        self.inscripcion_repo = InscripcionRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _cap_to_response(cap: Capacitacion) -> CapacitacionResponse:
        from sqlalchemy.orm import object_session
        from sqlalchemy import inspect as sa_inspect

        area_nombre = cap.area.descripcion if cap.area else None
        inscritos_count = 0
        # Only count if inscripciones are already loaded (avoid lazy load)
        if "inscripciones" in sa_inspect(cap).dict:
            inscritos_count = sum(1 for i in cap.inscripciones if i.estado != "cancelado")

        return CapacitacionResponse(
            id=cap.id,
            nombre=cap.nombre,
            descripcion=cap.descripcion,
            duracion_horas=cap.duracion_horas,
            modalidad=cap.modalidad,
            instructor=cap.instructor,
            fecha_inicio=cap.fecha_inicio,
            fecha_fin=cap.fecha_fin,
            cupo_maximo=cap.cupo_maximo,
            area_id=cap.area_id,
            area_nombre=area_nombre,
            competencias_asociadas=cap.competencias_asociadas,
            estado=cap.estado,
            inscritos_count=inscritos_count,
            created_at=cap.created_at,
            updated_at=cap.updated_at,
        )

    @staticmethod
    def _insc_to_response(insc: Inscripcion) -> InscripcionResponse:
        cap_nombre = insc.capacitacion.nombre if insc.capacitacion else None
        emp_nombre = insc.empleado.nombre if insc.empleado else None

        return InscripcionResponse(
            id=insc.id,
            capacitacion_id=insc.capacitacion_id,
            capacitacion_nombre=cap_nombre,
            empleado_id=insc.empleado_id,
            empleado_nombre=emp_nombre,
            estado=insc.estado,
            calificacion=insc.calificacion,
            fecha_inscripcion=insc.fecha_inscripcion,
            fecha_completado=insc.fecha_completado,
        )

    # ── Capacitaciones CRUD ──────────────────────────────────────────────────

    async def listar(
        self,
        page: int,
        page_size: int,
        area_id: int | None = None,
        modalidad: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> CapacitacionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset, limit=page_size,
            area_id=area_id, modalidad=modalidad, estado=estado, busqueda=busqueda,
        )
        # Batch count inscritos to avoid N+1 / loading all inscripciones
        inscritos_map = await self.repo.count_inscritos_batch([i.id for i in items])

        responses = []
        for cap in items:
            r = self._cap_to_response(cap)
            r.inscritos_count = inscritos_map.get(cap.id, 0)
            responses.append(r)

        return CapacitacionListResponse(
            items=responses,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def crear(self, data: CapacitacionCreate, current_user: Empleado) -> CapacitacionResponse:
        if data.fecha_inicio and data.fecha_fin and data.fecha_fin < data.fecha_inicio:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fecha_fin no puede ser anterior a fecha_inicio")

        cap = await self.repo.create({
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "duracion_horas": data.duracion_horas,
            "modalidad": data.modalidad,
            "instructor": data.instructor,
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "cupo_maximo": data.cupo_maximo,
            "area_id": data.area_id,
            "competencias_asociadas": data.competencias_asociadas,
            "created_by": current_user.id,
        })
        cap = await self.repo.get_with_relations(cap.id)
        return self._cap_to_response(cap)

    async def obtener(self, id: int) -> CapacitacionResponse:
        cap = await self.repo.get_with_relations(id)
        if not cap:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capacitacion no encontrada")
        return self._cap_to_response(cap)

    async def actualizar(self, id: int, data: CapacitacionUpdate, current_user: Empleado) -> CapacitacionResponse:
        cap = await self.repo.get_with_relations(id)
        if not cap:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capacitacion no encontrada")

        update_data = data.model_dump(exclude_unset=True)

        fecha_inicio = update_data.get("fecha_inicio", cap.fecha_inicio)
        fecha_fin = update_data.get("fecha_fin", cap.fecha_fin)
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="fecha_fin no puede ser anterior a fecha_inicio")

        if update_data:
            await self.repo.update(id, update_data)

        cap = await self.repo.get_with_relations(id)
        return self._cap_to_response(cap)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        cap = await self.repo.get_with_relations(id)
        if not cap:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capacitacion no encontrada")
        await self.repo.update(id, {"activo": False})

    # ── Inscripciones ────────────────────────────────────────────────────────

    async def inscribir(self, capacitacion_id: int, empleado_id: int, current_user: Empleado) -> InscripcionResponse:
        # Permission check: RH can inscribe anyone, others only themselves
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol != "rh" and empleado_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes inscribirte a ti mismo")

        # Lock row to prevent race condition on cupo_maximo check
        cap = await self.repo.get_for_update(capacitacion_id)
        if not cap:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capacitacion no encontrada")

        if cap.estado != "activa":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No se puede inscribir a una capacitacion con estado '{cap.estado}'")

        existing = await self.inscripcion_repo.get_by_pair(capacitacion_id, empleado_id)
        if existing and existing.estado != "cancelado":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El empleado ya esta inscrito en esta capacitacion")

        if cap.cupo_maximo:
            inscritos = await self.inscripcion_repo.count_by_capacitacion(capacitacion_id)
            if inscritos >= cap.cupo_maximo:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Capacitacion llena ({cap.cupo_maximo} cupos)")

        if existing and existing.estado == "cancelado":
            await self.inscripcion_repo.update(existing.id, {"estado": "inscrito", "calificacion": None, "fecha_completado": None})
            insc = await self.inscripcion_repo.get_with_relations(existing.id)
        else:
            insc = await self.inscripcion_repo.create({
                "capacitacion_id": capacitacion_id,
                "empleado_id": empleado_id,
                "estado": "inscrito",
            })
            insc = await self.inscripcion_repo.get_with_relations(insc.id)

        return self._insc_to_response(insc)

    async def listar_inscripciones(self, capacitacion_id: int, page: int, page_size: int) -> InscripcionListResponse:
        cap = await self.repo.get_with_relations(capacitacion_id)
        if not cap:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Capacitacion no encontrada")

        offset = (page - 1) * page_size
        items, total = await self.inscripcion_repo.list_by_capacitacion(capacitacion_id, offset, page_size)
        return InscripcionListResponse(
            items=[self._insc_to_response(i) for i in items],
            total=total, page=page, page_size=page_size,
        )

    async def mis_inscripciones(self, empleado_id: int, page: int, page_size: int) -> InscripcionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.inscripcion_repo.list_by_empleado(empleado_id, offset, page_size)
        return InscripcionListResponse(
            items=[self._insc_to_response(i) for i in items],
            total=total, page=page, page_size=page_size,
        )

    async def actualizar_inscripcion(self, id: int, data: InscripcionUpdate, current_user: Empleado) -> InscripcionResponse:
        insc = await self.inscripcion_repo.get_with_relations(id)
        if not insc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscripcion no encontrada")

        update_data: dict = {}
        if data.estado is not None:
            update_data["estado"] = data.estado
            if data.estado == "completado" and not insc.fecha_completado:
                update_data["fecha_completado"] = datetime.now(timezone.utc)
        if data.calificacion is not None:
            update_data["calificacion"] = data.calificacion

        if update_data:
            await self.inscripcion_repo.update(id, update_data)

        insc = await self.inscripcion_repo.get_with_relations(id)
        return self._insc_to_response(insc)

    async def cancelar_inscripcion(self, id: int, current_user: Empleado) -> None:
        insc = await self.inscripcion_repo.get_with_relations(id)
        if not insc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscripcion no encontrada")

        if insc.estado == "cancelado":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La inscripcion ya esta cancelada")
        if insc.estado == "completado":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede cancelar una inscripcion completada")

        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol != "rh" and insc.empleado_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo puedes cancelar tus propias inscripciones")

        await self.inscripcion_repo.update(id, {"estado": "cancelado"})
