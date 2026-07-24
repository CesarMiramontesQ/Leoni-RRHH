# Módulo Operaciones — Analítica de cobertura y polivalencia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un módulo RH de solo lectura que agrega las evaluaciones de competencia ya capturadas y produce analítica de cobertura por área: índice de polivalencia, cobertura por competencia, competencias críticas (punto único de falla) y cross-training sugerido.

**Architecture:** Agregador sin tabla nueva sobre la BD Bono principal. El service **reutiliza** `CompetenciaService.obtener_multihabilidades(puesto)` (que ya resuelve, por puesto, la grilla empleado×competencia con `nivel_actual`/`nivel_requerido` y el manejo de grado) y agrega esas grillas por área. La lógica de fórmula vive en funciones puras (`operaciones/calculo.py`) testeables sin DB; el service orquesta enumeración de puestos por área + scope por rol + agregación; el router expone 3 endpoints gestión RH/jefatura.

**Tech Stack:** FastAPI async, SQLAlchemy async, Pydantic v2, openpyxl (export), pytest (SQLite in-memory), Vite/TypeScript frontend con design system (`uiTokens.ts`).

## Global Constraints

- Responder siempre en español; código y comentarios en español, sin acentos en identificadores.
- **Nunca push directo a `main`**: todo por PR. Rama de este trabajo: `feat/cm/operaciones-cobertura`.
- **Sin tabla nueva y sin migración.** Este módulo es de solo lectura; no crea/altera/borra tablas.
- Toda tabla propia del proyecto usa prefijo `levelup_`; las tablas legacy de Bono (`empleados`, `areas`, `puestos`, ...) son **read-only** (solo SELECT/FK).
- No usar DATOS_ANALISIS (SQL Server) ni RPA/`encolar_tress`.
- Tests: SQLite in-memory (`tests/conftest.py`); **no** correr `alembic upgrade/downgrade`.
- Frontend: solo tokens de `frontend/src/ui/uiTokens.ts` y helpers de niveles de `frontend/src/ui/metodosCalificacionCompetencia.ts`; sin hex ni fuentes nuevas. Todo string interpolado con `escapeHtml`.
- Mantener `openapi.yaml` sincronizado al añadir/cambiar endpoints.
- Commits Conventional Commits en español, sin iniciales; terminar cada commit con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Umbral de "cubierto" = **cumple el requisito** (`nivel_actual >= nivel_requerido`, con `nivel_requerido >= 1`). Umbrales de semáforo de cobertura: verde ≥ 80, ámbar ≥ 50, rojo < 50.
- Scope por rol vía `empleado_ids_scope_por_modulo(...)` con `module_key="operaciones"`: RH/director → sin filtro (`None`); supervisor → reportes directos + él mismo; gerente → subárbol + él mismo.

## File Structure

- `app/services/operaciones/__init__.py` — paquete del service.
- `app/services/operaciones/constants.py` — umbrales de semáforo + `MAX_CANDIDATOS_CROSSTRAIN`.
- `app/services/operaciones/types.py` — dataclasses de entrada/salida de la agregación pura.
- `app/services/operaciones/calculo.py` — **funciones puras** de fórmula (sin DB, sin Pydantic).
- `app/services/operaciones_service.py` — `OperacionesService`: enumeración por área + scope + agregación + export.
- `app/schemas/operaciones.py` — schemas Pydantic de respuesta.
- `app/api/v1/operaciones/__init__.py`, `app/api/v1/operaciones/router.py` — router, prefix `/api/v1/operaciones`.
- `app/core/rh_module_registry.py` — (modificar) añadir `RhModuleDef` `operaciones`.
- `app/main.py` — (modificar) `include_router(operaciones_router)`.
- `openapi.yaml` — (modificar) 3 paths + schemas nuevos.
- `frontend/src/api/operaciones.ts` — cliente API.
- `frontend/src/pages/operaciones.ts` — página role-adaptive.
- `frontend/src/shellRouter.ts`, `frontend/src/navigation/*`, `frontend/src/layouts/*`, `frontend/src/auth/rhModuleRegistry.ts` — (modificar) ruta + nav + gating.
- Tests: `tests/test_operaciones_calculo.py`, `tests/test_operaciones_service.py`, `tests/test_operaciones_api.py`.

---

### Task 1: Constantes + funciones puras de fórmula

**Files:**
- Create: `app/services/operaciones/__init__.py` (vacío)
- Create: `app/services/operaciones/constants.py`
- Create: `app/services/operaciones/types.py`
- Create: `app/services/operaciones/calculo.py`
- Test: `tests/test_operaciones_calculo.py`

**Interfaces:**
- Consumes: nada (funciones puras).
- Produces (usadas por Task 2):
  - `types.CompetenciaMeta(competencia_id: int, nombre: str, tipo_nombre: str)`
  - `types.EmpleadoCompetencias(empleado_id: int, no_empleado: int | str, nombre: str, puesto_perfil_id: int, puesto_nombre: str, competencias: dict[int, tuple[int, int]])` — `competencias[comp_id] = (nivel_actual, nivel_requerido)`, solo comps con `nivel_requerido >= 1`.
  - `types.CoberturaCompetencia(competencia_id, competencia_nombre, tipo_nombre, requieren, cubren, en_entrenamiento, cobertura_pct, semaforo, severidad)`
  - `types.CandidatoCrossTrain(empleado_id, no_empleado, nombre, nivel_actual, nivel_requerido)`
  - `calculo.cobertura_por_competencia(empleados, comp_meta) -> list[CoberturaCompetencia]`
  - `calculo.indice_polivalencia_empleado(e) -> float | None`
  - `calculo.indice_polivalencia_area(empleados) -> float`
  - `calculo.resiliencia_area(coberturas) -> float`
  - `calculo.candidatos_crosstrain(competencia_id, empleados, limite=MAX_CANDIDATOS_CROSSTRAIN) -> list[CandidatoCrossTrain]`
  - `calculo.semaforo_cobertura(pct) -> str`, `calculo.severidad_cobertura(cubren) -> str`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_operaciones_calculo.py`:

```python
from app.services.operaciones import calculo
from app.services.operaciones.types import CompetenciaMeta, EmpleadoCompetencias


def _emp(eid, comps, puesto_id=1, puesto_nombre="Crimpado"):
    # comps: dict comp_id -> (actual, requerido)
    return EmpleadoCompetencias(
        empleado_id=eid, no_empleado=eid, nombre=f"Emp{eid}",
        puesto_perfil_id=puesto_id, puesto_nombre=puesto_nombre, competencias=comps,
    )


