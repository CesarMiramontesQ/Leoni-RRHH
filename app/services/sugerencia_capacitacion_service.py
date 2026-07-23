"""Motor de Sugerencias de Capacitacion: CRUD + generador desde brechas."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.level_up import Curso, SugerenciaCapacitacion
from app.schemas.level_up import (
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
from app.services.competencia_service import CompetenciaService


def prioridad_desde_brecha(gap_porcentaje: float) -> int:
    """Deriva la prioridad 1-5 desde el porcentaje de brecha, alineado a los
    rangos de AccionRecomendada (0 / 1-30 / 31-50 / 51-100):
      <= 0 -> 1 (mantener nivel); <= 30 -> 3; <= 50 -> 4; > 50 -> 5."""
    g = float(gap_porcentaje)
    if g <= 0:
        return 1
    if g <= 30:
        return 3
    if g <= 50:
        return 4
    return 5


class SugerenciaCapacitacionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _to_response(
        self, s: SugerenciaCapacitacion
    ) -> SugerenciaCapacitacionResponse:
        data = SugerenciaCapacitacionResponse.model_validate(s)
        if s.curso_id is not None:
            curso = await self.db.get(Curso, s.curso_id)
            data.curso_nombre = curso.nombre if curso is not None else None
        return data

    async def _validar_curso(self, curso_id: Optional[int]) -> None:
        if curso_id is None:
            return
        curso = await self.db.get(Curso, curso_id)
        if curso is None:
            raise NotFoundError("Curso", curso_id)

    async def _get_o_404(self, sugerencia_id: int) -> SugerenciaCapacitacion:
        s = await self.db.get(SugerenciaCapacitacion, sugerencia_id)
        if s is None:
            raise NotFoundError("SugerenciaCapacitacion", sugerencia_id)
        return s

    async def listar(
        self, estado: Optional[str] = None, prioridad: Optional[int] = None
    ) -> list[SugerenciaCapacitacionResponse]:
        stmt = select(SugerenciaCapacitacion)
        if estado is not None:
            stmt = stmt.where(SugerenciaCapacitacion.estado == estado)
        if prioridad is not None:
            stmt = stmt.where(SugerenciaCapacitacion.prioridad == prioridad)
        stmt = stmt.order_by(
            SugerenciaCapacitacion.prioridad.desc(),
            SugerenciaCapacitacion.created_at.desc(),
        )
        filas = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(s) for s in filas]

    async def crear(
        self, data: SugerenciaCapacitacionCreate
    ) -> SugerenciaCapacitacionResponse:
        await self._validar_curso(data.curso_id)
        s = SugerenciaCapacitacion(**data.model_dump())
        self.db.add(s)
        await self.db.flush()
        await self.db.refresh(s)
        return await self._to_response(s)

    async def actualizar(
        self, sugerencia_id: int, data: SugerenciaCapacitacionUpdate
    ) -> SugerenciaCapacitacionResponse:
        s = await self._get_o_404(sugerencia_id)
        campos = data.model_dump(exclude_unset=True)
        if "curso_id" in campos:
            await self._validar_curso(campos["curso_id"])
        for k, v in campos.items():
            setattr(s, k, v)
        await self.db.flush()
        await self.db.refresh(s)
        return await self._to_response(s)

    async def eliminar(self, sugerencia_id: int) -> None:
        s = await self._get_o_404(sugerencia_id)
        await self.db.delete(s)
        await self.db.flush()

    async def generar_desde_brechas(
        self, area_id: int, umbral_brecha: float, current_user_id: Optional[int] = None
    ) -> list[SugerenciaCapacitacionResponse]:
        """Crea sugerencias BORRADOR (estado 'activa') desde las brechas del area
        con gap_porcentaje >= umbral_brecha. Deduplica por titulo canonico contra
        las sugerencias ya 'activa'. No inventa datos manuales. Devuelve solo las
        creadas."""
        brechas_resp = await CompetenciaService(self.db).obtener_brechas(area_id)
        area_nombre = brechas_resp.area_nombre

        # Titulos ya activos, para deduplicar.
        activos_stmt = select(SugerenciaCapacitacion.titulo).where(
            SugerenciaCapacitacion.estado == "activa"
        )
        titulos_activos = set((await self.db.execute(activos_stmt)).scalars().all())

        creadas: list[SugerenciaCapacitacionResponse] = []
        for b in brechas_resp.brechas:
            if float(b.gap_porcentaje) < float(umbral_brecha):
                continue
            titulo = f"Capacitacion: {b.competencia_nombre}"
            if titulo in titulos_activos:
                continue
            justificacion = (
                f"Brecha de {b.gap_porcentaje}% en {area_nombre or 'el area'}: "
                f"{b.empleados_afectados} persona(s) por debajo del nivel requerido."
            )
            s = SugerenciaCapacitacion(
                titulo=titulo,
                justificacion=justificacion,
                brecha_pct=float(b.gap_porcentaje),
                capacidades_afectadas=[b.competencia_nombre],
                areas_afectadas=[area_nombre] if area_nombre else [],
                personas_alcanzables=b.empleados_afectados,
                prioridad=prioridad_desde_brecha(b.gap_porcentaje),
            )
            self.db.add(s)
            await self.db.flush()
            await self.db.refresh(s)
            titulos_activos.add(titulo)
            creadas.append(await self._to_response(s))
        return creadas
