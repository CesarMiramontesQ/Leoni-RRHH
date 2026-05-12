"""Endpoints de solo lectura sobre la base externa bono_productividad."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.bono_productividad import BonoIncidenciasListaResponse
from app.services.bono_productividad_incidencias_service import (
    BonoProductividadIncidenciasService,
)

router = APIRouter(
    prefix="/api/v1/bono-productividad",
    tags=["Bono productividad"],
)


@router.get(
    "/incidencias",
    response_model=BonoIncidenciasListaResponse,
    summary="Incidencias consolidadas (calidad, seguridad, progresivo)",
    description=(
        "Sin query params devuelve **todas** las incidencias (activas e históricas) de las seis fuentes. "
        "Use `empleado_id`, `no_empleado`, `tipo` o `semana_id` solo si necesita acotar."
    ),
)
async def listar_incidencias_bono(
    empleado_id: Annotated[
        int | None,
        Query(description="Opcional. Vacío = sin filtro. Filtra por id de empleado."),
    ] = None,
    no_empleado: Annotated[
        str | None,
        Query(description="Opcional. Vacío = sin filtro. Filtra por número de empleado."),
    ] = None,
    tipo: Annotated[
        str | None,
        Query(
            description=(
                "Opcional. Vacío = sin filtro. Origen: calidad, calidad_historico, seguridad, "
                "seguridad_historico, progresivo, progresivo_historico"
            )
        ),
    ] = None,
    semana_id: Annotated[
        int | None,
        Query(description="Opcional. Vacío = sin filtro. Filtra por id de semana."),
    ] = None,
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "director"])),
):
    _ = current_user
    no_empleado = (no_empleado or "").strip() or None
    tipo = (tipo or "").strip() or None
    service = BonoProductividadIncidenciasService()
    return await service.listar_incidencias(
        empleado_id=empleado_id,
        no_empleado=no_empleado,
        tipo=tipo,
        semana_id=semana_id,
    )