META = {
    10: CompetenciaMeta(10, "Crimpado manual", "Operación"),
    20: CompetenciaMeta(20, "Bloqueo LOTO", "Seguridad"),
}


def test_cobertura_total_parcial_y_cero():
    empleados = [
        _emp(1, {10: (3, 3), 20: (1, 3)}),  # cubre 10, no 20
        _emp(2, {10: (4, 3), 20: (0, 3)}),  # cubre 10, no 20
        _emp(3, {10: (2, 3)}),              # no cubre 10 (en entrenamiento)
    ]
    cobs = {c.competencia_id: c for c in calculo.cobertura_por_competencia(empleados, META)}
    # comp 10: requieren 3, cubren 2, en_entrenamiento 1 -> 66.7% -> ambar, ok(>=2)
    assert cobs[10].requieren == 3 and cobs[10].cubren == 2 and cobs[10].en_entrenamiento == 1
    assert cobs[10].cobertura_pct == 66.7
    assert cobs[10].semaforo == "ambar" and cobs[10].severidad == "ok"
    # comp 20: requieren 2, cubren 0 -> 0% rojo, severidad hueco
    assert cobs[20].requieren == 2 and cobs[20].cubren == 0
    assert cobs[20].cobertura_pct == 0.0
    assert cobs[20].semaforo == "rojo" and cobs[20].severidad == "hueco"


def test_severidad_punto_unico():
    empleados = [_emp(1, {10: (3, 3)}), _emp(2, {10: (1, 3)})]  # solo 1 cubre
    cob = calculo.cobertura_por_competencia(empleados, META)[0]
    assert cob.cubren == 1 and cob.severidad == "punto_unico"


def test_requisito_cero_se_ignora():
    # requerido 0 = N/A: no cuenta como requerida
    empleados = [_emp(1, {10: (0, 0)})]
    assert calculo.cobertura_por_competencia(empleados, META) == []
    assert calculo.indice_polivalencia_empleado(empleados[0]) is None


def test_indice_polivalencia_empleado():
    e = _emp(1, {10: (3, 3), 20: (1, 3)})  # cumple 1 de 2
    assert calculo.indice_polivalencia_empleado(e) == 50.0


def test_indice_polivalencia_area_excluye_sin_requisitos():
    empleados = [
        _emp(1, {10: (3, 3), 20: (3, 3)}),  # 100
        _emp(2, {10: (0, 3), 20: (0, 3)}),  # 0
        _emp(3, {10: (0, 0)}),              # sin requisitos -> excluido
    ]
    assert calculo.indice_polivalencia_area(empleados) == 50.0


def test_resiliencia_area():
    empleados = [
        _emp(1, {10: (3, 3), 20: (3, 3)}),
        _emp(2, {10: (3, 3), 20: (0, 3)}),  # 20 cubierto por 1 -> punto_unico
    ]
    cobs = calculo.cobertura_por_competencia(empleados, META)
    # comp10 cubren=2 (ok), comp20 cubren=1 (punto_unico) -> 1 de 2 sin punto unico = 50%
    assert calculo.resiliencia_area(cobs) == 50.0


def test_candidatos_crosstrain_orden_y_limite():
    empleados = [
        _emp(1, {10: (3, 3)}),  # ya cubre -> excluido
        _emp(2, {10: (2, 3)}),  # candidato, nivel 2
        _emp(3, {10: (1, 3)}),  # candidato, nivel 1
        _emp(4, {10: (2, 3)}),  # candidato, nivel 2
    ]
    cands = calculo.candidatos_crosstrain(10, empleados, limite=2)
    # orden: nivel_actual desc, desempate por nombre -> Emp2, Emp4
    assert [c.empleado_id for c in cands] == [2, 4]
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_operaciones_calculo.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.operaciones'`.

- [ ] **Step 3: Implementar constantes, tipos y cálculo**

`app/services/operaciones/__init__.py`: archivo vacío.

`app/services/operaciones/constants.py`:

```python
"""Umbrales y topes de la analitica de cobertura (configurables)."""

# Umbrales de semaforo de cobertura (porcentaje de personal que cumple el requisito).
COBERTURA_VERDE_MIN = 80.0
COBERTURA_AMBAR_MIN = 50.0

# Maximo de candidatos de cross-training a devolver por competencia critica.
MAX_CANDIDATOS_CROSSTRAIN = 5
```

`app/services/operaciones/types.py`:

```python
"""Estructuras de datos de la agregacion de cobertura (sin Pydantic ni DB)."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CompetenciaMeta:
    competencia_id: int
    nombre: str
    tipo_nombre: str


@dataclass
class EmpleadoCompetencias:
    empleado_id: int
    no_empleado: int | str
    nombre: str
    puesto_perfil_id: int
    puesto_nombre: str
    # comp_id -> (nivel_actual, nivel_requerido); solo competencias con nivel_requerido >= 1.
    competencias: dict[int, tuple[int, int]]


@dataclass
class CoberturaCompetencia:
    competencia_id: int
    competencia_nombre: str
    tipo_nombre: str
    requieren: int
    cubren: int
    en_entrenamiento: int
    cobertura_pct: float
    semaforo: str   # "verde" | "ambar" | "rojo"
    severidad: str  # "ok" | "punto_unico" | "hueco"


@dataclass
class CandidatoCrossTrain:
    empleado_id: int
    no_empleado: int | str
    nombre: str
    nivel_actual: int
    nivel_requerido: int
```

`app/services/operaciones/calculo.py`:

