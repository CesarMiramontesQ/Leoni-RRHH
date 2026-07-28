# app/utils/seed_evaluacion_demo.py
"""
Seed demo — Datos completos para visualizar Evaluación Individual vs Perfil Ideal.

Crea: niveles, grados, grupos, tipos, competencias, puesto perfil,
requisitos, PerfilFunciones (asignación empleado→puesto), y evaluaciones.

Idempotente: si ya existe un puesto con código 'DEMO-CAL-001', no hace nada.

Uso:
    docker-compose exec backend python -m app.utils.seed_evaluacion_demo
    docker-compose exec backend python -m app.utils.seed_evaluacion_demo --cleanup
    docker-compose exec backend python -m app.utils.seed_evaluacion_demo --cleanup --execute
"""

import argparse
import asyncio
import logging

from sqlalchemy import select, delete

from app.core.database import AsyncSessionLocal
from app.utils.clasificacion_bootstrap import get_or_create_career_path
from app.utils.competencia_categoria import slug_codigo_grupo
from app.utils.demo_residuo import (
    REFERENTES_COMPETENCIA,
    REFERENTES_GRUPO,
    REFERENTES_TIPO,
    ids_libres,
)
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    GradoPuesto,
    GrupoCompetencia,
    PerfilFunciones,
    PerfilFuncionesCompetencia,
    PuestoPerfil,
    PuestoPerfilGrado,
    TipoCompetencia,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DEMO_PUESTO_CODIGO = "DEMO-CAL-001"
DEMO_EMPLEADO_ID = 553  # RASCON LOPEZ, ANNA DELIA — area 10, estado activo

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


async def cleanup_evaluacion_demo(*, execute: bool) -> None:
    """Borra el demo de evaluación y su residuo de catálogo. Dry-run salvo --execute.

    Todo corre dentro de una transacción: en dry-run se hace rollback al final, así que
    los conteos reportados son los reales (ven el efecto de los borrados previos).
    """
    borrados: dict[str, int] = {}

    async def _borrar(etiqueta: str, stmt) -> None:
        result = await s.execute(stmt)
        borrados[etiqueta] = borrados.get(etiqueta, 0) + (result.rowcount or 0)

    async with AsyncSessionLocal() as s:
        puesto_id = (
            await s.execute(
                select(PuestoPerfil.id).where(PuestoPerfil.codigo == DEMO_PUESTO_CODIGO)
            )
        ).scalar_one_or_none()

        comp_ids = list(
            (
                await s.execute(
                    select(Competencia.id).where(
                        Competencia.nombre.in_([nombre for nombre, *_ in COMPETENCIAS])
                    )
                )
            )
            .scalars()
            .all()
        )

        if puesto_id is not None:
            pf_ids = list(
                (
                    await s.execute(
                        select(PerfilFunciones.id).where(
                            PerfilFunciones.puesto_perfil_id == puesto_id
                        )
                    )
                )
                .scalars()
                .all()
            )
            if pf_ids:
                await _borrar(
                    "niveles_evaluados",
                    delete(PerfilFuncionesCompetencia).where(
                        PerfilFuncionesCompetencia.perfil_funciones_id.in_(pf_ids)
                    ),
                )

        # Solo las evaluaciones del empleado demo sobre las competencias del demo:
        # las que RH haya capturado sobre otras competencias se conservan.
        if comp_ids:
            await _borrar(
                "evaluaciones",
                delete(EvaluacionCompetencia).where(
                    EvaluacionCompetencia.empleado_id == DEMO_EMPLEADO_ID,
                    EvaluacionCompetencia.competencia_id.in_(comp_ids),
                ),
            )

        if puesto_id is not None:
            await _borrar(
                "asignaciones",
                delete(PerfilFunciones).where(PerfilFunciones.puesto_perfil_id == puesto_id),
            )
            await _borrar(
                "requisitos",
                delete(CompetenciaRequisito).where(
                    CompetenciaRequisito.puesto_perfil_id == puesto_id
                ),
            )
            await _borrar(
                "puesto_perfil_grados",
                delete(PuestoPerfilGrado).where(PuestoPerfilGrado.puesto_perfil_id == puesto_id),
            )
            await _borrar(
                "puestos_perfil", delete(PuestoPerfil).where(PuestoPerfil.id == puesto_id)
            )

        # Residuo de catálogo: competencias → tipos → grupos → grados.
        if comp_ids:
            libres = await ids_libres(s, comp_ids, REFERENTES_COMPETENCIA)
            if libres:
                await _borrar(
                    "competencias", delete(Competencia).where(Competencia.id.in_(libres))
                )

        tipo_ids = list(
            (
                await s.execute(
                    select(TipoCompetencia.id).where(
                        TipoCompetencia.nombre.in_(
                            [t for tipos in GRUPOS_TIPOS.values() for t in tipos]
                        )
                    )
                )
            )
            .scalars()
            .all()
        )
        if tipo_ids:
            libres = await ids_libres(s, tipo_ids, REFERENTES_TIPO)
            if libres:
                await _borrar(
                    "tipos_competencia",
                    delete(TipoCompetencia).where(TipoCompetencia.id.in_(libres)),
                )

        grupo_ids = list(
            (
                await s.execute(
                    select(GrupoCompetencia.id).where(
                        GrupoCompetencia.nombre.in_(list(GRUPOS_TIPOS))
                    )
                )
            )
            .scalars()
            .all()
        )
        if grupo_ids:
            libres = await ids_libres(s, grupo_ids, REFERENTES_GRUPO)
            if libres:
                await _borrar(
                    "grupos_competencia",
                    delete(GrupoCompetencia).where(GrupoCompetencia.id.in_(libres)),
                )

        # Los grados NO se borran: son catálogo base de la plataforma (el seed solo los
        # crea si faltan) y `seed_talento_demo._grados_activos` exige que existan. Que
        # ahora nadie los referencie no los vuelve residuo demo.
        grados = list(
            (
                await s.execute(
                    select(GradoPuesto.nombre).where(GradoPuesto.nombre.in_(GRADOS))
                )
            )
            .scalars()
            .all()
        )
        if grados:
            logger.info(
                "Se conservan %d grados de puesto (catálogo base): %s",
                len(grados),
                ", ".join(sorted(set(grados))),
            )

        if execute:
            await s.commit()
        else:
            await s.rollback()

    logger.info("=== Cleanup evaluación demo (%s) ===", "ejecutado" if execute else "simulación")
    total = 0
    for etiqueta in sorted(borrados):
        if borrados[etiqueta]:
            logger.info("%-24s %d", etiqueta, borrados[etiqueta])
            total += borrados[etiqueta]
    logger.info("%-24s %d", "TOTAL", total)
    if not execute:
        logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")


