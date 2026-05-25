# app/services/competencia_service.py
"""
Logica de negocio para Competencias — Modulo Talento Fase 1.

Responsabilidades:
  - CRUD de competencias (catalogo)
  - Matriz de competencias por area (grid: competencias x puestos)
  - Bulk update de la matriz
  - Resumen de area (cumplimiento %, totales)
  - Brechas criticas (gap % por competencia)
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.models.catalogos import Area
from app.models.empleados import Empleado
from app.models.talento import Competencia, CompetenciaRequisito, EvaluacionCompetencia, PuestoPerfil
from app.repositories.competencia_repository import (
    CompetenciaRepository,
    CompetenciaRequisitoRepository,
)
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
from app.schemas.talento import (
    BrechaItem,
    BrechasResponse,
    CompetenciaCreate,
    CompetenciaListResponse,
    CompetenciaResponse,
    CompetenciaUpdate,
    FilterOption,
    FilterOptionsResponse,
    MatrizBulkUpdate,
    MatrizResponse,
    MatrizRow,
    PuestoPerfilResponse,
    ResumenAreaResponse,
)

logger = logging.getLogger(__name__)


class CompetenciaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = CompetenciaRepository(db)
        self.requisito_repo = CompetenciaRequisitoRepository(db)
        self.puesto_repo = PuestoPerfilRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(comp: Competencia) -> CompetenciaResponse:
        area_nombre = None
        if comp.area:
            area_nombre = comp.area.descripcion
        return CompetenciaResponse(
            id=comp.id,
            nombre=comp.nombre,
            descripcion=comp.descripcion,
            categoria=comp.categoria,
            area_id=comp.area_id,
            area_nombre=area_nombre,
            activo=comp.activo,
            created_at=comp.created_at,
            updated_at=comp.updated_at,
        )

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    async def _get_area(self, area_id: int) -> Area:
        """Obtiene el area o lanza NotFoundError."""
        result = await self.db.execute(
            select(Area).where(Area.area_id == area_id)
        )
        area = result.scalar_one_or_none()
        if not area:
            raise NotFoundError(entidad="Area", id=area_id)
        return area

    # ── Filter Options ──────────────────────────────────────────────────────

    async def obtener_filter_options(self) -> FilterOptionsResponse:
        """Devuelve las opciones de filtro disponibles (areas activas)."""
        result = await self.db.execute(
            select(Area).where(Area.estatus_id == 1).order_by(Area.descripcion)
        )
        areas = result.scalars().all()
        return FilterOptionsResponse(
            areas=[FilterOption(id=str(a.area_id), label=a.descripcion) for a in areas],
            lineas=[],
            sectores=[],
        )

    # ── Listar ───────────────────────────────────────────────────────────────

    async def listar(
        self,
        page: int,
        page_size: int,
        categoria: str | None = None,
        area_id: int | None = None,
        busqueda: str | None = None,
    ) -> CompetenciaListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            categoria=categoria,
            area_id=area_id,
            busqueda=busqueda,
        )
        return CompetenciaListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    # ── Obtener ──────────────────────────────────────────────────────────────

    async def obtener(self, id: int) -> CompetenciaResponse:
        comp = await self.repo.get_with_relations(id)
        if not comp:
            raise NotFoundError(entidad="Competencia", id=id)
        return self._to_response(comp)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear(
        self, data: CompetenciaCreate, current_user: Empleado
    ) -> CompetenciaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear competencias")

        # Verificar duplicado
        if await self.repo.exists_by_nombre_categoria(data.nombre, data.categoria):
            raise ConflictError(
                detail=f"Ya existe una competencia '{data.nombre}' con categoria '{data.categoria}'"
            )

        comp = await self.repo.create({
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "categoria": data.categoria,
            "area_id": data.area_id,
            "activo": True,
        })

        comp = await self.repo.get_with_relations(comp.id)
        return self._to_response(comp)

    # ── Actualizar ───────────────────────────────────────────────────────────

    async def actualizar(
        self, id: int, data: CompetenciaUpdate, current_user: Empleado
    ) -> CompetenciaResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar competencias")

        comp = await self.repo.get_with_relations(id)
        if not comp:
            raise NotFoundError(entidad="Competencia", id=id)

        # Verificar duplicado si cambia nombre o categoria
        nombre_check = data.nombre or comp.nombre
        categoria_check = data.categoria or comp.categoria
        if nombre_check != comp.nombre or categoria_check != comp.categoria:
            if await self.repo.exists_by_nombre_categoria(
                nombre_check, categoria_check, exclude_id=id
            ):
                raise ConflictError(
                    detail=f"Ya existe una competencia '{nombre_check}' con categoria '{categoria_check}'"
                )

        update_data: dict = {}
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion
        if data.categoria is not None:
            update_data["categoria"] = data.categoria
        if data.area_id is not None:
            update_data["area_id"] = data.area_id

        if update_data:
            await self.repo.update(id, update_data)

        comp = await self.repo.get_with_relations(id)
        return self._to_response(comp)

    # ── Eliminar ─────────────────────────────────────────────────────────────

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede eliminar competencias")

        comp = await self.repo.get_with_relations(id)
        if not comp:
            raise NotFoundError(entidad="Competencia", id=id)

        # Soft delete
        await self.repo.update(id, {"activo": False})

    # ── Matriz de Competencias ───────────────────────────────────────────────

    async def obtener_matriz(self, area_id: int) -> MatrizResponse:
        """
        Retorna la matriz: filas=competencias, columnas=puestos del area.
        Cada celda contiene el nivel_requerido (0 si no existe requisito).
        """
        area = await self._get_area(area_id)

        # Obtener puestos del area
        puestos = await self.puesto_repo.list_by_area(area_id)
        if not puestos:
            return MatrizResponse(
                area_id=area_id,
                area_nombre=area.descripcion,
                puestos=[],
                competencias=[],
            )

        # Obtener competencias del area
        competencias = await self.repo.list_by_area(area_id)

        # Obtener todos los requisitos del area
        requisitos = await self.requisito_repo.list_by_area(area_id)

        # Construir mapa: {competencia_id: {puesto_perfil_id: nivel}}
        requisito_map: dict[int, dict[int, int]] = {}
        for req in requisitos:
            if req.competencia_id not in requisito_map:
                requisito_map[req.competencia_id] = {}
            requisito_map[req.competencia_id][req.puesto_perfil_id] = req.nivel_requerido

        # Construir filas de la matriz
        rows: list[MatrizRow] = []
        for comp in competencias:
            niveles = requisito_map.get(comp.id, {})
            # Solo incluir niveles para puestos de esta area
            niveles_filtrados = {
                p.id: niveles.get(p.id, 0) for p in puestos
            }
            rows.append(MatrizRow(
                competencia_id=comp.id,
                competencia_nombre=comp.nombre,
                categoria=comp.categoria,
                niveles=niveles_filtrados,
            ))

        # Convertir puestos a response
        puestos_response = []
        for p in puestos:
            puestos_response.append(PuestoPerfilResponse(
                id=p.id,
                codigo=p.codigo,
                nombre=p.nombre,
                area_id=p.area_id,
                area_nombre=area.descripcion,
                nivel=p.nivel,
                descripcion=p.descripcion,
                version=p.version,
                activo=p.activo,
                created_by=p.created_by,
                updated_by=p.updated_by,
                created_at=p.created_at,
                updated_at=p.updated_at,
            ))

        return MatrizResponse(
            area_id=area_id,
            area_nombre=area.descripcion,
            puestos=puestos_response,
            competencias=rows,
        )

    async def actualizar_matriz(
        self, data: MatrizBulkUpdate, current_user: Empleado
    ) -> dict:
        """Actualiza en bulk los niveles de la matriz."""
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar la matriz de competencias")

        actualizados = 0
        errores: list[str] = []

        for celda in data.celdas:
            # Validar que competencia existe y esta activa
            comp = await self.repo.get_with_relations(celda.competencia_id)
            if not comp:
                errores.append(
                    f"Competencia {celda.competencia_id} no encontrada"
                )
                continue

            # Validar que puesto existe y esta activo
            puesto = await self.puesto_repo.get_with_relations(celda.puesto_perfil_id)
            if not puesto:
                errores.append(
                    f"PuestoPerfil {celda.puesto_perfil_id} no encontrado"
                )
                continue

            # Validar nivel
            if celda.nivel_requerido < 0 or celda.nivel_requerido > 4:
                errores.append(
                    f"Nivel {celda.nivel_requerido} fuera de rango (0-4) para "
                    f"competencia={celda.competencia_id}, puesto={celda.puesto_perfil_id}"
                )
                continue

            await self.requisito_repo.upsert(
                competencia_id=celda.competencia_id,
                puesto_perfil_id=celda.puesto_perfil_id,
                nivel_requerido=celda.nivel_requerido,
            )
            actualizados += 1

        return {
            "actualizados": actualizados,
            "errores": errores,
        }

    # ── Resumen de Area ──────────────────────────────────────────────────────

    async def resumen_area(self, area_id: int) -> ResumenAreaResponse:
        """
        Calcula resumen de un area:
        - Total empleados activos del area
        - Total puestos perfil definidos
        - Total competencias asignadas al area
        - Requisitos activos (celdas con nivel > 0)
        - Cumplimiento % estimado
        """
        area = await self._get_area(area_id)

        # Total empleados activos del area
        result = await self.db.execute(
            select(func.count())
            .select_from(Empleado)
            .where(
                Empleado.area_id == area_id,
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            )
        )
        total_empleados = result.scalar_one() or 0

        # Total puestos perfil
        puestos = await self.puesto_repo.list_by_area(area_id)
        total_puestos = len(puestos)

        # Total competencias del area
        competencias = await self.repo.list_by_area(area_id)
        total_competencias = len(competencias)

        # Requisitos activos (nivel > 0)
        requisitos_activos = await self.requisito_repo.count_by_area(area_id)

        # Cumplimiento %: promedio de (nivel_actual / nivel_requerido) para
        # cada par empleado×competencia donde existe un requisito.
        # Si no hay evaluaciones, fallback a completitud de definicion.
        if requisitos_activos == 0 or total_empleados == 0:
            cumplimiento = 0.0
        else:
            # Obtener evaluaciones del area
            ev_result = await self.db.execute(
                select(EvaluacionCompetencia).where(
                    EvaluacionCompetencia.empleado_id.in_(
                        select(Empleado.id).where(
                            Empleado.area_id == area_id,
                            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                        )
                    )
                )
            )
            evaluaciones = {
                (e.empleado_id, e.competencia_id): e.nivel_actual
                for e in ev_result.scalars().all()
            }

            if not evaluaciones:
                # Fallback: completitud de definicion
                puestos_con_requisitos = 0
                for p in puestos:
                    reqs = await self.requisito_repo.list_by_puesto(p.id)
                    if reqs:
                        puestos_con_requisitos += 1
                cumplimiento = round(
                    (puestos_con_requisitos / total_puestos) * 100, 1
                ) if total_puestos > 0 else 0.0
            else:
                # Calcular cumplimiento real
                requisitos = await self.requisito_repo.list_by_area(area_id)
                total_score = 0.0
                total_pairs = 0
                emp_ids = [e.id for e in (await self.db.execute(
                    select(Empleado).where(
                        Empleado.area_id == area_id,
                        Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                    )
                )).scalars().all()]

                for req in requisitos:
                    if req.nivel_requerido == 0:
                        continue
                    for emp_id in emp_ids:
                        nivel_actual = evaluaciones.get((emp_id, req.competencia_id), 0)
                        score = min(nivel_actual / req.nivel_requerido, 1.0)
                        total_score += score
                        total_pairs += 1

                cumplimiento = round(
                    (total_score / total_pairs) * 100, 1
                ) if total_pairs > 0 else 0.0

        return ResumenAreaResponse(
            area_id=area_id,
            area_nombre=area.descripcion,
            total_empleados=total_empleados,
            total_puestos_perfil=total_puestos,
            total_competencias=total_competencias,
            requisitos_activos=requisitos_activos,
            cumplimiento_porcentaje=cumplimiento,
        )

    # ── Brechas Criticas ─────────────────────────────────────────────────────

    async def obtener_brechas(self, area_id: int) -> BrechasResponse:
        """
        Calcula brechas criticas por competencia en un area.

        Una brecha se define como: competencia requerida para puestos del area
        donde los empleados asignados a esos puestos NO tienen evaluacion o
        tienen nivel < requerido.

        En Fase 1 (sin evaluaciones individuales), calculamos gap como:
        - Por cada competencia requerida en el area, cuantos empleados
          estan en puestos que la requieren vs. total empleados del area.
        - gap_porcentaje = (empleados_afectados / total_empleados) * 100
        """
        area = await self._get_area(area_id)

        # Empleados activos del area
        result = await self.db.execute(
            select(Empleado)
            .where(
                Empleado.area_id == area_id,
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
            )
        )
        empleados = list(result.scalars().all())
        total_empleados = len(empleados)

        if total_empleados == 0:
            return BrechasResponse(
                area_id=area_id,
                area_nombre=area.descripcion,
                brechas=[],
            )

        # Obtener todos los requisitos del area
        requisitos = await self.requisito_repo.list_by_area(area_id)

        if not requisitos:
            return BrechasResponse(
                area_id=area_id,
                area_nombre=area.descripcion,
                brechas=[],
            )

        # Agrupar por competencia: {comp_id: [requisitos]}
        comp_requisitos: dict[int, list[CompetenciaRequisito]] = {}
        for req in requisitos:
            if req.competencia_id not in comp_requisitos:
                comp_requisitos[req.competencia_id] = []
            comp_requisitos[req.competencia_id].append(req)

        # Obtener evaluaciones del area para calcular gaps reales
        ev_result = await self.db.execute(
            select(EvaluacionCompetencia).where(
                EvaluacionCompetencia.empleado_id.in_(
                    select(Empleado.id).where(
                        Empleado.area_id == area_id,
                        Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                    )
                )
            )
        )
        evaluaciones = {
            (e.empleado_id, e.competencia_id): e.nivel_actual
            for e in ev_result.scalars().all()
        }
        emp_ids = [e.id for e in empleados]

        brechas: list[BrechaItem] = []

        for comp_id, reqs in comp_requisitos.items():
            comp = reqs[0].competencia if reqs[0].competencia else None
            if not comp:
                continue

            niveles = [r.nivel_requerido for r in reqs]
            nivel_promedio = sum(niveles) / len(niveles) if niveles else 0

            # Calcular empleados con gap > 0
            afectados = 0
            for emp_id in emp_ids:
                nivel_actual = evaluaciones.get((emp_id, comp_id), 0)
                if nivel_actual < nivel_promedio:
                    afectados += 1

            gap_porcentaje = round((afectados / total_empleados) * 100, 1)

            brechas.append(BrechaItem(
                competencia_id=comp_id,
                competencia_nombre=comp.nombre,
                categoria=comp.categoria,
                nivel_requerido_promedio=round(nivel_promedio, 1),
                gap_porcentaje=gap_porcentaje,
                empleados_afectados=afectados,
            ))

        # Ordenar por gap descendente
        brechas.sort(key=lambda b: b.gap_porcentaje, reverse=True)

        return BrechasResponse(
            area_id=area_id,
            area_nombre=area.descripcion,
            brechas=brechas,
        )
