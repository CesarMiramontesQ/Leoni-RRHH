"""Sincronización de catálogos de empleados desde una BD externa (bono / IT)."""

from __future__ import annotations

import logging

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

_CATALOGOS_PLAN = [
    ("areas", "area_id", "Area"),
    ("categorias", "categoria_id", "Categoria"),
    ("subareas", "subarea_id", "Subarea"),
    ("puestos", "puesto_id", "Puesto"),
    ("estados_empleados", "estado_id", "EstadoEmpleado"),
    ("clasificacion_empleado", "clasificacion_id", "ClasificacionEmpleado"),
]


async def sincronizar_catalogos_desde_bd(
    origen_db: AsyncSession,
    rh_db: AsyncSession,
    *,
    log_prefix: str = "CATALOG_SYNC",
) -> None:
    from app.models.catalogos import (
        Area,
        Categoria,
        ClasificacionEmpleado,
        EstadoEmpleado,
        Puesto,
        Subarea,
    )

    modelos = {
        "Area": Area,
        "Categoria": Categoria,
        "Subarea": Subarea,
        "Puesto": Puesto,
        "EstadoEmpleado": EstadoEmpleado,
        "ClasificacionEmpleado": ClasificacionEmpleado,
    }

    for tabla, pk_field, model_name in _CATALOGOS_PLAN:
        Model = modelos[model_name]
        try:
            result = await origen_db.execute(text(f"SELECT * FROM {tabla}"))  # noqa: S608
            rows = [dict(r) for r in result.mappings().all()]
            for row in rows:
                await _upsert_catalogo(rh_db, Model, pk_field, row)
            logger.info("%s | tabla=%s count=%s", log_prefix, tabla, len(rows))
        except Exception as exc:
            logger.warning("%s | tabla=%s error=%s", log_prefix, tabla, exc)


async def _upsert_catalogo(
    rh_db: AsyncSession,
    Model,
    pk_field: str,
    row: dict,
) -> None:
    pk_value = row.get(pk_field)
    if pk_value is None:
        return
    result = await rh_db.execute(
        select(Model).where(getattr(Model, pk_field) == pk_value)
    )
    local = result.scalar_one_or_none()
    clean = {k: v for k, v in row.items() if hasattr(Model, k)}

    if local is None:
        rh_db.add(Model(**clean))
    else:
        for campo, valor in clean.items():
            setattr(local, campo, valor)
