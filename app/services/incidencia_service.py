# app/services/incidencia_service.py
"""
Logica de negocio del dominio incidencias.
Subida de evidencias: almacena en /data/evidencias/incidencias/{year}/{month}/{uuid}.{ext}
"""

import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.incidencias import Incidencia
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.incidencia_repository import (
    EvidenciaRepository,
    IncidenciaRepository,
    build_incidencia_query_filters,
    filtro_tipos_visibles_en_listados,
)
from app.schemas import PaginatedResponse
from app.schemas.incidencias import (
    EvidenciaResponse,
    IncidenciaCreate,
    IncidenciaEmpleadoTotalItem,
    IncidenciaResponse,
    IncidenciaTipoDistribucionItem,
    IncidenciasEstadisticasResponse,
    IncidenciasKpiResumen,
    IncidenciasListPageResponse,
    IncidenciaAreaTotalItem,
    IncidenciaSerieMensualItem,
    IncidenciaSubareaTotalItem,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)

# Directorio base para evidencias
_EVIDENCIAS_BASE = Path("/data/evidencias/incidencias")


class IncidenciaService:
    def __init__(self, db: AsyncSession):
        self.repo = IncidenciaRepository(db)
        self.evidencia_repo = EvidenciaRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    @staticmethod
    def _texto_puesto_y_supervisor(emp: Empleado | None) -> tuple[str | None, str | None]:
        if emp is None:
            return None, None
        puesto_txt: str | None = None
        if emp.puesto is not None and emp.puesto.descripcion:
            p = str(emp.puesto.descripcion).strip()
            puesto_txt = p or None
        sup_txt: str | None = None
        if emp.lider is not None and emp.lider.nombre:
            s = str(emp.lider.nombre).strip()
            sup_txt = s or None
        return puesto_txt, sup_txt

    async def _empleado_reportante_para_incidencia(self, inc: Incidencia) -> Empleado | None:
        """Prioriza búsqueda por `no_empleado` en tabla empleados; si no hay coincidencia, usa FK `empleado_id`."""
        no = (inc.no_empleado or "").strip()
        if no:
            emp = await self.empleado_repo.get_by_no_empleado_con_puesto_y_lider(no)
            if emp is not None:
                return emp
        return await self.empleado_repo.get_with_area_y_lider(inc.empleado_id)

    async def _enriquecer_incidencia_response(self, inc: Incidencia, r: IncidenciaResponse) -> None:
        emp = await self._empleado_reportante_para_incidencia(inc)
        puesto_txt, sup_txt = self._texto_puesto_y_supervisor(emp)
        r.puesto = puesto_txt
        r.supervisor_directo = sup_txt

    def _get_rol(self, current_user: Empleado) -> str:
        return current_user.rol.nombre if current_user.rol else "empleado"

    async def _scope_filters_for_list(self, current_user: Empleado) -> list:
        """Restricción por rol sobre empleado_id (vacío = sin restricción adicional)."""
        rol = self._get_rol(current_user)
        if rol in ("director", "rh"):
            return []
        if rol in ("gerente", "supervisor"):
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            ids = [e.id for e in subordinados] + [current_user.id]
            return [Incidencia.empleado_id.in_(ids)]
        return [Incidencia.empleado_id == current_user.id]

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_incidencias(
        self,
        cursor: int | None,
        limit: int,
        current_user: Empleado,
    ) -> PaginatedResponse[IncidenciaResponse]:
        scope = await self._scope_filters_for_list(current_user)
        list_filters = [*scope, filtro_tipos_visibles_en_listados()]
        filters = list_filters if list_filters else None
        items, next_cursor = await self.repo.list_paginated(
            cursor=cursor, limit=limit, filters=filters
        )
        total = await self.repo.count(filters=filters)

        response_items = []
        for item in items:
            count = await self.repo.count_evidencias(item.id)
            r = IncidenciaResponse.model_validate(item)
            r.evidencias_count = count
            await self._enriquecer_incidencia_response(item, r)
            response_items.append(r)

        return PaginatedResponse(
            items=response_items,
            next_cursor=next_cursor,
            total=total,
        )

    async def list_incidencias_paginated(
        self,
        current_user: Empleado,
        page: int,
        page_size: int,
        *,
        tipo: str | None = None,
        empleado_id: int | None = None,
        no_empleado: str | None = None,
        nombre: str | None = None,
        fecha: date | None = None,
        semana_id: int | None = None,
        numero_semana: int | None = None,
        categoria: str | None = None,
        estatus_id: int | None = None,
        area: str | None = None,
        subarea: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> IncidenciasListPageResponse:
        page_size = min(10, max(1, page_size))
        page = max(1, page)

        scope = await self._scope_filters_for_list(current_user)
        user_filters = build_incidencia_query_filters(
            tipo=tipo,
            empleado_id=empleado_id,
            no_empleado=no_empleado,
            nombre=nombre,
            fecha=fecha,
            semana_id=semana_id,
            numero_semana=numero_semana,
            categoria=categoria,
            estatus_id=estatus_id,
            area=area,
            subarea=subarea,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        all_filters = [*scope, filtro_tipos_visibles_en_listados(), *user_filters]
        filters_arg = all_filters if all_filters else None

        total = await self.repo.count(filters=filters_arg)
        offset = (page - 1) * page_size
        if total == 0:
            page = 1
        elif offset >= total:
            page = max(1, (total + page_size - 1) // page_size)
            offset = (page - 1) * page_size

        items = await self.repo.list_offset(offset, page_size, filters_arg)
        abiertas, en_inv, resueltas, criticas = await self.repo.aggregate_kpis(filters_arg)

        response_items: list[IncidenciaResponse] = []
        for item in items:
            count = await self.repo.count_evidencias(item.id)
            r = IncidenciaResponse.model_validate(item)
            r.evidencias_count = count
            await self._enriquecer_incidencia_response(item, r)
            response_items.append(r)

        return IncidenciasListPageResponse(
            items=response_items,
            total=total,
            page=page,
            page_size=page_size,
            resumen=IncidenciasKpiResumen(
                abiertas=abiertas,
                en_investigacion=en_inv,
                resueltas=resueltas,
                criticas=criticas,
            ),
        )

    async def estadisticas_incidencias(
        self,
        current_user: Empleado,
        *,
        tipo: str | None = None,
        empleado_id: int | None = None,
        no_empleado: str | None = None,
        nombre: str | None = None,
        fecha: date | None = None,
        semana_id: int | None = None,
        numero_semana: int | None = None,
        categoria: str | None = None,
        estatus_id: int | None = None,
        area: str | None = None,
        subarea: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> IncidenciasEstadisticasResponse:
        """Top áreas/subáreas/empleados y distribución por tipo con los mismos filtros que el listado."""
        scope = await self._scope_filters_for_list(current_user)
        user_filters = build_incidencia_query_filters(
            tipo=tipo,
            empleado_id=empleado_id,
            no_empleado=no_empleado,
            nombre=nombre,
            fecha=fecha,
            semana_id=semana_id,
            numero_semana=numero_semana,
            categoria=categoria,
            estatus_id=estatus_id,
            area=area,
            subarea=subarea,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        all_filters = [*scope, filtro_tipos_visibles_en_listados(), *user_filters]
        filters_arg = all_filters if all_filters else None

        total_incidencias, incidencias_seguridad, incidencias_calidad = (
            await self.repo.aggregate_total_y_seguridad_calidad(filters_arg)
        )
        areas_raw = await self.repo.aggregate_areas_top(filters_arg, limit=10)
        subareas_raw = await self.repo.aggregate_subareas_top_with_area(filters_arg, limit=10)
        empleados_raw = await self.repo.aggregate_empleados_top(filters_arg, limit=10)
        tipos_raw = await self.repo.aggregate_tipos_con_totales(filters_arg)
        mes_rows = await self.repo.aggregate_totales_por_mes(filters_arg)

        total_tipos = sum(c for _, c in tipos_raw)
        incidencias_por_tipo: list[IncidenciaTipoDistribucionItem] = []
        for tipo_str, cnt in tipos_raw:
            pct = round(100.0 * cnt / total_tipos, 2) if total_tipos > 0 else 0.0
            incidencias_por_tipo.append(
                IncidenciaTipoDistribucionItem(tipo=tipo_str, total=cnt, porcentaje=pct)
            )

        incidencias_por_mes = [
            IncidenciaSerieMensualItem(periodo=p, total=c) for p, c in mes_rows
        ]

        total_periodo_anterior: int | None = None
        variacion_total_pct: float | None = None
        if fecha_inicio is not None and fecha_fin is not None:
            span_days = (fecha_fin - fecha_inicio).days + 1
            prev_end = fecha_inicio - timedelta(days=1)
            prev_start = prev_end - timedelta(days=span_days - 1)
            prev_user_filters = build_incidencia_query_filters(
                tipo=tipo,
                empleado_id=empleado_id,
                no_empleado=no_empleado,
                nombre=nombre,
                fecha=fecha,
                semana_id=semana_id,
                numero_semana=numero_semana,
                categoria=categoria,
                estatus_id=estatus_id,
                area=area,
                subarea=subarea,
                fecha_inicio=prev_start,
                fecha_fin=prev_end,
            )
            prev_all = [*scope, filtro_tipos_visibles_en_listados(), *prev_user_filters]
            total_prev = await self.repo.count_incidencias(
                prev_all if prev_all else None
            )
            total_periodo_anterior = total_prev
            if total_prev > 0:
                variacion_total_pct = round(
                    100.0 * (total_incidencias - total_prev) / total_prev,
                    1,
                )

        return IncidenciasEstadisticasResponse(
            total_incidencias=total_incidencias,
            incidencias_seguridad=incidencias_seguridad,
            incidencias_calidad=incidencias_calidad,
            areas_con_mas_incidencias=[
                IncidenciaAreaTotalItem(area=a, total=t) for a, t in areas_raw
            ],
            subareas_con_mas_incidencias=[
                IncidenciaSubareaTotalItem(subarea=s, total=t, area=ar)
                for s, ar, t in subareas_raw
            ],
            empleados_con_mas_incidencias=[
                IncidenciaEmpleadoTotalItem(
                    empleado_id=eid,
                    no_empleado=no,
                    nombre=nom,
                    total=cnt,
                )
                for eid, no, nom, cnt in empleados_raw
            ],
            incidencias_por_tipo=incidencias_por_tipo,
            incidencias_por_mes=incidencias_por_mes,
            total_periodo_anterior=total_periodo_anterior,
            variacion_total_pct=variacion_total_pct,
        )

    async def list_tipos_registrados(self, current_user: Empleado) -> list[str]:
        """Tipos distintos en incidencias visibles para el rol del usuario."""
        scope = await self._scope_filters_for_list(current_user)
        tipos_filters = [*scope, filtro_tipos_visibles_en_listados()]
        return await self.repo.distinct_tipos(filters=tipos_filters)

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
        await self._enriquecer_incidencia_response(incidencia, r)
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

        if rol in ("gerente", "supervisor"):
            subordinados = await self.empleado_repo.get_subordinados(
                current_user.id, settings.ESTADOS_ACTIVOS_IDS
            )
            permitidos = {e.id for e in subordinados} | {current_user.id}
            if data.empleado_id not in permitidos:
                raise ForbiddenError(
                    detail="No puedes registrar incidencias para empleados fuera de tu equipo"
                )

        incidencia = await self.repo.create({
            "tipo": data.tipo,
            "empleado_id": data.empleado_id,
            "no_empleado": data.no_empleado,
            "nombre": data.nombre,
            "fecha": data.fecha,
            "semana_id": data.semana_id,
            "numero_semana": data.numero_semana,
            "categoria": data.categoria,
            "detalle": data.detalle,
            "descuento_porcentaje": data.descuento_porcentaje,
            "estatus_id": data.estatus_id,
            "area": data.area,
            "subarea": data.subarea,
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
                "estatus_id": incidencia.estatus_id,
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
                target_url="#/incidencias",
                metadata={"entidad": "incidencia", "tipo": data.tipo},
            )

        background_tasks.add_task(_notify_incidencia)

        r = IncidenciaResponse.model_validate(incidencia)
        r.evidencias_count = 0
        await self._enriquecer_incidencia_response(incidencia, r)
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