```python
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
    Ordena peor cobertura primero."""
    agg: dict[int, list[int]] = {}  # comp_id -> [requieren, cubren, en_entrenamiento]
    for e in empleados:
        for comp_id, (actual, requerido) in e.competencias.items():
            if requerido < 1:
                continue
            r = agg.setdefault(comp_id, [0, 0, 0])
            r[0] += 1
            if actual >= requerido:
                r[1] += 1
            elif actual >= 1:
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


def indice_polivalencia_area(empleados: list[EmpleadoCompetencias]) -> float:
    vals = [v for e in empleados if (v := indice_polivalencia_empleado(e)) is not None]
    return round(sum(vals) / len(vals), 1) if vals else 0.0


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
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_operaciones_calculo.py -q`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add app/services/operaciones/ tests/test_operaciones_calculo.py
git commit -m "feat(operaciones): constantes y formulas puras de cobertura y polivalencia"
```

---

### Task 2: Service — enumeración por área, scope y agregación

**Files:**
- Create: `app/services/operaciones_service.py`
- Test: `tests/test_operaciones_service.py`

**Interfaces:**
- Consumes: `app/services/operaciones/calculo.py` + `types.py` (Task 1); `CompetenciaService.obtener_multihabilidades(puesto_perfil_id) -> MultihabilidadesResponse` (existente); `empleado_ids_scope_por_modulo(empleado_repo, current_user, module_key, rh_ui_mode) -> list[int] | None` (`app/core/data_scope.py`); `EmpleadoRepository(db)`.
- Produce (usadas por Task 3 y 4):
  - `OperacionesService(db: AsyncSession)`
  - `async listar_areas(current_user, rh_ui_mode) -> list[AreaResumen]`
  - `async cobertura_area(current_user, area_id, rh_ui_mode) -> CoberturaArea`
  - Métodos internos mockeables: `async _puestos_con_area() -> list[PuestoArea]` y `async _empleados_de_puesto(puesto_id) -> tuple[list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]`.
  - Dataclasses de retorno interno: `AreaResumen(area_id, area_nombre, pol_area_pct, resiliencia_pct, n_criticas, n_empleados)`, `PuestoArea(puesto_perfil_id, puesto_nombre, area_id, area_nombre)`, `CoberturaArea(resumen: AreaResumen, competencias: list[CoberturaCompetencia], puestos: list[PuestoCobertura], criticas: list[Critica])`, `PuestoCobertura(puesto_perfil_id, puesto_nombre, competencias: list[CoberturaCompetencia])`, `Critica(competencia_id, competencia_nombre, severidad, candidatos: list[CandidatoCrossTrain])`.

**Nota de reúso:** `MultihabilidadesResponse.empleados[i]` trae `.niveles: dict[comp_id,int]` (nivel actual) y `.requisitos: dict[comp_id,int]` (nivel requerido del empleado según su grado). La construcción de `EmpleadoCompetencias` toma solo comps con `requisitos[comp_id] >= 1` y `actual = niveles.get(comp_id, 0)`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_operaciones_service.py`. Los tests **mockean** los dos seams (`_puestos_con_area` y `obtener_multihabilidades`) para probar agregación + scope sin sembrar el grafo de competencias:

```python
from unittest.mock import AsyncMock, patch

import pytest

from app.services.operaciones_service import OperacionesService, PuestoArea


def _multihab(puesto_id, puesto_nombre, competencias, empleados):
    """Construye un objeto tipo MultihabilidadesResponse (los reales de
    app.schemas.competencias). empleados: list[(eid, nombre, niveles, requisitos)]."""
    from app.schemas.competencias import (
        MultihabilidadesResponse,
        MultihabilidadesCompetenciaItem,
        MultihabilidadesEmpleadoItem,
    )
    return MultihabilidadesResponse(
        puesto_perfil_id=puesto_id,
        puesto_nombre=puesto_nombre,
        competencias=[
            MultihabilidadesCompetenciaItem(
                competencia_id=c[0], competencia_nombre=c[1],
                tipo_competencia_id=None, tipo_nombre=c[2], nivel_requerido=0,
            ) for c in competencias
        ],
        empleados=[
            MultihabilidadesEmpleadoItem(
                empleado_id=e[0], nombre=e[1], no_empleado=e[0],
                grado_id=None, grado_nombre="", niveles=e[2], requisitos=e[3],
            ) for e in empleados
        ],
        metodos_calificacion=[],
    )


@pytest.mark.asyncio
async def test_cobertura_area_agrega_y_detecta_criticas(db):
    svc = OperacionesService(db)
    # area 5 con 1 puesto; comp 10 cubierta por 1 (punto_unico), comp 20 hueco
    puestos = [PuestoArea(puesto_perfil_id=1, puesto_nombre="Crimpado", area_id=5, area_nombre="Ensamble")]
    multihab = _multihab(
        1, "Crimpado",
        competencias=[(10, "Crimpado manual", "Operacion"), (20, "LOTO", "Seguridad")],
        empleados=[
            (100, "Ana", {10: 3, 20: 1}, {10: 3, 20: 3}),
            (101, "Beto", {10: 1, 20: 0}, {10: 3, 20: 3}),
        ],
    )
    with patch.object(svc, "_puestos_con_area", AsyncMock(return_value=puestos)), \
         patch("app.services.competencia_service.CompetenciaService.obtener_multihabilidades",
               AsyncMock(return_value=multihab)), \
         patch("app.services.operaciones_service.empleado_ids_scope_por_modulo",
               AsyncMock(return_value=None)):
        res = await svc.cobertura_area(current_user=object(), area_id=5, rh_ui_mode=None)
    cobs = {c.competencia_id: c for c in res.competencias}
    assert cobs[10].cubren == 1 and cobs[10].severidad == "punto_unico"
    assert cobs[20].cubren == 0 and cobs[20].severidad == "hueco"
    # criticas: ambas; candidatos de comp 20 = Ana(1) y Beto(0) ordenados por nivel desc
    crit = {c.competencia_id: c for c in res.criticas}
    assert crit[20].candidatos[0].empleado_id == 100  # Ana nivel 1 primero


@pytest.mark.asyncio
async def test_scope_supervisor_filtra_personal(db):
    svc = OperacionesService(db)
    puestos = [PuestoArea(1, "Crimpado", 5, "Ensamble")]
    multihab = _multihab(
        1, "Crimpado", [(10, "Crimpado manual", "Op")],
        empleados=[
            (100, "Ana", {10: 3}, {10: 3}),
            (101, "Beto", {10: 0}, {10: 3}),
        ],
    )
    with patch.object(svc, "_puestos_con_area", AsyncMock(return_value=puestos)), \
         patch("app.services.competencia_service.CompetenciaService.obtener_multihabilidades",
               AsyncMock(return_value=multihab)), \
         patch("app.services.operaciones_service.empleado_ids_scope_por_modulo",
               AsyncMock(return_value=[100])):  # supervisor solo ve a Ana
        res = await svc.cobertura_area(current_user=object(), area_id=5, rh_ui_mode=None)
    cob = res.competencias[0]
    assert cob.requieren == 1 and cob.cubren == 1  # solo Ana entra al calculo


@pytest.mark.asyncio
async def test_area_fuera_de_scope_403(db):
    from app.core.exceptions import ForbiddenError
    svc = OperacionesService(db)
    puestos = [PuestoArea(1, "Crimpado", 5, "Ensamble")]
    multihab = _multihab(1, "Crimpado", [(10, "X", "Op")],
                         empleados=[(100, "Ana", {10: 3}, {10: 3})])
    with patch.object(svc, "_puestos_con_area", AsyncMock(return_value=puestos)), \
         patch("app.services.competencia_service.CompetenciaService.obtener_multihabilidades",
               AsyncMock(return_value=multihab)), \
         patch("app.services.operaciones_service.empleado_ids_scope_por_modulo",
               AsyncMock(return_value=[999])):  # scope sin nadie del area
        with pytest.raises(ForbiddenError):
            await svc.cobertura_area(current_user=object(), area_id=5, rh_ui_mode=None)


@pytest.mark.asyncio
async def test_listar_areas_ordena_por_criticas(db):
    svc = OperacionesService(db)
    puestos = [
        PuestoArea(1, "P1", 5, "Area A"),
        PuestoArea(2, "P2", 6, "Area B"),
    ]
    def _obtener(puesto_id, nombre_filtro=None):
        if puesto_id == 1:  # area A: 1 hueco
            return _multihab(1, "P1", [(10, "X", "Op")],
                             empleados=[(100, "Ana", {10: 0}, {10: 3})])
        return _multihab(2, "P2", [(20, "Y", "Op")],  # area B: cubierta
                         empleados=[(200, "Cid", {20: 3}, {20: 3}), (201, "Dan", {20: 3}, {20: 3})])
    with patch.object(svc, "_puestos_con_area", AsyncMock(return_value=puestos)), \
         patch("app.services.competencia_service.CompetenciaService.obtener_multihabilidades",
               AsyncMock(side_effect=_obtener)), \
         patch("app.services.operaciones_service.empleado_ids_scope_por_modulo",
               AsyncMock(return_value=None)):
        areas = await svc.listar_areas(current_user=object(), rh_ui_mode=None)
    assert [a.area_id for a in areas] == [5, 6]  # A (1 critica) antes que B (0)
    assert areas[0].n_criticas == 1 and areas[1].n_criticas == 0
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.operaciones_service'`.

