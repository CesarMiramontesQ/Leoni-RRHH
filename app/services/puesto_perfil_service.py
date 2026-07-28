# app/services/puesto_perfil_service.py
"""
Logica de negocio para Puestos Perfil — Modulo Talento Fase 1.

Responsabilidades:
  - CRUD con codigo proporcionado por el usuario (unico)
  - Versionado automatico en actualizaciones
  - Soft-delete (campo activo)
  - Integracion con Ollama para generacion de descripcion + competencias
"""

import json
import logging
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.core.rh_module_registry import user_has_module
from app.models.empleados import Empleado
from app.models.talento import GradoPuesto, PuestoPerfil
from app.repositories.clasificacion_puesto_repository import (
    CareerPathRepository,
    DisciplinaPuestoRepository,
    FuncionPuestoRepository,
    GlobalGradeRepository,
    CareerLevelGradeMappingRepository,
)
from app.repositories.grado_puesto_repository import GradoPuestoRepository
from app.repositories.puesto_perfil_repository import (
    ClasificacionHistorialRepository,
    PuestoPerfilRepository,
)
from app.schemas.talento import (
    ClasificacionCambioItem,
    ClasificacionHistorialItem,
    ClasificacionHistorialResponse,
    GenerarPerfilIARequest,
    GenerarPerfilIAResponse,
    GradoPerfilItem,
    PerfilTarjetaItem,
    PuestoPerfilCreate,
    PuestoPerfilListResponse,
    PuestoPerfilResponse,
    PuestoPerfilUpdate,
    ResumenTarjetasResponse,
)

ESTADOS_PERFIL = ("activo", "inactivo", "en_revision")

# Campos que componen la clasificacion organizacional, con la etiqueta que se
# muestra en el historial.
CAMPOS_CLASIFICACION: tuple[tuple[str, str], ...] = (
    ("career_path", "Career Path"),
    ("funcion", "Funcion"),
    ("disciplina", "Disciplina"),
    ("career_level", "Career Level"),
    ("global_grade", "Global Grade"),
    ("estado", "Estado"),
)

logger = logging.getLogger(__name__)


