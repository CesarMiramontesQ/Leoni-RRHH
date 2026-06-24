"""
Seed demo — Acciones PDI para empleado 553.

Crea 4 acciones de desarrollo vinculadas a competencias con brecha.
Requiere que seed_evaluacion_demo haya corrido antes.

Uso:
    docker-compose exec backend python -m app.utils.seed_pdi_demo
    docker-compose exec backend python -m app.utils.seed_pdi_demo --cleanup
"""

import asyncio
import logging
import sys
from datetime import date

from sqlalchemy import select, delete

from app.core.database import AsyncSessionLocal
from app.models.talento import Competencia, PlanDesarrolloIndividual

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DEMO_EMPLEADO_ID = 553
DEMO_CREADOR_ID = 553

ACCIONES = [
    {
        "competencia_nombre": "Auditoría Interna",
        "accion": "Curso avanzado de auditoría interna ISO 19011",
        "tipo": "E-Learning",
        "duracion_horas": 40,
        "fecha_inicio": date(2026, 7, 1),
        "fecha_fin": date(2026, 8, 15),
        "responsable": "Depto. Calidad",
        "estado": "pendiente",
    },
    {
        "competencia_nombre": "Liderazgo",
        "accion": "Programa de mentoring con gerente de área",
        "tipo": "Mentoring",
        "duracion_horas": 20,
        "fecha_inicio": date(2026, 7, 15),
        "fecha_fin": date(2026, 9, 30),
        "responsable": "Gerencia de Operaciones",
        "estado": "en_proceso",
    },
    {
        "competencia_nombre": "Toma de Decisiones",
        "accion": "Taller presencial de toma de decisiones bajo presión",
        "tipo": "Presencial",
        "duracion_horas": 16,
        "fecha_inicio": date(2026, 8, 1),
        "fecha_fin": date(2026, 8, 2),
        "responsable": "RH Capacitación",
        "estado": "pendiente",
    },
    {
        "competencia_nombre": "Manejo de ERP/SAP",
        "accion": "Certificación SAP MM módulo básico",
        "tipo": "Certificación",
        "duracion_horas": 60,
        "fecha_inicio": date(2026, 9, 1),
        "fecha_fin": date(2026, 11, 30),
        "responsable": "Proveedor externo SAP",
        "estado": "pendiente",
    },
]


async def cleanup():
    async with AsyncSessionLocal() as s:
        await s.execute(
            delete(PlanDesarrolloIndividual).where(
                PlanDesarrolloIndividual.empleado_id == DEMO_EMPLEADO_ID
            )
        )
        await s.commit()
        logger.info("PDI demo data cleaned up.")


async def seed():
    async with AsyncSessionLocal() as s:
        existing = await s.execute(
            select(PlanDesarrolloIndividual).where(
                PlanDesarrolloIndividual.empleado_id == DEMO_EMPLEADO_ID
            )
        )
        if existing.scalars().first():
            logger.info("PDI demo data already exists. Skipping.")
            return

        for item in ACCIONES:
            comp_name = item.pop("competencia_nombre")
            r = await s.execute(
                select(Competencia).where(Competencia.nombre == comp_name)
            )
            comp = r.scalar_one_or_none()
            if not comp:
                logger.warning("Competencia '%s' no encontrada, saltando.", comp_name)
                continue

            pdi = PlanDesarrolloIndividual(
                empleado_id=DEMO_EMPLEADO_ID,
                competencia_id=comp.id,
                creado_por=DEMO_CREADOR_ID,
                **item,
            )
            s.add(pdi)

        await s.commit()
        logger.info("PDI demo: %d acciones creadas para empleado %d.", len(ACCIONES), DEMO_EMPLEADO_ID)


async def main():
    if "--cleanup" in sys.argv:
        await cleanup()
    else:
        await seed()


if __name__ == "__main__":
    asyncio.run(main())