- [ ] **Step 3: Implementar el service**

Crear `app/services/operaciones_service.py`:

```python
"""Analitica de cobertura y polivalencia por area (solo lectura).

Reutiliza `CompetenciaService.obtener_multihabilidades` (grilla empleado x
competencia por puesto, con manejo de grado) y agrega por area. Scope por rol
via `empleado_ids_scope_por_modulo`. Sin tabla nueva.
"""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.catalogos import Area
from app.models.talento import CompetenciaRequisito, PuestoPerfil
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.competencia_service import CompetenciaService
from app.services.operaciones import calculo
from app.services.operaciones.types import (
    CandidatoCrossTrain,
    CoberturaCompetencia,
    CompetenciaMeta,
    EmpleadoCompetencias,
)

MODULE_KEY = "operaciones"


@dataclass
class PuestoArea:
    puesto_perfil_id: int
    puesto_nombre: str
    area_id: int
    area_nombre: str


@dataclass
class AreaResumen:
    area_id: int
    area_nombre: str
    pol_area_pct: float
    resiliencia_pct: float
    n_criticas: int
    n_empleados: int


@dataclass
class PuestoCobertura:
    puesto_perfil_id: int
    puesto_nombre: str
    competencias: list[CoberturaCompetencia]


@dataclass
class Critica:
    competencia_id: int
    competencia_nombre: str
    severidad: str
    candidatos: list[CandidatoCrossTrain]


@dataclass
class CoberturaArea:
    resumen: AreaResumen
    competencias: list[CoberturaCompetencia]
    puestos: list[PuestoCobertura]
    criticas: list[Critica]


class OperacionesService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.comp_svc = CompetenciaService(db)
        self.empleado_repo = EmpleadoRepository(db)

    async def _puestos_con_area(self) -> list[PuestoArea]:
        """Puestos activos con >= 1 competencia requisito, con su area."""
        result = await self.db.execute(
            select(PuestoPerfil.id, PuestoPerfil.nombre, PuestoPerfil.area_id, Area.descripcion)
            .join(Area, Area.area_id == PuestoPerfil.area_id)
            .where(
                PuestoPerfil.activo.is_(True),
                exists().where(CompetenciaRequisito.puesto_perfil_id == PuestoPerfil.id),
            )
        )
        return [
            PuestoArea(puesto_perfil_id=r[0], puesto_nombre=r[1], area_id=r[2], area_nombre=r[3])
            for r in result.all()
        ]

    async def _empleados_de_puesto(
        self, puesto_perfil_id: int, puesto_nombre: str
    ) -> tuple[list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]:
        resp = await self.comp_svc.obtener_multihabilidades(puesto_perfil_id)
        comp_meta = {
            c.competencia_id: CompetenciaMeta(c.competencia_id, c.competencia_nombre, c.tipo_nombre)
            for c in resp.competencias
        }
        empleados: list[EmpleadoCompetencias] = []
        for emp in resp.empleados:
            comps: dict[int, tuple[int, int]] = {}
            for comp_id, requerido in emp.requisitos.items():
                if requerido < 1:
                    continue
                comps[comp_id] = (emp.niveles.get(comp_id, 0), requerido)
            empleados.append(
                EmpleadoCompetencias(
                    empleado_id=emp.empleado_id,
                    no_empleado=emp.no_empleado,
                    nombre=emp.nombre,
                    puesto_perfil_id=resp.puesto_perfil_id,
                    puesto_nombre=puesto_nombre,
                    competencias=comps,
                )
            )
        return empleados, comp_meta

    async def _cargar_area(
        self, area_id: int, scope: list[int] | None
    ) -> tuple[str, list[PuestoCobertura], list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]:
        """Devuelve (area_nombre, puestos_cobertura, empleados_scope, comp_meta)."""
        puestos = [p for p in await self._puestos_con_area() if p.area_id == area_id]
        area_nombre = puestos[0].area_nombre if puestos else ""
        puestos_cob: list[PuestoCobertura] = []
        empleados_area: list[EmpleadoCompetencias] = []
        comp_meta: dict[int, CompetenciaMeta] = {}
        for p in puestos:
            emps, meta = await self._empleados_de_puesto(p.puesto_perfil_id, p.puesto_nombre)
            comp_meta.update(meta)
            if scope is not None:
                emps = [e for e in emps if e.empleado_id in scope]
            empleados_area.extend(emps)
            puestos_cob.append(
                PuestoCobertura(
                    puesto_perfil_id=p.puesto_perfil_id,
                    puesto_nombre=p.puesto_nombre,
                    competencias=calculo.cobertura_por_competencia(emps, meta),
                )
            )
        return area_nombre, puestos_cob, empleados_area, comp_meta

    def _resumen(self, area_id, area_nombre, empleados, coberturas) -> AreaResumen:
        n_criticas = sum(1 for c in coberturas if c.severidad != "ok")
        return AreaResumen(
            area_id=area_id,
            area_nombre=area_nombre,
            pol_area_pct=calculo.indice_polivalencia_area(empleados),
            resiliencia_pct=calculo.resiliencia_area(coberturas),
            n_criticas=n_criticas,
            n_empleados=len({e.empleado_id for e in empleados}),
        )

    async def listar_areas(self, current_user, rh_ui_mode) -> list[AreaResumen]:
        scope = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        puestos = await self._puestos_con_area()
        # Agrupa puestos por area en una sola pasada.
        por_area: dict[int, tuple[str, list[EmpleadoCompetencias], dict[int, CompetenciaMeta]]] = {}
        for p in puestos:
            emps, meta = await self._empleados_de_puesto(p.puesto_perfil_id, p.puesto_nombre)
            if scope is not None:
                emps = [e for e in emps if e.empleado_id in scope]
            nombre, acc_emps, acc_meta = por_area.setdefault(p.area_id, (p.area_nombre, [], {}))
            acc_emps.extend(emps)
            acc_meta.update(meta)
        resumenes: list[AreaResumen] = []
        for area_id, (nombre, emps, meta) in por_area.items():
            if not emps:
                continue  # area sin personal en scope
            coberturas = calculo.cobertura_por_competencia(emps, meta)
            resumenes.append(self._resumen(area_id, nombre, emps, coberturas))
        resumenes.sort(key=lambda a: (-a.n_criticas, a.area_nombre))
        return resumenes

    async def cobertura_area(self, current_user, area_id: int, rh_ui_mode) -> CoberturaArea:
        scope = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        area_nombre, puestos_cob, empleados, comp_meta = await self._cargar_area(area_id, scope)
        if not puestos_cob:
            # Area inexistente o sin puestos con competencias requisito: nada que mostrar.
            raise NotFoundError(entidad="Area", id=area_id)
        if not empleados:
            # Existe pero no hay personal visible: fuera de scope (jefe) o sin datos (RH).
            if scope is not None:
                raise ForbiddenError(mensaje="Area fuera de tu alcance")
            raise NotFoundError(entidad="Area", id=area_id)
        coberturas = calculo.cobertura_por_competencia(empleados, comp_meta)
        criticas = [
            Critica(
                competencia_id=c.competencia_id,
                competencia_nombre=c.competencia_nombre,
                severidad=c.severidad,
                candidatos=calculo.candidatos_crosstrain(c.competencia_id, empleados),
            )
            for c in coberturas
            if c.severidad != "ok"
        ]
        return CoberturaArea(
            resumen=self._resumen(area_id, area_nombre, empleados, coberturas),
            competencias=coberturas,
            puestos=puestos_cob,
            criticas=criticas,
        )
```

