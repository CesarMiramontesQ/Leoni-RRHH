# app/repositories/ciclo_desempeno_repository.py
"""Capa de acceso a datos del modulo Ciclo de Desempeno.

Solo queries/persistencia (SQLAlchemy async) sobre las tablas propias
`levelup_ciclo_desempeno` / `levelup_ciclo_desempeno_resultado`. La logica de
negocio (calculo de calificacion, bandas, cierre de ciclo, materializacion al
activar) vive en `CicloDesempenoService` (Tarea 4).

Decision (senales fuente): este repositorio NO lee cumplimiento de metas
(`levelup_meta_ciclo`/`Meta`) ni calificacion 360 (`Eval360Resultado`/
`Eval360Participante`) — esas tablas pertenecen a otros modulos con su propia
logica de dominio (formulas de avance, escalas de calificacion). El service
(Tarea 4) obtiene esas senales invocando `MetasRepository`/`MetasService` y
`Evaluacion360Repository`/`Evaluacion360Service` ya existentes, y le pasa a
este repositorio solo los valores ya resueltos (via `upsert_resultado`) o el
universo de `empleado_id` a materializar (via `bulk_create_resultados`). Esto
evita acoplar este modulo a las formulas/estados internos de Metas y Eval360.

Precarga con `selectinload` donde el service necesita atravesar relaciones
lazy en contexto async (evita MissingGreenlet) — mismo patron que
`app/repositories/metas_repository.py`.
"""

from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.models.empleados import Empleado


class CicloDesempenoRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Ciclo ────────────────────────────────────────────────────────────
    async def list_ciclos(self, estado: Optional[str] = None) -> Sequence[CicloDesempeno]:
        query = select(CicloDesempeno).order_by(CicloDesempeno.id.desc())
        if estado is not None:
            query = query.where(CicloDesempeno.estado == estado)
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_ciclo(self, ciclo_id: int) -> Optional[CicloDesempeno]:
        """Ciclo con `resultados` precargados (selectinload) para que el
        service pueda listarlos/contarlos sin lazy-load en contexto async."""
        result = await self.db.execute(
            select(CicloDesempeno)
            .where(CicloDesempeno.id == ciclo_id)
            .options(selectinload(CicloDesempeno.resultados))
        )
        return result.scalar_one_or_none()

    async def create_ciclo(self, ciclo: CicloDesempeno) -> CicloDesempeno:
        self.db.add(ciclo)
        await self.db.flush()
        await self.db.refresh(ciclo)
        return ciclo

    async def update_ciclo(self, ciclo: CicloDesempeno) -> CicloDesempeno:
        """Persiste cambios sobre una instancia ya obtenida (via `get_ciclo`)
        y mutada por el service (`setattr` de los campos a editar, cambio de
        `estado`, etc.). Solo flush + refresh; ninguna validacion aqui."""
        await self.db.flush()
        await self.db.refresh(ciclo)
        return ciclo

    # ── Resultado ────────────────────────────────────────────────────────
    async def list_resultados(
        self, ciclo_id: int, empleado_ids: Optional[set[int]] = None
    ) -> Sequence[CicloDesempenoResultado]:
        """Resultados de un ciclo. Si `empleado_ids` no es None, filtra por
        ese scope (equipo de un jefe/supervisor); `None` = todos (vista RH)."""
        if empleado_ids is not None and not empleado_ids:
            return []
        query = (
            select(CicloDesempenoResultado)
            .where(CicloDesempenoResultado.ciclo_id == ciclo_id)
            .order_by(CicloDesempenoResultado.id)
        )
        if empleado_ids is not None:
            query = query.where(CicloDesempenoResultado.empleado_id.in_(empleado_ids))
        result = await self.db.execute(query)
        return result.scalars().all()

    async def get_resultado(
        self, ciclo_id: int, empleado_id: int
    ) -> Optional[CicloDesempenoResultado]:
        result = await self.db.execute(
            select(CicloDesempenoResultado).where(
                CicloDesempenoResultado.ciclo_id == ciclo_id,
                CicloDesempenoResultado.empleado_id == empleado_id,
            )
        )
        return result.scalar_one_or_none()

    async def bulk_create_resultados(
        self, ciclo_id: int, empleado_ids: Sequence[int]
    ) -> Sequence[CicloDesempenoResultado]:
        """Materializa una fila vacia (snapshot en NULL) por cada
        `empleado_id` del universo de participantes que aun no tenga
        resultado en el ciclo (respeta el UNIQUE ciclo_id+empleado_id, no
        duplica). Usado al activar un ciclo (Tarea 4). Devuelve TODOS los
        resultados del ciclo tras materializar (existentes + nuevos)."""
        if not empleado_ids:
            return await self.list_resultados(ciclo_id)

        existentes = await self.list_resultados(ciclo_id, set(empleado_ids))
        ya_creados = {r.empleado_id for r in existentes}
        nuevos = [
            CicloDesempenoResultado(ciclo_id=ciclo_id, empleado_id=eid)
            for eid in dict.fromkeys(empleado_ids)  # unicos, preserva orden
            if eid not in ya_creados
        ]
        if nuevos:
            self.db.add_all(nuevos)
            await self.db.flush()
        return await self.list_resultados(ciclo_id)

    async def upsert_resultado(
        self, ciclo_id: int, empleado_id: int, **campos
    ) -> CicloDesempenoResultado:
        """Crea (si no existe) o actualiza el snapshot de un empleado en el
        ciclo. `campos` son columnas de `CicloDesempenoResultado` (ej.
        `cumplimiento_metas=...`, `potencial=...`, `banda_desempeno=...`);
        el service decide que calcular y que setear, este metodo solo
        persiste (sin validar rangos/formulas)."""
        resultado = await self.get_resultado(ciclo_id, empleado_id)
        if resultado is None:
            resultado = CicloDesempenoResultado(ciclo_id=ciclo_id, empleado_id=empleado_id)
            self.db.add(resultado)
        for key, value in campos.items():
            setattr(resultado, key, value)
        await self.db.flush()
        await self.db.refresh(resultado)
        return resultado

    async def count_participantes(self, ciclo_id: int) -> int:
        result = await self.db.execute(
            select(func.count())
            .select_from(CicloDesempenoResultado)
            .where(CicloDesempenoResultado.ciclo_id == ciclo_id)
        )
        return result.scalar_one()

    async def count_con_potencial(self, ciclo_id: int) -> int:
        """Resultados del ciclo con `potencial` ya capturado (progreso de
        captura para el service/tablero, Tarea 4)."""
        result = await self.db.execute(
            select(func.count())
            .select_from(CicloDesempenoResultado)
            .where(
                CicloDesempenoResultado.ciclo_id == ciclo_id,
                CicloDesempenoResultado.potencial.is_not(None),
            )
        )
        return result.scalar_one()

    # ── Empleado (solo lectura, tabla Bono externa) ──────────────────────
    async def get_nombres_empleados(self, empleado_ids: Sequence[int]) -> dict[int, str]:
        """Mapa `empleado_id` -> `nombre` para enriquecer respuestas (nombre
        de empleado, ver `CicloDesempenoResultadoResponse.empleado_nombre`).
        Solo lectura sobre `empleados` (Bono, prohibido escribir/alterar el
        esquema desde este proyecto). Copia deliberada del mismo helper en
        `MetasRepository.get_nombres_empleados` — el repo del proyecto no
        comparte estos helpers entre modulos (ver `metas_repository.py`)."""
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.nombre).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
        return {eid: nombre for eid, nombre in result.all()}