async def seed():
    async with AsyncSessionLocal() as s:
        # Check idempotency
        existing = await s.execute(
            select(PuestoPerfil).where(PuestoPerfil.codigo == DEMO_PUESTO_CODIGO)
        )
        if existing.scalar_one_or_none():
            logger.info("Demo data already exists (puesto %s). Skipping.", DEMO_PUESTO_CODIGO)
            return

        # 1. Create grados (global levels del career path por defecto)
        career_path = await get_or_create_career_path(s)
        grado_map = {}
        for i, nombre in enumerate(GRADOS, 1):
            r = await s.execute(
                select(GradoPuesto).where(
                    GradoPuesto.career_path_id == career_path.id,
                    GradoPuesto.nombre == nombre,
                )
            )
            grado = r.scalar_one_or_none()
            if not grado:
                grado = GradoPuesto(
                    career_path_id=career_path.id,
                    codigo=f"{career_path.codigo}{i}",
                    nombre=nombre,
                    orden=i,
                )
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
                grupo = GrupoCompetencia(
                    nombre=grupo_nombre, codigo=slug_codigo_grupo(grupo_nombre)
                )
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
        puesto = PuestoPerfil(
            codigo=DEMO_PUESTO_CODIGO,
            nombre="Auditor de Calidad Nivel 2",
            area_id=10,  # Cables Especiales
            activo=True,
        )
        s.add(puesto)
        await s.flush()
        logger.info("Puesto: %s (id=%d)", puesto.nombre, puesto.id)

        # 5. Create competencias and requisitos
        grado = grado_map["Grado 2"]

        # Configurar el grado del perfil (tabla puente)
        s.add(PuestoPerfilGrado(puesto_perfil_id=puesto.id, grado_id=grado.id))
        await s.flush()
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo de Evaluación Individual.")
    parser.add_argument("--cleanup", action="store_true", help="Borrar los datos demo.")
    parser.add_argument(
        "--execute", action="store_true", help="Con --cleanup, ejecuta el borrado (default dry-run)."
    )
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup_evaluacion_demo(execute=args.execute))
        return

    asyncio.run(seed())


if __name__ == "__main__":
    main()
