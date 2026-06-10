# app/utils/seed_competencias_catalogo.py
"""
Seed idempotente — Catálogo de Competencias Demostradas por tipo.

Crea registros en `competencias` agrupados por tipo del catalogo `tipos_competencia`.
Idempotente: no duplica si ya existe un registro con mismo nombre+tipo.

Uso:
    docker-compose exec backend python -m app.utils.seed_competencias_catalogo
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.talento import Competencia, TipoCompetencia

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# codigo legacy -> nombre del tipo en catalogo
TIPO_NOMBRES: dict[str, str] = {
    "informatica": "Conocimientos de Informática",
    "idiomas": "Lenguas",
    "profesional": "Competencia profesional",
    "social": "Competencia social",
    "personal": "Competencias personales",
    "metodos": "Competencias en métodos",
}

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


async def _get_tipo_id(db, codigo: str) -> int | None:
    nombre = TIPO_NOMBRES.get(codigo)
    if not nombre:
        return None
    result = await db.execute(
        select(TipoCompetencia).where(TipoCompetencia.nombre == nombre)
    )
    tipo = result.scalar_one_or_none()
    return tipo.id if tipo else None


async def seed_competencias_catalogo() -> None:
    logger.info("═══ Seed: Catálogo de Competencias Demostradas ═══")

    async with AsyncSessionLocal() as db:
        creados = 0
        existentes = 0

        for codigo, nombres in CATALOGO.items():
            tipo_id = await _get_tipo_id(db, codigo)
            if tipo_id is None:
                logger.warning("  Tipo no encontrado para codigo '%s', omitiendo", codigo)
                continue

            result = await db.execute(
                select(TipoCompetencia).where(TipoCompetencia.id == tipo_id)
            )
            tipo = result.scalar_one()
            categoria = tipo.grupo

            for nombre in nombres:
                result = await db.execute(
                    select(Competencia).where(
                        Competencia.nombre == nombre,
                        Competencia.tipo_competencia_id == tipo_id,
                    )
                )
                existing = result.scalar_one_or_none()

                if existing:
                    existentes += 1
                    continue

                db.add(Competencia(
                    nombre=nombre,
                    categoria=categoria,
                    tipo_competencia_id=tipo_id,
                    descripcion=None,
                    area_id=None,
                    activo=True,
                ))
                creados += 1

            await db.flush()

        await db.commit()

        total = creados + existentes
        logger.info(f"  Total catálogo: {total} competencias")
        logger.info(f"  Creados: {creados} | Ya existían: {existentes}")

    logger.info("═══ Seed completado ═══")


if __name__ == "__main__":
    asyncio.run(seed_competencias_catalogo())
