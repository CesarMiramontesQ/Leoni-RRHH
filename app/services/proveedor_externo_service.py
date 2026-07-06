# app/services/proveedor_externo_service.py
"""
Logica de negocio del modulo de Capacitacion de Personal Externo.

Responsabilidades:
  - CRUD de proveedores (empresa/marca) y sus personas externas.
  - CRUD del catalogo de cursos externos (con periodicidad `vigencia_meses`).
  - Registro de cursos tomados por personas, con calculo de `fecha_vencimiento`
    (persistida) y derivacion de `estado`/`dias_restantes` (en lectura).

El commit lo realiza la dependencia `get_db` al cierre del request; aqui solo se
usa flush().
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta
from typing import Optional

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.empleados import Empleado
from app.models.proveedores_externos import (
    CursoExterno,
    Proveedor,
    ProveedorPersona,
    ProveedorPersonaCurso,
)
from app.repositories.proveedor_externo_repository import ProveedorExternoRepository
from app.schemas.proveedores_externos import (
    CursoExternoCreate,
    CursoExternoListResponse,
    CursoExternoResponse,
    CursoExternoUpdate,
    PersonaCreate,
    PersonaResponse,
    PersonaUpdate,
    ProveedorCreate,
    ProveedorDetalleResponse,
    ProveedorListResponse,
    ProveedorResponse,
    ProveedorUpdate,
    RegistroCursoCreate,
    RegistroCursoResponse,
    RegistroCursoUpdate,
    VencimientoListResponse,
)
from app.utils.audit_logger import audit_background

AUDIT_MODULE = "PROVEEDORES_EXTERNOS"
DIAS_POR_VENCER = 30


def add_months(d: date, months: int) -> date:
    """Suma `months` meses a `d`, ajustando el dia al ultimo valido del mes
    destino (ej. 31-ene + 1 mes -> 28/29-feb)."""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


class ProveedorExternoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProveedorExternoRepository(db)

    # ══ Proveedores ═══════════════════════════════════════════════════════════
    async def list_proveedores(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        activo: Optional[bool] = None,
    ) -> ProveedorListResponse:
        filters: list = []
        if activo is None:
            filters.append(Proveedor.activo.is_(True))
        else:
            filters.append(Proveedor.activo.is_(activo))
        if search:
            filters.append(Proveedor.nombre.ilike(f"%{search}%"))
        proveedores, total = await self.repo.list_proveedores(filters, page, page_size)
        items = [self._proveedor_to_response(p) for p in proveedores]
        return ProveedorListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def get_proveedor(self, proveedor_id: int) -> ProveedorDetalleResponse:
        prov = await self.repo.get_proveedor_detalle(proveedor_id)
        if not prov:
            raise NotFoundError("Proveedor", proveedor_id)
        base = self._proveedor_to_response(prov)
        personas = [
            PersonaResponse.model_validate(p)
            for p in sorted(prov.personas, key=lambda x: x.nombre.lower())
        ]
        return ProveedorDetalleResponse(**base.model_dump(), personas=personas)

    async def create_proveedor(
        self, data: ProveedorCreate, current_user: Empleado, background_tasks: BackgroundTasks
    ) -> ProveedorDetalleResponse:
        prov = Proveedor(
            nombre=data.nombre,
            rfc=data.rfc,
            contacto=data.contacto,
            telefono=data.telefono,
            email=data.email,
            direccion=data.direccion,
            created_by=current_user.empleado_id,
        )
        self.db.add(prov)
        await self.db.flush()
        audit_background(
            background_tasks, self.db, "PROVEEDOR_CREATE", AUDIT_MODULE,
            usuario_id=current_user.empleado_id, entidad_id=prov.id,
            datos_despues={"nombre": prov.nombre},
        )
        return await self.get_proveedor(prov.id)

    async def update_proveedor(
        self, proveedor_id: int, data: ProveedorUpdate, current_user: Empleado
    ) -> ProveedorDetalleResponse:
        prov = await self.repo.get(proveedor_id)
        if not prov:
            raise NotFoundError("Proveedor", proveedor_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(prov, field, value)
        prov.updated_by = current_user.empleado_id
        await self.db.flush()
        return await self.get_proveedor(prov.id)

    async def delete_proveedor(self, proveedor_id: int) -> None:
        prov = await self.repo.get(proveedor_id)
        if not prov:
            raise NotFoundError("Proveedor", proveedor_id)
        prov.activo = False
        await self.db.flush()

    # ══ Personas ══════════════════════════════════════════════════════════════
    async def list_personas(self, proveedor_id: int) -> list[PersonaResponse]:
        prov = await self.repo.get(proveedor_id)
        if not prov:
            raise NotFoundError("Proveedor", proveedor_id)
        personas = await self.repo.list_personas_de_proveedor(proveedor_id)
        return [PersonaResponse.model_validate(p) for p in personas]

    async def create_persona(
        self, proveedor_id: int, data: PersonaCreate
    ) -> PersonaResponse:
        prov = await self.repo.get(proveedor_id)
        if not prov:
            raise NotFoundError("Proveedor", proveedor_id)
        persona = ProveedorPersona(
            proveedor_id=proveedor_id,
            nombre=data.nombre,
            identificacion=data.identificacion,
            puesto=data.puesto,
        )
        self.db.add(persona)
        await self.db.flush()
        await self.db.refresh(persona)
        return PersonaResponse.model_validate(persona)

    async def update_persona(
        self, persona_id: int, data: PersonaUpdate
    ) -> PersonaResponse:
        persona = await self.repo.get_persona(persona_id)
        if not persona:
            raise NotFoundError("Persona", persona_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(persona, field, value)
        await self.db.flush()
        await self.db.refresh(persona)
        return PersonaResponse.model_validate(persona)

    async def delete_persona(self, persona_id: int) -> None:
        persona = await self.repo.get_persona(persona_id)
        if not persona:
            raise NotFoundError("Persona", persona_id)
        persona.activo = False
        await self.db.flush()

    # ══ Cursos externos ═══════════════════════════════════════════════════════
    async def list_cursos_externos(
        self,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        activo: Optional[bool] = None,
    ) -> CursoExternoListResponse:
        filters: list = []
        if activo is None:
            filters.append(CursoExterno.activo.is_(True))
        else:
            filters.append(CursoExterno.activo.is_(activo))
        if search:
            filters.append(CursoExterno.nombre.ilike(f"%{search}%"))
        cursos, total = await self.repo.list_cursos_externos(filters, page, page_size)
        items = [CursoExternoResponse.model_validate(c) for c in cursos]
        return CursoExternoListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    async def get_curso_externo(self, curso_id: int) -> CursoExternoResponse:
        curso = await self.repo.get_curso_externo(curso_id)
        if not curso:
            raise NotFoundError("Curso externo", curso_id)
        return CursoExternoResponse.model_validate(curso)

    async def create_curso_externo(
        self, data: CursoExternoCreate
    ) -> CursoExternoResponse:
        curso = CursoExterno(
            nombre=data.nombre,
            descripcion=data.descripcion,
            vigencia_meses=data.vigencia_meses,
        )
        self.db.add(curso)
        await self.db.flush()
        await self.db.refresh(curso)
        return CursoExternoResponse.model_validate(curso)

    async def update_curso_externo(
        self, curso_id: int, data: CursoExternoUpdate
    ) -> CursoExternoResponse:
        curso = await self.repo.get_curso_externo(curso_id)
        if not curso:
            raise NotFoundError("Curso externo", curso_id)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(curso, field, value)
        await self.db.flush()
        await self.db.refresh(curso)
        return CursoExternoResponse.model_validate(curso)

    async def delete_curso_externo(self, curso_id: int) -> None:
        curso = await self.repo.get_curso_externo(curso_id)
        if not curso:
            raise NotFoundError("Curso externo", curso_id)
        curso.activo = False
        await self.db.flush()

    # ══ Registros / Vencimientos ══════════════════════════════════════════════
    async def create_registro(
        self, data: RegistroCursoCreate, current_user: Empleado, background_tasks: BackgroundTasks
    ) -> RegistroCursoResponse:
        persona = await self.repo.get_persona(data.persona_id)
        if not persona:
            raise NotFoundError("Persona", data.persona_id)
        curso = await self.repo.get_curso_externo(data.curso_externo_id)
        if not curso:
            raise NotFoundError("Curso externo", data.curso_externo_id)

        fecha_venc = self._calcular_vencimiento(data.fecha_realizado, curso.vigencia_meses)
        registro = ProveedorPersonaCurso(
            persona_id=data.persona_id,
            curso_externo_id=data.curso_externo_id,
            fecha_realizado=data.fecha_realizado,
            fecha_vencimiento=fecha_venc,
            observaciones=data.observaciones,
            created_by=current_user.empleado_id,
        )
        self.db.add(registro)
        await self.db.flush()
        audit_background(
            background_tasks, self.db, "REGISTRO_CURSO_CREATE", AUDIT_MODULE,
            usuario_id=current_user.empleado_id, entidad_id=registro.id,
            datos_despues={
                "persona_id": data.persona_id,
                "curso_externo_id": data.curso_externo_id,
            },
        )
        return await self._registro_response_by_id(registro.id)

    async def update_registro(
        self, registro_id: int, data: RegistroCursoUpdate, current_user: Empleado
    ) -> RegistroCursoResponse:
        registro = await self.repo.get_registro(registro_id)
        if not registro:
            raise NotFoundError("Registro", registro_id)
        payload = data.model_dump(exclude_unset=True)
        if "observaciones" in payload:
            registro.observaciones = payload["observaciones"]
        if "fecha_realizado" in payload and payload["fecha_realizado"] is not None:
            registro.fecha_realizado = payload["fecha_realizado"]
            # Recalcula el vencimiento con la vigencia vigente del curso.
            vigencia = registro.curso.vigencia_meses if registro.curso else None
            registro.fecha_vencimiento = self._calcular_vencimiento(
                registro.fecha_realizado, vigencia
            )
        registro.updated_by = current_user.empleado_id
        await self.db.flush()
        return await self._registro_response_by_id(registro.id)

    async def delete_registro(self, registro_id: int) -> None:
        registro = await self.repo.get_registro(registro_id)
        if not registro:
            raise NotFoundError("Registro", registro_id)
        await self.db.delete(registro)
        await self.db.flush()

    async def list_vencimientos(
        self,
        page: int = 1,
        page_size: int = 50,
        estado: Optional[str] = None,
        proveedor_id: Optional[int] = None,
        curso_externo_id: Optional[int] = None,
        incluir_historico: bool = False,
    ) -> VencimientoListResponse:
        filters: list = []
        if proveedor_id is not None:
            filters.append(ProveedorPersona.proveedor_id == proveedor_id)
        if curso_externo_id is not None:
            filters.append(ProveedorPersonaCurso.curso_externo_id == curso_externo_id)
        # Filtro de estado como rangos sobre fecha_vencimiento (SQL) para paginar bien.
        filters.extend(self._estado_filter(estado))

        registros, total = await self.repo.list_vencimientos(
            filters, page, page_size, incluir_historico
        )
        items = [self._registro_to_response(r) for r in registros]
        return VencimientoListResponse(
            items=items, total=total, page=page, page_size=page_size
        )

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _calcular_vencimiento(
        fecha_realizado: date, vigencia_meses: Optional[int]
    ) -> Optional[date]:
        if not vigencia_meses:
            return None
        return add_months(fecha_realizado, vigencia_meses)

    @staticmethod
    def _estado_filter(estado: Optional[str]) -> list:
        if not estado:
            return []
        today = date.today()
        col = ProveedorPersonaCurso.fecha_vencimiento
        if estado == "sin_vencimiento":
            return [col.is_(None)]
        if estado == "vencido":
            return [col.is_not(None), col < today]
        if estado == "por_vencer":
            limite = today + timedelta(days=DIAS_POR_VENCER)
            return [col.is_not(None), col >= today, col <= limite]
        if estado == "vigente":
            limite = today + timedelta(days=DIAS_POR_VENCER)
            return [col.is_not(None), col > limite]
        return []

    @staticmethod
    def _derivar_estado_dias(
        fecha_venc: Optional[date],
    ) -> tuple[str, Optional[int]]:
        if fecha_venc is None:
            return "sin_vencimiento", None
        dias = (fecha_venc - date.today()).days
        if dias < 0:
            estado = "vencido"
        elif dias <= DIAS_POR_VENCER:
            estado = "por_vencer"
        else:
            estado = "vigente"
        return estado, dias

    async def _registro_response_by_id(self, registro_id: int) -> RegistroCursoResponse:
        registro = await self.repo.get_registro(registro_id)
        if not registro:
            raise NotFoundError("Registro", registro_id)
        return self._registro_to_response(registro)

    def _proveedor_to_response(self, prov: Proveedor) -> ProveedorResponse:
        return ProveedorResponse(
            id=prov.id,
            nombre=prov.nombre,
            rfc=prov.rfc,
            contacto=prov.contacto,
            telefono=prov.telefono,
            email=prov.email,
            direccion=prov.direccion,
            activo=prov.activo,
            personas_count=sum(1 for p in prov.personas if p.activo),
            created_at=prov.created_at,
            updated_at=prov.updated_at,
        )

    def _registro_to_response(
        self, registro: ProveedorPersonaCurso
    ) -> RegistroCursoResponse:
        estado, dias = self._derivar_estado_dias(registro.fecha_vencimiento)
        persona = registro.persona
        proveedor = persona.proveedor if persona else None
        curso = registro.curso
        return RegistroCursoResponse(
            id=registro.id,
            persona_id=registro.persona_id,
            curso_externo_id=registro.curso_externo_id,
            fecha_realizado=registro.fecha_realizado,
            fecha_vencimiento=registro.fecha_vencimiento,
            observaciones=registro.observaciones,
            estado=estado,
            dias_restantes=dias,
            proveedor_id=proveedor.id if proveedor else None,
            proveedor_nombre=proveedor.nombre if proveedor else None,
            persona_nombre=persona.nombre if persona else None,
            curso_nombre=curso.nombre if curso else None,
            created_at=registro.created_at,
            updated_at=registro.updated_at,
        )
