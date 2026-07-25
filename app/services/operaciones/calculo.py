"""Funciones puras de la analitica de cobertura/polivalencia.

Umbral de "cubierto" = cumple el requisito (nivel_actual >= nivel_requerido,
con nivel_requerido >= 1). No hay acceso a DB aqui: la entrada son
`EmpleadoCompetencias` ya construidos por el service desde
`CompetenciaService.obtener_multihabilidades`.
"""
from __future__ import annotations

from .constants import COBERTURA_AMBAR_MIN, COBERTURA_VERDE_MIN, MAX_CANDIDATOS_CROSSTRAIN
from .types import CandidatoCrossTrain, CoberturaCompetencia, CompetenciaMeta, EmpleadoCompetencias


def semaforo_cobertura(pct: float) -> str:
    if pct >= COBERTURA_VERDE_MIN:
        return "verde"
    if pct >= COBERTURA_AMBAR_MIN:
        return "ambar"
    return "rojo"


def severidad_cobertura(cubren: int) -> str:
    if cubren == 0:
        return "hueco"
    if cubren == 1:
        return "punto_unico"
    return "ok"


def cobertura_por_competencia(
    empleados: list[EmpleadoCompetencias],
    comp_meta: dict[int, CompetenciaMeta],
) -> list[CoberturaCompetencia]:
    """Agrega, por competencia requerida, cuantos empleados la requieren, la
    cubren (cumplen requisito) y estan en entrenamiento (0 < actual < requerido).
    Ordena peor cobertura primero.

    Dedup por empleado_id dentro de cada competencia: un empleado asignado a
    varios puestos de la misma area puede aparecer en varias entradas
    `EmpleadoCompetencias` (mismo empleado_id, distinto puesto_perfil_id). Cada
    empleado distinto cuenta a lo mas una vez por competencia: cubre si CUALQUIERA
    de sus entradas cumple el requisito; si no cubre, esta en entrenamiento si
    CUALQUIERA de sus entradas tiene 0 < actual < requerido."""
    por_comp: dict[int, dict[int, list[tuple[int, int]]]] = {}  # comp_id -> empleado_id -> [(actual, requerido), ...]
    for e in empleados:
        for comp_id, (actual, requerido) in e.competencias.items():
            if requerido < 1:
                continue
            por_emp = por_comp.setdefault(comp_id, {})
            por_emp.setdefault(e.empleado_id, []).append((actual, requerido))

    agg: dict[int, list[int]] = {}  # comp_id -> [requieren, cubren, en_entrenamiento]
    for comp_id, por_emp in por_comp.items():
        r = agg.setdefault(comp_id, [0, 0, 0])
        for pares in por_emp.values():
            r[0] += 1
            if any(actual >= requerido for actual, requerido in pares):
                r[1] += 1
            elif any(actual >= 1 for actual, requerido in pares):
                r[2] += 1
    out: list[CoberturaCompetencia] = []
    for comp_id, (requieren, cubren, entren) in agg.items():
        pct = round(cubren / requieren * 100, 1) if requieren else 0.0
        meta = comp_meta.get(comp_id)
        out.append(
            CoberturaCompetencia(
                competencia_id=comp_id,
                competencia_nombre=meta.nombre if meta else str(comp_id),
                tipo_nombre=meta.tipo_nombre if meta else "",
                requieren=requieren,
                cubren=cubren,
                en_entrenamiento=entren,
                cobertura_pct=pct,
                semaforo=semaforo_cobertura(pct),
                severidad=severidad_cobertura(cubren),
            )
        )
    out.sort(key=lambda c: (c.cobertura_pct, c.competencia_nombre))
    return out


def indice_polivalencia_empleado(e: EmpleadoCompetencias) -> float | None:
    req = [(a, r) for (a, r) in e.competencias.values() if r >= 1]
    if not req:
        return None
    cumple = sum(1 for a, r in req if a >= r)
    return round(cumple / len(req) * 100, 1)


def indice_polivalencia_area(empleados: list[EmpleadoCompetencias]) -> float | None:
    """Promedio de la polivalencia individual. `None` (no 0.0) cuando ningun
    empleado del area tiene requisitos evaluables: sin dato != 0 %."""
    vals = [v for e in empleados if (v := indice_polivalencia_empleado(e)) is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def resiliencia_area(coberturas: list[CoberturaCompetencia]) -> float:
    if not coberturas:
        return 0.0
    sin_punto_unico = sum(1 for c in coberturas if c.cubren >= 2)
    return round(sin_punto_unico / len(coberturas) * 100, 1)


def candidatos_crosstrain(
    competencia_id: int,
    empleados: list[EmpleadoCompetencias],
    limite: int = MAX_CANDIDATOS_CROSSTRAIN,
) -> list[CandidatoCrossTrain]:
    """Empleados que requieren la competencia y NO la cubren, ordenados por
    nivel_actual desc (mas cerca del requisito primero), desempate por nombre.
    Dedup por empleado_id (si aparece en varios puestos, se queda el nivel mas alto)."""
    por_empleado: dict[int, CandidatoCrossTrain] = {}
    for e in empleados:
        par = e.competencias.get(competencia_id)
        if par is None:
            continue
        actual, requerido = par
        if requerido < 1 or actual >= requerido:
            continue
        prev = por_empleado.get(e.empleado_id)
        if prev is None or actual > prev.nivel_actual:
            por_empleado[e.empleado_id] = CandidatoCrossTrain(
                empleado_id=e.empleado_id,
                no_empleado=e.no_empleado,
                nombre=e.nombre,
                nivel_actual=actual,
                nivel_requerido=requerido,
            )
    cands = sorted(por_empleado.values(), key=lambda c: (-c.nivel_actual, c.nombre))
    return cands[:limite]
