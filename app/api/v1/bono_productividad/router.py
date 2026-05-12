"""Endpoints de solo lectura sobre la base externa bono_productividad."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.bono_productividad import (
    BonoIncidenciasListaResponse,
    BonoIncidenciasSyncResponse,
)
from app.services.bono_productividad_incidencias_service import (
    BonoProductividadIncidenciasService,
)
from app.services.bono_productividad_sync_service import BonoProductividadSyncService

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


@router.post(
    "/incidencias/sync",
    response_model=BonoIncidenciasSyncResponse,
    summary="Sincronizar incidencias de bono hacia incidencias locales",
    description=(
        "Lee incidencias desde bono_productividad (solo lectura), mapea a la tabla local `incidencias` "
        "en la BD principal y evita duplicados por llave de origen BONO::<tipo>::<id>. "
        "Por seguridad, `dry_run=true` es el default (no inserta)."
    ),
)
async def sync_incidencias_bono_a_local(
    dry_run: Annotated[
        bool,
        Query(description="Si es true, solo simula y reporta conteos; no inserta."),
    ] = True,
    limit: Annotated[
        int | None,
        Query(
            description="Límite opcional de filas a procesar para corridas controladas.",
            ge=1,
        ),
    ] = None,
    current_user: Empleado = Depends(role_checker(["rh", "director"])),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    service = BonoProductividadSyncService(db)
    return await service.sync_incidencias(
        dry_run=dry_run,
        limit=limit,
    )
