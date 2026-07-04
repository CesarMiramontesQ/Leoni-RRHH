# app/services/junta_service.py
"""
Logica de negocio del modulo Juntas.

Responsabilidades:
  - CRUD de juntas y su lista de asistentes (empleados del catalogo Bono).
  - Mapeo modelo -> schema (conteo de asistentes en el listado, lista completa
    en el detalle).

Reutiliza el catalogo de empleados existente; no crea ni duplica personas.
El commit lo realiza la dependencia `get_db` al cierre del request; aqui solo se
usa flush().
"""

from __future__ import annotations

from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.empleados import Empleado
from app.models.juntas import Junta, JuntaAsistente
from app.repositories.junta_repository import JuntaRepository
from app.schemas.juntas import (
    AsistenteResponse,
    JuntaCreate,
    JuntaDetalleResponse,
    JuntaListResponse,
    JuntaResponse,
)
from app.utils.audit_logger import audit_background

AUDIT_MODULE = "JUNTAS"


class JuntaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = JuntaRepository(db)

    # ── Consultas ─────────────────────────────────────────────────────────────
    async def list_juntas(
        self,
        page: int = 1,
        page_size: int = 10,
        search: Optional[str] = None,
        categoria: Optional[str] = None,
    ) -> JuntaListResponse:
        filters = [Junta.activo.is_(True)]
        if categoria:
            filters.append(Junta.categoria == categoria)
        if search:
            filters.append(Junta.nombre.ilike(f"%{search}%"))
        juntas, total = await self.repo.list_juntas(filters, page, page_size)
        items = [self._junta_to_response(j) for j in juntas]
        return JuntaListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def get_junta(self, junta_id: int) -> JuntaDetalleResponse:
        junta = await self.repo.get_junta_detalle(junta_id)
        if not junta or not junta.activo:
            raise NotFoundError("Junta no encontrada")
        base = self._junta_to_response(junta)
        asistentes = [
            self._asistente_to_response(a)
            for a in sorted(junta.asistentes, key=lambda x: x.id)
        ]
        return JuntaDetalleResponse(**base.model_dump(), asistentes=asistentes)

    # ── Mutaciones ────────────────────────────────────────────────────────────
    async def create_junta(
        self, data: JuntaCreate, current_user: Empleado, background_tasks: BackgroundTasks
    ) -> JuntaDetalleResponse:
        junta = Junta(
            nombre=data.nombre,
            motivo=data.motivo,
            categoria=data.categoria,
            estado="registrada",
            created_by=current_user.empleado_id,
        )
        self.db.add(junta)
        await self.db.flush()

        await self._sync_asistentes(junta, data.asistente_ids)
        await self.db.flush()

        audit_background(
            background_tasks, self.db, "JUNTA_CREATE", AUDIT_MODULE,
            usuario_id=current_user.empleado_id, entidad_id=junta.id,
            datos_despues={"nombre": junta.nombre},
        )
        return await self.get_junta(junta.id)

    # ── Helpers ───────────────────────────────────────────────────────────────
    async def _sync_asistentes(
        self, junta: Junta, empleado_ids, replace: bool = False
    ) -> None:
        """Inserta los asistentes de la junta a partir de ids de empleado.

        Solo agrega empleados que existen en el catalogo (ignora ids invalidos).
        `replace=True` borra los existentes y re-crea (preparado para edicion).
        """
        if replace:
            for a in await self.repo.list_asistentes(junta.id):
                await self.db.delete(a)
            await self.db.flush()
        empleados = await self._get_empleados_by_ids(empleado_ids)
        for emp in empleados:
            self.db.add(JuntaAsistente(
                junta_id=junta.id,
                empleado_id=emp.empleado_id,
            ))

    async def _get_empleados_by_ids(self, ids) -> list[Empleado]:
        ids = list(dict.fromkeys(ids))
        if not ids:
            return []
        result = await self.db.execute(
            select(Empleado).where(Empleado.empleado_id.in_(ids))
        )
        return list(result.scalars().all())

    def _junta_to_response(self, junta: Junta) -> JuntaResponse:
        return JuntaResponse(
            id=junta.id,
            nombre=junta.nombre,
            motivo=junta.motivo,
            categoria=junta.categoria,
            estado=junta.estado,
            asistentes_count=len(junta.asistentes),
            created_at=junta.created_at,
            updated_at=junta.updated_at,
        )

    def _asistente_to_response(self, asistente: JuntaAsistente) -> AsistenteResponse:
        emp = asistente.empleado
        return AsistenteResponse(
            empleado_id=asistente.empleado_id,
            no_empleado=emp.no_empleado if emp else None,
            nombre=emp.nombre if emp else None,
            puesto=emp.puesto.descripcion if emp and emp.puesto else None,
            area=emp.area.descripcion if emp and emp.area else None,
        )
