# app/utils/backfill_perfil_tareas_catalogo.py
"""
Vincula tareas de perfil legacy (sin ``tarea_catalogo_id``) al catálogo por coincidencia
exacta de ``descripcion`` con ``TareaCatalogo.nombre``.

Idempotente: solo actualiza filas sin FK y con match único en catálogo activo.

Uso:
    docker-compose exec backend python -m app.utils.backfill_perfil_tareas_catalogo
    docker-compose exec backend python -m app.utils.backfill_perfil_tareas_catalogo --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.talento import PerfilTarea, TareaCatalogo

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


async def backfill(*, dry_run: bool = False) -> tuple[int, int]:
    """Retorna (vinculadas, sin_match)."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PerfilTarea).where(PerfilTarea.tarea_catalogo_id.is_(None))
        )
        legacy = list(result.scalars().all())
        if not legacy:
            logger.info("No hay tareas de perfil sin tarea_catalogo_id.")
            return 0, 0

        catalogo_result = await db.execute(
            select(TareaCatalogo).where(TareaCatalogo.activo.is_(True))
        )
        catalogo_by_nombre: dict[str, TareaCatalogo] = {}
        for t in catalogo_result.scalars().all():
            key = t.nombre.strip()
            if key and key not in catalogo_by_nombre:
                catalogo_by_nombre[key] = t

        vinculadas = 0
        sin_match = 0
        for tarea in legacy:
            key = tarea.descripcion.strip()
            cat = catalogo_by_nombre.get(key)
            if not cat:
                sin_match += 1
                logger.debug("Sin match catálogo: perfil_tarea id=%s descripcion=%r", tarea.id, key)
                continue
            if dry_run:
                logger.info(
                    "[dry-run] Vincularía perfil_tarea id=%s -> catalogo id=%s (%s)",
                    tarea.id,
                    cat.id,
                    cat.nombre,
                )
            else:
                tarea.tarea_catalogo_id = cat.id
                tarea.es_complemento = cat.es_complemento
            vinculadas += 1

        if not dry_run and vinculadas:
            await db.commit()
            logger.info("Vinculadas %s tarea(s) de perfil al catálogo.", vinculadas)
        elif dry_run:
            logger.info("[dry-run] Se vincularían %s tarea(s); %s sin match.", vinculadas, sin_match)
        else:
            logger.info("Ninguna tarea legacy pudo vincularse (%s sin match).", sin_match)

        return vinculadas, sin_match


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Vincula PerfilTarea legacy al catálogo por nombre exacto."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo reporta coincidencias sin escribir en BD.",
    )
    args = parser.parse_args()
    asyncio.run(backfill(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
