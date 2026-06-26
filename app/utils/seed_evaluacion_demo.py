# app/utils/seed_evaluacion_demo.py
"""
Seed demo — Datos completos para visualizar Evaluación Individual vs Perfil Ideal.

Crea: niveles, grados, grupos, tipos, competencias, puesto perfil,
requisitos, PerfilFunciones (asignación empleado→puesto), y evaluaciones.

Idempotente: si ya existe un puesto con código 'DEMO-CAL-001', no hace nada.

Uso:
    docker-compose exec backend python -m app.utils.seed_evaluacion_demo
    docker-compose exec backend python -m app.utils.seed_evaluacion_demo --cleanup
"""

import asyncio
import logging
import sys

from sqlalchemy import select, delete, text

from app.core.database import AsyncSessionLocal
from app.models.talento import (
    AccionRecomendada,
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    GradoPuesto,
    GrupoCompetencia,
    NivelPuesto,
    PerfilFunciones,
    PuestoPerfil,
    TipoCompetencia,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DEMO_PUESTO_CODIGO = "DEMO-CAL-001"
DEMO_EMPLEADO_ID = 553  # RASCON LOPEZ, ANNA DELIA — area 10, estado activo

NIVELES = ["Nivel 1 Operativo", "Nivel 2 Senior", "Nivel 3 Especialista", "Nivel 4 Líder"]
GRADOS = ["Grado 1", "Grado 2", "Grado 3", "Grado 4"]

GRUPOS_TIPOS = {
    "Competencias Técnicas": ["Informática", "Profesional"],
    "Competencias Blandas": ["Social", "Personal", "Métodos"],
}

COMPETENCIAS = [
    # (nombre, tipo_nombre, categoria, nivel_requerido, nivel_actual)
    ("Auditoría Interna", "Profesional", "tecnica", 4, 2),
    ("Análisis de Datos", "Informática", "tecnica", 3, 2),
    ("Gestión de Procesos", "Profesional", "tecnica", 3, 3),
    ("Liderazgo", "Social", "social", 4, 2),
    ("Comunicación", "Social", "social", 4, 3),
    ("Toma de Decisiones", "Personal", "personal", 4, 1),
    ("Trabajo en Equipo", "Social", "social", 3, 3),
    ("Resolución de Problemas", "Métodos", "metodos", 4, 3),
    ("Normatividad ISO", "Profesional", "tecnica", 4, 4),
    ("Planificación", "Métodos", "metodos", 3, 2),
    ("Orientación a Resultados", "Personal", "personal", 3, 3),
    ("Manejo de ERP/SAP", "Informática", "tecnica", 3, 1),
]


async def cleanup():
    """Remove all demo data."""
    async with AsyncSessionLocal() as s:
        puesto_r = await s.execute(
            select(PuestoPerfil).where(PuestoPerfil.codigo == DEMO_PUESTO_CODIGO)
        )
        puesto = puesto_r.scalar_one_or_none()
        if not puesto:
            logger.info("No demo data found.")
            return

        # Delete evaluations for demo employee
        await s.execute(
            delete(EvaluacionCompetencia).where(
                EvaluacionCompetencia.empleado_id == DEMO_EMPLEADO_ID
            )
        )
        # Delete PerfilFunciones
        await s.execute(
            delete(PerfilFunciones).where(PerfilFunciones.puesto_perfil_id == puesto.id)
        )
        # Delete requisitos
        await s.execute(
            delete(CompetenciaRequisito).where(CompetenciaRequisito.puesto_perfil_id == puesto.id)
        )
        # Delete puesto
        await s.execute(delete(PuestoPerfil).where(PuestoPerfil.id == puesto.id))
        await s.commit()
        logger.info("Demo data cleaned up.")


async def seed():
    async with AsyncSessionLocal() as s:
        # Check idempotency
        existing = await s.execute(
            select(PuestoPerfil).where(PuestoPerfil.codigo == DEMO_PUESTO_CODIGO)
        )
        if existing.scalar_one_or_none():
            logger.info("Demo data already exists (puesto %s). Skipping.", DEMO_PUESTO_CODIGO)
            return

        # 1. Create niveles
        nivel_map = {}
        for i, nombre in enumerate(NIVELES, 1):
            r = await s.execute(select(NivelPuesto).where(NivelPuesto.nombre == nombre))
            nivel = r.scalar_one_or_none()
            if not nivel:
                nivel = NivelPuesto(nombre=nombre)
                s.add(nivel)
                await s.flush()
            nivel_map[nombre] = nivel
        logger.info("Niveles: %d", len(nivel_map))

        # 2. Create grados
        grado_map = {}
        for i, nombre in enumerate(GRADOS, 1):
            r = await s.execute(select(GradoPuesto).where(GradoPuesto.nombre == nombre))
            grado = r.scalar_one_or_none()
            if not grado:
                grado = GradoPuesto(nombre=nombre, orden=i)
                s.add(grado)
                await s.flush()
            grado_map[nombre] = grado
        logger.info("Grados: %d", len(grado_map))

        # 3. Create grupos and tipos
        tipo_map = {}
        for grupo_nombre, tipos in GRUPOS_TIPOS.items():
            r = await s.execute(select(GrupoCompetencia).where(GrupoCompetencia.nombre == grupo_nombre))
            grupo = r.scalar_one_or_none()
            if not grupo:
                grupo = GrupoCompetencia(nombre=grupo_nombre)
                s.add(grupo)
                await s.flush()
            for tipo_nombre in tipos:
                r = await s.execute(select(TipoCompetencia).where(TipoCompetencia.nombre == tipo_nombre))
                tipo = r.scalar_one_or_none()
                if not tipo:
                    tipo = TipoCompetencia(nombre=tipo_nombre, grupo_competencia_id=grupo.id)
                    s.add(tipo)
                    await s.flush()
                tipo_map[tipo_nombre] = tipo
        logger.info("Tipos competencia: %d", len(tipo_map))

        # 4. Create puesto perfil
        nivel_puesto = nivel_map["Nivel 2 Senior"]
        puesto = PuestoPerfil(
            codigo=DEMO_PUESTO_CODIGO,
            nombre="Auditor de Calidad Nivel 2",
            nivel_id=nivel_puesto.id,
            area_id=10,  # Cables Especiales
            activo=True,
        )
        s.add(puesto)
        await s.flush()
        logger.info("Puesto: %s (id=%d)", puesto.nombre, puesto.id)

        # 5. Create competencias and requisitos
        grado = grado_map["Grado 2"]
        comp_objs = []
        for nombre, tipo_nombre, categoria, nivel_req, _ in COMPETENCIAS:
            r = await s.execute(select(Competencia).where(Competencia.nombre == nombre))
            comp = r.scalar_one_or_none()
            if not comp:
                comp = Competencia(
                    nombre=nombre,
                    tipo_competencia_id=tipo_map[tipo_nombre].id,
                    categoria=categoria,
                    activo=True,
                )
                s.add(comp)
                await s.flush()
            comp_objs.append(comp)

            # Requisito
            req = CompetenciaRequisito(
                competencia_id=comp.id,
                puesto_perfil_id=puesto.id,
                grado_id=grado.id,
                nivel_requerido=nivel_req,
            )
            s.add(req)

        await s.flush()
        logger.info("Competencias + requisitos: %d", len(comp_objs))

        # 6. Assign employee to puesto (PerfilFunciones)
        pf = PerfilFunciones(
            puesto_perfil_id=puesto.id,
            empleado_id=DEMO_EMPLEADO_ID,
            grado_id=grado.id,
            departamento="Depto Calidad",
            activo=True,
        )
        s.add(pf)
        await s.flush()
        logger.info("PerfilFunciones: empleado %d → puesto %s", DEMO_EMPLEADO_ID, puesto.nombre)

        # 7. Create evaluaciones (simulating partial development)
        for comp, (_, _, _, _, nivel_act) in zip(comp_objs, COMPETENCIAS):
            ev = EvaluacionCompetencia(
                empleado_id=DEMO_EMPLEADO_ID,
                competencia_id=comp.id,
                nivel_actual=nivel_act,
                evaluador_id=DEMO_EMPLEADO_ID,
            )
            s.add(ev)
        await s.flush()
        logger.info("Evaluaciones: %d registros", len(COMPETENCIAS))

        await s.commit()
        logger.info("Done! Visit: http://localhost:5173/#/evaluaciones/empleado/%d", DEMO_EMPLEADO_ID)


async def main():
    if "--cleanup" in sys.argv:
        await cleanup()
    else:
        await seed()


if __name__ == "__main__":
    asyncio.run(main())
