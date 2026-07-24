# Dashboard de Talento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo `dashboard-talento`: una vista ejecutiva de solo lectura que consolida por área las señales de desempeño, polivalencia, capacitación, PDI e historial objetivo que los módulos existentes ya calculan.

**Architecture:** Agregador sin tabla nueva ni migración. `TalentoService` resuelve el scope de empleados **una sola vez** y se lo pasa explícito a los building blocks existentes (Operaciones, Ciclo de Desempeño, dashboard de Cursos, repositorio de PDI, Historial Objetivo), que se extienden con variantes que aceptan scope explícito **sin cambiar sus firmas públicas actuales**. Cinco endpoints independientes bajo `/api/v1/talento` (uno por bloque) más el detalle de área y el export, para que un bloque lento o caído degrade solo su columna.

**Tech Stack:** FastAPI async + SQLAlchemy async (BD Bono, PostgreSQL), Pydantic v2, openpyxl para el export, pytest/pytest-asyncio con SQLite en memoria, Vite + TypeScript vanilla + Tailwind en el frontend, vitest para tests de front.

**Spec:** `docs/superpowers/specs/2026-07-24-dashboard-talento-design.md` — léela antes de empezar.

## Global Constraints

- **Todo corre en Docker.** No hay Python ni Node local. Backend: `docker-compose run --rm test pytest ...`. Frontend: `docker-compose exec frontend npm run test` / `npm run build`.
- **Idioma:** código, comentarios y docstrings en español sin acentos (patrón del repo, ver `app/services/operaciones/`). Los textos de UI sí llevan acentos.
- **Cero DDL, cero migraciones, cero modelos nuevos.** El módulo entero es de solo lectura. Prohibido crear tablas; si algo pareciera necesitarlas, es señal de que el plan se está desviando.
- **Nunca se toca DATOS_ANALISIS más que leyendo**, y solo a través de `HistorialObjetivoService`.
- **Prefijo `levelup_`:** no aplica aquí porque no se crea ninguna tabla.
- **Firmas públicas existentes intactas:** cada extracción de scope conserva el método público actual, que pasa a delegar. Si un test existente de Operaciones/PDI/Cursos/Historial se rompe, la extracción está mal hecha.
- **Umbrales:** los de polivalencia se **importan** de `app/services/operaciones/constants.py`; los de desempeño salen del ciclo (`umbral_medio`/`umbral_alto`). Nunca se redefinen en Talento.
- **Métrica sin datos = `None`**, que la UI pinta como `n/d`. Jamás `0.0` como sustituto de "no hay datos".
- **Rama:** `feat/cm/dashboard-talento`. Commits Conventional Commits, scope `talento`. Nunca push directo a `main`.
- **Al cerrar:** `openapi.yaml` actualizado con los 7 paths (Tarea 9 y 10 lo hacen incrementalmente).

---

## File Structure

**Backend — nuevo**

| archivo | responsabilidad |
|---|---|
| `app/services/talento/__init__.py` | paquete |
| `app/services/talento/constants.py` | umbrales de capacitación/PDI, topes de foco, meses del rango default |
| `app/services/talento/types.py` | dataclasses puras de entrada/salida de la agregación |
| `app/services/talento/calculo.py` | funciones **puras**: semáforo, agregación por área, promedio ponderado, señales de riesgo, empleados en foco |
| `app/services/talento_service.py` | `TalentoService`: resuelve scope y orquesta los building blocks |
| `app/schemas/talento.py` | respuestas Pydantic de los 7 endpoints |
| `app/api/v1/talento/__init__.py` | paquete |
| `app/api/v1/talento/router.py` | los 7 endpoints |

**Backend — modificado**

| archivo | cambio |
|---|---|
| `app/services/operaciones_service.py` | extraer `listar_areas_con_scope`; agregar `polivalencia_empleados_area` |
| `app/repositories/pdi_repository.py:228` | parámetro opcional `empleado_ids` en `equipo_pdi_aggregates` |
| `app/services/level_up_cursos_dashboard.py` | método público nuevo `resumen_por_area` |
| `app/services/historial_objetivo_service.py` | extraer `indice_equipo_con_scope` |
| `app/core/rh_module_registry.py:402-409` | registrar el módulo `dashboard-talento` |
| `app/main.py` | incluir el router |
| `openapi.yaml` | 7 paths + schemas |

**Frontend — nuevo**

| archivo | responsabilidad |
|---|---|
| `frontend/src/api/talento.ts` | cliente HTTP + tipos sincronizados con `app/schemas/talento.py` |
| `frontend/src/pages/dashboardTalento.ts` | página: banda de KPIs, tabla de áreas, detalle |
| `frontend/src/pages/dashboardTalento.test.ts` | tests de render, orden y degradación |

**Frontend — modificado:** `navigation/talentoNav.ts`, `navigation/shellNavPolicy.ts`, `navigation/rhNav.ts`, `layouts/appShell.ts`, `layouts/shellSidebar.ts`, `auth/rhModuleRegistry.ts`, `shellRouter.ts`.

---

### Task 1: Constantes, tipos y cálculo puro de Talento

**Files:**
- Create: `app/services/talento/__init__.py`
- Create: `app/services/talento/constants.py`
- Create: `app/services/talento/types.py`
- Create: `app/services/talento/calculo.py`
- Test: `tests/test_talento_calculo.py`

**Interfaces:**
- Consumes: `COBERTURA_VERDE_MIN`, `COBERTURA_AMBAR_MIN` de `app/services/operaciones/constants.py`.
- Produces:
  - `semaforo_pct(pct: float | None) -> str | None`
  - `promedio(valores: list[float]) -> float | None`
  - `promedio_ponderado(pares: list[tuple[float, int]]) -> float | None`
  - `dataclass SenalesEmpleado(empleado_id, no_empleado, nombre, puesto_nombre, desempeno_bajo, polivalencia_baja, capacitacion_pendiente, pdi_vencido)` con propiedades `senales_activas -> list[str]` y `n_senales -> int`
  - `empleados_en_foco(senales: list[SenalesEmpleado]) -> list[SenalesEmpleado]`
  - Constantes `CUMPLIMIENTO_VERDE_MIN`, `CUMPLIMIENTO_AMBAR_MIN`, `POLIVALENCIA_BAJA_MAX`, `MIN_SENALES_FOCO`, `MAX_EMPLEADOS_FOCO`, `RANGO_OBJETIVO_MESES_DEFAULT`

- [ ] **Step 1: Crear el paquete y las constantes**

Crear `app/services/talento/__init__.py` vacío (sin contenido).

Crear `app/services/talento/constants.py`:

```python
"""Umbrales y topes del Dashboard de Talento (configurables).

Los umbrales de polivalencia NO se definen aqui: se importan de
`app.services.operaciones.constants` para que el dashboard y el modulo
Operaciones no puedan divergir. Los de desempeno tampoco: salen del propio
ciclo (`umbral_medio` / `umbral_alto`).
"""

from app.services.operaciones.constants import COBERTURA_AMBAR_MIN

# Semaforo de porcentajes de cumplimiento (capacitacion y PDI).
CUMPLIMIENTO_VERDE_MIN = 80.0
CUMPLIMIENTO_AMBAR_MIN = 50.0

# Un empleado cuenta con la senal `polivalencia_baja` si su indice individual
# queda por debajo de este umbral. Es el mismo corte rojo/ambar que usa la
# cobertura en Operaciones: no se inventa un umbral nuevo.
POLIVALENCIA_BAJA_MAX = COBERTURA_AMBAR_MIN

# Un empleado esta "en foco" si acumula al menos esta cantidad de senales malas.
MIN_SENALES_FOCO = 2

# Tope de empleados en foco devueltos por area.
MAX_EMPLEADOS_FOCO = 10

# Rango por defecto del bloque de historial objetivo, en meses hacia atras.
RANGO_OBJETIVO_MESES_DEFAULT = 12
```

- [ ] **Step 2: Crear los tipos puros**

Crear `app/services/talento/types.py`:

```python
"""Estructuras puras de la agregacion del Dashboard de Talento (sin Pydantic ni DB)."""
from __future__ import annotations

from dataclasses import dataclass

# Nombres canonicos de las senales de riesgo. El orden define el orden de los
# badges en la UI.
SENALES = ("desempeno_bajo", "polivalencia_baja", "capacitacion_pendiente", "pdi_vencido")


@dataclass
class SenalesEmpleado:
    """Senales de riesgo de un empleado dentro de un area.

    Cada senal es `True` (mala), `False` (bien) o `None` (no evaluable: no hay
    ciclo, el empleado no tiene competencias requeridas, etc.). `None` NUNCA
    cuenta como senal mala -- la ausencia de dato no es riesgo.
    """

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None = None
    desempeno_bajo: bool | None = None
    polivalencia_baja: bool | None = None
    capacitacion_pendiente: bool | None = None
    pdi_vencido: bool | None = None

    @property
    def senales_activas(self) -> list[str]:
        return [s for s in SENALES if getattr(self, s) is True]

    @property
    def n_senales(self) -> int:
        return len(self.senales_activas)
```

- [ ] **Step 3: Escribir los tests que fallan**

Crear `tests/test_talento_calculo.py`:

```python
"""Tests puros de la agregacion del Dashboard de Talento (sin DB, sin HTTP)."""
import pytest

from app.services.talento import calculo
from app.services.talento.constants import MAX_EMPLEADOS_FOCO
from app.services.talento.types import SenalesEmpleado


# ── semaforo_pct ──────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "pct,esperado",
    [
        (100.0, "verde"),
        (80.0, "verde"),
        (79.9, "ambar"),
        (50.0, "ambar"),
        (49.9, "rojo"),
        (0.0, "rojo"),
    ],
)
def test_semaforo_pct_limites(pct, esperado):
    assert calculo.semaforo_pct(pct) == esperado


def test_semaforo_pct_none_es_none():
    """Sin dato no hay semaforo: la UI pinta n/d, no rojo."""
    assert calculo.semaforo_pct(None) is None


# ── promedios ─────────────────────────────────────────────────────────────
def test_promedio_redondea_a_un_decimal():
    assert calculo.promedio([70.0, 80.0, 91.0]) == 80.3


def test_promedio_lista_vacia_es_none():
    assert calculo.promedio([]) is None


def test_promedio_ponderado_usa_los_pesos():
    """Un area de 90 personas al 100% y otra de 10 al 0% dan 90, no 50."""
    assert calculo.promedio_ponderado([(100.0, 90), (0.0, 10)]) == 90.0


def test_promedio_ponderado_ignora_pesos_cero():
    assert calculo.promedio_ponderado([(80.0, 5), (10.0, 0)]) == 80.0


def test_promedio_ponderado_todos_peso_cero_es_none():
    assert calculo.promedio_ponderado([(80.0, 0)]) is None


def test_promedio_ponderado_lista_vacia_es_none():
    assert calculo.promedio_ponderado([]) is None


# ── senales de empleado ───────────────────────────────────────────────────
def _senales(**kwargs) -> SenalesEmpleado:
    base = dict(empleado_id=1, no_empleado=100, nombre="Ana", puesto_nombre="Crimpado")
    base.update(kwargs)
    return SenalesEmpleado(**base)


def test_n_senales_cuenta_solo_true():
    s = _senales(desempeno_bajo=True, polivalencia_baja=False, pdi_vencido=True)
    assert s.n_senales == 2
    assert s.senales_activas == ["desempeno_bajo", "pdi_vencido"]


def test_senal_none_no_cuenta_como_mala():
    """Sin ciclo activo, `desempeno_bajo` es None y no debe inflar el riesgo."""
    s = _senales(desempeno_bajo=None, polivalencia_baja=True)
    assert s.n_senales == 1


# ── empleados_en_foco ─────────────────────────────────────────────────────
def test_en_foco_requiere_dos_senales():
    una = _senales(empleado_id=1, nombre="Ana", desempeno_bajo=True)
    dos = _senales(empleado_id=2, nombre="Beto", desempeno_bajo=True, pdi_vencido=True)
    foco = calculo.empleados_en_foco([una, dos])
    assert [e.empleado_id for e in foco] == [2]


def test_en_foco_ordena_por_numero_de_senales_desc():
    dos = _senales(empleado_id=1, nombre="Ana", desempeno_bajo=True, pdi_vencido=True)
    cuatro = _senales(
        empleado_id=2, nombre="Beto", desempeno_bajo=True, polivalencia_baja=True,
        capacitacion_pendiente=True, pdi_vencido=True,
    )
    tres = _senales(
        empleado_id=3, nombre="Caro", desempeno_bajo=True, polivalencia_baja=True,
        capacitacion_pendiente=True,
    )
    foco = calculo.empleados_en_foco([dos, cuatro, tres])
    assert [e.empleado_id for e in foco] == [2, 3, 1]


def test_en_foco_desempata_por_nombre():
    a = _senales(empleado_id=1, nombre="Zoe", desempeno_bajo=True, pdi_vencido=True)
    b = _senales(empleado_id=2, nombre="Ana", desempeno_bajo=True, pdi_vencido=True)
    foco = calculo.empleados_en_foco([a, b])
    assert [e.nombre for e in foco] == ["Ana", "Zoe"]


def test_en_foco_aplica_tope():
    muchos = [
        _senales(empleado_id=i, nombre=f"Emp{i:02d}", desempeno_bajo=True, pdi_vencido=True)
        for i in range(MAX_EMPLEADOS_FOCO + 5)
    ]
    assert len(calculo.empleados_en_foco(muchos)) == MAX_EMPLEADOS_FOCO


def test_en_foco_lista_vacia():
    assert calculo.empleados_en_foco([]) == []


def test_en_foco_nadie_califica():
    assert calculo.empleados_en_foco([_senales(desempeno_bajo=True)]) == []
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_talento_calculo.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.talento.calculo'`

- [ ] **Step 5: Implementar `calculo.py`**

Crear `app/services/talento/calculo.py`:

```python
"""Funciones puras de la agregacion del Dashboard de Talento.

Sin acceso a DB ni a sesion: la entrada son datos ya cargados por
`TalentoService` desde los building blocks de cada modulo. Toda la logica
testeable vive aqui.

Convencion central: una metrica sin datos vale `None` (la UI pinta "n/d"),
nunca `0.0`. "No hay planes de desarrollo" y "los planes van al 0%" son cosas
distintas y el dashboard no las confunde.
"""
from __future__ import annotations

from .constants import (
    CUMPLIMIENTO_AMBAR_MIN,
    CUMPLIMIENTO_VERDE_MIN,
    MAX_EMPLEADOS_FOCO,
    MIN_SENALES_FOCO,
)
from .types import SenalesEmpleado


def semaforo_pct(pct: float | None) -> str | None:
    """Semaforo de un porcentaje de cumplimiento. `None` -> `None` (n/d)."""
    if pct is None:
        return None
    if pct >= CUMPLIMIENTO_VERDE_MIN:
        return "verde"
    if pct >= CUMPLIMIENTO_AMBAR_MIN:
        return "ambar"
    return "rojo"


def promedio(valores: list[float]) -> float | None:
    """Promedio simple a 1 decimal. Lista vacia -> None."""
    if not valores:
        return None
    return round(sum(valores) / len(valores), 1)


def promedio_ponderado(pares: list[tuple[float, int]]) -> float | None:
    """Promedio de `(valor, peso)` a 1 decimal, para agregar areas a nivel org
    sin que un area de 3 personas pese igual que una de 300. Peso total 0 -> None."""
    total_peso = sum(peso for _, peso in pares)
    if total_peso <= 0:
        return None
    acumulado = sum(valor * peso for valor, peso in pares)
    return round(acumulado / total_peso, 1)


def empleados_en_foco(senales: list[SenalesEmpleado]) -> list[SenalesEmpleado]:
    """Empleados con al menos `MIN_SENALES_FOCO` senales malas, mas senales
    primero y desempate por nombre, topado a `MAX_EMPLEADOS_FOCO`."""
    candidatos = [s for s in senales if s.n_senales >= MIN_SENALES_FOCO]
    candidatos.sort(key=lambda s: (-s.n_senales, s.nombre))
    return candidatos[:MAX_EMPLEADOS_FOCO]
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_calculo.py -v`
Expected: PASS — 18 passed

