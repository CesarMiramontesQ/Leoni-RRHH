# app/utils/seed_acciones_recomendadas.py
"""
Seed idempotente — Catálogo de Acciones Recomendadas por rango de brecha.

Uso:
    docker-compose exec backend python -m app.utils.seed_acciones_recomendadas
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.talento import AccionRecomendada

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

CATALOGO = [
    {"brecha_min": 0, "brecha_max": 0, "etiqueta": "Mantener Nivel", "color": "green", "orden": 1},
    {"brecha_min": 1, "brecha_max": 30, "etiqueta": "Capacitación Técnica", "color": "yellow", "orden": 2},
    {"brecha_min": 31, "brecha_max": 50, "etiqueta": "Mentoring / Coaching", "color": "orange", "orden": 3},
    {"brecha_min": 51, "brecha_max": 100, "etiqueta": "Intervención Urgente", "color": "red", "orden": 4},
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AccionRecomendada))
        existing = result.scalars().all()

        if existing:
            logger.info("Catálogo ya existe (%d registros). Nada que hacer.", len(existing))
            return

        for item in CATALOGO:
            session.add(AccionRecomendada(**item))

        await session.commit()
        logger.info("Insertados %d registros en levelup_acciones_recomendadas.", len(CATALOGO))


if __name__ == "__main__":
    asyncio.run(main())
