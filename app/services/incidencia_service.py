# app/services/incidencia_service.py
"""
Logica de negocio del dominio incidencias.

Flujo de estados:
  OPEN → IN_REVIEW → RESOLVED → CLOSED

Al cerrar con tipo falta/retardo: se encola en TRESS para nomina.
Subida de evidencias: almacena en /data/evidencias/incidencias/{year}/{month}/{uuid}.{ext}
"""

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.integrations.tress.queue import encolar_tress
from app.models.empleados import Empleado
from app.models.incidencias import Incidencia
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.incidencia_repository import EvidenciaRepository, IncidenciaRepository
from app.schemas import PaginatedResponse
from app.schemas.incidencias import (
    INCIDENCIA_TRANSICIONES_VALIDAS,
    EvidenciaResponse,
    IncidenciaCreate,
    IncidenciaResponse,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

# Tipos que generan registro en nomina al cerrar
_TIPOS_NOMINA = {"falta", "retardo"}

# Directorio base para evidencias
_EVIDENCIAS_BASE = Path("/data/evidencias/incidencias")


class IncidenciaService:
    def __init__(self, db: AsyncSession):
        self.repo = IncidenciaRepository(db)
        self.evidencia_repo = EvidenciaRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_incidencias(
        self,
        cursor: int | None,
        limit: int,
        current_user: Empleado,
    ) -> PaginatedResponse[IncidenciaResponse]:
        rol = self._get_rol(current_user)

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()
        elif rol in ("gerente", "supervisor"):
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            items, next_cursor = await self.repo.list_paginated(
                cursor=cursor,
                limit=limit,
                filters=[Incidencia.empleado_id.in_(ids)],
            )
            total = await self.repo.count(filters=[Incidencia.empleado_id.in_(ids)])
        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Incidencia.empleado_id == current_user.id]
            )

        response_items = []
        for item in items:
            count = await self.repo.count_evidencias(item.id)
            r = IncidenciaResponse.model_validate(item)
            r.evidencias_count = count
            response_items.append(r)

        return PaginatedResponse(
            items=response_items,
            next_cursor=next_cursor,
            total=total,
        )

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_incidencia(
        self,
        id: int,
        current_user: Empleado,
    ) -> IncidenciaResponse:
        incidencia = await self.repo.get_with_evidencias(id)
        if not incidencia:
            raise NotFoundError(entidad="Incidencia", id=id)

        rol = self._get_rol(current_user)
        if rol not in ("director", "rh", "gerente", "supervisor"):
            if incidencia.empleado_id != current_user.id:
                raise ForbiddenError(detail="No tienes acceso a esta incidencia")

        count = await self.repo.count_evidencias(id)
        r = IncidenciaResponse.model_validate(incidencia)
        r.evidencias_count = count
        return r

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear_incidencia(
        self,
        data: IncidenciaCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> IncidenciaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor", "gerente", "director"):
            raise ForbiddenError(detail="Se requiere rol rh o supervisor para crear incidencias")

        # Verificar que el empleado existe
        empleado = await self.empleado_repo.get(data.empleado_id)
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        incidencia = await self.repo.create({
            "empleado_id": data.empleado_id,
            "tipo": data.tipo,
            "descripcion": data.descripcion,
            "estado": "open",
            "registrado_por": current_user.id,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="INCIDENCIA_CREATED",
            modulo="incidencias",
            usuario_id=current_user.id,
            entidad_id=incidencia.id,
            datos_despues={
                "empleado_id": incidencia.empleado_id,
                "tipo": incidencia.tipo,
                "estado": incidencia.estado,
            },
        )

        # Notificar al empleado afectado
        empleado_id = data.empleado_id

        async def _notify_incidencia() -> None:
            from app.services.notificacion_service import NotificacionService
            svc = NotificacionService(self.db)
            await svc.enviar(
                destinatario_id=empleado_id,
                asunto="Se ha registrado una incidencia en tu expediente",
                cuerpo=(
                    f"Se ha registrado una incidencia de tipo <b>{data.tipo}</b> "
                    "en tu expediente. Por favor revisa la plataforma para mas informacion."
                ),
                canal="in_app",
            )

        background_tasks.add_task(_notify_incidencia)

        r = IncidenciaResponse.model_validate(incidencia)
        r.evidencias_count = 0
        return r

    # ── Cambiar estado ────────────────────────────────────────────────────────

    async def cambiar_estado(
        self,
        id: int,
        nuevo_estado: str,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> IncidenciaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="Se requiere rol rh o gerente para cambiar el estado")

        incidencia = await self.repo.get(id)
        if not incidencia:
            raise NotFoundError(entidad="Incidencia", id=id)

        # Validar transicion
        transiciones_permitidas = INCIDENCIA_TRANSICIONES_VALIDAS.get(
            incidencia.estado, set()
        )
        if nuevo_estado not in transiciones_permitidas:
            raise DomainValidationError(
                detail=(
                    f"Transicion no permitida: '{incidencia.estado}' → '{nuevo_estado}'. "
                    f"Transiciones validas desde '{incidencia.estado}': "
                    f"{sorted(transiciones_permitidas) or 'ninguna'}"
                )
            )

        datos_antes = {"estado": incidencia.estado}
        incidencia = await self.repo.update(id, {"estado": nuevo_estado})

        # Si se cierra con tipo falta/retardo → encolar TRESS
        if nuevo_estado == "closed" and incidencia.tipo in _TIPOS_NOMINA:
            empleado = await self.empleado_repo.get(incidencia.empleado_id)
            if empleado:
                await encolar_tress(
                    db=self.db,
                    accion="REGISTRAR_INCIDENCIA",
                    payload={
                        "empleado_num": empleado.no_empleado,
                        "tipo": incidencia.tipo,
                        "descripcion": incidencia.descripcion,
                        "fecha": str(incidencia.created_at.date()),
                        "referencia_id": incidencia.id,
                    },
                )

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="INCIDENCIA_ESTADO_CHANGED",
            modulo="incidencias",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues={"estado": nuevo_estado},
        )

        count = await self.repo.count_evidencias(id)
        r = IncidenciaResponse.model_validate(incidencia)
        r.evidencias_count = count
        return r

    # ── Subir evidencia ───────────────────────────────────────────────────────

    async def subir_evidencia(
        self,
        incidencia_id: int,
        filename: str,
        content_type: str,
        size: int,
        file_bytes: bytes,
        current_user: Empleado,
    ) -> EvidenciaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("rh", "supervisor", "gerente", "director"):
            raise ForbiddenError(detail="Se requiere rol rh o supervisor para subir evidencias")

        incidencia = await self.repo.get(incidencia_id)
        if not incidencia:
            raise NotFoundError(entidad="Incidencia", id=incidencia_id)

        if incidencia.estado == "closed":
            raise ConflictError(detail="No se pueden subir evidencias a una incidencia cerrada")

        # Construir path
        now = datetime.now(timezone.utc)
        ext = Path(filename).suffix.lower() if Path(filename).suffix else ""
        unique_name = f"{uuid.uuid4()}{ext}"
        relative_path = Path(str(now.year)) / str(now.month).zfill(2) / unique_name
        full_path = _EVIDENCIAS_BASE / relative_path

        # Crear directorio y guardar archivo
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(file_bytes)

        evidencia = await self.evidencia_repo.create({
            "entidad_tipo": "incidencia",
            "entidad_id": incidencia_id,
            "archivo_path": str(full_path),
            "nombre_original": filename,
            "mime_type": content_type or "application/octet-stream",
            "tamano_bytes": size,
            "subido_por": current_user.id,
            "activo": True,
        })

        return EvidenciaResponse.model_validate(evidencia)

    # ── Obtener evidencia ─────────────────────────────────────────────────────

    async def get_evidencia(
        self,
        incidencia_id: int,
        evidencia_id: int,
        current_user: Empleado,
    ) -> str:
        """Retorna el path del archivo de la evidencia."""
        incidencia = await self.repo.get(incidencia_id)
        if not incidencia:
            raise NotFoundError(entidad="Incidencia", id=incidencia_id)

        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "supervisor", "director"):
            if incidencia.empleado_id != current_user.id:
                raise ForbiddenError(detail="No tienes acceso a esta evidencia")

        evidencia = await self.evidencia_repo.get_by_id_and_incidencia(
            evidencia_id=evidencia_id,
            incidencia_id=incidencia_id,
        )
        if not evidencia:
            raise NotFoundError(entidad="Evidencia", id=evidencia_id)

        return evidencia.archivo_path
