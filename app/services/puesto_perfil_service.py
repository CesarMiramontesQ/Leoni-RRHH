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
from app.utils import career_level_tramo as tramo_util
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
    WtwGradeItem,
    WtwMapaResponse,
    WtwNivelItem,
    WtwNivelSinPosicion,
    WtwPathItem,
)

ESTADOS_PERFIL = ("activo", "inactivo", "en_revision")

# Campos que componen la clasificacion organizacional, con la etiqueta que se
# muestra en el historial.
CAMPOS_CLASIFICACION: tuple[tuple[str, str], ...] = (
    ("career_path", "Career Path"),
    ("funcion", "Funcion"),
    ("disciplina", "Disciplina"),
    ("career_level", "Career Level"),
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
                global_grade_codigo=cls._etiqueta_grades(g),
            )
            for g in cls._ordenar_por_posicion(grados)
        ]

    @classmethod
    def _tramo_del_perfil(cls, perfil: PuestoPerfil) -> str | None:
        """Etiqueta del tramo de global grades que hereda del career level."""
        grados = [g.grado for g in perfil.grados_config if g.grado]
        return cls._etiqueta_grades(grados[0]) if grados else None

    @staticmethod
    def _clasificacion_completa(perfil: PuestoPerfil) -> bool:
        """
        El global grade NO cuenta: dejo de ser un dato del perfil.

        Lo asigna cada persona dentro del tramo de su career level. Exigirlo aqui
        marcaria como «clasificacion pendiente» a todo perfil nuevo.
        """
        return all(
            (
                perfil.career_path_id,
                perfil.funcion_id,
                perfil.disciplina_id,
                bool(perfil.grados_config),
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
            # El perfil ya no tiene global grade propio: se expone el TRAMO que
            # hereda de su career level, informativo. El GG concreto lo lleva
            # cada persona dentro de ese tramo.
            global_grade_id=None,
            global_grade_codigo=cls._tramo_del_perfil(perfil),
            global_grade_nombre=None,
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
        Posicion del career level: el extremo inferior de su tramo de grades.

        El nivel no tiene escala propia y puede abarcar varios global grades
        (M4 = GG17 + GG18). Devuelve None si no hay equivalencias activas, que es
        el unico caso en que un nivel no se puede ubicar.
        """
        return tramo_util.posicion(grado)

    @staticmethod
    def _etiqueta_grades(grado: GradoPuesto) -> str | None:
        """`GG17` o `GG17 - GG18` segun el nivel abarque uno o varios grades."""
        grades = sorted(
            (eq.global_grade for eq in (grado.equivalencias or []) if eq.global_grade),
            key=lambda g: g.orden,
        )
        if not grades:
            return None
        if len(grades) == 1:
            return grades[0].codigo
        return f"{grades[0].codigo} - {grades[-1].codigo}"

    @classmethod
    def _ordenar_por_posicion(cls, grados: list[GradoPuesto]) -> list[GradoPuesto]:
        """Los niveles sin equivalencias van al final; se desempata por codigo."""
        return tramo_util.ordenar(grados)

    async def _validar_grado(self, grado_id: int | None) -> list[GradoPuesto]:
        """
        El career level del perfil. UNO.

        Antes era un rango y habia que validar contiguidad; ya no. El nivel dice
        el tamano del puesto y el global grade concreto se asigna a cada persona
        dentro del tramo de ese nivel, asi que un puesto no necesita abarcar
        varios niveles para admitir gente de distinto peso.

        Devuelve una lista de uno: es lo que espera el resto del servicio y lo
        que la respuesta sigue exponiendo, para no tocar la matriz de
        competencias ni las tareas, que se acotan por nivel.
        """
        # Sin nivel no hay nada que validar. El alta lo exige por schema, pero al
        # editar un perfil anterior a la metodologia puede no tener ninguno, y eso
        # no debe impedir corregirle el nombre.
        if grado_id is None:
            return []
        grados = await self.grado_repo.get_activos_by_ids([grado_id])
        if not grados:
            raise NotFoundError(entidad="GradoPuesto", id=grado_id)

        grado = grados[0]
        # Sin equivalencias el nivel no tiene posicion: no se puede ubicar en la
        # estructura ni saber que global grades admite su gente.
        if self._posicion(grado) is None:
            raise DomainValidationError(
                f"El career level '{grado.codigo}' no tiene una equivalencia de "
                "global grade configurada, asi que no se puede ubicar. Configurala "
                "en Ajustes > Clasificacion."
            )
        return grados

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
                # Un solo nivel: desde y hasta son el mismo. Se conservan las dos
                # columnas para no migrar la tabla del historial.
                "career_level_desde_id": grados[0].id if grados else None,
                "career_level_hasta_id": grados[-1].id if grados else None,
                "global_grade_id": None,
                "estado": perfil.estado,
                "version": perfil.version,
                "cambios": cambios,
                "motivo": motivo,
                "changed_by": current_user.id,
            }
        )

    # ── Resumen Tarjetas ────────────────────────────────────────────────────

    async def mapa_wtw(self) -> WtwMapaResponse:
        """
        La estructura de grados leida como la lamina de Towers.

        Una franja por career path y cada nivel ocupando el ancho de los global
        grades que abarca. No calcula nada: la posicion es la misma que usa el
        rango de un perfil, puesta sobre un eje comun para que se vea que un P4
        y un M1 caen en la misma columna.

        Vive bajo `/api/v1/puestos-perfil` a proposito: los catalogos que tienen
        estos datos pertenecen al modulo `puestos-ajustes`, y la vista debe poder
        consultarla cualquiera que trabaje con perfiles de puesto.
        """
        grades, _ = await self.grade_repo.list_filtered(offset=0, limit=500)
        grades = sorted(grades, key=lambda g: g.orden)

        paths, _ = await self.career_path_repo.list_filtered(offset=0, limit=200)
        # Los niveles traen precargado `equivalencias -> global_grade`; leerlos
        # en lazy dentro de una sesion async revienta con MissingGreenlet.
        niveles, _ = await self.grado_repo.list_filtered(offset=0, limit=500)

        por_path: dict[int, list] = {}
        for nivel in niveles:
            por_path.setdefault(nivel.career_path_id, []).append(nivel)

        items: list[WtwPathItem] = []
        for path in paths:
            del_path = tramo_util.ordenar(por_path.get(path.id, []))
            con_posicion: list[WtwNivelItem] = []
            sin_posicion: list[WtwNivelSinPosicion] = []
            for nivel in del_path:
                t = tramo_util.tramo(nivel)
                if t is None:
                    # Sin equivalencias no se puede ubicar. Se devuelve igual:
                    # ocultarlo mentiria sobre lo que hay en el catalogo.
                    sin_posicion.append(
                        WtwNivelSinPosicion(
                            id=nivel.id, codigo=nivel.codigo, nombre=nivel.nombre
                        )
                    )
                    continue
                codigos = [
                    eq.global_grade.codigo
                    for eq in sorted(
                        (e for e in nivel.equivalencias if e.global_grade),
                        key=lambda e: e.global_grade.orden,
                    )
                ]
                con_posicion.append(
                    WtwNivelItem(
                        id=nivel.id,
                        codigo=nivel.codigo,
                        nombre=nivel.nombre,
                        posicion_desde=t[0],
                        posicion_hasta=t[1],
                        global_grades=codigos,
                    )
                )
            items.append(
                WtwPathItem(
                    id=path.id,
                    codigo=path.codigo,
                    nombre=path.nombre,
                    niveles=con_posicion,
                    sin_posicion=sin_posicion,
                )
            )

        # El eje se recorta a lo que algun career path ocupa: un grade que nadie
        # usa solo agrega columnas vacias y empuja las franjas a la derecha.
        # Se usa la COBERTURA, no los grades con equivalencia: un nivel que
        # abarque GG10 y GG12 pasa tambien por GG11, y sin esa columna su celda
        # no podria dibujarse completa.
        cubiertos = tramo_util.cobertura(niveles)

        return WtwMapaResponse(
            global_grades=[
                WtwGradeItem(id=g.id, codigo=g.codigo, orden=g.orden)
                for g in grades
                if g.orden in cubiertos
            ],
            career_paths=items,
        )

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

        grados = await self._validar_grado(data.grado_id)
        self._validar_estado(data.estado)
        await self._validar_clasificacion(
            data.career_path_id, data.funcion_id, data.disciplina_id, grados
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
            "estado": estado,
            # `activo` sigue siendo el soft-delete y se mantiene alineado con el estado.
            "activo": estado != "inactivo",
            "version": 1,
            "created_by": current_user.id,
            "updated_by": current_user.id,
        })
        await self.repo.set_grados(perfil.id, [data.grado_id])

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
        new_grado_id = (
            data.grado_id
            if data.grado_id is not None
            else next(iter(sorted(current_grado_ids)), None)
        )
        new_grado_ids = [new_grado_id] if new_grado_id is not None else []

        # Duplicado (nombre + area)
        if new_area_id is not None and await self.repo.exists_by_nombre_y_area(
            new_nombre, new_area_id, exclude_id=id
        ):
            raise ConflictError(
                detail=f"Ya existe un perfil de puesto con el nombre '{new_nombre}' en esa área"
            )

        grados_cambio = data.grado_id is not None

        # Foto de la clasificacion ANTES de tocar nada, para el diff del historial.
        clasificacion_previa = await self._snapshot_clasificacion(perfil)

        grados = await self._validar_grado(new_grado_id)

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
