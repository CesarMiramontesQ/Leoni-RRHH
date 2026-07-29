# app/services/grado_puesto_service.py
"""
Logica de negocio del catalogo de Career Levels (Willis Towers Watson).

Cada nivel pertenece a un career path y su codigo/nombre son unicos DENTRO de ese
path, no en toda la tabla: P1 y M1 conviven.

El codigo ademas lo dicta el path: es su codigo seguido de un numero (ver
`app/utils/career_level_codigo.py`).
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ConflictError,
    DomainValidationError,
    ForbiddenError,
    NotFoundError,
)
from app.core.rh_module_registry import user_has_module
from app.models.clasificacion_puesto import CareerPath
from app.models.empleados import Empleado
from app.models.talento import GradoPuesto
from app.repositories.clasificacion_puesto_repository import CareerPathRepository
from app.repositories.grado_puesto_repository import GradoPuestoRepository
from app.schemas.grados_puesto import (
    GlobalGradeRef,
    GradoPuestoCreate,
    GradoPuestoListResponse,
    GradoPuestoResponse,
    GradoPuestoUpdate,
)
from app.utils.career_level_codigo import normalizar_codigo


class GradoPuestoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = GradoPuestoRepository(db)
        self.career_path_repo = CareerPathRepository(db)

    @staticmethod
    def _get_rol(user: Empleado) -> str:
        return user.rol.nombre if user.rol else "empleado"

    @staticmethod
    def _to_response(
        grado: GradoPuesto, *, reactivado: bool = False
    ) -> GradoPuestoResponse:
        career_path = grado.career_path
        # Un nivel abarca un TRAMO de grades (M4 = GG17 + GG18), no uno solo.
        grades = sorted(
            (eq.global_grade for eq in (grado.equivalencias or []) if eq.global_grade),
            key=lambda g: g.orden,
        )
        return GradoPuestoResponse(
            id=grado.id,
            career_path_id=grado.career_path_id,
            career_path_codigo=career_path.codigo if career_path else None,
            career_path_nombre=career_path.nombre if career_path else None,
            codigo=grado.codigo,
            nombre=grado.nombre,
            global_grades=[
                GlobalGradeRef(id=g.id, codigo=g.codigo, orden=g.orden) for g in grades
            ],
            posicion_desde=grades[0].orden if grades else None,
            posicion_hasta=grades[-1].orden if grades else None,
            activo=grado.activo,
            reactivado=reactivado,
            created_at=grado.created_at,
            updated_at=grado.updated_at,
        )

    async def listar(
        self,
        page: int,
        page_size: int,
        busqueda: str | None = None,
        career_path_id: int | None = None,
        solo_activos: bool = True,
    ) -> GradoPuestoListResponse:
        offset = (page - 1) * page_size
        items, total = await self.repo.list_filtered(
            offset=offset,
            limit=page_size,
            busqueda=busqueda,
            career_path_id=career_path_id,
            solo_activos=solo_activos,
        )
        return GradoPuestoListResponse(
            items=[self._to_response(i) for i in items],
            total=total,
            page=page,
            page_size=page_size,
        )

    async def obtener(self, id: int) -> GradoPuestoResponse:
        grado = await self.repo.get_with_career_path(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)
        return self._to_response(grado)

    async def _validar_career_path(self, career_path_id: int) -> CareerPath:
        career_path = await self.career_path_repo.get_activo(career_path_id)
        if not career_path:
            raise NotFoundError(entidad="CareerPath", id=career_path_id)
        return career_path

    @staticmethod
    def _normalizar_codigo(career_path: CareerPath, codigo: str) -> str:
        """
        El codigo lo dicta el career path del payload, no el que tenga el nivel.

        Se normaliza ANTES de comprobar unicidad: si no, 'p10' y 'P10' se verian
        como codigos distintos dentro del mismo path.
        """
        try:
            return normalizar_codigo(career_path.codigo, codigo)
        except ValueError as e:
            raise DomainValidationError(
                f"El codigo de un career level del career path "
                f"'{career_path.nombre}' {e}"
            ) from e

    async def _validar_unicidad(
        self,
        data: GradoPuestoCreate | GradoPuestoUpdate,
        codigo: str,
        exclude_id: int | None = None,
    ) -> None:
        """
        Duplicados contra TODAS las filas, activas o no.

        Las uniques de la tabla no distinguen `activo`, asi que comprobar solo
        los activos dejaba pasar el duplicado hasta el INSERT: 500 en vez de 409.
        """
        choque = await self.repo.get_por_codigo(
            data.career_path_id, codigo, exclude_id=exclude_id
        )
        if choque:
            raise ConflictError(detail=self._detalle_choque(choque, f"codigo '{codigo}'"))

        choque = await self.repo.get_por_nombre(
            data.career_path_id, data.nombre, exclude_id=exclude_id
        )
        if choque:
            raise ConflictError(
                detail=self._detalle_choque(choque, f"nombre '{data.nombre}'")
            )

    @staticmethod
    def _detalle_choque(choque: GradoPuesto, que: str) -> str:
        estado = "" if choque.activo else " (esta desactivado)"
        return f"Ya existe un career level con {que} en ese career path{estado}"

    async def crear(
        self, data: GradoPuestoCreate, current_user: Empleado
    ) -> GradoPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede crear career levels")

        career_path = await self._validar_career_path(data.career_path_id)
        codigo = self._normalizar_codigo(career_path, data.codigo)

        # Crear un codigo que ocupa un nivel DESACTIVADO lo reactiva, en vez de
        # chocar contra la unique. Se conserva su id para que nada de lo que lo
        # referenciaba quede huerfano: es exactamente lo que implica un borrado
        # suave, y sin esto el codigo quedaba quemado para siempre (no hay
        # pantalla para reactivar).
        desactivado = await self.repo.get_por_codigo(data.career_path_id, codigo)
        if desactivado and not desactivado.activo:
            await self._validar_unicidad(data, codigo, exclude_id=desactivado.id)
            await self.repo.update(
                desactivado.id, {"nombre": data.nombre, "activo": True}
            )
            return self._to_response(
                await self.repo.get_with_career_path(desactivado.id), reactivado=True
            )

        await self._validar_unicidad(data, codigo)

        grado = await self.repo.create({
            "career_path_id": data.career_path_id,
            "codigo": codigo,
            "nombre": data.nombre,
            "activo": True,
        })
        return self._to_response(await self.repo.get_with_career_path(grado.id))

    async def actualizar(
        self, id: int, data: GradoPuestoUpdate, current_user: Empleado
    ) -> GradoPuestoResponse:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede actualizar career levels")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        career_path = await self._validar_career_path(data.career_path_id)
        codigo = self._normalizar_codigo(career_path, data.codigo)
        await self._validar_unicidad(data, codigo, exclude_id=id)

        # Mover un nivel de career path rompe los perfiles que ya lo usan: sus
        # grados dejarian de compartir path y el rango quedaria invalido.
        if data.career_path_id != grado.career_path_id:
            requisitos = await self.repo.count_requisitos_usando(id)
            asignaciones = await self.repo.count_asignaciones_usando(id)
            if requisitos > 0 or asignaciones > 0:
                raise ConflictError(
                    detail=(
                        f"No se puede mover '{grado.nombre}' a otro career path "
                        f"porque esta en uso ({requisitos} requisito(s), "
                        f"{asignaciones} asignacion(es) activa(s))"
                    )
                )

        await self.repo.update(
            id,
            {
                "career_path_id": data.career_path_id,
                "codigo": codigo,
                "nombre": data.nombre,
            },
        )
        return self._to_response(await self.repo.get_with_career_path(id))

    async def eliminar(self, id: int, current_user: Empleado) -> None:
        if not user_has_module(current_user, "puestos"):
            raise ForbiddenError(detail="Solo RH puede eliminar career levels")

        grado = await self.repo.get(id)
        if not grado or not grado.activo:
            raise NotFoundError(entidad="GradoPuesto", id=id)

        requisitos = await self.repo.count_requisitos_usando(id)
        asignaciones = await self.repo.count_asignaciones_usando(id)
        if requisitos > 0 or asignaciones > 0:
            raise ConflictError(
                detail=(
                    f"No se puede eliminar el career level '{grado.nombre}' "
                    f"porque esta en uso ({requisitos} requisito(s), "
                    f"{asignaciones} asignacion(es) activa(s))"
                )
            )

        await self.repo.update(id, {"activo": False})

    async def validar_grado_activo(self, grado_id: int) -> GradoPuesto:
        grado = await self.repo.get_activo(grado_id)
        if not grado:
            raise NotFoundError(entidad="GradoPuesto", id=grado_id)
        return grado
