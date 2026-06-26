"""Seed de datos demo para Plan de Desarrollo Individual (PDI).

Uso:
  docker-compose exec backend python -m app.utils.seed_pdi_demo
"""

import asyncio
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.talento import PlanDesarrolloIndividual, Competencia


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


async def seed_pdi():
    async with AsyncSessionLocal() as db:
        competencias_result = await db.execute(select(Competencia))
        competencias = {c.nombre: c.id for c in competencias_result.scalars().all()}

        for emp_id, data_list in [(553, DEMO_DATA_553), (1, DEMO_DATA_1)]:
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


if __name__ == "__main__":
    asyncio.run(seed_pdi())