- [ ] **Step 7: Commit**

```bash
git add app/services/talento/ tests/test_talento_calculo.py
git commit -m "feat(talento): constantes, tipos y calculo puro del dashboard"
```

---

### Task 2: Scope explícito y polivalencia por empleado en Operaciones

**Files:**
- Modify: `app/services/operaciones_service.py:156-177` (`listar_areas`)
- Test: `tests/test_operaciones_service.py` (agregar casos)

**Interfaces:**
- Consumes: `calculo.indice_polivalencia_empleado` (ya existe en `app/services/operaciones/calculo.py`).
- Produces:
  - `OperacionesService.listar_areas_con_scope(scope: list[int] | None) -> list[AreaResumen]`
  - `OperacionesService.polivalencia_empleados_area(area_id: int, scope: list[int] | None) -> list[PolivalenciaEmpleado]`
  - `dataclass PolivalenciaEmpleado(empleado_id: int, no_empleado: int | str, nombre: str, puesto_nombre: str, pol_pct: float | None)` en `app/services/operaciones_service.py`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `tests/test_operaciones_service.py`:

```python
@pytest.mark.asyncio
async def test_listar_areas_con_scope_filtra_sin_tocar_current_user(db):
    """`listar_areas_con_scope` recibe los ids ya resueltos: no consulta rol ni
    modulo. Es el punto de entrada que usa el Dashboard de Talento."""
    from app.services.operaciones_service import OperacionesService

    datos = await _area_con_dos_empleados(db)  # helper existente del archivo
    svc = OperacionesService(db)

    todos = await svc.listar_areas_con_scope(None)
    assert todos and todos[0].n_empleados == 2

    uno = await svc.listar_areas_con_scope([datos["empleado_a"].empleado_id])
    assert uno[0].n_empleados == 1


@pytest.mark.asyncio
async def test_polivalencia_empleados_area_devuelve_indice_por_persona(db):
    from app.services.operaciones_service import OperacionesService

    datos = await _area_con_dos_empleados(db)
    svc = OperacionesService(db)

    filas = await svc.polivalencia_empleados_area(datos["area"].area_id, None)
    por_id = {f.empleado_id: f for f in filas}
    assert set(por_id) == {
        datos["empleado_a"].empleado_id,
        datos["empleado_b"].empleado_id,
    }
    assert all(f.pol_pct is None or 0.0 <= f.pol_pct <= 100.0 for f in filas)
    assert all(f.nombre for f in filas)


@pytest.mark.asyncio
async def test_polivalencia_empleados_area_respeta_scope(db):
    from app.services.operaciones_service import OperacionesService

    datos = await _area_con_dos_empleados(db)
    svc = OperacionesService(db)

    filas = await svc.polivalencia_empleados_area(
        datos["area"].area_id, [datos["empleado_a"].empleado_id]
    )
    assert [f.empleado_id for f in filas] == [datos["empleado_a"].empleado_id]
```

**Nota para quien implementa:** `_area_con_dos_empleados` es un helper que debes crear si el archivo no lo tiene ya. Revisa primero `tests/test_operaciones_service.py`: si los tests existentes construyen el escenario inline, extrae ese setup a un helper `async def _area_con_dos_empleados(db) -> dict` que devuelva `{"area": ..., "empleado_a": ..., "empleado_b": ..., "puesto": ...}` y refactoriza los tests existentes para usarlo. Los factories vienen de `tests/conftest_talento.py` (`make_area`, `make_puesto_perfil`, `make_competencia`, `make_competencia_requisito`, `make_perfil_funciones`) y `tests/conftest.py` (`make_empleado`).

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py -v -k "con_scope or polivalencia_empleados"`
Expected: FAIL — `AttributeError: 'OperacionesService' object has no attribute 'listar_areas_con_scope'`

- [ ] **Step 3: Implementar la extracción**

En `app/services/operaciones_service.py`, agregar el dataclass junto a los demás (después de `class AreaResumen`, alrededor de la línea 50):

```python
@dataclass
class PolivalenciaEmpleado:
    """Indice de polivalencia de UN empleado dentro de un area.

    Existe para el Dashboard de Talento: `indice_polivalencia_empleado` ya
    calculaba esto, pero hasta ahora solo se consumia promediado por area.
    """

    empleado_id: int
    no_empleado: int | str
    nombre: str
    puesto_nombre: str
    pol_pct: float | None
```

Reemplazar `listar_areas` (líneas 156-177) por:

```python
    async def listar_areas(self, current_user, rh_ui_mode) -> list[AreaResumen]:
        scope = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        return await self.listar_areas_con_scope(scope)

    async def listar_areas_con_scope(self, scope: list[int] | None) -> list[AreaResumen]:
        """Resumen por area con el scope YA resuelto (`None` = universo).

        Separado de `listar_areas` para que el Dashboard de Talento pueda pasar
        el scope que el resolvio con SU module_key, en vez de recalcularlo con
        el de Operaciones -- si cada bloque resolviera el suyo, dos columnas de
        la misma fila saldrian sobre poblaciones distintas."""
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

    async def polivalencia_empleados_area(
        self, area_id: int, scope: list[int] | None
    ) -> list[PolivalenciaEmpleado]:
        """Indice de polivalencia por empleado del area (scope ya resuelto).

        Dedup por empleado_id: si esta asignado a varios puestos del area, se
        queda el indice mas alto -- mismo criterio de `candidatos_crosstrain`."""
        _nombre, _puestos, empleados, _meta = await self._cargar_area(area_id, scope)
        por_empleado: dict[int, PolivalenciaEmpleado] = {}
        for e in empleados:
            pct = calculo.indice_polivalencia_empleado(e)
            prev = por_empleado.get(e.empleado_id)
            if prev is not None and (prev.pol_pct or 0.0) >= (pct or 0.0):
                continue
            por_empleado[e.empleado_id] = PolivalenciaEmpleado(
                empleado_id=e.empleado_id,
                no_empleado=e.no_empleado,
                nombre=e.nombre,
                puesto_nombre=e.puesto_nombre,
                pol_pct=pct,
            )
        return sorted(por_empleado.values(), key=lambda p: p.nombre)
```

- [ ] **Step 4: Correr los tests de Operaciones completos**

Run: `docker-compose run --rm test pytest tests/test_operaciones_service.py tests/test_operaciones_api.py tests/test_operaciones_calculo.py -v`
Expected: PASS — los 3 tests nuevos pasan y **ningún test previo se rompe** (la firma pública de `listar_areas` no cambió).

- [ ] **Step 5: Commit**

```bash
git add app/services/operaciones_service.py tests/test_operaciones_service.py
git commit -m "feat(operaciones): scope explicito y polivalencia por empleado"
```

---

### Task 3: `resumen_por_area` en el dashboard de Cursos

**Files:**
- Modify: `app/services/level_up_cursos_dashboard.py` (agregar método público al final de la clase)
- Test: `tests/test_talento_cursos_resumen.py`

**Interfaces:**
- Consumes: `self._build_pares()`, `self._estado_par(par)`, `self.repo.get_empleados_map(emp_ids)` (existentes).
- Produces: `LevelUpCursosDashboardService.resumen_por_area(empleado_ids_scope: list[int] | None) -> dict[int | None, CursosAreaAgg]` y `dataclass CursosAreaAgg(total_pares: int, completados: int, empleados_obligatorio_pendiente: set[int])` en el mismo módulo.

Las claves del dict son `area_id`; la clave `None` agrupa empleados sin área asignada.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_talento_cursos_resumen.py`:

```python
"""Tests de `resumen_por_area`, el agregador de capacitacion que consume el
Dashboard de Talento. Verifica agregacion, scope y el manejo de obligatorios."""
from unittest.mock import AsyncMock, patch

import pytest

from app.services.level_up_cursos_dashboard import LevelUpCursosDashboardService


class _Curso:
    def __init__(self, id_: int, obligatorio: bool):
        self.id = id_
        self.obligatorio = obligatorio


class _Par:
    def __init__(self, empleado_id: int, curso_id: int):
        self.empleado_id = empleado_id
        self.curso_id = curso_id


class _Emp:
    def __init__(self, empleado_id: int, area_id: int | None):
        self.empleado_id = empleado_id
        self.area_id = area_id


@pytest.mark.asyncio
async def test_resumen_por_area_agrega_y_marca_obligatorios(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=True), 2: _Curso(2, obligatorio=False)}
    pares = {
        (10, 1): _Par(10, 1),  # obligatorio, pendiente
        (10, 2): _Par(10, 2),  # opcional, completado
        (11, 1): _Par(11, 1),  # obligatorio, completado
    }
    estados = {(10, 1): "pendiente", (10, 2): "completado", (11, 1): "completado"}
    empleados = {10: _Emp(10, 7), 11: _Emp(11, 7)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: estados[(p.empleado_id, p.curso_id)]), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area(None)

    agg = resumen[7]
    assert agg.total_pares == 3
    assert agg.completados == 2
    assert agg.empleados_obligatorio_pendiente == {10}


@pytest.mark.asyncio
async def test_resumen_por_area_respeta_scope(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=False)}
    pares = {(10, 1): _Par(10, 1), (11, 1): _Par(11, 1)}
    empleados = {10: _Emp(10, 7), 11: _Emp(11, 7)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: "completado"), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area([10])

    assert resumen[7].total_pares == 1


@pytest.mark.asyncio
async def test_resumen_por_area_empleado_sin_area_va_a_none(db):
    svc = LevelUpCursosDashboardService(db)
    curso_map = {1: _Curso(1, obligatorio=False)}
    pares = {(10, 1): _Par(10, 1)}
    empleados = {10: _Emp(10, None)}

    with patch.object(svc, "_build_pares", AsyncMock(return_value=(curso_map, pares))), \
         patch.object(svc, "_estado_par", side_effect=lambda p: "completado"), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value=empleados)):
        resumen = await svc.resumen_por_area(None)

    assert None in resumen and resumen[None].total_pares == 1


@pytest.mark.asyncio
async def test_resumen_por_area_sin_datos_devuelve_vacio(db):
    svc = LevelUpCursosDashboardService(db)
    with patch.object(svc, "_build_pares", AsyncMock(return_value=({}, {}))), \
         patch.object(svc.repo, "get_empleados_map", AsyncMock(return_value={})):
        assert await svc.resumen_por_area(None) == {}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_talento_cursos_resumen.py -v`
Expected: FAIL — `AttributeError: 'LevelUpCursosDashboardService' object has no attribute 'resumen_por_area'`

- [ ] **Step 3: Implementar el método**

En `app/services/level_up_cursos_dashboard.py`, agregar el dataclass junto a `_ParCursoEmpleado` (alrededor de la línea 35):

```python
@dataclass
class CursosAreaAgg:
    """Agregado de capacitacion de UN area, para el Dashboard de Talento."""

    total_pares: int = 0
    completados: int = 0
    empleados_obligatorio_pendiente: set[int] = field(default_factory=set)
```

Asegúrate de que el import de arriba del archivo incluya `field`: `from dataclasses import dataclass, field`.

Agregar como último método de `LevelUpCursosDashboardService`:

```python
    async def resumen_por_area(
        self, empleado_ids_scope: list[int] | None
    ) -> dict[int | None, CursosAreaAgg]:
        """Agrega el estado de los pares (empleado, curso) por area.

        Punto de entrada del Dashboard de Talento. Reutiliza `_build_pares` y
        `_estado_par`, de modo que el estado de un curso se decide con LA misma
        logica que la pantalla de seguimiento -- aqui no se reimplementa.

        `empleado_ids_scope` = None significa universo. La clave `None` del dict
        agrupa a empleados sin area asignada.
        """
        curso_map, pares = await self._build_pares()
        if empleado_ids_scope is not None:
            permitidos = set(empleado_ids_scope)
            pares = {k: v for k, v in pares.items() if v.empleado_id in permitidos}
        if not pares:
            return {}

        emp_ids = {p.empleado_id for p in pares.values()}
        empleados = await self.repo.get_empleados_map(emp_ids)

        out: dict[int | None, CursosAreaAgg] = {}
        for par in pares.values():
            estado = self._estado_par(par)
            if estado is None:
                continue
            emp = empleados.get(par.empleado_id)
            area_id = emp.area_id if emp is not None else None
            agg = out.setdefault(area_id, CursosAreaAgg())
            agg.total_pares += 1
            if estado == "completado":
                agg.completados += 1
            else:
                curso = curso_map.get(par.curso_id)
                if curso is not None and curso.obligatorio:
                    agg.empleados_obligatorio_pendiente.add(par.empleado_id)
        return out
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_cursos_resumen.py tests/ -k "cursos_dashboard or level_up" -v`
Expected: PASS — los 4 nuevos pasan y los tests existentes del dashboard de cursos siguen verdes.

- [ ] **Step 5: Commit**

```bash
git add app/services/level_up_cursos_dashboard.py tests/test_talento_cursos_resumen.py
git commit -m "feat(talento): agregado de capacitacion por area con scope"
```

---

### Task 4: Filtro por `empleado_ids` en los agregados de PDI

**Files:**
- Modify: `app/repositories/pdi_repository.py:228-257` (`equipo_pdi_aggregates`)
- Test: `tests/test_talento_pdi_repo.py`

**Interfaces:**
- Produces: `PDIRepository.equipo_pdi_aggregates(area_ids=None, area_id=None, empleado_ids=None)`. Cada fila expone `empleado_id`, `total`, `completadas`, `en_proceso`, `pendientes`, `vencidas`, `ultima_actualizacion`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_talento_pdi_repo.py`:

```python
"""El Dashboard de Talento filtra los agregados de PDI por los empleado_ids que
resolvio SU scope, no por area. Este test cubre ese parametro nuevo."""
import pytest

from app.models.talento import PlanDesarrolloIndividual
from app.repositories.pdi_repository import PDIRepository
from tests.conftest import make_empleado


