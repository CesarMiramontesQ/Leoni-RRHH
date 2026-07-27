# app/utils/seed_talento_demo.py
"""
Seed demo de la suite de Talento — datos de punta a punta para visualizar y probar.

Siembra el grafo completo que consumen el Dashboard de Talento, Operaciones,
Competencias, Cursos, PDI y Ciclo de Desempeno:

    area (real) -> puesto perfil -> tareas + cualificaciones + requisitos
                -> asignacion de empleados (PerfilFunciones) -> niveles evaluados
                -> cursos, PDI, metas, evaluacion 360, ciclos de desempeno, actas

**No crea empleados ni areas**: `empleados`/`areas` son tablas de Bono (solo
lectura, ver CLAUDE.md). Reutiliza empleados activos existentes y los toma
SIEMPRE del area del puesto -- si `Empleado.area_id` no coincide con
`PuestoPerfil.area_id`, la fila del area sale con todas sus columnas en `n/d`,
porque polivalencia agrupa por el area del puesto y los demas bloques por la
del empleado.

Los datos incluyen casos borde a proposito: competencias con hueco / punto
unico / cobertura ok, empleados con >=2 senales de riesgo (los "en foco"), y un
area cuya polivalencia es `None` -- no 0 % -- por no tener requisitos evaluables.

Uso (Docker):
    # Sembrar (4 areas x ~10 personas)
    docker-compose exec backend python -m app.utils.seed_talento_demo

    # Ajustar volumen
    docker-compose exec backend python -m app.utils.seed_talento_demo --areas 2 --por-area 6

    # Sin tocar cursos ni actas
    docker-compose exec backend python -m app.utils.seed_talento_demo --sin-cursos --sin-actas

    # Ver que borraria (dry-run) y borrar
    docker-compose exec backend python -m app.utils.seed_talento_demo --cleanup
    docker-compose exec backend python -m app.utils.seed_talento_demo --cleanup --execute

Todo lo creado lleva marcador (`DEMO-TAL-` en el codigo del puesto, `[DEMO]` en
los nombres), y `--cleanup` borra unicamente lo marcado.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.actas import ActaAdministrativa
from app.models.catalogos import Area
from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.models.empleados import Empleado
from app.models.evaluacion360 import (
    Eval360Campana,
    Eval360CampanaEvaluadorTipo,
    Eval360Escala,
    Eval360Participante,
    Eval360Resultado,
)
from app.models.level_up import (
    Curso,
    CursoEmpleado,
    CursoPuesto,
    CursoSesion,
    EstadoSesion,
)
from app.models.metas import Meta, MetaCiclo, MetaResultadoClave
from app.utils.demo_residuo import REFERENTES_GRUPO, REFERENTES_TIPO, ids_libres
from app.models.talento import (
    Competencia,
    CompetenciaRequisito,
    EvaluacionCompetencia,
    GradoPuesto,
    GrupoCompetencia,
    MetodoCalificacionCompetencia,
    PerfilFunciones,
    PerfilFuncionesCompetencia,
    PerfilTarea,
    PlanDesarrolloIndividual,
    PuestoPerfil,
    PuestoPerfilGrado,
    TareaCatalogo,
    TipoCompetencia,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════════════════════════════════
# Marcadores demo
# ══════════════════════════════════════════════════════════════════════════
DEMO_CODIGO_PREFIJO = "DEMO-TAL-"
DEMO_NOMBRE_PREFIJO = "[DEMO]"

# Niveles de `levelup_metodos_calificacion_competencia`
NIVEL_PLANEADO, NIVEL_ENTRENAMIENTO, NIVEL_CERTIFICADO, NIVEL_EXPERTO = 1, 2, 3, 4

# Grupos y tipos de competencia: el seed los crea con `_get_or_create` y nombres reales,
# sin marcador. El cleanup los retira solo si al final nadie los referencia.
GRUPO_TECNICAS = "Competencias Tecnicas"
GRUPO_BLANDAS = "Competencias Blandas"
GRUPOS_DEMO = [GRUPO_TECNICAS, GRUPO_BLANDAS]
TIPOS_POR_GRUPO: list[tuple[str, str]] = [
    ("Profesional", GRUPO_TECNICAS),
    ("Informatica", GRUPO_TECNICAS),
    ("Metodos", GRUPO_TECNICAS),
    ("Social", GRUPO_BLANDAS),
]
TIPOS_DEMO = [nombre for nombre, _ in TIPOS_POR_GRUPO]


def es_demo_codigo(codigo: str | None) -> bool:
    """Un puesto perfil es demo si su codigo lleva el prefijo reservado."""
    return bool(codigo) and codigo.startswith(DEMO_CODIGO_PREFIJO)


def es_demo_nombre(nombre: str | None) -> bool:
    """El resto de entidades se marcan con el prefijo en su texto principal."""
    return bool(nombre) and nombre.startswith(DEMO_NOMBRE_PREFIJO)


def demo(nombre: str) -> str:
    return f"{DEMO_NOMBRE_PREFIJO} {nombre}"


# ══════════════════════════════════════════════════════════════════════════
# Reparto de niveles — de aqui salen los casos borde de cobertura
# ══════════════════════════════════════════════════════════════════════════
def nivel_evaluado(i_competencia: int, i_empleado: int, nivel_requerido: int) -> int:
    """Nivel alcanzado por un empleado en una competencia del puesto.

    El reparto es deterministico y busca que CADA puesto tenga las tres
    severidades que pinta Operaciones, en vez de un porcentaje plano:

    - competencia 0 -> todos cumplen              (cobertura 100 %, `ok`)
    - competencia 1 -> cumple 1 de cada 2         (`ok` en cuanto hay 2 personas)
    - competencia 2 -> cumple solo el primero     (`punto_unico`)
    - competencia 3 -> no cumple nadie            (`hueco`)
    - resto         -> alterna cumplir / quedarse un nivel corto

    Nunca devuelve mas de 4 ni menos de 1: 0 significaria "sin evaluar" y aqui
    todos los pares empleado x competencia estan evaluados.
    """
    corto = max(NIVEL_PLANEADO, nivel_requerido - 1)
    caso = i_competencia % 5
    if caso == 0:
        cumple = True
    elif caso == 1:
        cumple = i_empleado % 2 == 0
    elif caso == 2:
        cumple = i_empleado == 0
    elif caso == 3:
        cumple = False
    else:
        cumple = (i_empleado + i_competencia) % 3 != 0
    return min(NIVEL_EXPERTO, nivel_requerido) if cumple else corto


# ══════════════════════════════════════════════════════════════════════════
# Catalogo de contenidos demo
# ══════════════════════════════════════════════════════════════════════════
COMPETENCIAS_DEMO = [
    # (nombre, tipo, categoria, nivel_requerido)
    ("Lectura de plano electrico", "Profesional", "tecnica", 3),
    ("Crimpado manual", "Profesional", "tecnica", 3),
    ("Bloqueo y etiquetado (LOTO)", "Profesional", "tecnica", 4),
    ("Control estadistico del proceso", "Metodos", "tecnica", 3),
    ("Manejo de ERP", "Informatica", "tecnica", 2),
    ("Trabajo en equipo", "Social", "blanda", 3),
    ("Comunicacion efectiva", "Social", "blanda", 3),
    ("Resolucion de problemas", "Metodos", "blanda", 4),
]

TAREAS_DEMO = [
    ("Preparar la linea al inicio del turno", False),
    ("Registrar la produccion en el sistema", False),
    ("Verificar calidad de la primera pieza", False),
    ("Reportar desviaciones al supervisor", False),
    ("Mantener orden y limpieza del area (5S)", False),
    ("Apoyar en auditorias internas", True),
    ("Capacitar a personal de nuevo ingreso", True),
]

PUESTOS_POR_AREA = [
    ("Operador", "operativo"),
    ("Tecnico", "operativo"),
]

CURSOS_DEMO = [
    # (nombre, obligatorio, horas)
    ("Induccion de seguridad", True, 8.0),
    ("Manejo de equipo de medicion", False, 16.0),
    ("Mejora continua y 5S", False, 12.0),
]

PDI_ACCIONES = [
    # (accion, tipo, estado, offset_dias_inicio, dur_dias)
    ("Curso en linea de fundamentos", "E-Learning", "completado", -180, 30),
    ("Acompanamiento con tecnico senior", "Mentoring", "en_proceso", -30, 90),
    ("Taller presencial de la competencia", "Presencial", "pendiente", 15, 45),
    ("Certificacion interna", "Certificacion", "pendiente", -120, 60),  # vencida
    ("Rotacion a otra linea", "Rotacion", "cancelado", -60, 30),
]


# ══════════════════════════════════════════════════════════════════════════
# Helpers de BD
# ══════════════════════════════════════════════════════════════════════════
async def _get_or_create(s: AsyncSession, modelo, filtros: dict, defaults: dict | None = None):
    """get-or-create por clave natural (patron de `seed_competencias_catalogo`)."""
    query = select(modelo)
    for campo, valor in filtros.items():
        query = query.where(getattr(modelo, campo) == valor)
    obj = (await s.execute(query)).scalars().first()
    if obj is not None:
        return obj
    obj = modelo(**filtros, **(defaults or {}))
    s.add(obj)
    await s.flush()
    return obj


async def _grados_activos(s: AsyncSession, cuantos: int) -> list[GradoPuesto]:
    """Los primeros grados activos por `orden`. La BD real trae duplicados de
    nombre con `activo=False`, asi que se filtra explicitamente."""
    result = await s.execute(
        select(GradoPuesto).where(GradoPuesto.activo.is_(True)).order_by(GradoPuesto.orden)
    )
    grados = list(result.scalars().all())[:cuantos]
    if len(grados) < cuantos:
        raise RuntimeError(
            f"Se necesitan {cuantos} grados activos en levelup_grados_puesto y hay {len(grados)}."
        )
    return grados


async def _ensure_metodos_competencia(s: AsyncSession) -> None:
    """Sin las 4 filas de metodos, la validacion de niveles rechaza cualquier
    requisito > 0 (`competencia_service.validar_nivel_requerido`)."""
    for valor, nombre in enumerate(
        ["Planeado", "En entrenamiento", "Certificado", "Experto"], start=1
    ):
        await _get_or_create(
            s,
            MetodoCalificacionCompetencia,
            {"valor": valor},
            {"nombre": nombre, "orden": valor, "activo": True},
        )


async def _areas_con_personal(s: AsyncSession, cuantas: int, minimo: int) -> list[tuple[int, str]]:
    """Areas reales con al menos `minimo` empleados activos, de mayor a menor."""
    result = await s.execute(
        select(Area.area_id, Area.descripcion, func.count(Empleado.empleado_id).label("n"))
        .join(Empleado, Empleado.area_id == Area.area_id)
        .where(Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS))
        .group_by(Area.area_id, Area.descripcion)
        .having(func.count(Empleado.empleado_id) >= minimo)
        .order_by(func.count(Empleado.empleado_id).desc())
        .limit(cuantas)
    )
    return [(row[0], row[1]) for row in result.all()]


async def _empleados_de_area(s: AsyncSession, area_id: int, cuantos: int) -> list[Empleado]:
    result = await s.execute(
        select(Empleado)
        .where(
            Empleado.area_id == area_id,
            Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
        )
        .order_by(Empleado.empleado_id)
        .limit(cuantos)
    )
    return list(result.scalars().all())


# ══════════════════════════════════════════════════════════════════════════
# Seed
# ══════════════════════════════════════════════════════════════════════════
async def seed_talento_demo(
    *,
    n_areas: int,
    por_area: int,
    con_cursos: bool,
    con_actas: bool,
    semilla: int,
) -> None:
    rng = random.Random(semilla)
    hoy = date.today()
    stats: dict[str, int] = {}

    def contar(clave: str, n: int = 1) -> None:
        stats[clave] = stats.get(clave, 0) + n

    async with AsyncSessionLocal() as s:
        ya = (
            await s.execute(
                select(PuestoPerfil).where(PuestoPerfil.codigo.like(f"{DEMO_CODIGO_PREFIJO}%"))
            )
        ).scalars().first()
        if ya is not None:
            logger.info(
                "Ya existen datos demo (puesto %s). Corre --cleanup --execute antes de resembrar.",
                ya.codigo,
            )
            return

        # ── Catalogos ────────────────────────────────────────────────────
        await _ensure_metodos_competencia(s)
        grados = await _grados_activos(s, 2)
        grupos: dict[str, GrupoCompetencia] = {}
        for grupo_nombre in GRUPOS_DEMO:
            grupos[grupo_nombre] = await _get_or_create(
                s, GrupoCompetencia, {"nombre": grupo_nombre}, {"activo": True}
            )
        tipos: dict[str, TipoCompetencia] = {}
        for tipo_nombre, grupo_nombre in TIPOS_POR_GRUPO:
            tipos[tipo_nombre] = await _get_or_create(
                s,
                TipoCompetencia,
                {"nombre": tipo_nombre},
                {"grupo_competencia_id": grupos[grupo_nombre].id, "activo": True},
            )

        competencias: list[tuple[Competencia, int]] = []
        for nombre, tipo_nombre, categoria, nivel_req in COMPETENCIAS_DEMO:
            comp = Competencia(
                nombre=demo(nombre),
                categoria=categoria,
                tipo_competencia_id=tipos[tipo_nombre].id,
                activo=True,
            )
            s.add(comp)
            await s.flush()
            competencias.append((comp, nivel_req))
            contar("competencias")

        tareas_catalogo: list[tuple[TareaCatalogo, bool]] = []
        for nombre, es_complemento in TAREAS_DEMO:
            tarea = await _get_or_create(
                s,
                TareaCatalogo,
                {"nombre": demo(nombre)},
                {"es_complemento": es_complemento, "activo": True, "categoria": "operacion"},
            )
            tareas_catalogo.append((tarea, es_complemento))
            contar("tareas_catalogo")

        # ── Areas reales ─────────────────────────────────────────────────
        areas = await _areas_con_personal(s, n_areas, por_area * len(PUESTOS_POR_AREA))
        if not areas:
            raise RuntimeError(
                f"No hay areas con al menos {por_area * len(PUESTOS_POR_AREA)} empleados activos. "
                "Baja --por-area."
            )
        if len(areas) < n_areas:
            logger.warning(
                "Solo %d areas cumplen el minimo de personal (se pidieron %d).", len(areas), n_areas
            )

        empleados_demo: list[Empleado] = []
        empleados_por_area: dict[int, list[Empleado]] = {}
        puestos_demo: list[PuestoPerfil] = []
        requisitos_por_puesto: dict[int, list[CompetenciaRequisito]] = {}
        # El area sin requisitos evaluables: aparece en la tabla con polivalencia
        # `None` (n/d), que NO es lo mismo que 0 %.
        area_sin_dato = areas[-1][0] if len(areas) > 1 else None

        for i_area, (area_id, area_nombre) in enumerate(areas):
            plantilla = await _empleados_de_area(s, area_id, por_area * len(PUESTOS_POR_AREA))
            empleados_por_area[area_id] = plantilla
            empleados_demo.extend(plantilla)

            for i_puesto, (puesto_base, tipo) in enumerate(PUESTOS_POR_AREA):
                codigo = f"{DEMO_CODIGO_PREFIJO}{i_area + 1:02d}{i_puesto + 1}"
                puesto = PuestoPerfil(
                    codigo=codigo,
                    nombre=f"{puesto_base} de {area_nombre}",
                    tipo=tipo,
                    area_id=area_id,
                    activo=True,
                    reporta_a=f"Jefe de {area_nombre}",
                    responsable_de="Cumplir el estandar de la linea y reportar desviaciones.",
                )
                s.add(puesto)
                await s.flush()
                puestos_demo.append(puesto)
                contar("puestos_perfil")

                for grado in grados:
                    s.add(PuestoPerfilGrado(puesto_perfil_id=puesto.id, grado_id=grado.id))
                await s.flush()

                for orden, (tarea, es_complemento) in enumerate(tareas_catalogo, start=1):
                    s.add(
                        PerfilTarea(
                            puesto_perfil_id=puesto.id,
                            tarea_catalogo_id=tarea.id,
                            orden=orden,
                            descripcion=tarea.nombre.removeprefix(f"{DEMO_NOMBRE_PREFIJO} "),
                            es_complemento=es_complemento,
                        )
                    )
                    contar("perfil_tareas")

                # Requisitos por grado: `PerfilFunciones.grado_id` tiene que
                # coincidir EXACTO con el del requisito -- no hay fallback a NULL.
                del_puesto = competencias[i_puesto * 3 : i_puesto * 3 + 5] or competencias[:5]
                reqs: list[CompetenciaRequisito] = []
                for i_comp, (comp, nivel_req) in enumerate(del_puesto):
                    for i_grado, grado in enumerate(grados):
                        nivel = 0 if area_id == area_sin_dato else min(4, nivel_req + i_grado)
                        req = CompetenciaRequisito(
                            competencia_id=comp.id,
                            puesto_perfil_id=puesto.id,
                            grado_id=grado.id,
                            nivel_requerido=nivel,
                            orden=i_comp + 1,
                        )
                        s.add(req)
                        reqs.append(req)
                        contar("requisitos")
                await s.flush()
                requisitos_por_puesto[puesto.id] = reqs

                # Asignacion de personal del MISMO area + niveles evaluados
                asignados = plantilla[i_puesto * por_area : (i_puesto + 1) * por_area]
                for i_emp, empleado in enumerate(asignados):
                    grado = grados[i_emp % len(grados)]
                    pf = PerfilFunciones(
                        puesto_perfil_id=puesto.id,
                        empleado_id=empleado.empleado_id,
                        grado_id=grado.id,
                        departamento=area_nombre,
                        activo=True,
                    )
                    s.add(pf)
                    await s.flush()
                    contar("asignaciones")

                    for i_comp, (comp, nivel_req) in enumerate(del_puesto):
                        req = next(
                            r
                            for r in reqs
                            if r.competencia_id == comp.id and r.grado_id == grado.id
                        )
                        nivel = nivel_evaluado(i_comp, i_emp, max(1, req.nivel_requerido))
                        s.add(
                            PerfilFuncionesCompetencia(
                                perfil_funciones_id=pf.id,
                                competencia_requisito_id=req.id,
                                situacion_actual=str(nivel),
                                comentarios=demo("evaluacion de muestra"),
                            )
                        )
                        contar("niveles_evaluados")
                        # La pantalla de Evaluaciones lee otra tabla distinta a
                        # la matriz de multihabilidades; se siembran las dos.
                        s.add(
                            EvaluacionCompetencia(
                                empleado_id=empleado.empleado_id,
                                competencia_id=comp.id,
                                nivel_actual=nivel,
                                estado="cerrado",
                                fecha_evaluacion=hoy - timedelta(days=rng.randint(10, 120)),
                            )
                        )
                        contar("evaluaciones_competencia")
                await s.flush()

        await s.commit()
        logger.info("Perfiles, competencias y asignaciones listos.")

        # ── Cursos ───────────────────────────────────────────────────────
        if con_cursos:
            cursos: list[Curso] = []
            for nombre, obligatorio, horas in CURSOS_DEMO:
                curso = Curso(
                    nombre=demo(nombre),
                    obligatorio=obligatorio,
                    duracion_horas=horas,
                    activo=True,
                    descripcion=demo("curso de datos de prueba"),
                )
                s.add(curso)
                await s.flush()
                cursos.append(curso)
                contar("cursos")

            for curso in cursos:
                for puesto in puestos_demo:
                    s.add(
                        CursoPuesto(
                            curso_id=curso.id,
                            puesto_perfil_id=puesto.id,
                            obligatorio=curso.obligatorio,
                            sesion_id=None,  # NULL = asignacion, no inscripcion
                        )
                    )
                    contar("curso_puesto")
            await s.flush()

            sesion_pasada = CursoSesion(
                curso_id=cursos[0].id,
                fecha_inicio=hoy - timedelta(days=45),
                fecha_fin=hoy - timedelta(days=45),
                estado=EstadoSesion.completada,
                ubicacion=demo("Aula 1"),
            )
            sesion_futura = CursoSesion(
                curso_id=cursos[1].id,
                fecha_inicio=hoy + timedelta(days=21),
                fecha_fin=hoy + timedelta(days=21),
                estado=EstadoSesion.programada,
                ubicacion=demo("Aula 2"),
            )
            s.add_all([sesion_pasada, sesion_futura])
            await s.flush()
            contar("sesiones", 2)

            # Dos de cada tres pasaron el curso; el resto queda no acreditado o
            # con el obligatorio pendiente, que es lo que enciende la senal.
            for i, empleado in enumerate(empleados_demo):
                if i % 3 == 0:
                    continue  # sin inscripcion: obligatorio pendiente
                s.add(
                    CursoEmpleado(
                        curso_id=cursos[0].id,
                        empleado_id=empleado.empleado_id,
                        sesion_id=sesion_pasada.id,
                        asistio=i % 3 == 1,
                        fecha=hoy - timedelta(days=45),
                        horas=cursos[0].duracion_horas,
                        obligatorio=True,
                    )
                )
                contar("inscripciones")
                if i % 4 == 0:
                    s.add(
                        CursoEmpleado(
                            curso_id=cursos[1].id,
                            empleado_id=empleado.empleado_id,
                            sesion_id=sesion_futura.id,
                            asistio=None,
                            fecha=hoy + timedelta(days=21),
                            obligatorio=False,
                        )
                    )
                    contar("inscripciones")
            await s.commit()
            logger.info("Cursos, sesiones e inscripciones listos.")

        # ── PDI ──────────────────────────────────────────────────────────
        for i, empleado in enumerate(empleados_demo):
            for j, (accion, tipo, estado, offset, dur) in enumerate(PDI_ACCIONES):
                if (i + j) % 3 == 0 and estado == "pendiente":
                    continue  # no todos tienen todo
                inicio = hoy + timedelta(days=offset)
                s.add(
                    PlanDesarrolloIndividual(
                        empleado_id=empleado.empleado_id,
                        competencia_id=competencias[j % len(competencias)][0].id,
                        accion=demo(accion),
                        tipo=tipo,
                        duracion_horas=8,
                        fecha_inicio=inicio,
                        fecha_fin=inicio + timedelta(days=dur),
                        responsable=demo("Jefe de area"),
                        estado=estado,
                        prioridad=["baja", "media", "alta"][j % 3],
                    )
                )
                contar("pdi")
        await s.commit()
        logger.info("Planes de desarrollo listos.")

        # ── Metas + 360 (senales del ciclo activo) ───────────────────────
        asignador_id = empleados_demo[0].empleado_id
        meta_ciclo = MetaCiclo(
            nombre=demo(f"Metas {hoy.year}"),
            descripcion=demo("ciclo de metas de datos de prueba"),
            fecha_inicio=date(hoy.year, 1, 1),
            fecha_fin=date(hoy.year, 12, 31),
            estado="activo",
            creado_por_id=asignador_id,
        )
        s.add(meta_ciclo)
        await s.flush()

        con_meta = [e for i, e in enumerate(empleados_demo) if i % 3 != 2]
        for i, empleado in enumerate(con_meta):
            meta = Meta(
                ciclo_id=meta_ciclo.id,
                nivel="individual",
                empleado_id=empleado.empleado_id,
                titulo=demo("Reducir scrap de la linea"),
                descripcion=demo("meta de datos de prueba"),
                peso=Decimal("100.00"),
                estado="cerrada",
                asignada_por_id=asignador_id,
                calificacion_cierre=Decimal(str(rng.choice([45, 62, 70, 78, 85, 92, 96]))),
                comentario_cierre=demo("cierre de muestra"),
            )
            s.add(meta)
            await s.flush()
            s.add(
                MetaResultadoClave(
                    meta_id=meta.id,
                    orden=1,
                    titulo=demo("% de scrap"),
                    tipo_metrica="porcentaje",
                    unidad="%",
                    direccion="bajar",
                    valor_inicial=Decimal("5.00"),
                    valor_objetivo=Decimal("2.00"),
                    valor_actual=Decimal(str(rng.choice(["2.00", "2.40", "3.10"]))),
                )
            )
            contar("metas")

        escala = Eval360Escala(
            nombre=demo("Escala 1-5"), valor_min=1, valor_max=5, activo=True
        )
        s.add(escala)
        await s.flush()
        campana = Eval360Campana(
            nombre=demo(f"Evaluacion 360 {hoy.year}"),
            estado="finalizada",
            tipo="evaluacion_360",
            activo=True,
            fecha_inicio=hoy - timedelta(days=90),
            fecha_cierre=hoy - timedelta(days=30),
            escala_id=escala.id,
        )
        s.add(campana)
        await s.flush()
        s.add(
            Eval360CampanaEvaluadorTipo(
                campana_id=campana.id, tipo="jefe", peso=Decimal("100.00"), activo=True
            )
        )
        for empleado in empleados_demo:
            participante = Eval360Participante(
                campana_id=campana.id,
                empleado_id=empleado.empleado_id,
                estado="completada",
            )
            s.add(participante)
            await s.flush()
            s.add(
                Eval360Resultado(
                    participante_id=participante.id,
                    competencia_id=None,  # fila resumen: la que lee el ciclo
                    calificacion_general=Decimal(str(rng.choice(["2.4", "3.1", "3.6", "4.2", "4.7"]))),
                    promedio_general=Decimal("3.8"),
                )
            )
            contar("participantes_360")
        await s.commit()
        logger.info("Metas y evaluacion 360 listas.")

        # ── Ciclo de desempeno activo (calcula en vivo) ──────────────────
        from app.services.ciclo_desempeno_service import CicloDesempenoService

        ciclo_activo = CicloDesempeno(
            nombre=demo(f"Ciclo de desempeno {hoy.year}"),
            estado="borrador",
            fecha_inicio=date(hoy.year, 1, 1),
            fecha_fin=date(hoy.year, 12, 31),
            meta_ciclo_id=meta_ciclo.id,
            eval360_campana_id=campana.id,
            peso_metas=Decimal("60.00"),
            peso_competencias=Decimal("40.00"),
            peso_historial=Decimal("0.00"),
            umbral_medio=Decimal("50.00"),
            umbral_alto=Decimal("75.00"),
            creado_por_id=asignador_id,
        )
        s.add(ciclo_activo)
        await s.commit()
        await CicloDesempenoService(s).activar_ciclo(ciclo_activo.id)
        contar("ciclos", 1)

        # Potencial para 2 de cada 3: el 9-Box exige banda de desempeno Y de
        # potencial, asi que sin esto la matriz sale vacia.
        resultados = (
            await s.execute(
                select(CicloDesempenoResultado).where(
                    CicloDesempenoResultado.ciclo_id == ciclo_activo.id
                )
            )
        ).scalars().all()
        for i, r in enumerate(resultados):
            if i % 3 == 2:
                continue
            r.potencial = Decimal(str(rng.choice([40, 55, 68, 80, 90])))
            r.potencial_capturado_por_id = asignador_id
            r.potencial_capturado_at = datetime.now(timezone.utc)
            contar("potencial_capturado")
        await s.commit()

        # ── Ciclo cerrado (snapshot ya congelado) ────────────────────────
        # Se escribe directo en `cerrado`: `cerrar_ciclo` exigiria ademas cerrar
        # el ciclo de metas y finalizar la campana, que aqui siguen vivos.
        ciclo_cerrado = CicloDesempeno(
            nombre=demo(f"Ciclo de desempeno {hoy.year - 1}"),
            estado="cerrado",
            fecha_inicio=date(hoy.year - 1, 1, 1),
            fecha_fin=date(hoy.year - 1, 12, 31),
            peso_metas=Decimal("60.00"),
            peso_competencias=Decimal("40.00"),
            peso_historial=Decimal("0.00"),
            umbral_medio=Decimal("50.00"),
            umbral_alto=Decimal("75.00"),
            creado_por_id=asignador_id,
        )
        s.add(ciclo_cerrado)
        await s.flush()
        for i, empleado in enumerate(empleados_demo):
            calificacion = rng.choice([38, 47, 55, 63, 71, 79, 86, 93])
            potencial = rng.choice([35, 52, 66, 78, 88])
            banda_d = "bajo" if calificacion < 50 else ("medio" if calificacion < 75 else "alto")
            banda_p = "bajo" if potencial < 50 else ("medio" if potencial < 75 else "alto")
            s.add(
                CicloDesempenoResultado(
                    ciclo_id=ciclo_cerrado.id,
                    empleado_id=empleado.empleado_id,
                    cumplimiento_metas=Decimal(str(calificacion)),
                    calificacion_360_norm=Decimal(str(min(100, calificacion + 5))),
                    calificacion_desempeno=Decimal(str(calificacion)),
                    peso_metas_efectivo=Decimal("60.00"),
                    peso_competencias_efectivo=Decimal("40.00"),
                    potencial=Decimal(str(potencial)),
                    banda_desempeno=banda_d,
                    banda_potencial=banda_p,
                    segmento_9box=f"{banda_d}_{banda_p}",
                    snapshot_at=datetime.now(timezone.utc),
                )
            )
            contar("resultados_ciclo_cerrado")
        contar("ciclos", 1)
        await s.commit()
        logger.info("Ciclos de desempeno listos.")

        # ── Actas (alimentan el indice objetivo) ─────────────────────────
        if con_actas:
            for i, empleado in enumerate(empleados_demo):
                if i % 4 != 0:
                    continue
                s.add(
                    ActaAdministrativa(
                        empleado_id=empleado.empleado_id,
                        estado="signed" if i % 8 == 0 else "pending_sign",
                        fecha_evento=hoy - timedelta(days=rng.randint(20, 330)),
                        tipo_falta=demo("Retardo reiterado"),
                        descripcion_hechos=demo("acta de datos de prueba"),
                        generado_por=asignador_id,
                    )
                )
                contar("actas")
            await s.commit()
            logger.info("Actas listas.")

    # ── Resumen ──────────────────────────────────────────────────────────
    logger.info("=== Resumen seed talento demo ===")
    logger.info("Areas: %s", ", ".join(f"{nombre} ({aid})" for aid, nombre in areas))
    logger.info("Empleados usados: %d (reales, no creados)", len(empleados_demo))
    for clave in sorted(stats):
        logger.info("%-28s %d", clave, stats[clave])
    logger.info("Area en n/d de polivalencia: %s", area_sin_dato)


# ══════════════════════════════════════════════════════════════════════════
# Cleanup
# ══════════════════════════════════════════════════════════════════════════
async def cleanup_talento_demo(*, execute: bool) -> None:
    """Borra SOLO lo marcado como demo, en orden inverso de dependencias.

    Nunca toca empleados, areas ni los cursos/actas reales: cada delete filtra
    por el marcador o por las filas hijas de un puesto `DEMO-TAL-`.

    Todo corre dentro de una transaccion: en dry-run se hace rollback al final, asi que
    los conteos reportados ya ven el efecto de los borrados previos.
    """
    borrados: dict[str, int] = {}

    async with AsyncSessionLocal() as s:
        puesto_ids = list(
            (
                await s.execute(
                    select(PuestoPerfil.id).where(
                        PuestoPerfil.codigo.like(f"{DEMO_CODIGO_PREFIJO}%")
                    )
                )
            ).scalars().all()
        )
        comp_ids = list(
            (
                await s.execute(
                    select(Competencia.id).where(
                        Competencia.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%")
                    )
                )
            ).scalars().all()
        )
        curso_ids = list(
            (
                await s.execute(
                    select(Curso.id).where(Curso.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%"))
                )
            ).scalars().all()
        )
        pf_ids = list(
            (
                await s.execute(
                    select(PerfilFunciones.id).where(
                        PerfilFunciones.puesto_perfil_id.in_(puesto_ids)
                    )
                )
            ).scalars().all()
        ) if puesto_ids else []
        ciclo_ids = list(
            (
                await s.execute(
                    select(CicloDesempeno.id).where(
                        CicloDesempeno.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%")
                    )
                )
            ).scalars().all()
        )
        campana_ids = list(
            (
                await s.execute(
                    select(Eval360Campana.id).where(
                        Eval360Campana.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%")
                    )
                )
            ).scalars().all()
        )
        participante_ids = list(
            (
                await s.execute(
                    select(Eval360Participante.id).where(
                        Eval360Participante.campana_id.in_(campana_ids)
                    )
                )
            ).scalars().all()
        ) if campana_ids else []
        meta_ciclo_ids = list(
            (
                await s.execute(
                    select(MetaCiclo.id).where(MetaCiclo.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%"))
                )
            ).scalars().all()
        )
        meta_ids = list(
            (
                await s.execute(select(Meta.id).where(Meta.ciclo_id.in_(meta_ciclo_ids)))
            ).scalars().all()
        ) if meta_ciclo_ids else []

        plan: list[tuple[str, object]] = [
            ("resultados_ciclo", delete(CicloDesempenoResultado).where(CicloDesempenoResultado.ciclo_id.in_(ciclo_ids)) if ciclo_ids else None),
            ("ciclos_desempeno", delete(CicloDesempeno).where(CicloDesempeno.id.in_(ciclo_ids)) if ciclo_ids else None),
            ("resultados_360", delete(Eval360Resultado).where(Eval360Resultado.participante_id.in_(participante_ids)) if participante_ids else None),
            ("participantes_360", delete(Eval360Participante).where(Eval360Participante.campana_id.in_(campana_ids)) if campana_ids else None),
            ("evaluador_tipos_360", delete(Eval360CampanaEvaluadorTipo).where(Eval360CampanaEvaluadorTipo.campana_id.in_(campana_ids)) if campana_ids else None),
            ("campanas_360", delete(Eval360Campana).where(Eval360Campana.id.in_(campana_ids)) if campana_ids else None),
            ("escalas_360", delete(Eval360Escala).where(Eval360Escala.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%"))),
            ("resultados_clave", delete(MetaResultadoClave).where(MetaResultadoClave.meta_id.in_(meta_ids)) if meta_ids else None),
            ("metas", delete(Meta).where(Meta.ciclo_id.in_(meta_ciclo_ids)) if meta_ciclo_ids else None),
            ("ciclos_metas", delete(MetaCiclo).where(MetaCiclo.id.in_(meta_ciclo_ids)) if meta_ciclo_ids else None),
            ("pdi", delete(PlanDesarrolloIndividual).where(PlanDesarrolloIndividual.accion.like(f"{DEMO_NOMBRE_PREFIJO}%"))),
            ("inscripciones", delete(CursoEmpleado).where(CursoEmpleado.curso_id.in_(curso_ids)) if curso_ids else None),
            ("curso_puesto", delete(CursoPuesto).where(CursoPuesto.curso_id.in_(curso_ids)) if curso_ids else None),
            ("sesiones", delete(CursoSesion).where(CursoSesion.curso_id.in_(curso_ids)) if curso_ids else None),
            ("cursos", delete(Curso).where(Curso.id.in_(curso_ids)) if curso_ids else None),
            ("actas", delete(ActaAdministrativa).where(ActaAdministrativa.descripcion_hechos.like(f"{DEMO_NOMBRE_PREFIJO}%"))),
            ("niveles_evaluados", delete(PerfilFuncionesCompetencia).where(PerfilFuncionesCompetencia.perfil_funciones_id.in_(pf_ids)) if pf_ids else None),
            ("asignaciones", delete(PerfilFunciones).where(PerfilFunciones.puesto_perfil_id.in_(puesto_ids)) if puesto_ids else None),
            ("evaluaciones_competencia", delete(EvaluacionCompetencia).where(EvaluacionCompetencia.competencia_id.in_(comp_ids)) if comp_ids else None),
            ("requisitos", delete(CompetenciaRequisito).where(CompetenciaRequisito.puesto_perfil_id.in_(puesto_ids)) if puesto_ids else None),
            ("perfil_tareas", delete(PerfilTarea).where(PerfilTarea.puesto_perfil_id.in_(puesto_ids)) if puesto_ids else None),
            ("puesto_perfil_grados", delete(PuestoPerfilGrado).where(PuestoPerfilGrado.puesto_perfil_id.in_(puesto_ids)) if puesto_ids else None),
            ("puestos_perfil", delete(PuestoPerfil).where(PuestoPerfil.id.in_(puesto_ids)) if puesto_ids else None),
            ("competencias", delete(Competencia).where(Competencia.id.in_(comp_ids)) if comp_ids else None),
            ("tareas_catalogo", delete(TareaCatalogo).where(TareaCatalogo.nombre.like(f"{DEMO_NOMBRE_PREFIJO}%"))),
        ]

        for etiqueta, stmt in plan:
            if stmt is None:
                continue
            result = await s.execute(stmt)
            borrados[etiqueta] = result.rowcount or 0

        # Residuo sin marcador: grupos y tipos de competencia creados por `_get_or_create`.
        # Solo se retiran si ya nadie los referencia (competencias reales, p.ej.).
        # `levelup_metodos_calificacion_competencia` se conserva a proposito: sin esas 4
        # filas `competencia_service.validar_nivel_requerido` rechaza cualquier requisito.
        tipo_ids = list(
            (
                await s.execute(
                    select(TipoCompetencia.id).where(TipoCompetencia.nombre.in_(TIPOS_DEMO))
                )
            ).scalars().all()
        )
        libres = await ids_libres(s, tipo_ids, REFERENTES_TIPO) if tipo_ids else []
        if libres:
            result = await s.execute(
                delete(TipoCompetencia).where(TipoCompetencia.id.in_(libres))
            )
            borrados["tipos_competencia"] = result.rowcount or 0

        grupo_ids = list(
            (
                await s.execute(
                    select(GrupoCompetencia.id).where(GrupoCompetencia.nombre.in_(GRUPOS_DEMO))
                )
            ).scalars().all()
        )
        libres = await ids_libres(s, grupo_ids, REFERENTES_GRUPO) if grupo_ids else []
        if libres:
            result = await s.execute(
                delete(GrupoCompetencia).where(GrupoCompetencia.id.in_(libres))
            )
            borrados["grupos_competencia"] = result.rowcount or 0

        if execute:
            await s.commit()
        else:
            await s.rollback()

    logger.info("=== Cleanup talento demo (%s) ===", "ejecutado" if execute else "simulación")
    total = 0
    for etiqueta in sorted(borrados):
        if borrados[etiqueta]:
            logger.info("%-28s %d", etiqueta, borrados[etiqueta])
            total += borrados[etiqueta]
    logger.info("%-28s %d", "TOTAL", total)
    if not execute:
        logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")


# ══════════════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════════════
def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo de la suite de Talento.")
    parser.add_argument("--areas", type=int, default=4, help="Áreas a poblar (default 4).")
    parser.add_argument(
        "--por-area", type=int, default=10, help="Empleados por puesto perfil (default 10)."
    )
    parser.add_argument("--sin-cursos", action="store_true", help="No sembrar cursos.")
    parser.add_argument("--sin-actas", action="store_true", help="No sembrar actas.")
    parser.add_argument("--seed", type=int, default=42, help="Semilla aleatoria (default 42).")
    parser.add_argument("--cleanup", action="store_true", help="Borrar los datos demo.")
    parser.add_argument(
        "--execute", action="store_true", help="Con --cleanup, ejecuta el borrado (default dry-run)."
    )
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup_talento_demo(execute=args.execute))
        return

    asyncio.run(
        seed_talento_demo(
            n_areas=args.areas,
            por_area=args.por_area,
            con_cursos=not args.sin_cursos,
            con_actas=not args.sin_actas,
            semilla=args.seed,
        )
    )


if __name__ == "__main__":
    main()