> Nota: verifica las firmas exactas de `NotFoundError`/`ForbiddenError` en `app/core/exceptions.py` (argumentos `entidad`/`id`/`mensaje`) y ajusta las llamadas a la convención real del proyecto antes de correr los tests.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py -q`
Expected: PASS (4 tests). Si `ForbiddenError`/`NotFoundError` reciben otros kwargs, corrige las llamadas y los `pytest.raises`.

- [ ] **Step 5: Commit**

```bash
git add app/services/operaciones_service.py tests/test_operaciones_service.py
git commit -m "feat(operaciones): service de cobertura por area con scope y reuso de multihabilidades"
```

---

### Task 3: Export Excel de la cobertura de un área

**Files:**
- Modify: `app/services/operaciones_service.py` (añadir método `exportar_area_excel`)
- Test: `tests/test_operaciones_service.py` (añadir 1 test)

**Interfaces:**
- Consumes: `OperacionesService.cobertura_area(...)` (Task 2).
- Produce: `async exportar_area_excel(current_user, area_id, rh_ui_mode) -> BytesIO`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_operaciones_service.py`:

```python
@pytest.mark.asyncio
async def test_export_area_genera_xlsx(db, monkeypatch):
    from app.services.operaciones_service import (
        AreaResumen, CoberturaArea, OperacionesService, PuestoCobertura,
    )
    from app.services.operaciones.types import CoberturaCompetencia

    svc = OperacionesService(db)
    fake = CoberturaArea(
        resumen=AreaResumen(5, "Ensamble", 75.0, 50.0, 1, 2),
        competencias=[CoberturaCompetencia(10, "Crimpado", "Op", 2, 1, 1, 50.0, "ambar", "punto_unico")],
        puestos=[PuestoCobertura(1, "Crimpado", [])],
        criticas=[],
    )
    monkeypatch.setattr(svc, "cobertura_area", AsyncMock(return_value=fake))
    out = await svc.exportar_area_excel(current_user=object(), area_id=5, rh_ui_mode=None)
    data = out.getvalue()
    assert data[:2] == b"PK" and len(data) > 100  # xlsx = zip, no vacio
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py::test_export_area_genera_xlsx -q`
Expected: FAIL — `AttributeError: 'OperacionesService' object has no attribute 'exportar_area_excel'`.

- [ ] **Step 3: Implementar el export**

Añadir al inicio de `app/services/operaciones_service.py` el import:

```python
from io import BytesIO
```

Y el método a la clase `OperacionesService` (patrón `MetasService.exportar_ciclo_excel`):

