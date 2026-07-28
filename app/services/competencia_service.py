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

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.core.rh_module_registry import user_has_module
from app.models.catalogos import Area
from app.models.empleados import Empleado
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    PerfilFunciones,
    PuestoPerfil,
)
from app.repositories.competencia_repository import (
    CompetenciaRepository,
    CompetenciaRequisitoRepository,
)
from app.repositories.grado_puesto_repository import GradoPuestoRepository
from app.repositories.perfil_funciones_repository import (
    PerfilFuncionesCompetenciaRepository,
    PerfilFuncionesRepository,
)
from app.repositories.puesto_perfil_repository import PuestoPerfilRepository
from app.services.metodo_calificacion_competencia_service import (
    MetodoCalificacionCompetenciaService,
)
from app.services.puesto_perfil_service import PuestoPerfilService
from app.services.tipo_competencia_service import TipoCompetenciaService
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
    MultihabilidadesCompetenciaItem,
    MultihabilidadesEmpleadoItem,
    GradoPerfilItem,
    MetodoCalificacionCompetenciaResumen,
    MultihabilidadesPuestoOption,
    MultihabilidadesResponse,
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
        self.pf_repo = PerfilFuncionesRepository(db)
        self.pf_comp_repo = PerfilFuncionesCompetenciaRepository(db)
        self.grado_repo = GradoPuestoRepository(db)
        self.metodo_competencia_service = MetodoCalificacionCompetenciaService(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _to_response(comp: Competencia) -> CompetenciaResponse:
        area_nombre = None
        if comp.area:
            area_nombre = comp.area.descripcion
        tipo_nombre = comp.tipo_competencia.nombre if comp.tipo_competencia else ""
        tipo_grupo = ""
        if comp.tipo_competencia and comp.tipo_competencia.grupo_competencia:
            tipo_grupo = comp.tipo_competencia.grupo_competencia.codigo
        return CompetenciaResponse(
            id=comp.id,
            nombre=comp.nombre,
            descripcion=comp.descripcion,
            categoria=comp.categoria,
            tipo_competencia_id=comp.tipo_competencia_id,
            tipo_nombre=tipo_nombre,
            tipo_grupo=tipo_grupo,
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
        if not user_has_module(current_user, "competencias"):
            raise ForbiddenError(detail="Solo RH puede crear competencias")

        tipo_service = TipoCompetenciaService(self.db)
        tipo = await tipo_service.validar_tipo_activo(data.tipo_competencia_id)
        categoria = tipo.grupo_competencia.codigo

        if await self.repo.exists_by_nombre_categoria(data.nombre, categoria):
            raise ConflictError(
                detail=f"Ya existe una competencia '{data.nombre}' con categoria '{categoria}'"
            )

        comp = await self.repo.create({
            "nombre": data.nombre,
            "descripcion": data.descripcion,
            "categoria": categoria,
            "tipo_competencia_id": tipo.id,
            "area_id": data.area_id,
            "activo": True,
        })

        comp = await self.repo.get_with_relations(comp.id)
        return self._to_response(comp)

    # ── Actualizar ───────────────────────────────────────────────────────────

    async def actualizar(
        self, id: int, data: CompetenciaUpdate, current_user: Empleado
    ) -> CompetenciaResponse:
        if not user_has_module(current_user, "competencias"):
            raise ForbiddenError(detail="Solo RH puede actualizar competencias")

        comp = await self.repo.get_with_relations(id)
        if not comp:
            raise NotFoundError(entidad="Competencia", id=id)

        tipo_service = TipoCompetenciaService(self.db)
        nuevo_tipo_id = data.tipo_competencia_id or comp.tipo_competencia_id
        tipo = await tipo_service.validar_tipo_activo(nuevo_tipo_id)
        categoria_check = tipo.grupo_competencia.codigo

        nombre_check = data.nombre or comp.nombre
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
        if data.tipo_competencia_id is not None:
            update_data["tipo_competencia_id"] = tipo.id
            update_data["categoria"] = tipo.grupo_competencia.codigo
        if data.area_id is not None:
            update_data["area_id"] = data.area_id

        if update_data:
            await self.repo.update(id, update_data)

        comp = await self.repo.get_with_relations(id)
        return self._to_response(comp)

    # ── Puestos asociados ──────────────────────────────────────────────────

    async def listar_puestos_asociados(self, id: int) -> list[dict]:
        """Lista puestos que tienen esta competencia como requisito."""
        comp = await self.repo.get_with_relations(id)
        if not comp:
            raise NotFoundError(entidad="Competencia", id=id)

        result = await self.db.execute(
            select(PuestoPerfil.id, PuestoPerfil.codigo, PuestoPerfil.nombre)
            .join(CompetenciaRequisito, CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id)
            .where(
                CompetenciaRequisito.competencia_id == id,
                PuestoPerfil.activo.is_(True),
            )
            .order_by(PuestoPerfil.nombre)
        )
        return [{"id": r.id, "codigo": r.codigo, "nombre": r.nombre} for r in result.all()]

    # ── Eliminar ─────────────────────────────────────────────────────────────

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "competencias"):
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
            # La posicion del nivel es la de su global grade; reutiliza el mismo
            # criterio que el servicio de perfiles para que la matriz y el detalle
            # ordenen igual.
            grados = PuestoPerfilService._grados_ordenados(p)
            puestos_response.append(PuestoPerfilResponse(
                id=p.id,
                codigo=p.codigo,
                nombre=p.nombre,
                area_id=p.area_id,
                area_nombre=area.descripcion,
                grados=grados,
                tipo=p.tipo,
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
        if not user_has_module(current_user, "competencias"):
            raise ForbiddenError(detail="Solo RH puede actualizar la matriz de competencias")

        # La matriz por area no distingue career level, asi que escribe el requisito
        # GENERAL del perfil (grado_id NULL), que es el mecanismo que introdujo la
        # migracion g2r3a4d5o6s7 y que el indice parcial unico ya soporta.
        # Antes fijaba el grado de orden 1; con Career Paths ese orden dejo de ser
        # unico (P1 y M1 comparten orden) y la consulta era ambigua.
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

            # Validar nivel contra catalogo configurado
            if celda.nivel_requerido < 0:
                errores.append(
                    f"Nivel {celda.nivel_requerido} invalido para "
                    f"competencia={celda.competencia_id}, puesto={celda.puesto_perfil_id}"
                )
                continue
            if celda.nivel_requerido > 0:
                try:
                    await self.metodo_competencia_service.validar_nivel_requerido(
                        celda.nivel_requerido
                    )
                except DomainValidationError as exc:
                    errores.append(
                        f"{exc.detail} (competencia={celda.competencia_id}, "
                        f"puesto={celda.puesto_perfil_id})"
                    )
                    continue

            await self.requisito_repo.upsert(
                competencia_id=celda.competencia_id,
                puesto_perfil_id=celda.puesto_perfil_id,
                grado_id=None,
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

    # ── Multihabilidades ────────────────────────────────────────────────────

    async def listar_puestos_multihabilidades(self) -> list[MultihabilidadesPuestoOption]:
        """Lista puestos que tienen al menos 1 competencia requisito asignada."""
        result = await self.db.execute(
            select(
                PuestoPerfil.id,
                PuestoPerfil.codigo,
                PuestoPerfil.nombre,
                func.count(distinct(CompetenciaRequisito.competencia_id)).label("num_competencias"),
                func.count(PerfilFunciones.id.distinct()).label("num_empleados"),
            )
            .join(
                CompetenciaRequisito,
                CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id,
            )
            .outerjoin(
                PerfilFunciones,
                (PerfilFunciones.puesto_perfil_id == PuestoPerfil.id)
                & (PerfilFunciones.activo.is_(True)),
            )
            .where(PuestoPerfil.activo.is_(True))
            .group_by(PuestoPerfil.id, PuestoPerfil.codigo, PuestoPerfil.nombre)
            .order_by(PuestoPerfil.nombre)
        )
        rows = result.all()
        return [
            MultihabilidadesPuestoOption(
                id=r.id,
                codigo=r.codigo,
                nombre=r.nombre,
                num_competencias=r.num_competencias,
                num_empleados=r.num_empleados,
            )
            for r in rows
        ]

    async def obtener_multihabilidades(
        self, puesto_perfil_id: int, nombre_filtro: str | None = None
    ) -> MultihabilidadesResponse:
        """Matriz multihabilidades: empleados x competencias para un puesto."""
        puesto = await self.puesto_repo.get_with_relations(puesto_perfil_id)
        if not puesto:
            raise NotFoundError(entidad="PuestoPerfil", id=puesto_perfil_id)

        requisitos = await self.requisito_repo.list_by_puesto_with_competencia(
            puesto_perfil_id
        )

        if not requisitos:
            metodos = await MetodoCalificacionCompetenciaService(self.db).listar_resumen()
            return MultihabilidadesResponse(
                puesto_perfil_id=puesto.id,
                puesto_nombre=puesto.nombre,
                competencias=[],
                empleados=[],
                metodos_calificacion=[
                    MetodoCalificacionCompetenciaResumen(
                        valor=m.valor, nombre=m.nombre, orden=m.orden
                    )
                    for m in metodos
                ],
            )

        asignaciones = await self.pf_repo.list_by_perfil(puesto_perfil_id)

        if nombre_filtro:
            filtro = nombre_filtro.lower()
            asignaciones = [
                a for a in asignaciones
                if filtro in a.empleado.nombre.lower()
            ]

        req_by_id = {r.id: r for r in requisitos}
        req_by_grado_comp: dict[tuple[int, int], CompetenciaRequisito] = {
            (r.grado_id, r.competencia_id): r for r in requisitos
        }

        seen_comp_ids: set[int] = set()
        competencias_out: list[MultihabilidadesCompetenciaItem] = []
        for r in requisitos:
            if r.competencia_id in seen_comp_ids:
                continue
            seen_comp_ids.add(r.competencia_id)
            competencias_out.append(
                MultihabilidadesCompetenciaItem(
                    competencia_id=r.competencia_id,
                    competencia_nombre=r.competencia.nombre,
                    tipo_competencia_id=r.competencia.tipo_competencia_id,
                    tipo_nombre=(
                        r.competencia.tipo_competencia.nombre
                        if r.competencia and r.competencia.tipo_competencia
                        else ""
                    ),
                    nivel_requerido=0,
                )
            )

        empleados_out: list[MultihabilidadesEmpleadoItem] = []
        for asig in asignaciones:
            evals = await self.pf_comp_repo.list_by_asignacion(asig.id)
            niveles: dict[int, int] = {}
            requisitos_emp: dict[int, int] = {}

            for comp_id in seen_comp_ids:
                req = req_by_grado_comp.get((asig.grado_id, comp_id))
                if req:
                    requisitos_emp[comp_id] = req.nivel_requerido

            for ev in evals:
                req = req_by_id.get(ev.competencia_requisito_id)
                if req is None or req.grado_id != asig.grado_id:
                    continue
                try:
                    niveles[req.competencia_id] = int(ev.situacion_actual)
                except (ValueError, TypeError):
                    pass

            empleados_out.append(
                MultihabilidadesEmpleadoItem(
                    empleado_id=asig.empleado_id,
                    nombre=asig.empleado.nombre,
                    no_empleado=asig.empleado.no_empleado,
                    grado_id=asig.grado_id,
                    grado_nombre=asig.grado.nombre if asig.grado else "",
                    niveles=niveles,
                    requisitos=requisitos_emp,
                )
            )

        metodos = await MetodoCalificacionCompetenciaService(self.db).listar_resumen()

        return MultihabilidadesResponse(
            puesto_perfil_id=puesto.id,
            puesto_nombre=puesto.nombre,
            competencias=competencias_out,
            empleados=empleados_out,
            metodos_calificacion=[
                MetodoCalificacionCompetenciaResumen(
                    valor=m.valor, nombre=m.nombre, orden=m.orden
                )
                for m in metodos
            ],
        )
