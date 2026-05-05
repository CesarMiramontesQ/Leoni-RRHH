# app/services/evaluacion_service.py
"""
Logica de negocio para Evaluaciones de Competencias — Fase 2.

Responsabilidades:
  - CRUD de evaluaciones (upsert semantics)
  - Evaluacion bulk
  - Permisos: RH evalua a todos, supervisor solo su area
  - Vista por empleado
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.talento import Competencia, EvaluacionCompetencia
from app.repositories.evaluacion_repository import EvaluacionRepository
from app.schemas.evaluaciones import (
    EvaluacionBulkCreate,
    EvaluacionCreate,
    EvaluacionListResponse,
    EvaluacionResponse,
    EvaluacionUpdate,
)


def _to_response(ev: EvaluacionCompetencia) -> EvaluacionResponse:
    empleado_nombre = ev.empleado.nombre if ev.empleado else None
    competencia_nombre = ev.competencia.nombre if ev.competencia else None
    evaluador_nombre = ev.evaluador.nombre if ev.evaluador else None

    return EvaluacionResponse(
        id=ev.id,
        empleado_id=ev.empleado_id,
        empleado_nombre=empleado_nombre,
        competencia_id=ev.competencia_id,
        competencia_nombre=competencia_nombre,
        nivel_actual=ev.nivel_actual,
        evaluador_id=ev.evaluador_id,
        evaluador_nombre=evaluador_nombre,
        observaciones=ev.observaciones,
        fecha_evaluacion=ev.fecha_evaluacion,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
    )


class EvaluacionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = EvaluacionRepository(db)

    def _check_supervisor_permission(self, current_user: Empleado, target_empleado: Empleado):
        rol = current_user.rol.nombre if current_user.rol else None
        if rol == "rh":
            return
        if rol == "supervisor":
            if current_user.area_id != target_empleado.area_id:
                raise ForbiddenError("Supervisor solo puede evaluar empleados de su area")
            return
        raise ForbiddenError("Solo RH o supervisores pueden crear evaluaciones")

    async def _get_empleado(self, empleado_id: int) -> Empleado:
        from sqlalchemy import select
        result = await self.db.execute(
            select(Empleado).where(Empleado.id == empleado_id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise NotFoundError(f"Empleado {empleado_id} no encontrado")
        return emp

    async def _get_competencia(self, competencia_id: int) -> Competencia:
        from sqlalchemy import select
        result = await self.db.execute(
            select(Competencia).where(
                Competencia.id == competencia_id,
                Competencia.activo.is_(True),
            )
        )
        comp = result.scalar_one_or_none()
        if not comp:
            raise NotFoundError(f"Competencia {competencia_id} no encontrada")
        return comp

    async def crear(
        self, data: EvaluacionCreate, current_user: Empleado
    ) -> EvaluacionResponse:
        target = await self._get_empleado(data.empleado_id)
        self._check_supervisor_permission(current_user, target)
        await self._get_competencia(data.competencia_id)

        ev = await self.repo.upsert(
            empleado_id=data.empleado_id,
            competencia_id=data.competencia_id,
            nivel_actual=data.nivel_actual,
            evaluador_id=current_user.id,
            observaciones=data.observaciones,
        )
        # Reload with relations
        ev = await self.repo.get(ev.id)
        await self.db.commit()
        return _to_response(ev)

    async def obtener(self, id: int) -> EvaluacionResponse:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError(f"Evaluacion {id} no encontrada")
        return _to_response(ev)

    async def actualizar(
        self, id: int, data: EvaluacionUpdate, current_user: Empleado
    ) -> EvaluacionResponse:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError(f"Evaluacion {id} no encontrada")

        target = await self._get_empleado(ev.empleado_id)
        self._check_supervisor_permission(current_user, target)

        if data.nivel_actual is not None:
            ev.nivel_actual = data.nivel_actual
        if data.observaciones is not None:
            ev.observaciones = data.observaciones
        ev.evaluador_id = current_user.id

        await self.db.flush()
        await self.db.refresh(ev)
        ev = await self.repo.get(ev.id)
        await self.db.commit()
        return _to_response(ev)

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        ev = await self.repo.get(id)
        if not ev:
            raise NotFoundError(f"Evaluacion {id} no encontrada")
        deleted = await self.repo.delete(id)
        if not deleted:
            raise NotFoundError(f"Evaluacion {id} no encontrada")
        await self.db.commit()

    async def listar(
        self,
        page: int = 1,
        page_size: int = 10,
        empleado_id: int | None = None,
        competencia_id: int | None = None,
        area_id: int | None = None,
    ) -> EvaluacionListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            empleado_id=empleado_id,
            competencia_id=competencia_id,
            area_id=area_id,
        )
        return EvaluacionListResponse(
            items=[_to_response(ev) for ev in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def listar_por_empleado(
        self, empleado_id: int, current_user: Empleado
    ) -> list[EvaluacionResponse]:
        rol = current_user.rol.nombre if current_user.rol else None
        if rol not in ("rh", "supervisor") and current_user.id != empleado_id:
            raise ForbiddenError("Solo puedes ver tus propias evaluaciones")
        if rol == "supervisor" and current_user.id != empleado_id:
            target = await self._get_empleado(empleado_id)
            if current_user.area_id != target.area_id:
                raise ForbiddenError("Supervisor solo puede ver evaluaciones de su area")

        items = await self.repo.list_by_empleado(empleado_id)
        return [_to_response(ev) for ev in items]

    async def bulk_crear(
        self, data: EvaluacionBulkCreate, current_user: Empleado
    ) -> dict:
        creadas = 0
        errores = []
        for ev_data in data.evaluaciones:
            try:
                target = await self._get_empleado(ev_data.empleado_id)
                self._check_supervisor_permission(current_user, target)
                await self._get_competencia(ev_data.competencia_id)
                await self.repo.upsert(
                    empleado_id=ev_data.empleado_id,
                    competencia_id=ev_data.competencia_id,
                    nivel_actual=ev_data.nivel_actual,
                    evaluador_id=current_user.id,
                    observaciones=ev_data.observaciones,
                )
                creadas += 1
            except Exception as e:
                errores.append(
                    f"empleado={ev_data.empleado_id} comp={ev_data.competencia_id}: {str(e)}"
                )

        await self.db.commit()
        return {"creadas": creadas, "errores": errores}
