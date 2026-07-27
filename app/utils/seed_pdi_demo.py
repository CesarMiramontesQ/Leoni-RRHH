"""Seed de datos demo para Plan de Desarrollo Individual (PDI).

Uso:
  docker-compose exec backend python -m app.utils.seed_pdi_demo
  docker-compose exec backend python -m app.utils.seed_pdi_demo --cleanup            # dry-run
  docker-compose exec backend python -m app.utils.seed_pdi_demo --cleanup --execute  # borra
"""

import argparse
import asyncio
import logging
from datetime import date

from sqlalchemy import delete, func, select

from app.core.database import AsyncSessionLocal
from app.models.talento import PlanDesarrolloIndividual, Competencia

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


DEMO_EMPLEADOS = [553, 1]

DEMO_DATA_553 = [
    {"competencia": "Auditoría Interna", "accion": "Curso ISO 19011:2018 Auditorías Internas", "tipo": "E-Learning", "duracion": 24, "inicio": "2026-07-01", "fin": "2026-08-15", "responsable": "Dpto. Calidad", "estado": "pendiente"},
    {"competencia": "Liderazgo", "accion": "Programa de Liderazgo Situacional Hersey-Blanchard", "tipo": "Presencial", "duracion": 40, "inicio": "2026-07-15", "fin": "2026-09-30", "responsable": "RH Capacitación", "estado": "en_proceso"},
    {"competencia": "Toma de Decisiones", "accion": "Mentoring con Gerente de Operaciones", "tipo": "Mentoring", "duracion": None, "inicio": "2026-08-01", "fin": "2026-11-30", "responsable": "Lic. García (Gerente Ops)", "estado": "pendiente"},
    {"competencia": "Manejo de ERP/SAP", "accion": "Certificación SAP MM Módulo Materiales", "tipo": "Certificación", "duracion": 60, "inicio": "2026-09-01", "fin": "2026-12-15", "responsable": "SAP Academy", "estado": "pendiente"},
]

DEMO_DATA_1 = [
    {"competencia": "Auditoría Interna", "accion": "Curso avanzado de auditoría de procesos", "tipo": "E-Learning", "duracion": 16, "inicio": "2026-07-01", "fin": "2026-07-31", "responsable": "Dpto. Calidad", "estado": "en_proceso"},
    {"competencia": "Liderazgo", "accion": "Workshop de liderazgo transformacional", "tipo": "Presencial", "duracion": 20, "inicio": "2026-08-01", "fin": "2026-09-15", "responsable": "RH Capacitación", "estado": "pendiente"},
    {"competencia": "Toma de Decisiones", "accion": "Coaching ejecutivo 1:1", "tipo": "Coaching", "duracion": 12, "inicio": "2026-07-15", "fin": "2026-10-15", "responsable": "Coach Externo", "estado": "en_proceso"},
    {"competencia": "Manejo de ERP/SAP", "accion": "Rotación área de compras (SAP práctico)", "tipo": "Rotación", "duracion": None, "inicio": "2026-09-01", "fin": "2027-01-31", "responsable": "Jefe de Compras", "estado": "pendiente"},
    {"competencia": "Comunicación Efectiva", "accion": "Taller de presentaciones ejecutivas", "tipo": "Presencial", "duracion": 8, "inicio": "2026-07-20", "fin": "2026-08-20", "responsable": "RH Capacitación", "estado": "completado"},
]

DEMO_POR_EMPLEADO: list[tuple[int, list[dict]]] = [(553, DEMO_DATA_553), (1, DEMO_DATA_1)]

# Texto exacto de cada acción sembrada. El cleanup filtra por (empleado, acción) para
# no tocar los PDI que RH capture a mano para estos mismos empleados.
ACCIONES_DEMO: dict[int, list[str]] = {
    emp_id: [item["accion"] for item in data] for emp_id, data in DEMO_POR_EMPLEADO
}


async def seed_pdi():
    async with AsyncSessionLocal() as db:
        competencias_result = await db.execute(select(Competencia))
        competencias = {c.nombre: c.id for c in competencias_result.scalars().all()}

        for emp_id, data_list in DEMO_POR_EMPLEADO:
            existing = await db.execute(
                select(PlanDesarrolloIndividual).where(
                    PlanDesarrolloIndividual.empleado_id == emp_id
                )
            )
            if existing.scalars().first():
                print(f"  ⊘ Empleado {emp_id} ya tiene PDI, saltando...")
                continue

            for item in data_list:
                comp_id = competencias.get(item["competencia"])
                if not comp_id:
                    print(f"  ⚠ Competencia '{item['competencia']}' no encontrada, saltando...")
                    continue
                pdi = PlanDesarrolloIndividual(
                    empleado_id=emp_id,
                    competencia_id=comp_id,
                    accion=item["accion"],
                    tipo=item["tipo"],
                    duracion_horas=item["duracion"],
                    fecha_inicio=date.fromisoformat(item["inicio"]),
                    fecha_fin=date.fromisoformat(item["fin"]),
                    responsable=item["responsable"],
                    estado=item["estado"],
                    creado_por=None,
                )
                db.add(pdi)
            print(f"  ✓ Empleado {emp_id}: {len(data_list)} acciones PDI creadas")

        await db.commit()
    print("\n✅ Seed PDI completado.")


async def cleanup_pdi_demo(*, execute: bool) -> None:
    """Borra las acciones PDI sembradas por este script. Dry-run salvo --execute."""
    borrados: dict[int, int] = {}

    async with AsyncSessionLocal() as db:
        for emp_id, acciones in ACCIONES_DEMO.items():
            cond = (
                PlanDesarrolloIndividual.empleado_id == emp_id,
                PlanDesarrolloIndividual.accion.in_(acciones),
            )
            if execute:
                result = await db.execute(delete(PlanDesarrolloIndividual).where(*cond))
                borrados[emp_id] = result.rowcount or 0
            else:
                borrados[emp_id] = (
                    await db.execute(
                        select(func.count()).select_from(PlanDesarrolloIndividual).where(*cond)
                    )
                ).scalar_one()

        if execute:
            await db.commit()

    logger.info("=== Cleanup PDI demo (%s) ===", "ejecutado" if execute else "simulación")
    total = 0
    for emp_id in sorted(borrados):
        logger.info("empleado %-10s %d", emp_id, borrados[emp_id])
        total += borrados[emp_id]
    logger.info("%-20s %d", "TOTAL", total)
    if not execute:
        logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo de PDI.")
    parser.add_argument("--cleanup", action="store_true", help="Borrar los datos demo.")
    parser.add_argument(
        "--execute", action="store_true", help="Con --cleanup, ejecuta el borrado (default dry-run)."
    )
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup_pdi_demo(execute=args.execute))
        return

    asyncio.run(seed_pdi())


if __name__ == "__main__":
    main()