```python
    async def exportar_area_excel(self, current_user, area_id: int, rh_ui_mode) -> BytesIO:
        """xlsx con 3 hojas: Resumen, Cobertura por competencia, Cross-training."""
        from openpyxl import Workbook
        from openpyxl.styles import Font

        cob = await self.cobertura_area(current_user, area_id, rh_ui_mode)
        r = cob.resumen
        wb = Workbook()

        ws = wb.active
        ws.title = "Resumen"
        ws.cell(row=1, column=1, value=f"Cobertura — {r.area_nombre}").font = Font(bold=True, size=14)
        filas = [
            ("Indice de polivalencia (%)", r.pol_area_pct),
            ("Resiliencia (% sin punto unico) ", r.resiliencia_pct),
            ("Competencias criticas", r.n_criticas),
            ("Empleados", r.n_empleados),
        ]
        for i, (etq, val) in enumerate(filas, start=3):
            ws.cell(row=i, column=1, value=etq).font = Font(bold=True)
            ws.cell(row=i, column=2, value=val)

        ws2 = wb.create_sheet("Cobertura por competencia")
        headers = ["Competencia", "Tipo", "Requieren", "Cubren", "En entrenamiento", "Cobertura %", "Semaforo", "Severidad"]
        for col, h in enumerate(headers, 1):
            ws2.cell(row=1, column=col, value=h).font = Font(bold=True)
        for row, c in enumerate(cob.competencias, start=2):
            for col, val in enumerate(
                [c.competencia_nombre, c.tipo_nombre, c.requieren, c.cubren,
                 c.en_entrenamiento, c.cobertura_pct, c.semaforo, c.severidad], 1
            ):
                ws2.cell(row=row, column=col, value=val)

        ws3 = wb.create_sheet("Cross-training")
        h3 = ["Competencia", "Severidad", "Candidato", "No. empleado", "Nivel actual", "Nivel requerido"]
        for col, h in enumerate(h3, 1):
            ws3.cell(row=1, column=col, value=h).font = Font(bold=True)
        row = 2
        for crit in cob.criticas:
            for cand in crit.candidatos:
                for col, val in enumerate(
                    [crit.competencia_nombre, crit.severidad, cand.nombre,
                     cand.no_empleado, cand.nivel_actual, cand.nivel_requerido], 1
                ):
                    ws3.cell(row=row, column=col, value=val)
                row += 1

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py -q`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/services/operaciones_service.py tests/test_operaciones_service.py
git commit -m "feat(operaciones): export xlsx de cobertura por area"
```

---

### Task 4: API — schemas, router, registro de módulo y openapi

**Files:**
- Create: `app/schemas/operaciones.py`
- Create: `app/api/v1/operaciones/__init__.py`, `app/api/v1/operaciones/router.py`
- Modify: `app/core/rh_module_registry.py`
- Modify: `app/main.py`
- Modify: `openapi.yaml`
- Test: `tests/test_operaciones_api.py`

**Interfaces:**
- Consumes: `OperacionesService` (Task 2/3); deps `get_db`, `get_current_user`, `get_rh_ui_mode`, `role_checker`, `gestor_team_role_checker` (`app/core/dependencies.py`).
- Produce: endpoints `GET /api/v1/operaciones/areas`, `GET /api/v1/operaciones/areas/{area_id}/cobertura`, `GET /api/v1/operaciones/areas/{area_id}/export`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_operaciones_api.py`. Usa dependency override para inyectar un usuario y mockear el service (patrón: la app real ya registra el router):

```python
import pytest
from unittest.mock import AsyncMock, patch

from app.services.operaciones_service import AreaResumen, CoberturaArea, PuestoCobertura
from app.services.operaciones.types import CoberturaCompetencia


@pytest.mark.asyncio
async def test_get_areas_ok(client, rh_operativo_headers):
    resumen = AreaResumen(5, "Ensamble", 75.0, 50.0, 1, 3)
    with patch("app.api.v1.operaciones.router.OperacionesService.listar_areas",
               AsyncMock(return_value=[resumen])):
        resp = await client.get("/api/v1/operaciones/areas", headers=rh_operativo_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body[0]["area_id"] == 5 and body[0]["n_criticas"] == 1


@pytest.mark.asyncio
async def test_get_cobertura_shape(client, rh_operativo_headers):
    cob = CoberturaArea(
        resumen=AreaResumen(5, "Ensamble", 75.0, 50.0, 1, 3),
        competencias=[CoberturaCompetencia(10, "Crimpado", "Op", 3, 1, 1, 33.3, "rojo", "punto_unico")],
        puestos=[PuestoCobertura(1, "Crimpado", [])],
        criticas=[],
    )
    with patch("app.api.v1.operaciones.router.OperacionesService.cobertura_area",
               AsyncMock(return_value=cob)):
        resp = await client.get("/api/v1/operaciones/areas/5/cobertura", headers=rh_operativo_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["resumen"]["pol_area_pct"] == 75.0
    assert body["competencias"][0]["semaforo"] == "rojo"


@pytest.mark.asyncio
async def test_operaciones_sin_permiso_403(client, empleado_headers):
    # empleado base: el middleware de permisos por modulo bloquea /api/v1/operaciones
    resp = await client.get("/api/v1/operaciones/areas", headers=empleado_headers)
    assert resp.status_code == 403
```

> Usa los fixtures de auth existentes en `tests/conftest.py` (busca cómo otros `tests/test_*_api.py` obtienen `client`, `rh_operativo_headers`/equivalente y `empleado_headers`; reutiliza esos nombres/factories — no inventes fixtures nuevos). Si el fixture de headers RH operativo tiene otro nombre, ajústalo.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_operaciones_api.py -q`
Expected: FAIL — 404 en las rutas (router no registrado).

- [ ] **Step 3: Implementar schemas, router y registro**

`app/schemas/operaciones.py`:

```python
"""Schemas de respuesta del modulo Operaciones (analitica de cobertura)."""
from __future__ import annotations

from pydantic import BaseModel


class AreaResumenSchema(BaseModel):
    area_id: int
    area_nombre: str
    pol_area_pct: float
    resiliencia_pct: float
    n_criticas: int
    n_empleados: int


class CompetenciaCoberturaSchema(BaseModel):
    competencia_id: int
    competencia_nombre: str
    tipo_nombre: str
    requieren: int
    cubren: int
    en_entrenamiento: int
    cobertura_pct: float
    semaforo: str
    severidad: str


class PuestoCoberturaSchema(BaseModel):
    puesto_perfil_id: int
    puesto_nombre: str
    competencias: list[CompetenciaCoberturaSchema]


class CandidatoCrossTrainSchema(BaseModel):
    empleado_id: int
    no_empleado: int | str
    nombre: str
    nivel_actual: int
    nivel_requerido: int


class CriticaSchema(BaseModel):
    competencia_id: int
    competencia_nombre: str
    severidad: str
    candidatos: list[CandidatoCrossTrainSchema]


class CoberturaAreaResponse(BaseModel):
    resumen: AreaResumenSchema
    competencias: list[CompetenciaCoberturaSchema]
    puestos: list[PuestoCoberturaSchema]
    criticas: list[CriticaSchema]