async def _pdi(db, empleado_id: int, estado: str) -> None:
    db.add(
        PlanDesarrolloIndividual(
            empleado_id=empleado_id,
            titulo=f"PDI {empleado_id} {estado}",
            estado=estado,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_equipo_pdi_aggregates_filtra_por_empleado_ids(db):
    a = await make_empleado(db, email="pdi_scope_a@leoni.test")
    b = await make_empleado(db, email="pdi_scope_b@leoni.test")
    await _pdi(db, a.empleado_id, "completado")
    await _pdi(db, b.empleado_id, "pendiente")

    repo = PDIRepository(db)

    todos = await repo.equipo_pdi_aggregates()
    assert {r.empleado_id for r in todos} >= {a.empleado_id, b.empleado_id}

    solo_a = await repo.equipo_pdi_aggregates(empleado_ids=[a.empleado_id])
    assert [r.empleado_id for r in solo_a] == [a.empleado_id]
    assert solo_a[0].total == 1 and solo_a[0].completadas == 1


@pytest.mark.asyncio
async def test_equipo_pdi_aggregates_lista_vacia_devuelve_nada(db):
    """Scope vacio = no ve a nadie. NO debe interpretarse como 'sin filtro'."""
    a = await make_empleado(db, email="pdi_scope_c@leoni.test")
    await _pdi(db, a.empleado_id, "pendiente")

    repo = PDIRepository(db)
    assert await repo.equipo_pdi_aggregates(empleado_ids=[]) == []
```

**Nota:** si el modelo `PlanDesarrolloIndividual` exige más campos obligatorios, complétalos siguiendo cómo lo hacen los tests de PDI existentes (`grep -rn "PlanDesarrolloIndividual(" tests/`).

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_talento_pdi_repo.py -v`
Expected: FAIL — `TypeError: equipo_pdi_aggregates() got an unexpected keyword argument 'empleado_ids'`

- [ ] **Step 3: Implementar el parámetro**

En `app/repositories/pdi_repository.py`, cambiar la firma y agregar el filtro:

```python
    async def equipo_pdi_aggregates(
        self,
        area_ids: list[int] | None = None,
        area_id: int | None = None,
        empleado_ids: list[int] | None = None,
    ) -> list:
```

Y justo antes de `result = await self.db.execute(stmt)`, agregar:

```python
        if empleado_ids is not None:
            # Lista vacia = scope que no ve a nadie. `in_([])` devuelve 0 filas,
            # que es exactamente lo correcto: NO equivale a "sin filtro".
            stmt = stmt.where(PlanDesarrolloIndividual.empleado_id.in_(empleado_ids))
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_pdi_repo.py tests/ -k "pdi" -v`
Expected: PASS — los 2 nuevos pasan y los tests de PDI existentes siguen verdes (el parámetro es opcional).

- [ ] **Step 5: Commit**

```bash
git add app/repositories/pdi_repository.py tests/test_talento_pdi_repo.py
git commit -m "feat(pdi): filtrar agregados de equipo por empleado_ids"
```

---

### Task 5: Scope explícito en Historial Objetivo

**Files:**
- Modify: `app/services/historial_objetivo_service.py:340-435` (`indice_equipo`)
- Test: `tests/test_talento_historial_scope.py`

**Interfaces:**
- Produces: `HistorialObjetivoService.indice_equipo_con_scope(scope_ids: list[int] | None, fecha_inicio: date | None, fecha_fin: date | None) -> HistorialObjetivoEquipoResponse`. `indice_equipo` pasa a resolver el scope y delegar.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_talento_historial_scope.py`:

```python
"""`indice_equipo_con_scope` recibe los ids ya resueltos (lo que necesita el
Dashboard de Talento) y conserva las mismas protecciones de rango que la
version publica."""
from datetime import date

import pytest

from app.core.exceptions import DomainValidationError
from app.services.historial_objetivo_service import HistorialObjetivoService


@pytest.mark.asyncio
async def test_con_scope_universo_exige_rango(db):
    """Sin scope y sin rango, agregaria toda la organizacion sin acotar."""
    svc = HistorialObjetivoService(db)
    with pytest.raises(DomainValidationError):
        await svc.indice_equipo_con_scope(None, None, None)


@pytest.mark.asyncio
async def test_con_scope_acotado_no_exige_rango(db):
    """Con scope de equipo la consulta ya esta acotada por empleado."""
    svc = HistorialObjetivoService(db)
    resp = await svc.indice_equipo_con_scope([1, 2], None, None)
    assert resp.items == ()


@pytest.mark.asyncio
async def test_con_scope_valida_rango_invertido(db):
    svc = HistorialObjetivoService(db)
    with pytest.raises(DomainValidationError):
        await svc.indice_equipo_con_scope([1], date(2026, 5, 1), date(2026, 1, 1))
```

**Nota:** si `test_con_scope_acotado_no_exige_rango` falla porque el engine de bono no está disponible en tests, mira cómo lo resuelven los tests existentes de Historial Objetivo (`grep -rn "bono_disponible\|_bono_engine" tests/`) y aplica el mismo mock; **no** cambies el service para acomodar al test.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_talento_historial_scope.py -v`
Expected: FAIL — `AttributeError: 'HistorialObjetivoService' object has no attribute 'indice_equipo_con_scope'`

- [ ] **Step 3: Implementar la extracción**

En `app/services/historial_objetivo_service.py`, reemplazar el encabezado de `indice_equipo` (líneas 340-352, hasta justo antes de `if scope_ids is not None:`) por:

```python
    async def indice_equipo(
        self,
        current_user: Empleado,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        rh_ui_mode: str | None = None,
    ) -> HistorialObjetivoEquipoResponse:
        scope_ids = await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )
        return await self.indice_equipo_con_scope(scope_ids, fecha_inicio, fecha_fin)

    async def indice_equipo_con_scope(
        self,
        scope_ids: list[int] | None,
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> HistorialObjetivoEquipoResponse:
        """Ranking de equipo con el scope YA resuelto (`None` = universo).

        Lo usa el Dashboard de Talento, que resuelve el scope con SU module_key.
        Conserva intactas las protecciones de la version publica: se valida el
        rango y, sin scope, se exige rango explicito para no agregar el universo
        sin acotar."""
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
```

El resto del cuerpo original (desde `if scope_ids is not None:` en adelante) queda **sin cambios** dentro de `indice_equipo_con_scope`. Verifica que la llamada original a `self._validar_rango_fechas(...)` que estaba al inicio de `indice_equipo` no quede duplicada.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_historial_scope.py tests/ -k "historial_objetivo" -v`
Expected: PASS — los 3 nuevos pasan y los tests existentes de Historial Objetivo siguen verdes.

- [ ] **Step 5: Commit**

```bash
git add app/services/historial_objetivo_service.py tests/test_talento_historial_scope.py
git commit -m "feat(historial-objetivo): variante de indice de equipo con scope explicito"
```

---

### Task 6: `TalentoService` — scope, mapa de áreas y bloques desempeño + polivalencia

**Files:**
- Create: `app/services/talento_service.py`
- Test: `tests/test_talento_service.py`

**Interfaces:**
- Consumes: `empleado_ids_scope_por_modulo` (`app/core/data_scope.py`), `OperacionesService.listar_areas_con_scope`, `CicloDesempenoService.list_ciclos/resultados_ciclo/distribucion_ciclo/construir_9box`, `calculo.promedio/promedio_ponderado/semaforo_pct`.
- Produces:
  - `MODULE_KEY = "dashboard-talento"`
  - `TalentoService(db)` con `scope() -> list[int] | None`, `areas_de_empleados(...) -> dict[int, int | None]`, `ciclo_vigente(ciclo_id) -> CicloDesempenoResponse | None`, `bloque_desempeno(current_user, rh_ui_mode, ciclo_id) -> BloqueDesempeno`, `bloque_polivalencia(current_user, rh_ui_mode) -> BloquePolivalencia`
  - dataclasses `AreaDesempeno`, `BloqueDesempeno`, `AreaPolivalencia`, `BloquePolivalencia`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_talento_service.py`:

```python
"""Tests de orquestacion de TalentoService: que el scope se resuelva UNA vez y
se pase explicito a cada building block, y que la agregacion por area cuadre."""
from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest

from app.services.operaciones_service import AreaResumen
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_bloque_polivalencia_agrega_org_ponderado(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_pol@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    areas = [
        AreaResumen(1, "Arneses A", 100.0, 90.0, 0, 90),
        AreaResumen(2, "Arneses B", 0.0, 10.0, 3, 10),
    ]
    with patch(
        "app.services.talento_service.OperacionesService.listar_areas_con_scope",
        AsyncMock(return_value=areas),
    ):
        bloque = await svc.bloque_polivalencia(rh, None)

    assert bloque.disponible is True
    # Ponderado por personal: 90 personas al 100 y 10 al 0 -> 90.0, no 50.0
    assert bloque.org.pol_pct == 90.0
    assert bloque.org.n_criticas == 3
    assert bloque.org.n_empleados == 100
    assert [a.area_id for a in bloque.areas] == [1, 2]


@pytest.mark.asyncio
async def test_bloque_desempeno_sin_ciclo_no_disponible(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_sinciclo@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[]),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    assert bloque.disponible is False
    assert bloque.motivo == "sin_ciclo"
    assert bloque.areas == []


@pytest.mark.asyncio
async def test_bloque_desempeno_promedia_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_desemp@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    emp_a = await make_empleado(db, email="tal_d_a@leoni.test", area_id=7)
    emp_b = await make_empleado(db, email="tal_d_b@leoni.test", area_id=7)
    svc = TalentoService(db)

    ciclo = _ciclo_stub(ciclo_id=3)
    resultados = [
        _resultado_stub(emp_a.empleado_id, calificacion=80, banda="alto", metas=90),
        _resultado_stub(emp_b.empleado_id, calificacion=40, banda="bajo", metas=50),
    ]
    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[ciclo]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=resultados),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.construir_9box",
        AsyncMock(return_value=_9box_stub()),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    assert bloque.disponible is True
    area = next(a for a in bloque.areas if a.area_id == 7)
    assert area.calificacion_promedio == 60.0
    assert area.cumplimiento_metas_pct == 70.0
    assert area.distribucion == {"bajo": 1, "medio": 0, "alto": 1}
    assert area.con_resultado_pct == 100.0


@pytest.mark.asyncio
async def test_bloque_desempeno_area_sin_calificaciones_es_none(db):
    """Empleados en el ciclo pero sin calificacion -> n/d, NO 0.0."""
    rh = await make_empleado(
        db, rol="rh", email="tal_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    emp = await make_empleado(db, email="tal_nd_e@leoni.test", area_id=9)
    svc = TalentoService(db)

    with patch(
        "app.services.talento_service.CicloDesempenoService.list_ciclos",
        AsyncMock(return_value=[_ciclo_stub(ciclo_id=1)]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=[_resultado_stub(emp.empleado_id, calificacion=None, banda=None, metas=None)]),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.construir_9box",
        AsyncMock(return_value=_9box_stub()),
    ):
        bloque = await svc.bloque_desempeno(rh, None, None)

    area = next(a for a in bloque.areas if a.area_id == 9)
    assert area.calificacion_promedio is None
    assert area.semaforo is None
    assert area.con_resultado_pct == 0.0


@pytest.mark.asyncio
async def test_scope_supervisor_es_su_equipo(db):
    """El scope se resuelve con el module_key del dashboard, no con el de cada bloque."""
    jefe = await make_empleado(db, rol="supervisor", email="tal_jefe@leoni.test")
    sub = await make_empleado(db, email="tal_sub@leoni.test", jefe_id=jefe.empleado_id)
    svc = TalentoService(db)

    ids = await svc.scope(jefe, None)
    assert ids is not None
    assert set(ids) == {jefe.empleado_id, sub.empleado_id}


# ── stubs ─────────────────────────────────────────────────────────────────
def _ciclo_stub(ciclo_id: int, estado: str = "activo"):
    from types import SimpleNamespace

    return SimpleNamespace(
        id=ciclo_id, nombre=f"Ciclo {ciclo_id}", estado=estado,
        fecha_inicio=None, fecha_fin=None,
        umbral_medio=Decimal("50"), umbral_alto=Decimal("75"),
    )


def _resultado_stub(empleado_id: int, calificacion, banda, metas):
    from types import SimpleNamespace

    return SimpleNamespace(
        empleado_id=empleado_id,
        empleado_nombre=f"Emp {empleado_id}",
        calificacion_desempeno=None if calificacion is None else Decimal(str(calificacion)),
        cumplimiento_metas=None if metas is None else Decimal(str(metas)),
        banda_desempeno_efectiva=banda,
        banda_potencial=None,
        segmento_9box=None,
    )


def _9box_stub():
    from types import SimpleNamespace

    return SimpleNamespace(ciclo_id=1, celdas=[])
```

**Nota:** si `make_empleado` no acepta `area_id` o `jefe_id`, revisa su firma en `tests/conftest.py` y usa los nombres reales de esos parámetros.

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_talento_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.talento_service'`

- [ ] **Step 3: Implementar el service**

Crear `app/services/talento_service.py`:

```python
"""Dashboard de Talento: agregador de solo lectura por area.

Principio central: este service NO re-deriva nada de tablas crudas. Consume los
building blocks que ya alimentan cada modulo (Operaciones, Ciclo de Desempeno,
dashboard de Cursos, repositorio de PDI, Historial Objetivo), de modo que sus
numeros cuadran por construccion con la pantalla de origen.

Scope: se resuelve UNA sola vez con el module_key de este modulo y se pasa
explicito a cada bloque. Si cada bloque resolviera el suyo, dos columnas de la
misma fila saldrian calculadas sobre poblaciones distintas.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.data_scope import empleado_ids_scope_por_modulo
from app.models.empleados import Empleado
from app.repositories.empleado_repository import EmpleadoRepository
from app.services.ciclo_desempeno_service import CicloDesempenoService
from app.services.operaciones_service import OperacionesService
from app.services.talento import calculo

MODULE_KEY = "dashboard-talento"


# ── Tipos de salida ───────────────────────────────────────────────────────
@dataclass
class OrgPolivalencia:
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


@dataclass
class AreaPolivalencia:
    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


@dataclass
class BloquePolivalencia:
    disponible: bool
    org: OrgPolivalencia | None
    areas: list[AreaPolivalencia] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaDesempeno:
    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    semaforo: str | None


@dataclass
class OrgDesempeno:
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


@dataclass
class CicloInfo:
    id: int
    nombre: str
    estado: str


@dataclass
class BloqueDesempeno:
    disponible: bool
    ciclo: CicloInfo | None = None
    org: OrgDesempeno | None = None
    areas: list[AreaDesempeno] = field(default_factory=list)
    motivo: str | None = None


def _f(valor: Decimal | float | None) -> float | None:
    return None if valor is None else float(valor)


class TalentoService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)
        self.oper_svc = OperacionesService(db)
        self.ciclo_svc = CicloDesempenoService(db)

    # ── Scope y catalogos ────────────────────────────────────────────────
    async def scope(self, current_user: Empleado, rh_ui_mode: str | None) -> list[int] | None:
        """Ids de empleados visibles (`None` = universo), resueltos con el
        module_key de ESTE modulo. Unico punto donde se decide el scope."""
        return await empleado_ids_scope_por_modulo(
            self.empleado_repo, current_user, MODULE_KEY, rh_ui_mode
        )

    async def areas_de_empleados(self, empleado_ids: list[int]) -> dict[int, int | None]:
        """empleado_id -> area_id. `Empleado.area_id` es el mismo criterio que
        ya usan PDI y el dashboard de cursos para agrupar por area."""
        if not empleado_ids:
            return {}
        result = await self.db.execute(
            select(Empleado.empleado_id, Empleado.area_id).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
        return {row[0]: row[1] for row in result.all()}

    async def nombres_de_areas(self, area_ids: list[int]) -> dict[int, str]:
        """area_id -> descripcion. Tabla legacy `areas`, solo lectura."""
        from app.models.catalogos import Area

        ids = [a for a in area_ids if a is not None]
        if not ids:
            return {}
        result = await self.db.execute(
            select(Area.area_id, Area.descripcion).where(Area.area_id.in_(ids))
        )
        return {row[0]: row[1] for row in result.all()}

    async def ciclo_vigente(self, ciclo_id: int | None):
        """Ciclo a mostrar: el pedido, si no el `activo`, si no el ultimo
        `cerrado` por fecha de fin. `None` si no hay ninguno."""
        if ciclo_id is not None:
            ciclos = await self.ciclo_svc.list_ciclos()
            return next((c for c in ciclos if c.id == ciclo_id), None)
        activos = await self.ciclo_svc.list_ciclos(estado="activo")
        if activos:
            return activos[0]
        cerrados = await self.ciclo_svc.list_ciclos(estado="cerrado")
        if not cerrados:
            return None
        return sorted(
            cerrados, key=lambda c: (c.fecha_fin is None, c.fecha_fin, c.id), reverse=True
        )[0]

    # ── Bloque: polivalencia ─────────────────────────────────────────────
    async def bloque_polivalencia(
        self, current_user: Empleado, rh_ui_mode: str | None
    ) -> BloquePolivalencia:
        scope = await self.scope(current_user, rh_ui_mode)
        resumenes = await self.oper_svc.listar_areas_con_scope(scope)
        areas = [
            AreaPolivalencia(
                area_id=r.area_id,
                area_nombre=r.area_nombre,
                n_empleados=r.n_empleados,
                pol_pct=r.pol_area_pct,
                resiliencia_pct=r.resiliencia_pct,
                n_criticas=r.n_criticas,
                semaforo=calculo.semaforo_pct(r.pol_area_pct),
            )
            for r in resumenes
        ]
        if not areas:
            return BloquePolivalencia(disponible=True, org=None, areas=[], motivo="sin_datos")
        pol_org = calculo.promedio_ponderado([(a.pol_pct or 0.0, a.n_empleados) for a in areas])
        res_org = calculo.promedio_ponderado(
            [(a.resiliencia_pct or 0.0, a.n_empleados) for a in areas]
        )
        org = OrgPolivalencia(
            pol_pct=pol_org,
            resiliencia_pct=res_org,
            n_criticas=sum(a.n_criticas for a in areas),
            n_empleados=sum(a.n_empleados for a in areas),
            semaforo=calculo.semaforo_pct(pol_org),
        )
        return BloquePolivalencia(disponible=True, org=org, areas=areas)

    # ── Bloque: desempeno ────────────────────────────────────────────────
    async def bloque_desempeno(
        self, current_user: Empleado, rh_ui_mode: str | None, ciclo_id: int | None
    ) -> BloqueDesempeno:
        ciclo = await self.ciclo_vigente(ciclo_id)
        if ciclo is None:
            return BloqueDesempeno(disponible=False, motivo="sin_ciclo")

        scope = await self.scope(current_user, rh_ui_mode)
        scope_set = set(scope) if scope is not None else None
        resultados = await self.ciclo_svc.resultados_ciclo(ciclo.id, scope_set)
        if not resultados:
            return BloqueDesempeno(
                disponible=True,
                ciclo=CicloInfo(id=ciclo.id, nombre=ciclo.nombre, estado=ciclo.estado),
                org=None,
                areas=[],
                motivo="sin_resultados",
            )

        area_por_emp = await self.areas_de_empleados([r.empleado_id for r in resultados])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        por_area: dict[int | None, list] = {}
        for r in resultados:
            por_area.setdefault(area_por_emp.get(r.empleado_id), []).append(r)

        areas: list[AreaDesempeno] = []
        for area_id, filas in por_area.items():
            areas.append(self._area_desempeno(area_id, nombres.get(area_id), filas))
        areas.sort(key=lambda a: (a.calificacion_promedio is None, a.calificacion_promedio or 0.0))

        nine_box_resp = await self.ciclo_svc.construir_9box(ciclo.id, scope_set)
        nine_box = {
            celda.segmento: len(celda.empleados) for celda in getattr(nine_box_resp, "celdas", [])
        }
        org_area = self._area_desempeno(None, "org", resultados)
        org = OrgDesempeno(
            calificacion_promedio=org_area.calificacion_promedio,
            cumplimiento_metas_pct=org_area.cumplimiento_metas_pct,
            con_resultado_pct=org_area.con_resultado_pct,
            distribucion=org_area.distribucion,
            nine_box=nine_box,
            semaforo=self._semaforo_desempeno(org_area.calificacion_promedio, ciclo),
            n_empleados=len(resultados),
        )
        for a in areas:
            a.semaforo = self._semaforo_desempeno(a.calificacion_promedio, ciclo)
        return BloqueDesempeno(
            disponible=True,
            ciclo=CicloInfo(id=ciclo.id, nombre=ciclo.nombre, estado=ciclo.estado),
            org=org,
            areas=areas,
        )

    def _area_desempeno(self, area_id, area_nombre, filas) -> AreaDesempeno:
        calificaciones = [
            _f(r.calificacion_desempeno) for r in filas if r.calificacion_desempeno is not None
        ]
        metas = [_f(r.cumplimiento_metas) for r in filas if r.cumplimiento_metas is not None]
        distribucion = {"bajo": 0, "medio": 0, "alto": 0}
        for r in filas:
            banda = r.banda_desempeno_efectiva
            if banda in distribucion:
                distribucion[banda] += 1
        return AreaDesempeno(
            area_id=area_id,
            area_nombre=area_nombre or "Sin area",
            n_empleados=len(filas),
            calificacion_promedio=calculo.promedio(calificaciones),
            cumplimiento_metas_pct=calculo.promedio(metas),
            con_resultado_pct=round(len(calificaciones) / len(filas) * 100, 1) if filas else 0.0,
            distribucion=distribucion,
            semaforo=None,  # lo llena el caller, que conoce los umbrales del ciclo
        )

    @staticmethod
    def _semaforo_desempeno(valor: float | None, ciclo) -> str | None:
        """Semaforo de desempeno con los umbrales DEL CICLO (no los de Talento):
        el dashboard no inventa cortes de desempeno."""
        if valor is None:
            return None
        if valor >= float(ciclo.umbral_alto):
            return "verde"
        if valor >= float(ciclo.umbral_medio):
            return "ambar"
        return "rojo"
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_service.py -v`
Expected: PASS — 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/talento_service.py tests/test_talento_service.py
git commit -m "feat(talento): service con scope unico y bloques de desempeno y polivalencia"
```

---

### Task 7: Bloques de capacitación y PDI

**Files:**
- Modify: `app/services/talento_service.py` (agregar métodos y dataclasses)
- Test: `tests/test_talento_service_capacitacion_pdi.py`

**Interfaces:**
- Consumes: `LevelUpCursosDashboardService.resumen_por_area` (Tarea 3), `PDIRepository.equipo_pdi_aggregates(empleado_ids=...)` (Tarea 4).
- Produces: `TalentoService.bloque_capacitacion(current_user, rh_ui_mode) -> BloqueCapacitacion`, `TalentoService.bloque_pdi(current_user, rh_ui_mode) -> BloquePdi`, y las dataclasses `AreaCapacitacion`, `OrgCapacitacion`, `BloqueCapacitacion`, `AreaPdi`, `OrgPdi`, `BloquePdi`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_talento_service_capacitacion_pdi.py`:

```python
"""Bloques de capacitacion y PDI: agregacion por area, semaforo y la regla de
que 'sin datos' es None y no 0%."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.level_up_cursos_dashboard import CursosAreaAgg
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_bloque_capacitacion_agrega_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_cap@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    resumen = {
        7: CursosAreaAgg(total_pares=10, completados=9, empleados_obligatorio_pendiente={1}),
        8: CursosAreaAgg(total_pares=10, completados=2, empleados_obligatorio_pendiente={2, 3}),
    }
    with patch(
        "app.services.talento_service.LevelUpCursosDashboardService.resumen_por_area",
        AsyncMock(return_value=resumen),
    ), patch.object(
        TalentoService, "nombres_de_areas",
        AsyncMock(return_value={7: "Arneses A", 8: "Arneses B"}),
    ):
        bloque = await svc.bloque_capacitacion(rh, None)

    por_id = {a.area_id: a for a in bloque.areas}
    assert por_id[7].cumplimiento_pct == 90.0
    assert por_id[7].semaforo == "verde"
    assert por_id[8].cumplimiento_pct == 20.0
    assert por_id[8].semaforo == "rojo"
    assert por_id[8].n_obligatorio_pendiente == 2
    assert bloque.org.cumplimiento_pct == 55.0  # 11 completados de 20 pares


@pytest.mark.asyncio
async def test_bloque_capacitacion_area_sin_pares_es_none(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_cap_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    resumen = {7: CursosAreaAgg(total_pares=0, completados=0, empleados_obligatorio_pendiente=set())}
    with patch(
        "app.services.talento_service.LevelUpCursosDashboardService.resumen_por_area",
        AsyncMock(return_value=resumen),
    ), patch.object(TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})):
        bloque = await svc.bloque_capacitacion(rh, None)

    assert bloque.areas[0].cumplimiento_pct is None
    assert bloque.areas[0].semaforo is None


@pytest.mark.asyncio
async def test_bloque_pdi_agrega_y_cuenta_vencidos(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_pdi@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    filas = [
        SimpleNamespace(empleado_id=1, total=4, completadas=2, en_proceso=1, pendientes=1, vencidas=1),
        SimpleNamespace(empleado_id=2, total=2, completadas=2, en_proceso=0, pendientes=0, vencidas=0),
    ]
    with patch(
        "app.services.talento_service.PDIRepository.equipo_pdi_aggregates",
        AsyncMock(return_value=filas),
    ), patch.object(
        TalentoService, "areas_de_empleados", AsyncMock(return_value={1: 7, 2: 7})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        bloque = await svc.bloque_pdi(rh, None)

    area = bloque.areas[0]
    assert area.cumplimiento_pct == 66.7  # 4 completadas de 6
    assert area.n_vencidos == 1
    assert area.n_activos == 1  # 6 - 4 completadas - 1 vencida


@pytest.mark.asyncio
async def test_bloque_pdi_sin_planes_es_none(db):
    """'No hay planes' != 'los planes van al 0%'."""
    rh = await make_empleado(
        db, rol="rh", email="tal_pdi_nd@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.PDIRepository.equipo_pdi_aggregates",
        AsyncMock(return_value=[]),
    ):
        bloque = await svc.bloque_pdi(rh, None)

    assert bloque.disponible is True
    assert bloque.areas == []
    assert bloque.org is None
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_talento_service_capacitacion_pdi.py -v`
Expected: FAIL — `ImportError: cannot import name 'CursosAreaAgg'` no; ese ya existe por la Tarea 3 → el fallo real es `AttributeError: 'TalentoService' object has no attribute 'bloque_capacitacion'`

- [ ] **Step 3: Implementar los bloques**

En `app/services/talento_service.py`, agregar a los imports:

```python
from app.repositories.pdi_repository import PDIRepository
from app.services.level_up_cursos_dashboard import LevelUpCursosDashboardService
```

Agregar las dataclasses después de `BloqueDesempeno`:

```python
@dataclass
class AreaCapacitacion:
    area_id: int | None
    area_nombre: str
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


@dataclass
class OrgCapacitacion:
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


@dataclass
class BloqueCapacitacion:
    disponible: bool
    org: OrgCapacitacion | None = None
    areas: list[AreaCapacitacion] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class AreaPdi:
    area_id: int | None
    area_nombre: str
    total: int
    completados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


@dataclass
class OrgPdi:
    total: int
    completados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


@dataclass
class BloquePdi:
    disponible: bool
    org: OrgPdi | None = None
    areas: list[AreaPdi] = field(default_factory=list)
    motivo: str | None = None
```

En `__init__`, agregar:

```python
        self.cursos_svc = LevelUpCursosDashboardService(db)
        self.pdi_repo = PDIRepository(db)
```

Agregar los métodos al final de la clase:

```python
    @staticmethod
    def _pct(parte: int, total: int) -> float | None:
        """Porcentaje a 1 decimal. Total 0 -> None (n/d), nunca 0.0."""
        if total <= 0:
            return None
        return round(parte / total * 100, 1)

    # ── Bloque: capacitacion ─────────────────────────────────────────────
    async def bloque_capacitacion(
        self, current_user: Empleado, rh_ui_mode: str | None
    ) -> BloqueCapacitacion:
        scope = await self.scope(current_user, rh_ui_mode)
        resumen = await self.cursos_svc.resumen_por_area(scope)
        if not resumen:
            return BloqueCapacitacion(disponible=True, org=None, areas=[], motivo="sin_datos")

        nombres = await self.nombres_de_areas([a for a in resumen if a is not None])
        areas: list[AreaCapacitacion] = []
        for area_id, agg in resumen.items():
            pct = self._pct(agg.completados, agg.total_pares)
            areas.append(
                AreaCapacitacion(
                    area_id=area_id,
                    area_nombre=nombres.get(area_id, "Sin area") if area_id else "Sin area",
                    total_pares=agg.total_pares,
                    completados=agg.completados,
                    cumplimiento_pct=pct,
                    n_obligatorio_pendiente=len(agg.empleados_obligatorio_pendiente),
                    semaforo=calculo.semaforo_pct(pct),
                )
            )
        areas.sort(key=lambda a: (a.cumplimiento_pct is None, a.cumplimiento_pct or 0.0))

        total = sum(a.total_pares for a in areas)
        completados = sum(a.completados for a in areas)
        pct_org = self._pct(completados, total)
        org = OrgCapacitacion(
            total_pares=total,
            completados=completados,
            cumplimiento_pct=pct_org,
            n_obligatorio_pendiente=sum(a.n_obligatorio_pendiente for a in areas),
            semaforo=calculo.semaforo_pct(pct_org),
        )
        return BloqueCapacitacion(disponible=True, org=org, areas=areas)

    # ── Bloque: PDI ──────────────────────────────────────────────────────
    async def bloque_pdi(self, current_user: Empleado, rh_ui_mode: str | None) -> BloquePdi:
        scope = await self.scope(current_user, rh_ui_mode)
        filas = await self.pdi_repo.equipo_pdi_aggregates(empleado_ids=scope)
        if not filas:
            return BloquePdi(disponible=True, org=None, areas=[], motivo="sin_datos")

        area_por_emp = await self.areas_de_empleados([f.empleado_id for f in filas])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        acc: dict[int | None, list[int]] = {}  # area -> [total, completados, vencidos]
        for f in filas:
            area_id = area_por_emp.get(f.empleado_id)
            a = acc.setdefault(area_id, [0, 0, 0])
            a[0] += f.total
            a[1] += f.completadas
            a[2] += f.vencidas

        areas: list[AreaPdi] = []
        for area_id, (total, completados, vencidos) in acc.items():
            pct = self._pct(completados, total)
            areas.append(
                AreaPdi(
                    area_id=area_id,
                    area_nombre=nombres.get(area_id, "Sin area") if area_id else "Sin area",
                    total=total,
                    completados=completados,
                    cumplimiento_pct=pct,
                    n_vencidos=vencidos,
                    n_activos=max(total - completados - vencidos, 0),
                    semaforo=calculo.semaforo_pct(pct),
                )
            )
        areas.sort(key=lambda a: (a.cumplimiento_pct is None, a.cumplimiento_pct or 0.0))

        total = sum(a.total for a in areas)
        completados = sum(a.completados for a in areas)
        pct_org = self._pct(completados, total)
        org = OrgPdi(
            total=total,
            completados=completados,
            cumplimiento_pct=pct_org,
            n_vencidos=sum(a.n_vencidos for a in areas),
            n_activos=sum(a.n_activos for a in areas),
            semaforo=calculo.semaforo_pct(pct_org),
        )
        return BloquePdi(disponible=True, org=org, areas=areas)
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_service_capacitacion_pdi.py tests/test_talento_service.py -v`
Expected: PASS — 9 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/talento_service.py tests/test_talento_service_capacitacion_pdi.py
git commit -m "feat(talento): bloques de capacitacion y PDI por area"
```

---

### Task 8: Bloque objetivo y detalle de área con empleados en foco

**Files:**
- Modify: `app/services/talento_service.py`
- Test: `tests/test_talento_detalle_area.py`

**Interfaces:**
- Consumes: `HistorialObjetivoService.indice_equipo_con_scope` (Tarea 5), `OperacionesService.polivalencia_empleados_area` (Tarea 2), `calculo.empleados_en_foco`, `SenalesEmpleado`.
- Produces: `TalentoService.bloque_objetivo(current_user, rh_ui_mode, desde, hasta, area_id) -> BloqueObjetivo`, `TalentoService.detalle_area(current_user, rh_ui_mode, area_id, ciclo_id) -> DetalleArea`, dataclasses `AreaObjetivo`, `BloqueObjetivo`, `EmpleadoFoco`, `DetalleArea`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_talento_detalle_area.py`:

```python
"""Detalle de area: agregados del area + empleados en foco. Cubre la regla de
que una senal no evaluable no cuenta como riesgo."""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.core.exceptions import ForbiddenError, NotFoundError
from app.services.operaciones_service import PolivalenciaEmpleado
from app.services.talento_service import TalentoService
from tests.conftest import make_empleado


@pytest.mark.asyncio
async def test_detalle_area_marca_empleados_en_foco(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_det@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    polivalencia = [
        PolivalenciaEmpleado(1, 101, "Ana", "Crimpado", 20.0),   # baja
        PolivalenciaEmpleado(2, 102, "Beto", "Crimpado", 95.0),  # ok
    ]
    resultados = [
        SimpleNamespace(empleado_id=1, empleado_nombre="Ana", calificacion_desempeno=None,
                        cumplimiento_metas=None, banda_desempeno_efectiva="bajo",
                        banda_potencial=None, segmento_9box=None),
        SimpleNamespace(empleado_id=2, empleado_nombre="Beto", calificacion_desempeno=None,
                        cumplimiento_metas=None, banda_desempeno_efectiva="alto",
                        banda_potencial=None, segmento_9box=None),
    ]
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(return_value=polivalencia),
    ), patch.object(
        TalentoService, "ciclo_vigente",
        AsyncMock(return_value=SimpleNamespace(id=1, nombre="C1", estado="activo",
                                               umbral_medio=50, umbral_alto=75)),
    ), patch(
        "app.services.talento_service.CicloDesempenoService.resultados_ciclo",
        AsyncMock(return_value=resultados),
    ), patch.object(
        TalentoService, "_pdi_vencido_por_empleado", AsyncMock(return_value={1: True, 2: False})
    ), patch.object(
        TalentoService, "_obligatorio_pendiente_por_empleado",
        AsyncMock(return_value={1: False, 2: False}),
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        detalle = await svc.detalle_area(rh, None, 7, None)

    # Ana: desempeno_bajo + polivalencia_baja + pdi_vencido = 3 senales -> en foco
    assert [e.empleado_id for e in detalle.empleados_foco] == [1]
    assert set(detalle.empleados_foco[0].senales) == {
        "desempeno_bajo", "polivalencia_baja", "pdi_vencido"
    }


@pytest.mark.asyncio
async def test_detalle_area_sin_ciclo_no_inventa_senal_de_desempeno(db):
    """Sin ciclo, `desempeno_bajo` queda en None y Ana solo suma 2 senales."""
    rh = await make_empleado(
        db, rol="rh", email="tal_det2@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(return_value=[PolivalenciaEmpleado(1, 101, "Ana", "Crimpado", 10.0)]),
    ), patch.object(
        TalentoService, "ciclo_vigente", AsyncMock(return_value=None)
    ), patch.object(
        TalentoService, "_pdi_vencido_por_empleado", AsyncMock(return_value={1: True})
    ), patch.object(
        TalentoService, "_obligatorio_pendiente_por_empleado", AsyncMock(return_value={1: False})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        detalle = await svc.detalle_area(rh, None, 7, None)

    foco = detalle.empleados_foco[0]
    assert set(foco.senales) == {"polivalencia_baja", "pdi_vencido"}
    assert "desempeno_bajo" not in foco.senales


@pytest.mark.asyncio
async def test_detalle_area_fuera_de_scope_403(db):
    jefe = await make_empleado(db, rol="supervisor", email="tal_jefe2@leoni.test")
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(side_effect=ForbiddenError(detail="Area fuera de tu alcance")),
    ):
        with pytest.raises(ForbiddenError):
            await svc.detalle_area(jefe, None, 99, None)


@pytest.mark.asyncio
async def test_detalle_area_inexistente_404(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_det404@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    with patch(
        "app.services.talento_service.OperacionesService.polivalencia_empleados_area",
        AsyncMock(side_effect=NotFoundError(entidad="Area", id=99)),
    ):
        with pytest.raises(NotFoundError):
            await svc.detalle_area(rh, None, 99, None)


@pytest.mark.asyncio
async def test_bloque_objetivo_promedia_por_area(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_obj@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    items = (
        SimpleNamespace(empleado_id=1, resultado=SimpleNamespace(indice=80.0)),
        SimpleNamespace(empleado_id=2, resultado=SimpleNamespace(indice=60.0)),
    )
    resp = SimpleNamespace(items=items, bono_disponible=True)
    with patch(
        "app.services.talento_service.HistorialObjetivoService.indice_equipo_con_scope",
        AsyncMock(return_value=resp),
    ), patch.object(
        TalentoService, "areas_de_empleados", AsyncMock(return_value={1: 7, 2: 7})
    ), patch.object(
        TalentoService, "nombres_de_areas", AsyncMock(return_value={7: "Arneses A"})
    ):
        bloque = await svc.bloque_objetivo(rh, None, None, None, None)

    assert bloque.disponible is True
    assert bloque.areas[0].indice_promedio == 70.0
    assert bloque.org.indice_promedio == 70.0
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_talento_detalle_area.py -v`
Expected: FAIL — `AttributeError: 'TalentoService' object has no attribute 'detalle_area'`

- [ ] **Step 3: Implementar bloque objetivo y detalle**

En `app/services/talento_service.py`, agregar a los imports:

```python
from datetime import date, timedelta

from app.services.historial_objetivo_service import HistorialObjetivoService
from app.services.talento.constants import (
    POLIVALENCIA_BAJA_MAX,
    RANGO_OBJETIVO_MESES_DEFAULT,
)
from app.services.talento.types import SenalesEmpleado
```

Agregar las dataclasses:

```python
@dataclass
class AreaObjetivo:
    area_id: int | None
    area_nombre: str
    n_empleados: int
    indice_promedio: float | None


@dataclass
class OrgObjetivo:
    n_empleados: int
    indice_promedio: float | None


@dataclass
class RangoObjetivo:
    desde: date
    hasta: date


@dataclass
class EmpleadoFoco:
    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None
    senales: list[str]


@dataclass
class BloqueObjetivo:
    disponible: bool
    rango: RangoObjetivo | None = None
    org: OrgObjetivo | None = None
    areas: list[AreaObjetivo] = field(default_factory=list)
    motivo: str | None = None


@dataclass
class DetalleArea:
    area_id: int
    area_nombre: str
    desempeno: AreaDesempeno | None
    polivalencia: AreaPolivalencia | None
    capacitacion: AreaCapacitacion | None
    pdi: AreaPdi | None
    empleados_foco: list[EmpleadoFoco] = field(default_factory=list)
```

En `__init__`, agregar `self.historial_svc = HistorialObjetivoService(db)`.

Agregar los métodos:

```python
    # ── Bloque: historial objetivo (diferido) ────────────────────────────
    async def bloque_objetivo(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
        desde: date | None,
        hasta: date | None,
        area_id: int | None,
    ) -> BloqueObjetivo:
        """Indice objetivo (0-100) promediado por area.

        Se sirve en su propio endpoint porque consulta DATOS_ANALISIS: si esa BD
        no responde, solo esta columna se cae. NO confundir este indice con el
        `indice_historial` del resultado del ciclo: aquel ya va ponderado dentro
        de la calificacion de desempeno y se calcula sobre el rango del ciclo."""
        if hasta is None:
            hasta = date.today()
        if desde is None:
            desde = hasta - timedelta(days=30 * RANGO_OBJETIVO_MESES_DEFAULT)

        scope = await self.scope(current_user, rh_ui_mode)
        resp = await self.historial_svc.indice_equipo_con_scope(scope, desde, hasta)
        rango = RangoObjetivo(desde=desde, hasta=hasta)
        if not resp.items:
            return BloqueObjetivo(disponible=True, rango=rango, org=None, areas=[], motivo="sin_datos")

        area_por_emp = await self.areas_de_empleados([i.empleado_id for i in resp.items])
        nombres = await self.nombres_de_areas(list({a for a in area_por_emp.values()}))

        por_area: dict[int | None, list[float]] = {}
        for item in resp.items:
            a = area_por_emp.get(item.empleado_id)
            if area_id is not None and a != area_id:
                continue
            por_area.setdefault(a, []).append(float(item.resultado.indice))

        areas = [
            AreaObjetivo(
                area_id=aid,
                area_nombre=(nombres.get(aid, "Sin area") if aid else "Sin area"),
                n_empleados=len(indices),
                indice_promedio=calculo.promedio(indices),
            )
            for aid, indices in por_area.items()
        ]
        areas.sort(key=lambda a: (a.indice_promedio is None, a.indice_promedio or 0.0))
        todos = [v for indices in por_area.values() for v in indices]
        org = OrgObjetivo(n_empleados=len(todos), indice_promedio=calculo.promedio(todos))
        return BloqueObjetivo(disponible=True, rango=rango, org=org, areas=areas)

    # ── Senales por empleado (detalle de area) ───────────────────────────
    async def _pdi_vencido_por_empleado(self, empleado_ids: list[int]) -> dict[int, bool]:
        if not empleado_ids:
            return {}
        filas = await self.pdi_repo.equipo_pdi_aggregates(empleado_ids=empleado_ids)
        return {f.empleado_id: f.vencidas > 0 for f in filas}

    async def _obligatorio_pendiente_por_empleado(
        self, empleado_ids: list[int]
    ) -> dict[int, bool]:
        if not empleado_ids:
            return {}
        resumen = await self.cursos_svc.resumen_por_area(empleado_ids)
        pendientes: set[int] = set()
        for agg in resumen.values():
            pendientes |= agg.empleados_obligatorio_pendiente
        return {eid: eid in pendientes for eid in empleado_ids}

    async def detalle_area(
        self,
        current_user: Empleado,
        rh_ui_mode: str | None,
        area_id: int,
        ciclo_id: int | None,
    ) -> DetalleArea:
        """Agregados del area + empleados en foco.

        `polivalencia_empleados_area` es quien decide visibilidad: propaga
        `NotFoundError` (area inexistente) o `ForbiddenError` (fuera de scope),
        mismo criterio que `cobertura_area` en Operaciones."""
        scope = await self.scope(current_user, rh_ui_mode)
        polivalencia = await self.oper_svc.polivalencia_empleados_area(area_id, scope)
        empleado_ids = [p.empleado_id for p in polivalencia]

        ciclo = await self.ciclo_vigente(ciclo_id)
        banda_por_emp: dict[int, str | None] = {}
        area_desempeno: AreaDesempeno | None = None
        if ciclo is not None:
            resultados = await self.ciclo_svc.resultados_ciclo(ciclo.id, set(empleado_ids))
            banda_por_emp = {r.empleado_id: r.banda_desempeno_efectiva for r in resultados}
            if resultados:
                nombres_area = await self.nombres_de_areas([area_id])
                area_desempeno = self._area_desempeno(
                    area_id, nombres_area.get(area_id), resultados
                )
                area_desempeno.semaforo = self._semaforo_desempeno(
                    area_desempeno.calificacion_promedio, ciclo
                )

        pdi_vencido = await self._pdi_vencido_por_empleado(empleado_ids)
        obligatorio = await self._obligatorio_pendiente_por_empleado(empleado_ids)

        senales = [
            SenalesEmpleado(
                empleado_id=p.empleado_id,
                no_empleado=p.no_empleado,
                nombre=p.nombre,
                puesto_nombre=p.puesto_nombre,
                desempeno_bajo=(
                    None
                    if p.empleado_id not in banda_por_emp
                    else banda_por_emp[p.empleado_id] == "bajo"
                ),
                polivalencia_baja=(
                    None if p.pol_pct is None else p.pol_pct < POLIVALENCIA_BAJA_MAX
                ),
                capacitacion_pendiente=obligatorio.get(p.empleado_id),
                pdi_vencido=pdi_vencido.get(p.empleado_id),
            )
            for p in polivalencia
        ]
        foco = [
            EmpleadoFoco(
                empleado_id=s.empleado_id,
                no_empleado=s.no_empleado,
                nombre=s.nombre,
                puesto_nombre=s.puesto_nombre,
                senales=s.senales_activas,
            )
            for s in calculo.empleados_en_foco(senales)
        ]

        nombres = await self.nombres_de_areas([area_id])
        bloque_pol = await self.bloque_polivalencia(current_user, rh_ui_mode)
        bloque_cap = await self.bloque_capacitacion(current_user, rh_ui_mode)
        bloque_pdi = await self.bloque_pdi(current_user, rh_ui_mode)
        return DetalleArea(
            area_id=area_id,
            area_nombre=nombres.get(area_id, "Sin area"),
            desempeno=area_desempeno,
            polivalencia=next((a for a in bloque_pol.areas if a.area_id == area_id), None),
            capacitacion=next((a for a in bloque_cap.areas if a.area_id == area_id), None),
            pdi=next((a for a in bloque_pdi.areas if a.area_id == area_id), None),
            empleados_foco=foco,
        )
```

**Nota de rendimiento (deliberada):** `detalle_area` reusa `bloque_polivalencia`,
`bloque_capacitacion` y `bloque_pdi` completos y se queda con la fila del área. Agrega de
más, pero garantiza que el número del detalle sea **idéntico** al de la tabla, que es la
propiedad que importa. Si el detalle resulta lento en producción, el siguiente paso es
extraer un `_agregados_de_area(area_id, scope)` que filtre antes de agregar — **no**
optimizar antes de medir, y nunca duplicando la fórmula.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_detalle_area.py tests/test_talento_service.py tests/test_talento_service_capacitacion_pdi.py -v`
Expected: PASS — 14 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/talento_service.py tests/test_talento_detalle_area.py
git commit -m "feat(talento): bloque de historial objetivo y detalle de area con empleados en foco"
```

---

### Task 9: Schemas, router y registro del módulo

**Files:**
- Create: `app/schemas/talento.py`
- Create: `app/api/v1/talento/__init__.py`
- Create: `app/api/v1/talento/router.py`
- Modify: `app/core/rh_module_registry.py` (después de la entrada `operaciones`, línea 409)
- Modify: `app/main.py`
- Modify: `openapi.yaml`
- Test: `tests/test_talento_api.py`

**Interfaces:**
- Consumes: todos los métodos de `TalentoService` (Tareas 6-8).
- Produces: los 6 endpoints GET de datos bajo `/api/v1/talento` y los schemas Pydantic correspondientes.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_talento_api.py`:

```python
"""Tests HTTP del router del Dashboard de Talento."""
from unittest.mock import AsyncMock, patch

import pytest

from app.services.talento_service import (
    AreaPolivalencia,
    BloqueDesempeno,
    BloquePolivalencia,
    OrgPolivalencia,
)
from tests.conftest import auth_headers, make_empleado

BASE = "/api/v1/talento"


async def _rh(db, email: str):
    return await make_empleado(
        db, rol="rh", email=email,
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )


@pytest.mark.asyncio
async def test_polivalencia_ok(client, db):
    rh = await _rh(db, "tal_api_pol@leoni.test")
    headers = await auth_headers(client, rh)
    bloque = BloquePolivalencia(
        disponible=True,
        org=OrgPolivalencia(70.0, 60.0, 4, 100, "ambar"),
        areas=[AreaPolivalencia(1, "Arneses A", 40, 70.0, 60.0, 2, "ambar")],
    )
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_polivalencia",
        AsyncMock(return_value=bloque),
    ):
        resp = await client.get(f"{BASE}/polivalencia", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["org"]["pol_pct"] == 70.0
    assert body["areas"][0]["area_nombre"] == "Arneses A"


@pytest.mark.asyncio
async def test_desempeno_sin_ciclo_devuelve_200_no_disponible(client, db):
    rh = await _rh(db, "tal_api_sinciclo@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_desempeno",
        AsyncMock(return_value=BloqueDesempeno(disponible=False, motivo="sin_ciclo")),
    ):
        resp = await client.get(f"{BASE}/desempeno", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["disponible"] is False and body["motivo"] == "sin_ciclo"


@pytest.mark.asyncio
async def test_objetivo_caido_no_afecta_a_los_demas_bloques(client, db):
    """El bloque externo vive en su propia ruta: si DATOS_ANALISIS falla, solo
    esa llamada se cae y las otras cuatro siguen sirviendo."""
    rh = await _rh(db, "tal_api_obj@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.bloque_objetivo",
        AsyncMock(side_effect=RuntimeError("DATOS_ANALISIS caido")),
    ), patch(
        "app.api.v1.talento.router.TalentoService.bloque_polivalencia",
        AsyncMock(return_value=BloquePolivalencia(disponible=True, org=None, areas=[])),
    ):
        try:
            objetivo = await client.get(f"{BASE}/objetivo", headers=headers)
            # Segun la config del transporte de test, la excepcion puede
            # propagarse o convertirse en 500. Ambas son "el bloque se cayo".
            assert objetivo.status_code >= 500
        except RuntimeError:
            pass

        resp = await client.get(f"{BASE}/polivalencia", headers=headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_sin_modulo_403(client, db):
    emp = await make_empleado(db, rol="empleado", email="tal_api_emp@leoni.test")
    headers = await auth_headers(client, emp)
    for ruta in ("polivalencia", "desempeno", "capacitacion", "pdi", "objetivo"):
        resp = await client.get(f"{BASE}/{ruta}", headers=headers)
        assert resp.status_code == 403, f"{ruta}: {resp.text}"


@pytest.mark.asyncio
async def test_detalle_area_fuera_de_scope_403(client, db):
    from app.core.exceptions import ForbiddenError

    rh = await _rh(db, "tal_api_det@leoni.test")
    headers = await auth_headers(client, rh)
    with patch(
        "app.api.v1.talento.router.TalentoService.detalle_area",
        AsyncMock(side_effect=ForbiddenError(detail="Area fuera de tu alcance")),
    ):
        resp = await client.get(f"{BASE}/areas/9/detalle", headers=headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_coherencia_con_operaciones(client, db):
    """El pol_area_pct del dashboard es el MISMO numero que reporta Operaciones:
    ambos salen de `listar_areas_con_scope`. Si esto se rompe, alguien duplico
    el calculo."""
    from app.services.operaciones_service import AreaResumen

    rh = await make_empleado(
        db, rol="rh", email="tal_api_coh@leoni.test",
        modulos_rh={"dashboard-talento": True, "operaciones": True},
        inscrito_modulos_rh=True,
    )
    headers = await auth_headers(client, rh)
    areas = [AreaResumen(1, "Arneses A", 73.5, 61.0, 2, 40)]
    with patch(
        "app.services.operaciones_service.OperacionesService.listar_areas_con_scope",
        AsyncMock(return_value=areas),
    ):
        dash = await client.get(f"{BASE}/polivalencia", headers=headers)
        oper = await client.get("/api/v1/operaciones/areas", headers=headers)

    assert dash.status_code == 200 and oper.status_code == 200
    assert dash.json()["areas"][0]["pol_pct"] == oper.json()[0]["pol_area_pct"] == 73.5
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_talento_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.api.v1.talento'`

- [ ] **Step 3: Crear los schemas**

Crear `app/schemas/talento.py`:

```python
"""Schemas de respuesta del Dashboard de Talento (solo lectura).

Sincronizados con `frontend/src/api/talento.ts`. Cada bloque comparte la misma
forma -- `disponible` + `org` + `areas[]` -- para que el frontend los trate de
forma uniforme y pueda pintar cada columna en cuanto llega.
"""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict

_CFG = ConfigDict(from_attributes=True)


class CicloInfoSchema(BaseModel):
    model_config = _CFG

    id: int
    nombre: str
    estado: str


class AreaDesempenoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    semaforo: str | None


class OrgDesempenoSchema(BaseModel):
    model_config = _CFG

    calificacion_promedio: float | None
    cumplimiento_metas_pct: float | None
    con_resultado_pct: float
    distribucion: dict[str, int]
    nine_box: dict[str, int]
    semaforo: str | None
    n_empleados: int


class BloqueDesempenoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    ciclo: CicloInfoSchema | None = None
    org: OrgDesempenoSchema | None = None
    areas: list[AreaDesempenoSchema] = []


class AreaPolivalenciaSchema(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    n_empleados: int
    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    semaforo: str | None


class OrgPolivalenciaSchema(BaseModel):
    model_config = _CFG

    pol_pct: float | None
    resiliencia_pct: float | None
    n_criticas: int
    n_empleados: int
    semaforo: str | None


class BloquePolivalenciaResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPolivalenciaSchema | None = None
    areas: list[AreaPolivalenciaSchema] = []


class AreaCapacitacionSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class OrgCapacitacionSchema(BaseModel):
    model_config = _CFG

    total_pares: int
    completados: int
    cumplimiento_pct: float | None
    n_obligatorio_pendiente: int
    semaforo: str | None


class BloqueCapacitacionResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgCapacitacionSchema | None = None
    areas: list[AreaCapacitacionSchema] = []


class AreaPdiSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    total: int
    completados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class OrgPdiSchema(BaseModel):
    model_config = _CFG

    total: int
    completados: int
    cumplimiento_pct: float | None
    n_vencidos: int
    n_activos: int
    semaforo: str | None


class BloquePdiResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    org: OrgPdiSchema | None = None
    areas: list[AreaPdiSchema] = []


class RangoObjetivoSchema(BaseModel):
    model_config = _CFG

    desde: date
    hasta: date


class AreaObjetivoSchema(BaseModel):
    model_config = _CFG

    area_id: int | None
    area_nombre: str
    n_empleados: int
    indice_promedio: float | None


class OrgObjetivoSchema(BaseModel):
    model_config = _CFG

    n_empleados: int
    indice_promedio: float | None


class BloqueObjetivoResponse(BaseModel):
    model_config = _CFG

    disponible: bool
    motivo: str | None = None
    rango: RangoObjetivoSchema | None = None
    org: OrgObjetivoSchema | None = None
    areas: list[AreaObjetivoSchema] = []


class EmpleadoFocoSchema(BaseModel):
    model_config = _CFG

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None
    senales: list[str]


class DetalleAreaResponse(BaseModel):
    model_config = _CFG

    area_id: int
    area_nombre: str
    desempeno: AreaDesempenoSchema | None
    polivalencia: AreaPolivalenciaSchema | None
    capacitacion: AreaCapacitacionSchema | None
    pdi: AreaPdiSchema | None
    empleados_foco: list[EmpleadoFocoSchema] = []
```

- [ ] **Step 4: Crear el router**

Crear `app/api/v1/talento/__init__.py` vacío.

Crear `app/api/v1/talento/router.py`:

```python
"""Router del Dashboard de Talento (consolidacion por area, solo lectura).

Acceso combinado, mismo patron que Operaciones (`_gestion_or_equipo`): RH con el
modulo 'dashboard-talento' en modo operativo, O jefe con scoping de equipo. No es
self-service. El scope real lo resuelve `TalentoService` con SU module_key.

Un endpoint por bloque a proposito: el bloque de historial objetivo consulta
DATOS_ANALISIS y, si esa BD no responde, solo esa llamada falla.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_rh_ui_mode,
    gestor_team_role_checker,
    role_checker,
)
from app.models.empleados import Empleado
from app.schemas.talento import (
    BloqueCapacitacionResponse,
    BloqueDesempenoResponse,
    BloqueObjetivoResponse,
    BloquePdiResponse,
    BloquePolivalenciaResponse,
    DetalleAreaResponse,
)
from app.services.talento_service import TalentoService

router = APIRouter(prefix="/api/v1/talento", tags=["talento"])


def _gestion_or_equipo():
    """RH con el modulo O jefe con scoping de equipo. Copia deliberada del
    patron de `app/api/v1/operaciones/router.py`: si el primero rechaza (RH sin
    modulo / no admin operativo), se intenta el segundo."""
    rh_dep = role_checker(["operativo"])
    equipo_dep = gestor_team_role_checker(["supervisor", "gerente"])

    async def check(
        request: Request,
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    ) -> Empleado:
        try:
            return await rh_dep(
                request=request, current_user=current_user, db=db, rh_ui_mode=rh_ui_mode
            )
        except HTTPException:
            return await equipo_dep(current_user=current_user, rh_ui_mode=rh_ui_mode)

    return check


@router.get("/desempeno", response_model=BloqueDesempenoResponse)
async def bloque_desempeno(
    ciclo_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_desempeno(current_user, rh_ui_mode, ciclo_id)


@router.get("/polivalencia", response_model=BloquePolivalenciaResponse)
async def bloque_polivalencia(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_polivalencia(current_user, rh_ui_mode)


@router.get("/capacitacion", response_model=BloqueCapacitacionResponse)
async def bloque_capacitacion(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_capacitacion(current_user, rh_ui_mode)


@router.get("/pdi", response_model=BloquePdiResponse)
async def bloque_pdi(
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_pdi(current_user, rh_ui_mode)


@router.get("/objetivo", response_model=BloqueObjetivoResponse)
async def bloque_objetivo(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    area_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).bloque_objetivo(
        current_user, rh_ui_mode, desde, hasta, area_id
    )


@router.get("/areas/{area_id}/detalle", response_model=DetalleAreaResponse)
async def detalle_area(
    area_id: int,
    ciclo_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    return await TalentoService(db).detalle_area(current_user, rh_ui_mode, area_id, ciclo_id)
```

- [ ] **Step 5: Registrar el módulo y el router**

En `app/core/rh_module_registry.py`, agregar después de la entrada `"operaciones"` (antes del `}` de cierre en la línea 410):

```python
    "dashboard-talento": RhModuleDef(
        key="dashboard-talento",
        label="Dashboard de Talento",
        group="Talento",
        nav_item_ids=("dashboard-talento",),
        hash_prefixes=("#/talento/dashboard",),
        api_prefixes=("/api/v1/talento",),
    ),
```

En `app/main.py`, seguir el patrón exacto con el que se incluye el router de `operaciones` (busca `from app.api.v1.operaciones import router as operaciones_router` y su `app.include_router(...)`) y agregar los dos equivalentes para `talento`.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_api.py -v`
Expected: PASS — 6 passed

- [ ] **Step 7: Actualizar `openapi.yaml`**

Agregar los 6 paths (`/api/v1/talento/desempeno`, `/polivalencia`, `/capacitacion`, `/pdi`, `/objetivo`, `/areas/{area_id}/detalle`) y los component schemas correspondientes a `app/schemas/talento.py`. Sigue el formato de las entradas de `/api/v1/operaciones/*` que ya están en el archivo — mismos `tags`, misma forma de `security`, mismos códigos de respuesta (200/401/403/404).

- [ ] **Step 8: Verificar la suite completa y commitear**

Run: `docker-compose run --rm test pytest tests/ -q`
Expected: PASS — sin regresiones en ningún módulo.

```bash
git add app/schemas/talento.py app/api/v1/talento/ app/core/rh_module_registry.py app/main.py openapi.yaml tests/test_talento_api.py
git commit -m "feat(talento): endpoints del dashboard, registro de modulo y openapi"
```

---

### Task 10: Export XLSX

**Files:**
- Modify: `app/services/talento_service.py` (método `exportar_excel`)
- Modify: `app/api/v1/talento/router.py` (endpoint `/export`)
- Modify: `openapi.yaml`
- Test: `tests/test_talento_export.py`

**Interfaces:**
- Produces: `TalentoService.exportar_excel(current_user, rh_ui_mode, ciclo_id) -> BytesIO` y `GET /api/v1/talento/export`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_talento_export.py`:

```python
"""El export nunca falla por culpa del bloque externo: si DATOS_ANALISIS no
responde, la columna del indice objetivo queda vacia con una nota."""
from unittest.mock import AsyncMock, patch

import pytest
from openpyxl import load_workbook

from app.services.talento_service import (
    AreaCapacitacion,
    AreaPdi,
    AreaPolivalencia,
    BloqueCapacitacion,
    BloqueDesempeno,
    BloqueObjetivo,
    BloquePdi,
    BloquePolivalencia,
    DetalleArea,
    EmpleadoFoco,
    TalentoService,
)
from tests.conftest import make_empleado


def _bloques_stub():
    return {
        "pol": BloquePolivalencia(
            disponible=True, org=None,
            areas=[AreaPolivalencia(1, "Arneses A", 40, 70.0, 60.0, 2, "ambar")],
        ),
        "cap": BloqueCapacitacion(
            disponible=True, org=None,
            areas=[AreaCapacitacion(1, "Arneses A", 10, 9, 90.0, 1, "verde")],
        ),
        "pdi": BloquePdi(
            disponible=True, org=None,
            areas=[AreaPdi(1, "Arneses A", 6, 4, 66.7, 1, 1, "ambar")],
        ),
        "des": BloqueDesempeno(disponible=False, motivo="sin_ciclo"),
    }


@pytest.mark.asyncio
async def test_export_tiene_dos_hojas_y_datos(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_exp@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    b = _bloques_stub()
    detalle = DetalleArea(
        area_id=1, area_nombre="Arneses A", desempeno=None, polivalencia=None,
        capacitacion=None, pdi=None,
        empleados_foco=[EmpleadoFoco(5, 500, "Ana", "Crimpado", ["desempeno_bajo", "pdi_vencido"])],
    )
    with patch.object(TalentoService, "bloque_polivalencia", AsyncMock(return_value=b["pol"])), \
         patch.object(TalentoService, "bloque_capacitacion", AsyncMock(return_value=b["cap"])), \
         patch.object(TalentoService, "bloque_pdi", AsyncMock(return_value=b["pdi"])), \
         patch.object(TalentoService, "bloque_desempeno", AsyncMock(return_value=b["des"])), \
         patch.object(TalentoService, "bloque_objetivo", AsyncMock(return_value=BloqueObjetivo(disponible=True, areas=[]))), \
         patch.object(TalentoService, "detalle_area", AsyncMock(return_value=detalle)):
        output = await svc.exportar_excel(rh, None, None)

    wb = load_workbook(output)
    assert wb.sheetnames == ["Resumen por area", "Empleados en foco"]
    resumen = wb["Resumen por area"]
    assert resumen.cell(row=2, column=1).value == "Arneses A"
    foco = wb["Empleados en foco"]
    assert foco.cell(row=2, column=3).value == "Ana"


@pytest.mark.asyncio
async def test_export_sobrevive_a_datos_analisis_caido(db):
    rh = await make_empleado(
        db, rol="rh", email="tal_exp2@leoni.test",
        modulos_rh={"dashboard-talento": True}, inscrito_modulos_rh=True,
    )
    svc = TalentoService(db)
    b = _bloques_stub()
    with patch.object(TalentoService, "bloque_polivalencia", AsyncMock(return_value=b["pol"])), \
         patch.object(TalentoService, "bloque_capacitacion", AsyncMock(return_value=b["cap"])), \
         patch.object(TalentoService, "bloque_pdi", AsyncMock(return_value=b["pdi"])), \
         patch.object(TalentoService, "bloque_desempeno", AsyncMock(return_value=b["des"])), \
         patch.object(TalentoService, "bloque_objetivo", AsyncMock(side_effect=RuntimeError("caido"))), \
         patch.object(TalentoService, "detalle_area", AsyncMock(return_value=DetalleArea(
             area_id=1, area_nombre="Arneses A", desempeno=None, polivalencia=None,
             capacitacion=None, pdi=None, empleados_foco=[]))):
        output = await svc.exportar_excel(rh, None, None)

    wb = load_workbook(output)
    resumen = wb["Resumen por area"]
    # Columna del indice objetivo (6a) con la nota, no una excepcion.
    assert resumen.cell(row=2, column=6).value == "no disponible"
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_talento_export.py -v`
Expected: FAIL — `AttributeError: 'TalentoService' object has no attribute 'exportar_excel'`

- [ ] **Step 3: Implementar el export**

En `app/services/talento_service.py`, agregar `from io import BytesIO` a los imports y este método al final de la clase:

```python
    async def exportar_excel(
        self, current_user: Empleado, rh_ui_mode: str | None, ciclo_id: int | None
    ) -> BytesIO:
        """xlsx con 2 hojas: Resumen por area y Empleados en foco.

        El bloque de historial objetivo se intenta, pero si DATOS_ANALISIS no
        responde su columna queda como "no disponible": el export nunca falla
        por culpa de la BD externa."""
        from openpyxl import Workbook

        pol = await self.bloque_polivalencia(current_user, rh_ui_mode)
        cap = await self.bloque_capacitacion(current_user, rh_ui_mode)
        pdi = await self.bloque_pdi(current_user, rh_ui_mode)
        des = await self.bloque_desempeno(current_user, rh_ui_mode, ciclo_id)
        try:
            obj = await self.bloque_objetivo(current_user, rh_ui_mode, None, None, None)
            obj_por_area = {a.area_id: a.indice_promedio for a in obj.areas}
            obj_disponible = True
        except Exception:  # noqa: BLE001 - la BD externa no debe tumbar el export
            obj_por_area = {}
            obj_disponible = False

        des_por_area = {a.area_id: a for a in des.areas}
        cap_por_area = {a.area_id: a for a in cap.areas}
        pdi_por_area = {a.area_id: a for a in pdi.areas}

        wb = Workbook()
        hoja = wb.active
        hoja.title = "Resumen por area"
        hoja.append(
            ["Area", "Personal", "Desempeno", "Polivalencia", "Resiliencia",
             "Indice objetivo", "Capacitacion", "PDI", "Competencias criticas"]
        )
        for a in pol.areas:
            d = des_por_area.get(a.area_id)
            c = cap_por_area.get(a.area_id)
            p = pdi_por_area.get(a.area_id)
            hoja.append([
                a.area_nombre,
                a.n_empleados,
                d.calificacion_promedio if d else None,
                a.pol_pct,
                a.resiliencia_pct,
                obj_por_area.get(a.area_id) if obj_disponible else "no disponible",
                c.cumplimiento_pct if c else None,
                p.cumplimiento_pct if p else None,
                a.n_criticas,
            ])

        hoja_foco = wb.create_sheet("Empleados en foco")
        hoja_foco.append(["Area", "No. empleado", "Nombre", "Puesto", "Senales"])
        for a in pol.areas:
            detalle = await self.detalle_area(current_user, rh_ui_mode, a.area_id, ciclo_id)
            for e in detalle.empleados_foco:
                hoja_foco.append([
                    a.area_nombre, e.no_empleado, e.nombre, e.puesto_nombre,
                    ", ".join(e.senales),
                ])

        output = BytesIO()
        wb.save(output)
        output.seek(0)
        return output
```

En `app/api/v1/talento/router.py`, agregar el import `from fastapi.responses import StreamingResponse` y el endpoint:

```python
@router.get("/export")
async def export_dashboard(
    ciclo_id: Optional[int] = None,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
):
    output = await TalentoService(db).exportar_excel(current_user, rh_ui_mode, ciclo_id)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=dashboard_talento.xlsx"},
    )
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_talento_export.py tests/test_talento_api.py -v`
Expected: PASS — 8 passed

- [ ] **Step 5: Agregar el path a `openapi.yaml` y commitear**

Agregar `/api/v1/talento/export` a `openapi.yaml` con respuesta binaria, siguiendo el formato del export de Operaciones (`/api/v1/operaciones/areas/{area_id}/export`).

```bash
git add app/services/talento_service.py app/api/v1/talento/router.py openapi.yaml tests/test_talento_export.py
git commit -m "feat(talento): export xlsx del dashboard"
```

---

### Task 11: Cliente API y tipos del frontend

**Files:**
- Create: `frontend/src/api/talento.ts`

**Interfaces:**
- Produces: `getDesempeno`, `getPolivalencia`, `getCapacitacion`, `getPdi`, `getObjetivo`, `getDetalleArea`, `descargarDashboardExcel` y los tipos `BloqueDesempeno`, `BloquePolivalencia`, `BloqueCapacitacion`, `BloquePdi`, `BloqueObjetivo`, `DetalleArea`, `Semaforo`.

- [ ] **Step 1: Crear el cliente**

Crear `frontend/src/api/talento.ts`:

```typescript
/**
 * Cliente API del Dashboard de Talento (consolidación por área, solo lectura).
 * Types sincronizados con app/schemas/talento.py — no dupliques fuera de aquí.
 */
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/talento";

export class TalentoApiError extends Error {
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
  throw new TalentoApiError(detail, res.status);
}

export type Semaforo = "verde" | "ambar" | "rojo";

export interface CicloInfo {
  id: number;
  nombre: string;
  estado: string;
}

export interface AreaDesempeno {
  area_id: number | null;
  area_nombre: string;
  n_empleados: number;
  calificacion_promedio: number | null;
  cumplimiento_metas_pct: number | null;
  con_resultado_pct: number;
  distribucion: Record<string, number>;
  semaforo: Semaforo | null;
}

export interface OrgDesempeno {
  calificacion_promedio: number | null;
  cumplimiento_metas_pct: number | null;
  con_resultado_pct: number;
  distribucion: Record<string, number>;
  nine_box: Record<string, number>;
  semaforo: Semaforo | null;
  n_empleados: number;
}

export interface BloqueDesempeno {
  disponible: boolean;
  motivo: string | null;
  ciclo: CicloInfo | null;
  org: OrgDesempeno | null;
  areas: AreaDesempeno[];
}

export interface AreaPolivalencia {
  area_id: number;
  area_nombre: string;
  n_empleados: number;
  pol_pct: number | null;
  resiliencia_pct: number | null;
  n_criticas: number;
  semaforo: Semaforo | null;
}

export interface OrgPolivalencia {
  pol_pct: number | null;
  resiliencia_pct: number | null;
  n_criticas: number;
  n_empleados: number;
  semaforo: Semaforo | null;
}

export interface BloquePolivalencia {
  disponible: boolean;
  motivo: string | null;
  org: OrgPolivalencia | null;
  areas: AreaPolivalencia[];
}

export interface AreaCapacitacion {
  area_id: number | null;
  area_nombre: string;
  total_pares: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_obligatorio_pendiente: number;
  semaforo: Semaforo | null;
}

export interface OrgCapacitacion {
  total_pares: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_obligatorio_pendiente: number;
  semaforo: Semaforo | null;
}

export interface BloqueCapacitacion {
  disponible: boolean;
  motivo: string | null;
  org: OrgCapacitacion | null;
  areas: AreaCapacitacion[];
}

export interface AreaPdi {
  area_id: number | null;
  area_nombre: string;
  total: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_vencidos: number;
  n_activos: number;
  semaforo: Semaforo | null;
}

export interface OrgPdi {
  total: number;
  completados: number;
  cumplimiento_pct: number | null;
  n_vencidos: number;
  n_activos: number;
  semaforo: Semaforo | null;
}

export interface BloquePdi {
  disponible: boolean;
  motivo: string | null;
  org: OrgPdi | null;
  areas: AreaPdi[];
}

export interface AreaObjetivo {
  area_id: number | null;
  area_nombre: string;
  n_empleados: number;
  indice_promedio: number | null;
}

export interface BloqueObjetivo {
  disponible: boolean;
  motivo: string | null;
  rango: { desde: string; hasta: string } | null;
  org: { n_empleados: number; indice_promedio: number | null } | null;
  areas: AreaObjetivo[];
}

export interface EmpleadoFoco {
  empleado_id: number;
  no_empleado: number | string | null;
  nombre: string;
  puesto_nombre: string | null;
  senales: string[];
}

export interface DetalleArea {
  area_id: number;
  area_nombre: string;
  desempeno: AreaDesempeno | null;
  polivalencia: AreaPolivalencia | null;
  capacitacion: AreaCapacitacion | null;
  pdi: AreaPdi | null;
  empleados_foco: EmpleadoFoco[];
}

async function getJson<T>(path: string, fallback: string): Promise<T> {
  const res = await fetchWithAuth(`${BASE}${path}`);
  if (!res.ok) return parseError(res, fallback);
  return res.json();
}

export function getDesempeno(cicloId?: number): Promise<BloqueDesempeno> {
  const q = cicloId ? `?ciclo_id=${cicloId}` : "";
  return getJson(`/desempeno${q}`, "No se pudo cargar el desempeño");
}

export function getPolivalencia(): Promise<BloquePolivalencia> {
  return getJson("/polivalencia", "No se pudo cargar la polivalencia");
}

export function getCapacitacion(): Promise<BloqueCapacitacion> {
  return getJson("/capacitacion", "No se pudo cargar la capacitación");
}

export function getPdi(): Promise<BloquePdi> {
  return getJson("/pdi", "No se pudieron cargar los planes de desarrollo");
}

export function getObjetivo(): Promise<BloqueObjetivo> {
  return getJson("/objetivo", "No se pudo cargar el índice objetivo");
}

export function getDetalleArea(areaId: number, cicloId?: number): Promise<DetalleArea> {
  const q = cicloId ? `?ciclo_id=${cicloId}` : "";
  return getJson(`/areas/${areaId}/detalle${q}`, "No se pudo cargar el detalle del área");
}

/** Descarga el .xlsx del dashboard (mismo patrón que `descargarCoberturaAreaExcel`). */
export async function descargarDashboardExcel(filenameFallback: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BASE}/export`);
  if (!res.ok) return false;
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = /filename=([^;]+)/.exec(disposition);
  const filename = match?.[1]?.trim().replace(/^"|"$/g, "") || filenameFallback;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `docker-compose exec frontend npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/talento.ts
git commit -m "feat(talento): cliente API y tipos del frontend"
```

---

### Task 12: Página, navegación y ruta

**Files:**
- Create: `frontend/src/pages/dashboardTalento.ts`
- Modify: `frontend/src/navigation/talentoNav.ts:9,19-48`
- Modify: `frontend/src/navigation/shellNavPolicy.ts` (unión de ids ~línea 181 y las listas de módulos ~líneas 232 y 270)
- Modify: `frontend/src/navigation/rhNav.ts` (unión `RhNavKey`, ~línea 53)
- Modify: `frontend/src/layouts/appShell.ts` (unión de ids, ~línea 122)
- Modify: `frontend/src/layouts/shellSidebar.ts` (unión de ids, ~línea 71)
- Modify: `frontend/src/auth/rhModuleRegistry.ts` (~línea 45)
- Modify: `frontend/src/shellRouter.ts` (~línea 262)

**Interfaces:**
- Consumes: todo `frontend/src/api/talento.ts` (Tarea 11).
- Produces: `export function mountDashboardTalento(container: HTMLElement): void`.

- [ ] **Step 1: Registrar el módulo en la navegación**

En `frontend/src/navigation/talentoNav.ts`, extender el tipo y agregar el item **al inicio** del array (es la vista de entrada del grupo):

```typescript
export type TalentoNavKey =
  | "dashboard-talento"
  | "encuestas-rh"
  | "metas"
  | "ciclo-desempeno"
  | "historial-objetivo";
```

Como primer elemento de `TALENTO_NAV_ITEMS`:

```typescript
  {
    id: "dashboard-talento",
    key: "dashboard-talento",
    href: "#/talento/dashboard",
    label: "Dashboard de Talento",
    svgPaths: `<path d="M3 13.5h5.25V21H3v-7.5Zm6.75-6h4.5V21h-4.5V7.5ZM16.5 3h4.5v18h-4.5V3Z" stroke-linecap="round" stroke-linejoin="round" />`,
  },
```

En `frontend/src/auth/rhModuleRegistry.ts`, junto a las demás entradas del grupo Talento:

```typescript
  { key: "dashboard-talento", prefix: "#/talento/dashboard" },
```

Agregar `"dashboard-talento"` a las uniones de tipos de: `navigation/shellNavPolicy.ts` (`AppShellNavItemId`), `navigation/rhNav.ts` (`RhNavKey`), `layouts/appShell.ts` y `layouts/shellSidebar.ts`. En `shellNavPolicy.ts` agregarlo además a las **dos listas** donde ya aparece `"ciclo-desempeno"` (la de visibilidad por rol, ~línea 232, y la lista larga de módulos ~línea 270) — replica exactamente el tratamiento que recibe `ciclo-desempeno` en ambas.

En `frontend/src/shellRouter.ts`, junto al bloque de `#/talento/ciclo-desempeno` (~línea 262):

```typescript
    if (h.startsWith("#/talento/dashboard")) {
      void import("./pages/dashboardTalento.ts").then(({ mountDashboardTalento }) => {
        mountDashboardTalento(container);
      }).catch((err) => renderLazyPageImportError(container, "dashboard-talento", "Dashboard de Talento", err));
      return;
    }
```

**Importante:** copia la forma exacta del bloque vecino (nombres de variables, `return`, manejo de error). Si el bloque de `ciclo-desempeno` difiere de lo mostrado aquí, manda el vecino.

- [ ] **Step 2: Crear la página**

Crear `frontend/src/pages/dashboardTalento.ts`. Requisitos no negociables:

1. **Los cinco bloques se piden en paralelo** con `Promise.allSettled`, nunca en serie ni con un `Promise.all` que aborte todo.
2. **La tabla se dibuja con las áreas de polivalencia** (define el universo de filas); las demás columnas se unen por `area_id`.
3. **Un bloque rechazado pinta `n/d` en su columna** y su tile en estado de error, sin tumbar la página.
4. **Nada de hex ni clases inventadas**: usa los tokens de `frontend/src/ui/uiTokens.ts` (`BTN_PRIMARY`, `BTN_SECONDARY`, `RH_LISTADO_SURFACE`, funciones de badge, `FILTER_FIELD_WRAP`, `SELECT_CHEVRON`) y lee `design.md` antes de escribir markup.
5. **Todo texto de usuario pasa por `escapeHtml`** (ojo con `no_empleado`, que puede llegar como número — ver `frontend/src/pages/operaciones.ts` para el patrón correcto).

Estructura de la página:

```typescript
/**
 * Dashboard de Talento: consolidación por área de las señales que ya calculan
 * los módulos de la suite. Solo lectura.
 *
 * Los cinco bloques se piden en PARALELO y cada columna se pinta en cuanto
 * llega: si un bloque falla (típicamente el índice objetivo, que consulta
 * DATOS_ANALISIS), solo esa columna queda en n/d.
 */
import {
  descargarDashboardExcel,
  getCapacitacion,
  getDesempeno,
  getDetalleArea,
  getObjetivo,
  getPdi,
  getPolivalencia,
  type AreaPolivalencia,
  type BloqueCapacitacion,
  type BloqueDesempeno,
  type BloqueObjetivo,
  type BloquePdi,
  type BloquePolivalencia,
  type Semaforo,
} from "../api/talento.ts";
import { escapeHtml } from "../utils/escapeHtml.ts";  // ajusta al helper real del repo

type EstadoBloque<T> = { estado: "cargando" } | { estado: "ok"; datos: T } | { estado: "error"; mensaje: string };

interface EstadoPagina {
  polivalencia: EstadoBloque<BloquePolivalencia>;
  desempeno: EstadoBloque<BloqueDesempeno>;
  capacitacion: EstadoBloque<BloqueCapacitacion>;
  pdi: EstadoBloque<BloquePdi>;
  objetivo: EstadoBloque<BloqueObjetivo>;
  areaAbierta: number | null;
  ordenPor: "area" | "desempeno" | "polivalencia" | "capacitacion" | "pdi" | "criticas";
  ordenDesc: boolean;
}

export function mountDashboardTalento(container: HTMLElement): void {
  const estado: EstadoPagina = {
    polivalencia: { estado: "cargando" },
    desempeno: { estado: "cargando" },
    capacitacion: { estado: "cargando" },
    pdi: { estado: "cargando" },
    objetivo: { estado: "cargando" },
    areaAbierta: null,
    ordenPor: "criticas",
    ordenDesc: true,
  };

  render(container, estado);
  void cargarBloques(container, estado);
}

async function cargarBloques(container: HTMLElement, estado: EstadoPagina): Promise<void> {
  const peticiones = [
    { clave: "polivalencia" as const, promesa: getPolivalencia() },
    { clave: "desempeno" as const, promesa: getDesempeno() },
    { clave: "capacitacion" as const, promesa: getCapacitacion() },
    { clave: "pdi" as const, promesa: getPdi() },
    { clave: "objetivo" as const, promesa: getObjetivo() },
  ];
  // allSettled, no all: un bloque caido no debe cancelar los otros cuatro.
  const resultados = await Promise.allSettled(peticiones.map((p) => p.promesa));
  resultados.forEach((r, i) => {
    const clave = peticiones[i]!.clave;
    estado[clave] = r.status === "fulfilled"
      ? { estado: "ok", datos: r.value as never }
      : { estado: "error", mensaje: (r.reason as Error)?.message ?? "No disponible" };
  });
  render(container, estado);
}
```

El resto de la página, con el detalle de cada pieza:

```typescript
/** Une los cinco bloques por area_id. La lista de filas la manda polivalencia. */
interface FilaArea {
  area_id: number;
  area_nombre: string;
  n_empleados: number;
  desempeno: number | null;
  desempenoSemaforo: Semaforo | null;
  polivalencia: number | null;
  polivalenciaSemaforo: Semaforo | null;
  objetivo: number | null;
  capacitacion: number | null;
  capacitacionSemaforo: Semaforo | null;
  pdi: number | null;
  pdiSemaforo: Semaforo | null;
  n_criticas: number;
}

function construirFilas(estado: EstadoPagina): FilaArea[] {
  if (estado.polivalencia.estado !== "ok") return [];
  const des = estado.desempeno.estado === "ok" ? estado.desempeno.datos.areas : [];
  const cap = estado.capacitacion.estado === "ok" ? estado.capacitacion.datos.areas : [];
  const pdi = estado.pdi.estado === "ok" ? estado.pdi.datos.areas : [];
  const obj = estado.objetivo.estado === "ok" ? estado.objetivo.datos.areas : [];
  const porId = <T extends { area_id: number | null }>(xs: T[]) =>
    new Map(xs.filter((x) => x.area_id !== null).map((x) => [x.area_id as number, x]));
  const desMap = porId(des), capMap = porId(cap), pdiMap = porId(pdi), objMap = porId(obj);

  return estado.polivalencia.datos.areas.map((a: AreaPolivalencia) => ({
    area_id: a.area_id,
    area_nombre: a.area_nombre,
    n_empleados: a.n_empleados,
    desempeno: desMap.get(a.area_id)?.calificacion_promedio ?? null,
    desempenoSemaforo: desMap.get(a.area_id)?.semaforo ?? null,
    polivalencia: a.pol_pct,
    polivalenciaSemaforo: a.semaforo,
    objetivo: objMap.get(a.area_id)?.indice_promedio ?? null,
    capacitacion: capMap.get(a.area_id)?.cumplimiento_pct ?? null,
    capacitacionSemaforo: capMap.get(a.area_id)?.semaforo ?? null,
    pdi: pdiMap.get(a.area_id)?.cumplimiento_pct ?? null,
    pdiSemaforo: pdiMap.get(a.area_id)?.semaforo ?? null,
    n_criticas: a.n_criticas,
  }));
}

function ordenarFilas(filas: FilaArea[], estado: EstadoPagina): FilaArea[] {
  const clave: Record<EstadoPagina["ordenPor"], (f: FilaArea) => number | string> = {
    area: (f) => f.area_nombre,
    desempeno: (f) => f.desempeno ?? -1,
    polivalencia: (f) => f.polivalencia ?? -1,
    capacitacion: (f) => f.capacitacion ?? -1,
    pdi: (f) => f.pdi ?? -1,
    criticas: (f) => f.n_criticas,
  };
  const get = clave[estado.ordenPor];
  // Los null van siempre al final: "sin dato" no es "lo peor".
  return [...filas].sort((a, b) => {
    const va = get(a), vb = get(b);
    if (typeof va === "string" || typeof vb === "string") {
      return String(va).localeCompare(String(vb)) * (estado.ordenDesc ? -1 : 1);
    }
    return (va - vb) * (estado.ordenDesc ? -1 : 1);
  });
}

/** Celda de porcentaje. `null` -> n/d, nunca 0 %. */
function celdaMetrica(valor: number | null, semaforo: Semaforo | null): string {
  if (valor === null) {
    return `<td class="px-3 py-2 text-sm text-text-muted" title="Sin datos">n/d</td>`;
  }
  return `<td class="px-3 py-2 text-sm">${badgeSemaforo(semaforo)} ${valor.toFixed(1)}%</td>`;
}

function tileHtml(
  titulo: string,
  bloque: EstadoBloque<unknown>,
  valor: string,
  detalle: string,
): string {
  if (bloque.estado === "cargando") {
    return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs text-text-muted">${escapeHtml(titulo)}</p><div class="mt-2 h-6 w-20 animate-pulse rounded bg-slate-200"></div></div>`;
  }
  if (bloque.estado === "error") {
    return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs text-text-muted">${escapeHtml(titulo)}</p><p class="mt-1 text-sm text-text-muted" title="${escapeHtml(bloque.mensaje)}">n/d</p></div>`;
  }
  return `<div class="${RH_LISTADO_SURFACE} p-4"><p class="text-xs text-text-muted">${escapeHtml(titulo)}</p><p class="mt-1 text-xl font-semibold text-text-primary">${escapeHtml(valor)}</p><p class="text-xs text-text-muted">${escapeHtml(detalle)}</p></div>`;
}

function render(container: HTMLElement, estado: EstadoPagina): void {
  const filas = ordenarFilas(construirFilas(estado), estado);
  const motivoDesempeno =
    estado.desempeno.estado === "ok" && !estado.desempeno.datos.disponible
      ? "Sin ciclo de desempeño configurado"
      : "";

  container.innerHTML = `
    <section class="space-y-4">
      <header class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-lg font-semibold text-text-primary">Dashboard de Talento</h1>
        <button type="button" data-accion="exportar" class="${BTN_SECONDARY}">Exportar</button>
      </header>
      ${motivoDesempeno ? `<p class="text-sm text-text-muted">${escapeHtml(motivoDesempeno)}</p>` : ""}
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        ${tileHtml("Desempeño", estado.desempeno, pctTexto(orgDesempeno(estado)), "promedio del ciclo")}
        ${tileHtml("Polivalencia", estado.polivalencia, pctTexto(orgPolivalencia(estado)), "índice del personal")}
        ${tileHtml("Capacitación", estado.capacitacion, pctTexto(orgCapacitacion(estado)), "cursos completados")}
        ${tileHtml("PDI", estado.pdi, pctTexto(orgPdi(estado)), "planes completados")}
        ${tileHtml("Índice objetivo", estado.objetivo, pctTexto(orgObjetivo(estado)), "últimos 12 meses")}
      </div>
      <div class="${RH_LISTADO_SURFACE} overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr>
              ${encabezado("Área", "area", estado)}
              <th class="px-3 py-2 text-left text-xs text-text-muted">Personal</th>
              ${encabezado("Desempeño", "desempeno", estado)}
              ${encabezado("Polivalencia", "polivalencia", estado)}
              <th class="px-3 py-2 text-left text-xs text-text-muted">Objetivo</th>
              ${encabezado("Capacitación", "capacitacion", estado)}
              ${encabezado("PDI", "pdi", estado)}
              ${encabezado("Críticas", "criticas", estado)}
            </tr>
          </thead>
          <tbody>
            ${filas.map((f) => filaHtml(f, estado)).join("")}
          </tbody>
        </table>
      </div>
    </section>`;

  container.querySelector<HTMLButtonElement>('[data-accion="exportar"]')
    ?.addEventListener("click", () => {
      void descargarDashboardExcel("dashboard_talento.xlsx");
    });
  container.querySelectorAll<HTMLElement>("[data-orden]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.orden as EstadoPagina["ordenPor"];
      estado.ordenDesc = estado.ordenPor === col ? !estado.ordenDesc : true;
      estado.ordenPor = col;
      render(container, estado);
    });
  });
  container.querySelectorAll<HTMLElement>("[data-area-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = Number(tr.dataset.areaId);
      estado.areaAbierta = estado.areaAbierta === id ? null : id;
      render(container, estado);
      if (estado.areaAbierta === id) void abrirDetalle(container, estado, id);
    });
  });
}
```

Falta que implementes, siguiendo el mismo estilo: `encabezado(label, col, estado)` (un `<th>` con `data-orden` y el indicador de orden), `filaHtml(fila, estado)` (usa `celdaMetrica` y agrega `data-area-id`, más la fila expandida cuando `estado.areaAbierta === fila.area_id`), los helpers `orgDesempeno`/`orgPolivalencia`/`orgCapacitacion`/`orgPdi`/`orgObjetivo` (leen el valor del nivel `org` de cada bloque, `null` si el bloque no está en `ok`), `pctTexto(valor)` (`"n/d"` si es `null`, si no `` `${valor.toFixed(1)}%` ``) y `abrirDetalle`, que llama a `getDetalleArea(areaId)` y pinta los agregados del área más los empleados en foco con un badge por señal y un enlace a `#/empleados/{empleado_id}` (confirma la ruta real de la ficha 360 en `shellRouter.ts` antes de escribirla).

