"""
Router de la clasificacion de puestos (Willis Towers Watson) — CRUD de catalogos.

Los tres catalogos van bajo un mismo prefijo porque son un solo concepto de negocio
y porque `role_checker` resuelve el modulo RH desde la ruta: un prefijo, una entrada
en el registry.

Endpoints:
  GET/POST      /api/v1/clasificacion-puesto/career-paths
  GET/PATCH/DEL /api/v1/clasificacion-puesto/career-paths/{id}
  GET/POST      /api/v1/clasificacion-puesto/funciones
  GET/PATCH/DEL /api/v1/clasificacion-puesto/funciones/{id}
  GET/POST      /api/v1/clasificacion-puesto/disciplinas      (filtro ?funcion_id=)
  GET/PATCH/DEL /api/v1/clasificacion-puesto/disciplinas/{id}
  GET/POST      /api/v1/clasificacion-puesto/global-grades
  GET/PATCH/DEL /api/v1/clasificacion-puesto/global-grades/{id}
  GET/POST      /api/v1/clasificacion-puesto/equivalencias
  GET           /api/v1/clasificacion-puesto/equivalencias/resolver?career_level_id=
  GET/PATCH/DEL /api/v1/clasificacion-puesto/equivalencias/{id}
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.clasificacion_puesto import (
    CareerPathCreate,
    CareerPathListResponse,
    CareerPathResponse,
    CareerPathUpdate,
    DisciplinaPuestoCreate,
    DisciplinaPuestoListResponse,
    DisciplinaPuestoResponse,
    DisciplinaPuestoUpdate,
    EquivalenciaCreate,
    EquivalenciaListResponse,
    EquivalenciaResponse,
    EquivalenciaUpdate,
    FuncionPuestoCreate,
    FuncionPuestoListResponse,
    FuncionPuestoResponse,
    FuncionPuestoUpdate,
    GlobalGradeCreate,
    GlobalGradeListResponse,
    GlobalGradeResponse,
    GlobalGradeUpdate,
)
from app.services.clasificacion_puesto_service import (
    CareerPathService,
    DisciplinaPuestoService,
    EquivalenciaService,
    FuncionPuestoService,
    GlobalGradeService,
)

router = APIRouter(
    prefix="/api/v1/clasificacion-puesto", tags=["Clasificacion de Puesto"]
)


# ── Career Paths ─────────────────────────────────────────────────────────────


@router.get("/career-paths", response_model=CareerPathListResponse)
async def listar_career_paths(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los career paths del catalogo."""
    return await CareerPathService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "/career-paths",
    response_model=CareerPathResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_career_path(
    body: CareerPathCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un career path. Solo RH."""
    return await CareerPathService(db).crear(data=body, current_user=current_user)


@router.get("/career-paths/{id}", response_model=CareerPathResponse)
async def obtener_career_path(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de un career path."""
    return await CareerPathService(db).obtener(id=id)


@router.patch("/career-paths/{id}", response_model=CareerPathResponse)
async def actualizar_career_path(
    id: int,
    body: CareerPathUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un career path. Solo RH."""
    return await CareerPathService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/career-paths/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_career_path(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un career path (soft delete). Solo RH."""
    await CareerPathService(db).eliminar(id=id, current_user=current_user)


# ── Funciones ────────────────────────────────────────────────────────────────


@router.get("/funciones", response_model=FuncionPuestoListResponse)
async def listar_funciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las funciones (job families) del catalogo."""
    return await FuncionPuestoService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "/funciones",
    response_model=FuncionPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_funcion(
    body: FuncionPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una funcion. Solo RH."""
    return await FuncionPuestoService(db).crear(data=body, current_user=current_user)


@router.get("/funciones/{id}", response_model=FuncionPuestoResponse)
async def obtener_funcion(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una funcion."""
    return await FuncionPuestoService(db).obtener(id=id)


@router.patch("/funciones/{id}", response_model=FuncionPuestoResponse)
async def actualizar_funcion(
    id: int,
    body: FuncionPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una funcion. Solo RH."""
    return await FuncionPuestoService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/funciones/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_funcion(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una funcion (soft delete). Solo RH."""
    await FuncionPuestoService(db).eliminar(id=id, current_user=current_user)


# ── Disciplinas ──────────────────────────────────────────────────────────────


@router.get("/disciplinas", response_model=DisciplinaPuestoListResponse)
async def listar_disciplinas(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    funcion_id: int | None = Query(None, gt=0, description="Filtrar por funcion"),
    busqueda: str | None = Query(None, description="Buscar por nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las disciplinas, opcionalmente acotadas a una funcion."""
    return await DisciplinaPuestoService(db).listar(
        page=page,
        page_size=page_size,
        funcion_id=funcion_id,
        busqueda=busqueda,
        solo_activos=solo_activos,
    )


@router.post(
    "/disciplinas",
    response_model=DisciplinaPuestoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_disciplina(
    body: DisciplinaPuestoCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea una disciplina dentro de una funcion. Solo RH."""
    return await DisciplinaPuestoService(db).crear(
        data=body, current_user=current_user
    )


@router.get("/disciplinas/{id}", response_model=DisciplinaPuestoResponse)
async def obtener_disciplina(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una disciplina."""
    return await DisciplinaPuestoService(db).obtener(id=id)


@router.patch("/disciplinas/{id}", response_model=DisciplinaPuestoResponse)
async def actualizar_disciplina(
    id: int,
    body: DisciplinaPuestoUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una disciplina. Solo RH."""
    return await DisciplinaPuestoService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/disciplinas/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_disciplina(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva una disciplina (soft delete). Solo RH."""
    await DisciplinaPuestoService(db).eliminar(id=id, current_user=current_user)


# ── Global Grades ────────────────────────────────────────────────────────────


@router.get("/global-grades", response_model=GlobalGradeListResponse)
async def listar_global_grades(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
    busqueda: str | None = Query(None, description="Buscar por codigo o nombre"),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista los global grades del catalogo."""
    return await GlobalGradeService(db).listar(
        page=page, page_size=page_size, busqueda=busqueda, solo_activos=solo_activos
    )


@router.post(
    "/global-grades",
    response_model=GlobalGradeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_global_grade(
    body: GlobalGradeCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Crea un global grade. Solo RH."""
    return await GlobalGradeService(db).crear(data=body, current_user=current_user)


@router.get("/global-grades/{id}", response_model=GlobalGradeResponse)
async def obtener_global_grade(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de un global grade."""
    return await GlobalGradeService(db).obtener(id=id)


@router.patch("/global-grades/{id}", response_model=GlobalGradeResponse)
async def actualizar_global_grade(
    id: int,
    body: GlobalGradeUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza un global grade. Solo RH."""
    return await GlobalGradeService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/global-grades/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_global_grade(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Desactiva un global grade (soft delete). Solo RH. Falla si esta asignado."""
    await GlobalGradeService(db).eliminar(id=id, current_user=current_user)


# ── Equivalencias Career Level ↔ Global Grade ────────────────────────────────


@router.get("/equivalencias", response_model=EquivalenciaListResponse)
async def listar_equivalencias(
    page: int = Query(1, ge=1),
    page_size: int = Query(200, ge=1, le=500),
    career_path_id: int | None = Query(None, gt=0),
    solo_activos: bool = Query(True),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista las equivalencias configuradas por RH."""
    return await EquivalenciaService(db).listar(
        page=page,
        page_size=page_size,
        career_path_id=career_path_id,
        solo_activos=solo_activos,
    )


@router.get("/equivalencias/resolver", response_model=list[EquivalenciaResponse])
async def resolver_equivalencia(
    career_level_id: int = Query(..., gt=0),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Global grades a los que equivale un career level, ordenados por `orden`.

    Es una **lista** porque un nivel abarca un tramo: M4 puede ser GG17 y GG18.
    Alimenta el campo de global grade del formulario de perfil, que se acota a
    estos valores: con uno se autocompleta, con varios RH elige. Devolver `[]` no
    es un error — significa que RH aun no configuro la equivalencia y entonces el
    campo queda libre.
    """
    return await EquivalenciaService(db).resolver(career_level_id=career_level_id)


@router.post(
    "/equivalencias",
    response_model=EquivalenciaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def crear_equivalencia(
    body: EquivalenciaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Configura la equivalencia de un career level. Solo RH."""
    return await EquivalenciaService(db).crear(data=body, current_user=current_user)


@router.get("/equivalencias/{id}", response_model=EquivalenciaResponse)
async def obtener_equivalencia(
    id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Detalle de una equivalencia."""
    return await EquivalenciaService(db).obtener(id=id)


@router.patch("/equivalencias/{id}", response_model=EquivalenciaResponse)
async def actualizar_equivalencia(
    id: int,
    body: EquivalenciaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """Actualiza una equivalencia. Solo RH."""
    return await EquivalenciaService(db).actualizar(
        id=id, data=body, current_user=current_user
    )


@router.delete("/equivalencias/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar_equivalencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Desactiva una equivalencia. Solo RH.

    No toca los perfiles que ya la usaron: su global grade quedo grabado en el
    perfil, no se deriva en cada lectura.
    """
    await EquivalenciaService(db).eliminar(id=id, current_user=current_user)
