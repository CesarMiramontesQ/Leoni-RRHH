# app/schemas/grados_puesto.py
"""
Schemas Pydantic del catalogo de Career Levels (Willis Towers Watson).

El recurso es `/api/v1/career-levels`. La tabla conserva el nombre
`levelup_grados_puesto`: cuatro tablas la referencian por FK y renombrarla es
parte de la limpieza del vocabulario legacy en espanol, no de este cambio.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class GradoPuestoCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    career_path_id: int = Field(..., gt=0)
    codigo: str = Field(
        ...,
        min_length=1,
        max_length=10,
        description=(
            "Codigo del career path seguido de un numero. Ej. P10, M3. "
            "La regla se valida en el servicio, que es quien conoce el path."
        ),
    )
    nombre: str = Field(..., min_length=2, max_length=100)


class GradoPuestoUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    career_path_id: int = Field(..., gt=0)
    codigo: str = Field(
        ...,
        min_length=1,
        max_length=10,
        description="Codigo del career path seguido de un numero. Ej. P10, M3.",
    )
    nombre: str = Field(..., min_length=2, max_length=100)


class GlobalGradeRef(BaseModel):
    """Referencia minima a un Global Grade dentro del tramo de un career level."""

    model_config = {"from_attributes": True}

    id: int
    codigo: str
    orden: int


class GradoPuestoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    career_path_id: int
    career_path_codigo: str | None = None
    career_path_nombre: str | None = None
    codigo: str
    nombre: str
    # Un nivel abarca un TRAMO de global grades (M4 = GG17 + GG18), ordenado por
    # `orden`. Sin equivalencias el nivel no tiene posicion y no puede formar
    # parte del rango de un perfil.
    global_grades: list[GlobalGradeRef] = []
    posicion_desde: int | None = None
    posicion_hasta: int | None = None
    activo: bool
    # Solo lo llena el POST: `true` cuando el codigo pedido ocupaba un nivel
    # desactivado y se reactivo en vez de crear uno nuevo. La UI lo avisa para
    # no hacer pasar por alta lo que fue una restauracion.
    reactivado: bool = False
    created_at: datetime
    updated_at: datetime


class GradoPuestoListResponse(BaseModel):
    items: list[GradoPuestoResponse]
    total: int
    page: int
    page_size: int