`badgeSemaforo`, `BTN_SECONDARY` y `RH_LISTADO_SURFACE` salen de `uiTokens.ts`. Si no existe una función de badge de semáforo, **reutiliza la que ya usa `frontend/src/pages/operaciones.ts`** para pintar cobertura en vez de escribir una nueva — es el mismo semáforo conceptual.

**Si el tile con micro-distribución de bandas o el badge de señales resultan patrones no documentados**, agrégalos a `design.md` como pide la spec, después de implementarlos siguiendo los principios del sistema.

- [ ] **Step 3: Verificar el build**

Run: `docker-compose exec frontend npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificar en el navegador**

Run: `docker-compose up -d && docker-compose logs -f frontend`
Abre `http://localhost:5173/#/talento/dashboard` con un usuario que tenga el módulo `dashboard-talento`. Verifica: los cinco tiles cargan, la tabla lista áreas, el clic en una fila abre el detalle, y el export descarga un `.xlsx`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboardTalento.ts frontend/src/navigation/ frontend/src/layouts/ frontend/src/auth/rhModuleRegistry.ts frontend/src/shellRouter.ts
git commit -m "feat(talento): pagina del dashboard con nav y ruta"
```

---

### Task 13: Tests del frontend y verificación final

**Files:**
- Create: `frontend/src/pages/dashboardTalento.test.ts`
- Modify: `frontend/src/navigation/rhNav.test.ts` (agregar caso del módulo nuevo)

**Interfaces:**
- Consumes: `mountDashboardTalento` (Tarea 12).

- [ ] **Step 1: Escribir los tests**

Crear `frontend/src/pages/dashboardTalento.test.ts`:

```typescript
/**
 * El requisito central del dashboard es la degradación por bloque: si el índice
 * objetivo se cae (DATOS_ANALISIS), la página debe seguir mostrando las otras
 * cuatro columnas. Ese es el test que no puede faltar.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/talento.ts", () => ({
  getPolivalencia: vi.fn(),
  getDesempeno: vi.fn(),
  getCapacitacion: vi.fn(),
  getPdi: vi.fn(),
  getObjetivo: vi.fn(),
  getDetalleArea: vi.fn(),
  descargarDashboardExcel: vi.fn(),
  TalentoApiError: class extends Error {},
}));

import * as api from "../api/talento.ts";
import { mountDashboardTalento } from "./dashboardTalento.ts";

const areaPol = {
  area_id: 1, area_nombre: "Arneses A", n_empleados: 40,
  pol_pct: 70.0, resiliencia_pct: 60.0, n_criticas: 2, semaforo: "ambar" as const,
};

function stubOk() {
  vi.mocked(api.getPolivalencia).mockResolvedValue({
    disponible: true, motivo: null,
    org: { pol_pct: 70, resiliencia_pct: 60, n_criticas: 2, n_empleados: 40, semaforo: "ambar" },
    areas: [areaPol],
  });
  vi.mocked(api.getDesempeno).mockResolvedValue({
    disponible: true, motivo: null, ciclo: { id: 1, nombre: "2026", estado: "activo" },
    org: null, areas: [],
  });
  vi.mocked(api.getCapacitacion).mockResolvedValue({
    disponible: true, motivo: null, org: null, areas: [],
  });
  vi.mocked(api.getPdi).mockResolvedValue({
    disponible: true, motivo: null, org: null, areas: [],
  });
  vi.mocked(api.getObjetivo).mockResolvedValue({
    disponible: true, motivo: null, rango: null, org: null, areas: [],
  });
}

describe("dashboardTalento", () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("pide los cinco bloques en paralelo", async () => {
    stubOk();
    mountDashboardTalento(container);
    await vi.waitFor(() => expect(api.getPolivalencia).toHaveBeenCalled());
    expect(api.getDesempeno).toHaveBeenCalled();
    expect(api.getCapacitacion).toHaveBeenCalled();
    expect(api.getPdi).toHaveBeenCalled();
    expect(api.getObjetivo).toHaveBeenCalled();
  });

  it("lista las áreas de polivalencia en la tabla", async () => {
    stubOk();
    mountDashboardTalento(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
  });

  it("un bloque caído no tumba la página", async () => {
    stubOk();
    vi.mocked(api.getObjetivo).mockRejectedValue(new Error("DATOS_ANALISIS no responde"));
    mountDashboardTalento(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    expect(container.textContent).toContain("n/d");
  });

  it("muestra el motivo cuando no hay ciclo de desempeño", async () => {
    stubOk();
    vi.mocked(api.getDesempeno).mockResolvedValue({
      disponible: false, motivo: "sin_ciclo", ciclo: null, org: null, areas: [],
    });
    mountDashboardTalento(container);
    await vi.waitFor(() => expect(container.textContent).toContain("Arneses A"));
    expect(container.textContent?.toLowerCase()).toContain("ciclo");
  });
});
```

En `frontend/src/navigation/rhNav.test.ts`, agregar un caso calcado del de `ciclo-desempeno` (línea 293) pero para `dashboard-talento`, con `href: "#/talento/dashboard"`.

- [ ] **Step 2: Correr los tests del frontend**

Run: `docker-compose exec frontend npm run test`
Expected: PASS — los 4 tests nuevos de la página y el de nav pasan; ningún test previo se rompe.

- [ ] **Step 3: Verificación final completa**

```bash
docker-compose run --rm test pytest tests/ -q
docker-compose exec frontend npm run test
docker-compose exec frontend npm run build
```

Expected: las tres verdes. Confirma además:
- `git diff main --stat` no muestra ninguna migración de Alembic ni modelo nuevo.
- `grep -rn "create_table\|drop_table\|add_column" alembic/versions/ | git diff main --name-only` no toca nada nuevo.
- `openapi.yaml` tiene los 7 paths de `/api/v1/talento`.

- [ ] **Step 4: Commit y PR**

```bash
git add frontend/src/pages/dashboardTalento.test.ts frontend/src/navigation/rhNav.test.ts
git commit -m "test(talento): cubrir render, orden y degradacion por bloque"
git push -u origin feat/cm/dashboard-talento
```

Crear el PR contra `main` describiendo qué se hizo y cómo probarlo. **No mergear sin revisión.**

---

## Notas para quien implementa

- **Si un test existente de otro módulo se rompe**, la extracción de scope está mal: la firma pública debía quedar idéntica. Revierte y vuelve a extraer delegando.
- **Si te ves creando una tabla**, para y relee la spec: el módulo entero es un agregador de solo lectura. No hay caso en que necesite persistir.
- **Si un número del dashboard no cuadra con su módulo de origen**, no lo "arregles" en Talento: el bug está en el building block compartido, y arreglarlo en un solo lado crea justo la divergencia que este diseño evita.
- **`n/d` vs `0 %`** es una distinción de producto, no un detalle de estilo: "no hay planes de desarrollo" y "los planes van al 0 %" llevan a decisiones distintas.
