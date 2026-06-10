"""
Reemplaza área/subárea numéricas en incidencias por la descripción del catálogo local.

Uso:
    docker-compose exec backend python -m app.scripts.normalize_incidencia_area_labels
    docker-compose exec backend python -m app.scripts.normalize_incidencia_area_labels --execute
"""

from __future__ import annotations

import argparse
import asyncio
import re

from sqlalchemy import select, update

from app.core.database import AsyncSessionLocal, engine as main_engine
from app.models.catalogos import Area, Subarea
from app.models.incidencias import Incidencia
from app.utils.incidencia_catalog_labels import IncidenciaCatalogLabelMaps, looks_like_catalog_id

_NUMERIC_RE = re.compile(r"^\d+$")


async def _load_maps(session) -> IncidenciaCatalogLabelMaps:
    areas_result = await session.execute(select(Area.area_id, Area.descripcion))
    subs_result = await session.execute(select(Subarea.subarea_id, Subarea.descripcion))
    return IncidenciaCatalogLabelMaps(
        area_by_id={int(aid): str(desc).strip() for aid, desc in areas_result.all()},
        subarea_by_id={int(sid): str(desc).strip() for sid, desc in subs_result.all()},
    )


async def run(*, execute: bool) -> None:
    async with AsyncSessionLocal() as session:
        maps = await _load_maps(session)
        result = await session.execute(
            select(Incidencia.id, Incidencia.area, Incidencia.subarea)
        )
        rows = result.all()
        area_updates = 0
        subarea_updates = 0
        for inc_id, area_raw, subarea_raw in rows:
            new_area = maps.resolve_area(area_raw) if area_raw else None
            new_sub = maps.resolve_subarea(subarea_raw) if subarea_raw else None
            area_changed = (
                area_raw
                and looks_like_catalog_id(str(area_raw))
                and new_area
                and new_area != str(area_raw).strip()
            )
            sub_changed = (
                subarea_raw
                and looks_like_catalog_id(str(subarea_raw))
                and new_sub
                and new_sub != str(subarea_raw).strip()
            )
            if not area_changed and not sub_changed:
                continue
            if execute:
                values: dict = {}
                if area_changed:
                    values["area"] = new_area
                    area_updates += 1
                if sub_changed:
                    values["subarea"] = new_sub
                    subarea_updates += 1
                await session.execute(
                    update(Incidencia).where(Incidencia.id == inc_id).values(**values)
                )
            else:
                if area_changed:
                    area_updates += 1
                if sub_changed:
                    subarea_updates += 1

        if execute:
            await session.commit()
            print(f"Actualizadas {area_updates} áreas y {subarea_updates} subáreas.")
        else:
            print(
                "Dry-run: se actualizarían "
                f"{area_updates} áreas y {subarea_updates} subáreas. "
                "Usa --execute para aplicar."
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Normaliza área/subárea numéricas en incidencias.")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Aplicar cambios (sin este flag solo muestra conteo).",
    )
    args = parser.parse_args()
    async def _main() -> None:
        try:
            await run(execute=args.execute)
        finally:
            await main_engine.dispose()

    asyncio.run(_main())


if __name__ == "__main__":
    main()
