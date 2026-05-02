# app/services/acta_service.py
"""
Logica de negocio del dominio actas administrativas.

Flujo de estados:
  DRAFT → (edicion) → PENDING_SIGN → SIGNED → ARCHIVED

Al firmar con los 3 roles requeridos (gerente, director, rh) → estado SIGNED.
Se encola la generacion del PDF en TRESS una vez firmado.
Stub de Ollama para generacion de contenido de acta.
"""

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.integrations.tress.queue import encolar_tress
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.empleados import Empleado
from app.repositories.acta_repository import ActaAprobacionRepository, ActaRepository
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas import PaginatedResponse
from app.schemas.actas import (
    ActaAprobacionResponse,
    ActaCreateRequest,
    ActaEditarRequest,
    ActaFirmarRequest,
    ActaGenerarRequest,
    ActaResponse,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

# Roles que deben firmar para que un acta quede SIGNED
_ROLES_FIRMANTES_REQUERIDOS = {"gerente", "director", "rh"}

# Directorio de PDFs generados
_PDF_BASE = Path("/data/actas/pdf")


async def _llamar_ollama(contexto: dict) -> str:
    """Stub de llamada a Ollama. Implementacion completa en fase integraciones."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": f"Genera un acta administrativa formal para: {contexto}",
                    "temperature": settings.OLLAMA_TEMPERATURE,
                    "stream": False,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("response", "")
    except Exception:
        pass
    # Fallback: borrador vacio para edicion manual
    return (
        "[Borrador generado automaticamente - Completar manualmente]\n\n"
        f"Empleado: {contexto.get('empleado_nombre', '')}\n"
        f"Fecha: {contexto.get('fecha', '')}\n"
        f"Tipo: {contexto.get('tipo_incidencia', '')}\n"
    )


async def _mejorar_redaccion_acta(contexto: dict) -> str:
    prompt = (
        "Mejora la redaccion de una acta administrativa manteniendo hechos, fechas, personas y "
        "datos legales sin inventar informacion.\n"
        "Requisitos:\n"
        "1) Usa tono formal, claro y juridico-laboral mexicano.\n"
        "2) Conserva el significado original y el orden logico.\n"
        "3) Corrige ortografia, puntuacion y coherencia.\n"
        "4) No uses markdown ni encabezados adicionales.\n"
        "5) Devuelve solo el texto mejorado.\n\n"
        f"Contexto del acta:\n{contexto}"
    )
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": (
                        "Eres un especialista legal laboral en Mexico. "
                        "Redacta textos formales para actas administrativas de RH."
                    ),
                    "temperature": max(0.0, min(settings.OLLAMA_TEMPERATURE, 0.4)),
                    "stream": False,
                },
            )
            resp.raise_for_status()
            texto = str(resp.json().get("response", "")).strip()
            if not texto:
                raise ValueError("Respuesta vacia de Ollama")
            return texto
    except Exception as exc:
        logger.warning(
            "No se pudo mejorar redaccion del acta con IA: %s",
            exc,
        )
        raise ServiceUnavailableError(
            detail="No fue posible generar la sugerencia con IA en este momento. Intenta nuevamente."
        ) from exc


class ActaService:
    def __init__(self, db: AsyncSession):
        self.repo = ActaRepository(db)
        self.aprobacion_repo = ActaAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    @staticmethod
    def _normalizar_numero_empleado(numero: str | None) -> str | None:
        if numero is None:
            return None
        raw = str(numero).strip()
        if not raw:
            return None
        if raw.endswith(".0"):
            entero = raw[:-2]
            if entero.isdigit():
                return entero
        return raw

    async def _build_response(self, acta: ActaAdministrativa) -> ActaResponse:
        aprobaciones = getattr(acta, "aprobaciones", []) or []
        roles_firmados = {a.rol_firmante for a in aprobaciones if a.firma_timestamp}
        firmantes_pendientes = sorted(_ROLES_FIRMANTES_REQUERIDOS - roles_firmados)
        r = ActaResponse.model_validate(acta)

        # En registros historicos puede existir desalineacion entre empleado_id y numero_empleado.
        # Si el acta trae numero_empleado, priorizamos resolver el empleado por ese numero.
        numero_acta = self._normalizar_numero_empleado(getattr(acta, "numero_empleado", None))
        empleado_por_numero = None
        if numero_acta:
            candidatos = [numero_acta]
            if numero_acta.isdigit():
                # Compatibilidad con datos legacy que guardaron numero como decimal string.
                candidatos.append(f"{numero_acta}.0")
            result_emp = await self.db.execute(
                select(Empleado)
                .options(selectinload(Empleado.puesto))
                .where(Empleado.no_empleado.in_(candidatos))
            )
            empleado_por_numero = result_emp.scalar_one_or_none()

        if empleado_por_numero:
            r.empleado_nombre = empleado_por_numero.nombre
            r.numero_empleado = empleado_por_numero.no_empleado
            r.puesto = (
                empleado_por_numero.puesto.descripcion
                if empleado_por_numero.puesto
                else None
            )
        else:
            empleado_rel = getattr(acta, "empleado", None)
            if empleado_rel:
                r.empleado_nombre = empleado_rel.nombre
                r.numero_empleado = empleado_rel.no_empleado
                r.puesto = (
                    empleado_rel.puesto.descripcion
                    if getattr(empleado_rel, "puesto", None)
                    else None
                )

        numero_rel = self._normalizar_numero_empleado(r.numero_empleado)
        if numero_acta and numero_acta != numero_rel:
            r.numero_empleado = numero_acta

        if not r.numero_empleado and numero_acta:
            r.numero_empleado = numero_acta
        r.numero_empleado = self._normalizar_numero_empleado(r.numero_empleado)
        r.aprobaciones = [ActaAprobacionResponse.model_validate(a) for a in aprobaciones]
        r.firmantes_pendientes = firmantes_pendientes
        return r

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_actas(
        self,
        cursor: int | None,
        limit: int,
        current_user: Empleado,
    ) -> PaginatedResponse[ActaResponse]:
        rol = self._get_rol(current_user)

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()
        elif rol == "gerente":
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            items, next_cursor = await self.repo.list_paginated(
                cursor=cursor,
                limit=limit,
                filters=[ActaAdministrativa.empleado_id.in_(ids)],
            )
            total = await self.repo.count(
                filters=[ActaAdministrativa.empleado_id.in_(ids)]
            )
        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id,
                cursor=cursor,
                limit=limit,
            )
            total = await self.repo.count(
                filters=[ActaAdministrativa.empleado_id == current_user.id]
            )

        # Cargar aprobaciones para cada acta
        response_items = []
        for item in items:
            acta = await self.repo.get_with_aprobaciones(item.id)
            response_items.append(await self._build_response(acta))

        return PaginatedResponse(
            items=response_items,
            next_cursor=next_cursor,
            total=total,
        )

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_acta(
        self,
        id: int,
        current_user: Empleado,
    ) -> ActaResponse:
        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            if acta.empleado_id != current_user.id:
                raise ForbiddenError(detail="No tienes acceso a esta acta")

        return await self._build_response(acta)

    async def mejorar_redaccion_acta(
        self,
        id: int,
        current_user: Empleado,
    ) -> str:
        acta = await self.get_acta(id=id, current_user=current_user)
        texto_original = (acta.descripcion_hechos or "").strip()
        if not texto_original:
            raise ConflictError(
                detail="El acta no tiene descripcion de hechos para mejorar con IA"
            )

        contexto = {
            "tipo_falta": acta.tipo_falta or "",
            "fundamento_legal": acta.fundamento_legal or "",
            "articulo_inciso": acta.articulo_inciso or "",
            "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else "",
            "lugar_incidente": acta.lugar_incidente or "",
            "descripcion_hechos": texto_original,
            "personas_involucradas": acta.personas_involucradas or "",
            "testigos": acta.testigos or "",
        }
        texto_mejorado = await _mejorar_redaccion_acta(contexto)
        texto_mejorado = texto_mejorado.strip()

        # Persistir recomendacion por acta para recuperarla entre sesiones.
        await self.repo.update(
            id,
            {"ia_recomendacion": texto_mejorado},
        )
        return texto_mejorado

    # ── Generar ───────────────────────────────────────────────────────────────

    async def generar_acta(
        self,
        data: ActaGenerarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede generar actas")

        result_emp = await self.db.execute(
            select(Empleado)
            .options(selectinload(Empleado.area), selectinload(Empleado.puesto))
            .where(Empleado.id == data.empleado_id)
        )
        empleado = result_emp.scalar_one_or_none()
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        tipo_incidencia = "no especificado"
        if data.incidencia_id:
            from app.models.incidencias import Incidencia
            result = await self.db.execute(
                select(Incidencia).where(Incidencia.id == data.incidencia_id)
            )
            incidencia = result.scalar_one_or_none()
            if not incidencia:
                raise NotFoundError(entidad="Incidencia", id=data.incidencia_id)
            tipo_incidencia = incidencia.tipo

        contexto = {
            "empleado_nombre": empleado.nombre,
            "num_empleado": empleado.no_empleado,
            "departamento": (
                empleado.area.descripcion if empleado.area else ""
            ),
            "puesto": (empleado.puesto.descripcion if empleado.puesto else ""),
            "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "tipo_incidencia": tipo_incidencia,
        }
        contenido_ia = await _llamar_ollama(contexto)

        acta = await self.repo.create({
            "empleado_id": data.empleado_id,
            "incidencia_id": data.incidencia_id,
            "contenido_ia": contenido_ia,
            "contenido_final": None,
            "estado": "draft",
            "generado_por": current_user.id,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_GENERATED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=acta.id,
            datos_despues={
                "empleado_id": acta.empleado_id,
                "estado": acta.estado,
                "incidencia_id": acta.incidencia_id,
            },
        )

        acta = await self.repo.get_with_aprobaciones(acta.id)
        return await self._build_response(acta)

    async def crear_acta_desde_formulario(
        self,
        data: ActaCreateRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear actas")

        result_emp = await self.db.execute(
            select(Empleado).where(Empleado.id == data.empleado_id)
        )
        empleado = result_emp.scalar_one_or_none()
        if not empleado:
            raise NotFoundError(entidad="Empleado", id=data.empleado_id)

        acta = await self.repo.create({
            "empleado_id": data.empleado_id,
            "numero_empleado": self._normalizar_numero_empleado(data.numero_empleado),
            "area_departamento": data.area_departamento,
            "supervisor_directo": data.supervisor_directo,
            "tipo_falta": data.tipo_falta,
            "fundamento_legal": data.fundamento_legal,
            "articulo_inciso": data.articulo_inciso,
            "fecha_evento": data.fecha_evento,
            "lugar_incidente": data.lugar_incidente,
            "descripcion_hechos": data.descripcion_hechos,
            "personas_involucradas": data.personas_involucradas,
            "testigos": data.testigos,
            "responsable_rh": data.responsable_rh,
            # Opcional por ahora: no bloquear guardado sin evidencia.
            "evidencia": data.evidencia,
            "incidencia_id": None,
            "contenido_ia": None,
            "contenido_final": None,
            "estado": "draft",
            "generado_por": current_user.id,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_CREATED_FROM_FORM",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=acta.id,
            datos_despues={
                "empleado_id": acta.empleado_id,
                "estado": acta.estado,
                "fundamento_legal": acta.fundamento_legal,
                "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else None,
            },
        )

        acta = await self.repo.get_with_aprobaciones(acta.id)
        return await self._build_response(acta)

    # ── Editar ────────────────────────────────────────────────────────────────

    async def editar_acta(
        self,
        id: int,
        data: ActaEditarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede editar actas")

        acta = await self.repo.get(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado != "draft":
            raise ConflictError(
                detail=f"Solo se pueden editar actas en estado 'draft', estado actual: '{acta.estado}'"
            )

        datos_antes = {
            "tipo_falta": acta.tipo_falta,
            "fundamento_legal": acta.fundamento_legal,
            "articulo_inciso": acta.articulo_inciso,
            "fecha_evento": str(acta.fecha_evento) if acta.fecha_evento else None,
            "lugar_incidente": acta.lugar_incidente,
            "descripcion_hechos": acta.descripcion_hechos,
            "personas_involucradas": acta.personas_involucradas,
            "testigos": acta.testigos,
            "responsable_rh": acta.responsable_rh,
            "evidencia": acta.evidencia,
            "estado": acta.estado,
        }
        acta = await self.repo.update(id, {
            "tipo_falta": data.tipo_falta,
            "fundamento_legal": data.fundamento_legal,
            "articulo_inciso": data.articulo_inciso,
            "fecha_evento": data.fecha_evento,
            "lugar_incidente": data.lugar_incidente,
            "descripcion_hechos": data.descripcion_hechos,
            "personas_involucradas": data.personas_involucradas,
            "testigos": data.testigos,
            "responsable_rh": data.responsable_rh,
            "evidencia": data.evidencia,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_EDITED",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues={
                "tipo_falta": data.tipo_falta,
                "fundamento_legal": data.fundamento_legal,
                "articulo_inciso": data.articulo_inciso,
                "fecha_evento": str(data.fecha_evento),
                "lugar_incidente": data.lugar_incidente,
                "descripcion_hechos": data.descripcion_hechos,
                "personas_involucradas": data.personas_involucradas,
                "testigos": data.testigos,
                "responsable_rh": data.responsable_rh,
                "evidencia": data.evidencia,
                "estado": acta.estado,
            },
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    # ── Firmar ────────────────────────────────────────────────────────────────

    async def firmar_acta(
        self,
        id: int,
        request: ActaFirmarRequest,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> ActaResponse:
        rol = self._get_rol(current_user)
        if rol not in ("gerente", "director", "rh"):
            raise ForbiddenError(detail="Solo gerente, director o rh pueden firmar actas")

        acta = await self.repo.get_with_aprobaciones(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        if acta.estado not in ("pending_sign",):
            raise ConflictError(
                detail=f"El acta no esta en estado 'pending_sign', estado actual: '{acta.estado}'"
            )

        # Verificar que este firmante no haya firmado ya
        firma_existente = await self.repo.get_aprobacion_by_firmante(
            acta_id=id,
            firmante_id=current_user.id,
        )
        if firma_existente and firma_existente.firma_timestamp:
            raise ConflictError(detail="Ya has firmado este acta anteriormente")

        ahora = datetime.now(timezone.utc)

        if firma_existente:
            # Actualizar registro existente sin timestamp → poner timestamp
            await self.aprobacion_repo.update(
                firma_existente.id,
                {"firma_timestamp": ahora, "comentario": request.comentario},
            )
        else:
            # Crear nuevo registro de firma
            await self.aprobacion_repo.create({
                "acta_id": id,
                "firmante_id": current_user.id,
                "rol_firmante": rol,
                "firma_timestamp": ahora,
                "comentario": request.comentario,
            })

        # Verificar si todos los firmantes requeridos han firmado
        firmadas = await self.aprobacion_repo.count_firmadas(id)
        if firmadas >= len(_ROLES_FIRMANTES_REQUERIDOS):
            acta = await self.repo.update(id, {"estado": "signed"})

            # Encolar generacion de PDF
            await encolar_tress(
                db=self.db,
                accion="GENERAR_ACTA_PDF",
                payload={
                    "acta_id": id,
                    "empleado_id": acta.empleado_id,
                },
            )

            # Notificar al empleado
            empleado_id = acta.empleado_id

            async def _notify_acta_signed() -> None:
                from app.services.notificacion_service import NotificacionService
                svc = NotificacionService(self.db)
                await svc.enviar(
                    destinatario_id=empleado_id,
                    asunto="Tu acta administrativa ha sido firmada",
                    cuerpo=(
                        "El acta administrativa de tu expediente ha sido <b>firmada</b> "
                        "por todos los responsables. Puedes consultarla en la plataforma."
                    ),
                    canal="in_app",
                    target_url=f"#/actas/{id}",
                    metadata={"entidad": "acta", "estado": "signed", "acta_id": id},
                )

            background_tasks.add_task(_notify_acta_signed)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="ACTA_FIRMADA",
            modulo="actas",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_despues={"firmante_id": current_user.id, "rol": rol},
        )

        acta = await self.repo.get_with_aprobaciones(id)
        return await self._build_response(acta)

    # ── PDF ───────────────────────────────────────────────────────────────────

    async def get_acta_pdf(
        self,
        id: int,
        current_user: Empleado,
    ) -> str:
        """Retorna el path del PDF del acta. Retorna NotFoundError si aun no existe."""
        rol = self._get_rol(current_user)
        if rol not in ("rh", "gerente", "director"):
            raise ForbiddenError(detail="Se requiere rol rh o gerente para descargar el PDF")

        acta = await self.repo.get(id)
        if not acta:
            raise NotFoundError(entidad="Acta", id=id)

        pdf_path = _PDF_BASE / f"acta_{id}.pdf"
        if not pdf_path.exists():
            raise NotFoundError(
                entidad="PDF del Acta",
                id=id,
            )

        return str(pdf_path)