```

`app/api/v1/operaciones/__init__.py`: archivo vacío.

`app/api/v1/operaciones/router.py`:

```python
"""Router del modulo Operaciones (analitica de cobertura y polivalencia).

Gestion RH/jefatura, solo lectura. Acceso combinado (patron de
`app/api/v1/metas/router.py`): RH con modulo 'operaciones' en modo operativo
(sin scoping) O jefe (supervisor/gerente) con scoping de equipo. No es
self-service. El scope real por rol lo resuelve el service via
`empleado_ids_scope_por_modulo`.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_rh_ui_mode,
    gestor_team_role_checker,
    role_checker,
)
from app.models.empleados import Empleado
from app.schemas.operaciones import AreaResumenSchema, CoberturaAreaResponse
from app.services.operaciones_service import OperacionesService

router = APIRouter(prefix="/api/v1/operaciones", tags=["operaciones"])


def _gestion_or_equipo():
    """RH con modulo 'operaciones' (role_checker(["operativo"])) O jefe con
    scoping de equipo (gestor_team_role_checker). Mismo patron que metas."""
    rh_dep = role_checker(["operativo"])
    equipo_dep = gestor_team_role_checker(["supervisor", "gerente"])

    async def _dep(
        request: Request,
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    ) -> Empleado:
        try:
            return await rh_dep(request=request, current_user=current_user, db=db, rh_ui_mode=rh_ui_mode)
        except Exception:
            return await equipo_dep(current_user=current_user, rh_ui_mode=rh_ui_mode)

    return _dep


@router.get("/areas", response_model=list[AreaResumenSchema])
async def list_areas(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    areas = await OperacionesService(db).listar_areas(current_user, rh_ui_mode)
    return areas


@router.get("/areas/{area_id}/cobertura", response_model=CoberturaAreaResponse)
async def cobertura_area(
    area_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await OperacionesService(db).cobertura_area(current_user, area_id, rh_ui_mode)


@router.get("/areas/{area_id}/export")
async def export_area(
    area_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    output = await OperacionesService(db).exportar_area_excel(current_user, area_id, rh_ui_mode)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=cobertura_area_{area_id}.xlsx"},
    )
```

> `response_model=list[AreaResumenSchema]` / `CoberturaAreaResponse` sobre dataclasses: FastAPI+Pydantic v2 serializa dataclasses por atributo. Si un test de shape falla por validación, añade `model_config = ConfigDict(from_attributes=True)` a los schemas y devuelve los dataclasses tal cual (o mapea a los schemas en el router). Confirma el patrón mirando cómo `metas`/`competencias` devuelven sus response_models.

En `app/core/rh_module_registry.py`, dentro del dict `RH_MODULES`, añadir (junto a las entradas del grupo `Level Up`, cerca de `capacidades`/`evaluacion-360`):

```python
    "operaciones": RhModuleDef(
        key="operaciones",
        label="Cobertura y polivalencia",
        group="Level Up",
        nav_item_ids=("operaciones",),
        hash_prefixes=("#/operaciones",),
        api_prefixes=("/api/v1/operaciones",),
    ),
```

En `app/main.py`, junto a los demás routers Level Up (busca `include_router` de `competencias`/`metas`):

```python
from app.api.v1.operaciones.router import router as operaciones_router
```
y más abajo:
```python
app.include_router(operaciones_router)
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_operaciones_api.py -q`
Expected: PASS (3 tests). Ajusta nombres de fixtures de auth si difieren.

- [ ] **Step 5: Actualizar `openapi.yaml`**

Añadir a `paths:` (recuerda: en este archivo `paths:` va al final, después de `components:`) los 3 endpoints, y a `components.schemas:` los schemas `AreaResumenSchema`, `CompetenciaCoberturaSchema`, `PuestoCoberturaSchema`, `CandidatoCrossTrainSchema`, `CriticaSchema`, `CoberturaAreaResponse`, reflejando exactamente los campos de `app/schemas/operaciones.py`. Sigue el estilo de un endpoint GET existente (p. ej. el bloque de `metas`). Validar YAML:

Run: `docker-compose run --rm test python -c "import yaml; yaml.safe_load(open('openapi.yaml')); print('ok')"`
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add app/schemas/operaciones.py app/api/v1/operaciones/ app/core/rh_module_registry.py app/main.py openapi.yaml tests/test_operaciones_api.py
git commit -m "feat(operaciones): API de cobertura, registro de modulo y openapi"
```

---

### Task 5: Frontend — cliente API, página y wiring de nav/ruta

**Files:**
- Create: `frontend/src/api/operaciones.ts`
- Create: `frontend/src/pages/operaciones.ts`
- Modify: `frontend/src/shellRouter.ts` (ruta `#/operaciones`)
- Modify: `frontend/src/navigation/levelUpNav.ts` (item en `LEVEL_UP_FORMACION` + union de key)
- Modify: `frontend/src/navigation/shellNavPolicy.ts` (union `AppShellNavItemId`)
- Modify: `frontend/src/navigation/rhNav.ts` (union de nav-id)
- Modify: `frontend/src/layouts/appShell.ts` (union `ShellNavKey`)
- Modify: `frontend/src/layouts/shellSidebar.ts` (union de nav-id)
- Modify: `frontend/src/auth/rhModuleRegistry.ts` (regla de hash)

**Interfaces:**
- Consumes: endpoints de Task 4.
- Produce: `mountOperaciones(container: HTMLElement, signal?: AbortSignal): void` (export de `pages/operaciones.ts`).

**Contexto de reúso:** `operaciones` es el análogo exacto de `capacidades` (mismo grupo Level Up, gestión-only, gated por módulo). Wiring = **reflejar `capacidades`** en cada archivo donde aparece como miembro de unión de nav-id, MÁS el item de nav y la ruta. NO tocar `frontend/src/components/vista360/tabs.ts` (ahí `capacidades` es un tab de la ficha, no un ítem de sidebar).

- [ ] **Step 1: Cliente API**

Crear `frontend/src/api/operaciones.ts` (patrón de `frontend/src/api/metas.ts`: `fetchWithAuth`, clase de error, `parseError`):

```typescript
/**
 * Cliente API del modulo Operaciones (analitica de cobertura y polivalencia).
 * Types sincronizados con app/schemas/operaciones.py — no dupliques fuera de aqui.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/operaciones";

export class OperacionesApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response, fallback: string): Promise<never> {
  let detail = fallback;
  try {
    const body = await res.json();
    if (body && typeof body.detail === "string") detail = body.detail;
  } catch {
    /* sin cuerpo JSON */
  }
  throw new OperacionesApiError(detail, res.status);
}

export type Semaforo = "verde" | "ambar" | "rojo";
export type Severidad = "ok" | "punto_unico" | "hueco";

export interface AreaResumen {
  area_id: number;
  area_nombre: string;
  pol_area_pct: number;
  resiliencia_pct: number;
  n_criticas: number;
  n_empleados: number;
}

export interface CompetenciaCobertura {
  competencia_id: number;
  competencia_nombre: string;
  tipo_nombre: string;
  requieren: number;
  cubren: number;
  en_entrenamiento: number;
  cobertura_pct: number;
  semaforo: Semaforo;
  severidad: Severidad;
}

export interface PuestoCobertura {
  puesto_perfil_id: number;
  puesto_nombre: string;
  competencias: CompetenciaCobertura[];
}

export interface CandidatoCrossTrain {
  empleado_id: number;
  no_empleado: number | string;
  nombre: string;
  nivel_actual: number;
  nivel_requerido: number;
}

export interface Critica {
  competencia_id: number;
  competencia_nombre: string;
  severidad: Severidad;
  candidatos: CandidatoCrossTrain[];
}

export interface CoberturaArea {
  resumen: AreaResumen;
  competencias: CompetenciaCobertura[];
  puestos: PuestoCobertura[];
  criticas: Critica[];
}

export async function getAreas(): Promise<AreaResumen[]> {
  const res = await fetchWithAuth(`${BASE}/areas`);
  if (!res.ok) return parseError(res, "No se pudieron cargar las areas");
  return res.json();
}

export async function getCoberturaArea(areaId: number): Promise<CoberturaArea> {
  const res = await fetchWithAuth(`${BASE}/areas/${areaId}/cobertura`);
  if (!res.ok) return parseError(res, "No se pudo cargar la cobertura del area");
  return res.json();
}

export function exportCoberturaAreaUrl(areaId: number): string {
  return `${BASE}/areas/${areaId}/export`;
}
```

> Para la descarga del xlsx con auth, replica exactamente cómo `pages/metas.ts` dispara su export (fetch autenticado → blob → `URL.createObjectURL` → `<a download>`); no uses un `<a href>` directo si el resto del código usa fetch autenticado para exports.

- [ ] **Step 2: Página**

Crear `frontend/src/pages/operaciones.ts` con `export function mountOperaciones(container, signal?)`. Estructura (patrón `pages/metas.ts`): `mountAppShell` con `activeNav: "operaciones"`; per-mount `AbortController` respetando `signal`; `pageHeading("Cobertura y polivalencia")`; selector de área (`getAreas`, orden ya viene por críticas desc); al elegir área, `getCoberturaArea(areaId)` y render de:
  - Tarjetas de resumen: `pol_area_pct`, `resiliencia_pct`, `n_criticas`, `n_empleados` con `tabular-nums`.
  - Tabla de cobertura (fila = competencia; columnas: requerido/cubren/`en_entrenamiento`, barra de `cobertura_pct`, chip de `severidad`). Colores de semáforo desde tokens (`badge*` de `uiTokens.ts`); labels/tono de nivel desde `ui/metodosCalificacionCompetencia.ts`.
  - Drill-down por puesto (`cob.puestos`): mismas competencias por puesto (colapsable).
  - Panel de operaciones críticas (`cob.criticas`) con candidatos (`nombre`, `no_empleado`, `nivel_actual → nivel_requerido`).
  - Botón "Exportar" que descarga el xlsx (ver nota de Step 1).
  - Estados `skeletonBlock` mientras carga y `errorState` en error. Todo string con `escapeHtml`.

Usar solo tokens de `frontend/src/ui/uiTokens.ts`. No introducir hex/fuentes. (Es una página nueva; scálala al design system, sin inventar componentes.)

- [ ] **Step 3: Ruta en el router**

En `frontend/src/shellRouter.ts`, añadir la rama de hash (patrón de import dinámico con `renderLazyPageImportError`, como `#/opls`):

```typescript
    if (h.startsWith("#/operaciones")) {
      void import("./pages/operaciones.ts").then(({ mountOperaciones }) => {
        mountOperaciones(container, signal);
      }).catch((err) => renderLazyPageImportError(container, "operaciones", "Cobertura y polivalencia", err));
      return;
    }
```

- [ ] **Step 4: Item de nav + uniones de nav-id**

En `frontend/src/navigation/levelUpNav.ts`, dentro de `LEVEL_UP_FORMACION`, después del item `capacidades`, añadir:

```typescript
  {
    id: "operaciones",
    key: "operaciones",
    href: "#/operaciones",
    label: "Cobertura y polivalencia",
    svgPaths: `<path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
```

Añadir `| "operaciones"` a la unión de key en `levelUpNav.ts` (junto a `| "capacidades"`).

Verificar y reflejar en las demás uniones de nav-id donde aparece `"capacidades"`:

Run: `grep -rn '"capacidades"' frontend/src/navigation frontend/src/layouts frontend/src/auth`

Añadir `| "operaciones"` (o la sintaxis que use cada archivo) junto a `| "capacidades"` en: `frontend/src/navigation/shellNavPolicy.ts` (`AppShellNavItemId`), `frontend/src/navigation/rhNav.ts`, `frontend/src/layouts/appShell.ts` (`ShellNavKey`), `frontend/src/layouts/shellSidebar.ts`. **No** modificar `frontend/src/components/vista360/tabs.ts`.

- [ ] **Step 5: Regla de hash del registro de módulos frontend**

En `frontend/src/auth/rhModuleRegistry.ts`, en el arreglo `HASH_RULES` (el que termina en `.sort(...)`), añadir:

```typescript
  { key: "operaciones", prefix: "#/operaciones" },
```

(`navItemIdToModuleKey` devuelve el id por identidad, así que `operaciones → operaciones` sin caso especial.)

- [ ] **Step 6: Build y test frontend**

Run: `docker-compose exec -T frontend npm run build`
Expected: build sin errores de TypeScript (solo warnings preexistentes de tamaño de chunk).

Run: `docker-compose exec -T frontend npm run test`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/operaciones.ts frontend/src/pages/operaciones.ts frontend/src/shellRouter.ts frontend/src/navigation/ frontend/src/layouts/ frontend/src/auth/rhModuleRegistry.ts
git commit -m "feat(operaciones): pagina de cobertura y polivalencia con nav y ruta"
```

---

## Verificación final

- `docker-compose run --rm test pytest tests/test_operaciones_calculo.py tests/test_operaciones_service.py tests/test_operaciones_api.py -q` — todo verde.
- `docker-compose run --rm test` — suite completa sin regresiones.
- `docker-compose exec -T frontend npm run build` limpio + `npm run test` verde.
- Manual: como RH abrir `#/operaciones` → elegir un área con competencias requeridas → ver índice de polivalencia, tabla de cobertura con semáforos, competencias críticas con candidatos, y exportar el xlsx; como jefe (supervisor/gerente) confirmar que solo aparecen áreas con su equipo y no las ajenas.

## Notas de riesgo (heredadas del spec)

- **Costo:** `listar_areas` llama `obtener_multihabilidades` una vez por puesto con requisitos de todas las áreas en scope; `cobertura_area`, una vez por puesto del área. Aceptable para el volumen esperado; cache es trabajo futuro, no de este entregable.
- **Doble conteo:** si un empleado tiene perfil activo en 2 puestos del área que requieren la misma competencia, cuenta 2 veces en `cobertura_por_competencia` (raro: normalmente 1 perfil por empleado). Los candidatos de cross-training sí se deduplican por `empleado_id`.
- **Dato dependiente de captura:** áreas sin evaluaciones registradas muestran cobertura baja/real; la UI lleva la leyenda "según evaluaciones registradas". No se inventan datos.
