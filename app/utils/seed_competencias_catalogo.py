# app/utils/seed_competencias_catalogo.py
"""
Seed idempotente — Catálogo de Competencias Demostradas por categoría.

Crea 48 registros en la tabla `competencias` agrupados en 6 subcategorías:
informatica, idiomas, profesional, social, personal, metodos.

Todos usan categoria="tecnica" y subcategoria correspondiente.
Idempotente: no duplica si ya existe un registro con mismo nombre+subcategoria.

Uso:
    docker-compose exec backend python -m app.utils.seed_competencias_catalogo
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.talento import Competencia

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


CATALOGO: dict[str, list[str]] = {
    "informatica": [
        "MS Office",
        "SAP",
        "OEE",
        "MES",
        "LISA",
        "Minitab",
        "MS Project",
        "Software estadístico",
        "Software para visualización del proceso",
    ],
    "idiomas": [
        "Idioma local (Español)",
        "Inglés",
        "Alemán",
    ],
    "profesional": [
        "Conocimientos de procesos de producción",
        "Kanban",
        "Conocimientos de materiales",
        "Conocimientos de productos",
        "Flujo de materiales / FIFO",
        "Inventario",
        "Auditor",
        "Liderazgo / dirección",
        "Manejo de personal",
        "Gestión de calidad",
        "Requisitos específicos del cliente",
        "Extensos conocimientos del departamento",
        "Conocimientos de la maquinaria de la empresa",
        "Control de Activos Fijos",
    ],
    "social": [
        "Capacidad de cooperar y trabajar en equipo",
        "Habilidades de comunicación",
        "Capacidad de gestionar conflictos",
        "Cortesía y amabilidad",
        "Tolerancia",
    ],
    "personal": [
        "Facultad de concentración",
        "Disposición a trabajar y a aprender",
        "Responsabilidad y autonomía",
        "Orientación al cliente y a la calidad",
        "Capacidad de crítica y autocrítica",
        "Creatividad y flexibilidad",
        "Fiabilidad",
    ],
    "metodos": [
        "Capacidad de solucionar problemas",
        "Concepto de mejora de calidad",
        "Competencia como formador",
        "Capacidad de gestionar y de organizar",
        "Competencias en liderazgo",
        "Gestión y planificación del tiempo",
        "Competencia en negociación",
        "Capacidad analítica",
        "Capacidad de dar feedback",
        "Instrumento de calidad",
    ],
}


async def seed_competencias_catalogo() -> None:
    logger.info("═══ Seed: Catálogo de Competencias Demostradas ═══")

    async with AsyncSessionLocal() as db:
        creados = 0
        existentes = 0

        for subcategoria, nombres in CATALOGO.items():
            for nombre in nombres:
                result = await db.execute(
                    select(Competencia).where(
                        Competencia.nombre == nombre,
                        Competencia.subcategoria == subcategoria,
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    existentes += 1
                    continue

                db.add(Competencia(
                    nombre=nombre,
                    categoria="tecnica",
                    subcategoria=subcategoria,
                    descripcion=None,
                    area_id=None,
                    activo=True,
                ))
                creados += 1

            await db.flush()

        await db.commit()

        total = creados + existentes
        logger.info(f"  Total catálogo: {total} competencias en 6 categorías")
        logger.info(f"  Creados: {creados} | Ya existían: {existentes}")

    logger.info("═══ Seed completado ═══")


if __name__ == "__main__":
    asyncio.run(seed_competencias_catalogo())