class PuestoPerfilService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PuestoPerfilRepository(db)
        self.grado_repo = GradoPuestoRepository(db)
        self.career_path_repo = CareerPathRepository(db)
        self.funcion_repo = FuncionPuestoRepository(db)
        self.disciplina_repo = DisciplinaPuestoRepository(db)
        self.grade_repo = GlobalGradeRepository(db)
        self.equivalencia_repo = CareerLevelGradeMappingRepository(db)
        self.historial_repo = ClasificacionHistorialRepository(db)

    # ── Helpers ──────────────────────────────────────────────────────────────

    @classmethod
    def _grados_ordenados(cls, perfil: PuestoPerfil) -> list[GradoPerfilItem]:
        grados = [g.grado for g in perfil.grados_config if g.grado]
        return [
            GradoPerfilItem(
                id=g.id,
                nombre=g.nombre,
                orden=cls._posicion(g),
                codigo=g.codigo,
                career_path_codigo=g.career_path.codigo if g.career_path else None,
                global_grade_codigo=(
                    g.equivalencia.global_grade.codigo
                    if g.equivalencia and g.equivalencia.global_grade
                    else None
                ),
            )
            for g in cls._ordenar_por_posicion(grados)
        ]

    @staticmethod
    def _clasificacion_completa(perfil: PuestoPerfil) -> bool:
        return all(
            (
                perfil.career_path_id,
                perfil.funcion_id,
                perfil.disciplina_id,
                perfil.global_grade_id,
            )
        )

    @classmethod
    def _to_response(
        cls,
        perfil: PuestoPerfil,
        clasificado_por: str | None = None,
        clasificado_en=None,
    ) -> PuestoPerfilResponse:
        area_nombre = perfil.area.descripcion if perfil.area else None
        return PuestoPerfilResponse(
            id=perfil.id,
            codigo=perfil.codigo,
            nombre=perfil.nombre,
            area_id=perfil.area_id,
            area_nombre=area_nombre,
            grados=cls._grados_ordenados(perfil),
            tipo=perfil.tipo,
            descripcion=perfil.descripcion,
            version=perfil.version,
            activo=perfil.activo,
            career_path_id=perfil.career_path_id,
            career_path_codigo=(
                perfil.career_path.codigo if perfil.career_path else None
            ),
            career_path_nombre=(
                perfil.career_path.nombre if perfil.career_path else None
            ),
            funcion_id=perfil.funcion_id,
            funcion_nombre=perfil.funcion.nombre if perfil.funcion else None,
            disciplina_id=perfil.disciplina_id,
            disciplina_nombre=perfil.disciplina.nombre if perfil.disciplina else None,
            global_grade_id=perfil.global_grade_id,
            global_grade_codigo=(
                perfil.global_grade.codigo if perfil.global_grade else None
            ),
            global_grade_nombre=(
                perfil.global_grade.nombre if perfil.global_grade else None
            ),
            estado=perfil.estado,
            clasificacion_completa=cls._clasificacion_completa(perfil),
            clasificado_por=clasificado_por,
            clasificado_en=clasificado_en,
            created_by=perfil.created_by,
            updated_by=perfil.updated_by,
            created_at=perfil.created_at,
            updated_at=perfil.updated_at,
        )

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    # ── Validadores de grados ─────────────────────────────────────────────────

    @staticmethod
    def _posicion(grado: GradoPuesto) -> int | None:
        """
        Posicion del career level: el `orden` de su Global Grade.

        El nivel no tiene escala propia. Devuelve None si no hay equivalencia
        activa configurada, que es el unico caso en que un nivel no se puede
        ubicar.
        """
        equivalencia = grado.equivalencia
        grade = equivalencia.global_grade if equivalencia else None
        return grade.orden if grade else None

    @classmethod
    def _ordenar_por_posicion(cls, grados: list[GradoPuesto]) -> list[GradoPuesto]:
        """Los niveles sin equivalencia van al final; se desempata por codigo."""
        return sorted(
            grados,
            key=lambda g: (cls._posicion(g) is None, cls._posicion(g) or 0, g.codigo),
        )

    async def _validar_grados_consecutivos(
        self, grado_ids: list[int]
    ) -> list[GradoPuesto]:
        # Sin niveles no hay nada que validar. El alta los exige por schema, pero
        # al editar un perfil anterior a la metodologia puede no tener ninguno, y
        # eso no debe impedir corregirle el nombre.
        if not grado_ids:
            return []
        if len(set(grado_ids)) != len(grado_ids):
            raise DomainValidationError("La lista de career levels contiene duplicados")
        grados = await self.grado_repo.get_activos_by_ids(grado_ids)
        if len(grados) != len(grado_ids):
            faltante = next(iter(set(grado_ids) - {g.id for g in grados}))
            raise NotFoundError(entidad="GradoPuesto", id=faltante)

        # Un nivel sin equivalencia no tiene posicion, asi que no se puede saber
        # si el rango es contiguo ni por donde empieza.
        sin_equivalencia = [g for g in grados if self._posicion(g) is None]
        if sin_equivalencia:
            codigos = ", ".join(g.codigo for g in sin_equivalencia)
            raise DomainValidationError(
                f"Los career levels {codigos} no tienen una equivalencia de global "
                "grade configurada, asi que no se puede ubicar el rango del perfil. "
                "Configurala en Ajustes > Clasificacion."
            )

        # Se deduplica a proposito: dos niveles pueden equivaler al mismo global
        # grade —es justo lo que permite comparar un P10 con un M1— y eso no
        # rompe la contiguidad del rango.
        posiciones = sorted({self._posicion(g) for g in grados})
        if posiciones[-1] - posiciones[0] + 1 != len(posiciones):
            raise DomainValidationError(
                "Los career levels del perfil deben ser consecutivos por global "
                f"grade (ordenes recibidos: {posiciones})"
            )
        return self._ordenar_por_posicion(grados)

    # ── Clasificacion organizacional ─────────────────────────────────────────

    async def _validar_clasificacion(
        self,
        career_path_id: int | None,
        funcion_id: int | None,
        disciplina_id: int | None,
        grados: list[GradoPuesto],
    ) -> None:
        """Coherencia entre los catalogos: disciplina∈funcion, niveles∈career path."""
        if career_path_id is not None:
            if not await self.career_path_repo.get_activo(career_path_id):
                raise NotFoundError(entidad="CareerPath", id=career_path_id)
            fuera = [g for g in grados if g.career_path_id != career_path_id]
            if fuera:
                codigos = ", ".join(g.codigo for g in fuera)
                raise DomainValidationError(
                    f"Los career levels {codigos} no pertenecen al career path "
                    "seleccionado"
                )

        if funcion_id is not None and not await self.funcion_repo.get_activo(funcion_id):
            raise NotFoundError(entidad="FuncionPuesto", id=funcion_id)

        if disciplina_id is not None:
            disciplina = await self.disciplina_repo.get_activo(disciplina_id)
            if not disciplina:
                raise NotFoundError(entidad="DisciplinaPuesto", id=disciplina_id)
            if funcion_id is not None and disciplina.funcion_id != funcion_id:
                raise DomainValidationError(
                    f"La disciplina '{disciplina.nombre}' no pertenece a la funcion "
                    "seleccionada"
                )

    async def _resolver_global_grade(
        self, global_grade_id: int | None, grados: list[GradoPuesto]
    ) -> int | None:
        """
        Global grade a guardar: el enviado, o el de la equivalencia del nivel inicial.

        Nunca se calcula: si RH no configuro la equivalencia y no mando uno, se
        devuelve None y el llamador decide si eso es un error.
        """
        if global_grade_id is not None:
            grade = await self.grade_repo.get(global_grade_id)
            if not grade:
                raise NotFoundError(entidad="GlobalGrade", id=global_grade_id)
            if not grade.activo:
                raise DomainValidationError(
                    f"El global grade '{grade.codigo}' esta inactivo y no se puede "
                    "asignar"
                )
            return grade.id

        if not grados:
            return None
        # El nivel inicial del rango es el que define la clasificacion del puesto.
        equivalencia = await self.equivalencia_repo.get_activa_por_career_level(
            grados[0].id
        )
        return equivalencia.global_grade_id if equivalencia else None

    @staticmethod
    def _validar_estado(estado: str | None) -> None:
        if estado is not None and estado not in ESTADOS_PERFIL:
            raise DomainValidationError(
                f"Estado invalido '{estado}'. Valores validos: {', '.join(ESTADOS_PERFIL)}"
            )

    async def _snapshot_clasificacion(self, perfil: PuestoPerfil) -> dict:
        """Valores de clasificacion con su etiqueta legible, para comparar y registrar."""
        grados = self._ordenar_por_posicion(
            [g.grado for g in perfil.grados_config if g.grado]
        )
        rango = ""
        if grados:
            rango = (
                grados[0].codigo
                if len(grados) == 1
                else f"{grados[0].codigo} → {grados[-1].codigo}"
            )
        return {
            "career_path": (
                perfil.career_path_id,
                perfil.career_path.nombre if perfil.career_path else None,
            ),
            "funcion": (
                perfil.funcion_id,
                perfil.funcion.nombre if perfil.funcion else None,
            ),
            "disciplina": (
                perfil.disciplina_id,
                perfil.disciplina.nombre if perfil.disciplina else None,
            ),
            "career_level": (tuple(g.id for g in grados), rango or None),
            "global_grade": (
                perfil.global_grade_id,
                perfil.global_grade.codigo if perfil.global_grade else None,
            ),
            "estado": (perfil.estado, perfil.estado),
            "_grados": grados,
        }

    async def _registrar_clasificacion(
        self,
        perfil: PuestoPerfil,
        anterior: dict | None,
        current_user: Empleado,
        motivo: str | None,
    ) -> None:
        """
        Escribe una fila en la bitacora si algo de la clasificacion cambio.

        La fila guarda la foto del estado resultante y el diff del evento, para que
        la UI pueda pintar la bitacora sin leer la fila previa.
        """
        actual = await self._snapshot_clasificacion(perfil)

        cambios: list[dict] = []
        for campo, etiqueta in CAMPOS_CLASIFICACION:
            valor_anterior = anterior[campo] if anterior else (None, None)
            if valor_anterior[0] == actual[campo][0]:
                continue
            cambios.append(
                {
                    "campo": campo,
                    "etiqueta": etiqueta,
                    "anterior": valor_anterior[1],
                    "nuevo": actual[campo][1],
                }
            )

        if not cambios:
            return

        grados = actual["_grados"]
        await self.historial_repo.create(
            {
                "puesto_perfil_id": perfil.id,
                "career_path_id": perfil.career_path_id,
                "funcion_id": perfil.funcion_id,
                "disciplina_id": perfil.disciplina_id,
                "career_level_desde_id": grados[0].id if grados else None,
                "career_level_hasta_id": grados[-1].id if grados else None,
                "global_grade_id": perfil.global_grade_id,
                "estado": perfil.estado,
                "version": perfil.version,
                "cambios": cambios,
                "motivo": motivo,
                "changed_by": current_user.id,
            }
        )

    # ── Resumen Tarjetas ────────────────────────────────────────────────────

    async def resumen_tarjetas(self) -> ResumenTarjetasResponse:
        rows = await self.repo.get_resumen_tarjetas()
        # Recalcular brechas y % cumplimiento como "requisitos que no cumplen el mínimo del
        # puesto+grado del empleado (incluye pendientes)". Reemplaza el conteo del repo.
        from app.services.perfil_funciones_service import PerfilFuncionesService

        perfil_funciones_service = PerfilFuncionesService(self.db)
        brechas_cumpl = await perfil_funciones_service.brechas_cumplimiento_por_perfil(
            [row["id"] for row in rows]
        )
        for row in rows:
            requeridos, cumplen = brechas_cumpl.get(row["id"], (0, 0))
            row["brechas"] = requeridos - cumplen
            row["cumplimiento_pct"] = (
                round(cumplen / requeridos * 100) if requeridos > 0 else 0
            )
        items = [PerfilTarjetaItem(**row) for row in rows]
        return ResumenTarjetasResponse(items=items)

    # ── Listar ───────────────────────────────────────────────────────────────

    async def listar(
        self,
        page: int,
        page_size: int,
        area_id: int | None = None,
        grado_id: int | None = None,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        funcion_id: int | None = None,
        disciplina_id: int | None = None,
        global_grade_id: int | None = None,
        estado: str | None = None,
        clasificacion_pendiente: bool | None = None,
    ) -> PuestoPerfilListResponse:
        self._validar_estado(estado)
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            area_id=area_id,
            grado_id=grado_id,
            busqueda=busqueda,
            career_path_id=career_path_id,
            funcion_id=funcion_id,
            disciplina_id=disciplina_id,
            global_grade_id=global_grade_id,
            estado=estado,
            clasificacion_pendiente=clasificacion_pendiente,
        )
        return PuestoPerfilListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    # ── Obtener ──────────────────────────────────────────────────────────────

    async def obtener(self, id: int) -> PuestoPerfilResponse:
        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)
        # Quien y cuando registro la clasificacion sale del ultimo evento de la
        # bitacora; solo se resuelve en el detalle para no hacer una consulta por
        # fila en el listado.
        ultimo = await self.historial_repo.ultimo_de_perfil(id)
        clasificado_por = ultimo[1] if ultimo else None
        clasificado_en = ultimo[0].created_at if ultimo else None
        return self._to_response(perfil, clasificado_por, clasificado_en)

    # ── Historial de clasificacion ───────────────────────────────────────────

    async def historial_clasificacion(
        self, id: int, limit: int = 100
    ) -> ClasificacionHistorialResponse:
        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        filas = await self.historial_repo.list_by_perfil(id, limit=limit)
        items = [
            ClasificacionHistorialItem(
                id=fila.id,
                version=fila.version,
                cambios=[
                    ClasificacionCambioItem(**cambio) for cambio in (fila.cambios or [])
                ],
                motivo=fila.motivo,
                changed_by=fila.changed_by,
                changed_by_nombre=nombre,
                created_at=fila.created_at,
            )
            for fila, nombre in filas
        ]
        return ClasificacionHistorialResponse(items=items, total=len(items))

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear(
        self, data: PuestoPerfilCreate, current_user: Empleado
    ) -> PuestoPerfilResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear perfiles de puesto")

        if await self.repo.exists_by_codigo(data.codigo):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el codigo '{data.codigo}'"
            )

        # Verificar duplicado (nombre + area)
        if await self.repo.exists_by_nombre_y_area(data.nombre, data.area_id):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{data.nombre}' en esa área"
            )

        grados = await self._validar_grados_consecutivos(data.grado_ids)
        self._validar_estado(data.estado)
        await self._validar_clasificacion(
            data.career_path_id, data.funcion_id, data.disciplina_id, grados
        )

        global_grade_id = await self._resolver_global_grade(data.global_grade_id, grados)
        if global_grade_id is None:
            raise DomainValidationError(
                f"El career level '{grados[0].codigo}' no tiene una equivalencia de "
                "global grade configurada. Configurala en Ajustes o selecciona el "
                "global grade manualmente."
            )

        estado = data.estado or "activo"
        perfil = await self.repo.create({
            "codigo": data.codigo,
            "nombre": data.nombre,
            "area_id": data.area_id,
            "tipo": data.tipo,
            "descripcion": data.descripcion,
            "career_path_id": data.career_path_id,
            "funcion_id": data.funcion_id,
            "disciplina_id": data.disciplina_id,
            "global_grade_id": global_grade_id,
            "estado": estado,
            # `activo` sigue siendo el soft-delete y se mantiene alineado con el estado.
            "activo": estado != "inactivo",
            "version": 1,
            "created_by": current_user.id,
            "updated_by": current_user.id,
        })
        await self.repo.set_grados(perfil.id, data.grado_ids)

        # Reload with relations
        perfil = await self.repo.get_with_relations(perfil.id)
        await self._registrar_clasificacion(
            perfil, anterior=None, current_user=current_user,
            motivo=data.motivo_clasificacion or "Alta del perfil",
        )
        return self._to_response(perfil)

    # ── Actualizar ───────────────────────────────────────────────────────────

    async def actualizar(
        self, id: int, data: PuestoPerfilUpdate, current_user: Empleado
    ) -> PuestoPerfilResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar perfiles de puesto")

        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        # Resolver valores efectivos (enviados o actuales)
        new_nombre = data.nombre if data.nombre is not None else perfil.nombre
        new_area_id = data.area_id if data.area_id is not None else perfil.area_id
        current_grado_ids = await self.repo.get_grado_ids(id)
        new_grado_ids = (
            data.grado_ids if data.grado_ids is not None else sorted(current_grado_ids)
        )

        # Duplicado (nombre + area)
        if new_area_id is not None and await self.repo.exists_by_nombre_y_area(
            new_nombre, new_area_id, exclude_id=id
        ):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{new_nombre}' en esa área"
            )

        grados_cambio = data.grado_ids is not None

        # Foto de la clasificacion ANTES de tocar nada, para el diff del historial.
        clasificacion_previa = await self._snapshot_clasificacion(perfil)

        # Validar consecutividad si cambian los grados
        grados = await self._validar_grados_consecutivos(new_grado_ids)

        # ── Clasificacion: opcional al editar, pero coherente si se toca ──────
        self._validar_estado(data.estado)
        new_career_path_id = (
            data.career_path_id
            if data.career_path_id is not None
            else perfil.career_path_id
        )
        new_funcion_id = (
            data.funcion_id if data.funcion_id is not None else perfil.funcion_id
        )
        new_disciplina_id = (
            data.disciplina_id
            if data.disciplina_id is not None
            else perfil.disciplina_id
        )
        await self._validar_clasificacion(
            new_career_path_id, new_funcion_id, new_disciplina_id, grados
        )

        # El global grade se re-resuelve cuando cambia el rango de niveles o el
        # career path: seguir con el anterior dejaria una clasificacion incoherente.
        new_global_grade_id = perfil.global_grade_id
        if data.global_grade_id is not None:
            new_global_grade_id = await self._resolver_global_grade(
                data.global_grade_id, grados
            )
        elif grados_cambio or data.career_path_id is not None:
            resuelto = await self._resolver_global_grade(None, grados)
            if resuelto is not None:
                new_global_grade_id = resuelto

        # No permitir quitar grados en uso (requisitos/tareas/asignaciones activas)
        removidos = list(set(current_grado_ids) - set(new_grado_ids))
        if removidos:
            en_uso = await self.repo.grados_en_uso_por_perfil(id, removidos)
            if en_uso:
                detalle = ", ".join(f"{k}: {v}" for k, v in en_uso.items())
                raise ConflictError(
                    detail=f"No se pueden quitar grados en uso ({detalle})"
                )

        # Construir dict de actualizacion (solo campos enviados)
        update_data: dict = {"updated_by": current_user.id}

        if data.codigo is not None and data.codigo != perfil.codigo:
            if await self.repo.exists_by_codigo(data.codigo, exclude_id=id):
                raise ConflictError(
                    detail=f"Ya existe un perfil de puesto con el codigo '{data.codigo}'"
                )
            update_data["codigo"] = data.codigo
        if data.nombre is not None:
            update_data["nombre"] = data.nombre
        if data.area_id is not None:
            update_data["area_id"] = data.area_id
        if data.tipo is not None:
            update_data["tipo"] = data.tipo
        if data.descripcion is not None:
            update_data["descripcion"] = data.descripcion

        update_data["career_path_id"] = new_career_path_id
        update_data["funcion_id"] = new_funcion_id
        update_data["disciplina_id"] = new_disciplina_id
        update_data["global_grade_id"] = new_global_grade_id
        if data.estado is not None:
            update_data["estado"] = data.estado
            update_data["activo"] = data.estado != "inactivo"

        # Incrementar version
        update_data["version"] = perfil.version + 1

        await self.repo.update(id, update_data)

        if grados_cambio:
            await self.repo.set_grados(id, new_grado_ids)

        # Reload
        perfil = await self.repo.get_with_relations(id)
        await self._registrar_clasificacion(
            perfil,
            anterior=clasificacion_previa,
            current_user=current_user,
            motivo=data.motivo_clasificacion,
        )
        return self._to_response(perfil)

    # ── Eliminar ─────────────────────────────────────────────────────────────

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar perfiles de puesto")

        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        # Soft delete
        await self.repo.update(id, {"activo": False, "updated_by": current_user.id})

    # ── Generacion con IA ────────────────────────────────────────────────────

    async def generar_con_ia(
        self, id: int, data: GenerarPerfilIARequest, current_user: Empleado
    ) -> GenerarPerfilIAResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede generar perfiles con IA")

        # Verificar que el puesto existe
        perfil = await self.repo.get_with_relations(id)
        if not perfil:
            raise NotFoundError(entidad="PuestoPerfil", id=id)

        area_nombre = data.area_nombre
        if not area_nombre and perfil.area:
            area_nombre = perfil.area.descripcion

        return await self._llamar_ollama_perfil(data.nombre, area_nombre)

    async def _llamar_ollama_perfil(
        self, nombre_puesto: str, area_nombre: str | None
    ) -> GenerarPerfilIAResponse:
        """Llama a Ollama para generar descripcion y competencias del puesto."""
        area_ctx = f" en el area de {area_nombre}" if area_nombre else ""
        prompt = (
            f"Genera un perfil de puesto para '{nombre_puesto}'{area_ctx} en una empresa "
            f"de manufactura automotriz (arneses/cables) en Mexico.\n\n"
            f"Responde UNICAMENTE con un JSON valido con esta estructura exacta:\n"
            f'{{\n'
            f'  "descripcion": "descripcion general del puesto (2-3 oraciones)",\n'
            f'  "competencias_tecnicas": ["competencia1", "competencia2", ...],\n'
            f'  "habilidades_blandas": ["habilidad1", "habilidad2", ...],\n'
            f'  "maquinas_herramientas": ["maquina1", "herramienta2", ...]\n'
            f'}}\n\n'
            f"Genera entre 5-8 competencias tecnicas, 4-6 habilidades blandas, "
            f"y 3-5 maquinas/herramientas relevantes al puesto."
        )

        system = (
            "Eres un especialista en gestion de talento humano y desarrollo organizacional "
            "en la industria automotriz mexicana. Respondes SOLO con JSON valido sin markdown."
        )

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "system": system,
                        "stream": False,
                        "options": {
                            "temperature": settings.OLLAMA_TEMPERATURE,
                            "num_predict": 1024,
                        },
                    },
                )
                resp.raise_for_status()
                texto = resp.json().get("response", "").strip()

                if not texto:
                    raise ValueError("Respuesta vacia de Ollama")

                # Intentar parsear JSON
                parsed = self._parse_ia_response(texto)
                return parsed

        except httpx.HTTPError as exc:
            logger.warning("Ollama no disponible para generar perfil: %s", exc)
            raise ServiceUnavailableError(
                detail="Servicio de IA no disponible. Intenta mas tarde."
            ) from exc
        except (json.JSONDecodeError, ValueError, KeyError) as exc:
            logger.warning("Error parseando respuesta de Ollama: %s", exc)
            raise ServiceUnavailableError(
                detail="La respuesta de IA no tiene el formato esperado. Intenta nuevamente."
            ) from exc

    @staticmethod
    def _parse_ia_response(texto: str) -> GenerarPerfilIAResponse:
        """Parsea respuesta JSON de Ollama con tolerancia a markdown."""
        # Limpiar posible bloque markdown
        cleaned = texto.strip()
        if cleaned.startswith("```"):
            # Remover ```json y ``` de cierre
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            cleaned = "\n".join(lines)

        data = json.loads(cleaned)

        return GenerarPerfilIAResponse(
            descripcion=data.get("descripcion", ""),
            competencias_tecnicas=data.get("competencias_tecnicas", []),
            habilidades_blandas=data.get("habilidades_blandas", []),
            maquinas_herramientas=data.get("maquinas_herramientas", []),
        )
