# Agregador de progresivo/bono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el gap de la fuente "progresivo" del Historial Objetivo: contar las semanas en que el empleado perdió su bono de productividad (`pierde_bono=1`, vigente + histórico) y penalizarlas en el índice con peso 6.

**Architecture:** Extensión del Historial Objetivo, solo lectura sobre la BD de bono. Un repo nuevo (`BonoProgresivoRepository`) con una consulta agregada, enchufado al mismo engine que ya abre `_agregar_bono`, y una entrada en la tabla de pesos. Sin tabla nueva, sin migración. Los consumidores (ficha, equipo, bulk de la fase 2) recogen la penalización sin cambios propios.

**Tech Stack:** SQLAlchemy async (engine externo de bono, Postgres), pytest (helpers puros + mock de engine/repos; los repos de bono NO ejecutan SQL en tests), Vite/TypeScript.

## Global Constraints

- Responder siempre en español; código y comentarios en español sin acentos en identificadores.
- NUNCA push directo a `main`; rama `feat/cm/historial-progresivo`, PR a main.
- BD de bono (`bono_productividad`) es **externa y solo lectura**: SELECT únicamente; nunca DDL, INSERT, UPDATE ni DELETE sobre ella. No hay migración en este módulo.
- El paquete `app/services/historial_objetivo/` es de **cálculo puro**: no debe importar `app.models` ni `app.core.database`. Mantener esa pureza.
- Engine único: el repo nuevo va sobre el engine que ya abre `_agregar_bono`; nunca abrir un engine extra ni uno por empleado; `dispose()` en `finally` ya existe.
- Sin doble conteo: progresivo cuenta SOLO `pierde_bono=1`, no los contadores del resumen (faltas/suspensiones/actas) que ya cubren otras fuentes.
- Peso de progresivo: `PESO_PROGRESIVO_DEFAULT = 6`, en un solo lugar; el tipo es `TIPO_PROGRESIVO_PIERDE_BONO = "pierde_bono"`.
- Los tests de repos de bono prueban helpers puros (construcción de WHERE/params), NO ejecutan SQL contra una BD. El service se testea mockeando `create_read_engine` + repos (patrón de `tests/test_historial_objetivo_service.py`).
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

- `app/services/historial_objetivo/constants.py` — `TIPO_PROGRESIVO_PIERDE_BONO` + `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` no vacío (Task 1).
- `app/repositories/bono_progresivo_repository.py` — `BonoProgresivoRepository` (Task 2).
- `app/repositories/sql/bono_progresivo_semanas_sin_bono.sql` — consulta agregada (Task 2).
- `app/services/historial_objetivo_service.py` — `_BonoAgregado` + `_agregar_bono` + 3 call-sites (Task 3).
- `frontend/src/pages/empleadoVista360.ts` (o el componente del desglose del historial objetivo) — etiqueta de la fila progresivo (Task 4).
- Tests: `tests/test_historial_objetivo_formula.py` (Task 1), `tests/test_bono_progresivo_repository.py` (nuevo, Task 2), `tests/test_historial_objetivo_service.py` (Task 3), cobertura (Task 5).

---

### Task 1: Constantes + peso de progresivo

**Files:**
- Modify: `app/services/historial_objetivo/constants.py`
- Test: `tests/test_historial_objetivo_formula.py`

**Interfaces:**
- Produces: `TIPO_PROGRESIVO_PIERDE_BONO = "pierde_bono"`; `PESOS_POR_FUENTE[FUENTE_PROGRESIVO] = {TIPO_PROGRESIVO_PIERDE_BONO: PESO_PROGRESIVO_DEFAULT}`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_historial_objetivo_formula.py`:

```python
from app.services.historial_objetivo.constants import (
    FUENTE_PROGRESIVO,
    PESO_PROGRESIVO_DEFAULT,
    PESOS_POR_FUENTE,
    TIPO_PROGRESIVO_PIERDE_BONO,
)
from app.services.historial_objetivo.formula import calcular_indice
from app.services.historial_objetivo.types import ConteosFuente, ConteosHistorial


def test_pesos_progresivo_no_vacio():
    assert PESOS_POR_FUENTE[FUENTE_PROGRESIVO] == {
        TIPO_PROGRESIVO_PIERDE_BONO: PESO_PROGRESIVO_DEFAULT
    }


def test_calcular_indice_progresivo_penaliza():
    # 2 semanas sin bono * peso 6 = 12 de penalizacion -> 88
    conteos = ConteosHistorial(
        actas=ConteosFuente(),
        faltas=ConteosFuente(),
        incidencias=ConteosFuente(),
        progresivo=ConteosFuente(conteos={TIPO_PROGRESIVO_PIERDE_BONO: 2}),
    )
    resultado = calcular_indice(conteos)
    assert resultado.indice == 88.0
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_formula.py -k "progresivo" -v`
Expected: FAIL (`PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` es `{}`; `TIPO_PROGRESIVO_PIERDE_BONO` no existe).

- [ ] **Step 3: Actualizar las constantes**

En `app/services/historial_objetivo/constants.py`, en la sección de progresivo, añade la constante y llena la tabla de pesos. Reemplaza el bloque de `PESO_PROGRESIVO_DEFAULT` y la entrada de `PESOS_POR_FUENTE`:

```python
# Progresivo / bono-productividad: se cuenta el numero de semanas en que el
# empleado perdio su bono de productividad (`pierde_bono = 1` en
# `incidencias_progresivo` / `incidencias_progresivo_historico`). Es la senal
# propia del progresivo (un resultado), NO se re-cuentan las causas del resumen
# semanal (faltas/suspensiones/actas), que ya penalizan via las otras fuentes
# -- evita el doble conteo. Peso en un solo lugar (`PESO_PROGRESIVO_DEFAULT`).
TIPO_PROGRESIVO_PIERDE_BONO = "pierde_bono"
PESO_PROGRESIVO_DEFAULT: float = 6
```

Y en `PESOS_POR_FUENTE`:

```python
    FUENTE_PROGRESIVO: {TIPO_PROGRESIVO_PIERDE_BONO: PESO_PROGRESIVO_DEFAULT},
```

(mantén `PESO_PROGRESIVO_DEFAULT` definido ANTES de `PESOS_POR_FUENTE`.)

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_formula.py -k "progresivo" -v`
Expected: PASS

- [ ] **Step 5: Correr la suite del historial objetivo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_formula.py tests/test_historial_objetivo_service.py -q`
Expected: PASS (los tests de exhaustividad de pesos, si los hay, siguen verdes).

- [ ] **Step 6: Commit**

```bash
git add app/services/historial_objetivo/constants.py tests/test_historial_objetivo_formula.py
git commit -m "feat(historial-objetivo): peso de progresivo por semanas sin bono

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Repo `BonoProgresivoRepository` + SQL

**Files:**
- Create: `app/repositories/bono_progresivo_repository.py`
- Create: `app/repositories/sql/bono_progresivo_semanas_sin_bono.sql`
- Test: `tests/test_bono_progresivo_repository.py`

**Interfaces:**
- Consumes: `AsyncEngine` (inyectado).
- Produces:
  - `BonoProgresivoRepository(engine)`
  - `_build_where(*, empleado_id, empleado_ids_scope, fecha_inicio, fecha_fin) -> tuple[str, dict[str, Any]]` (helper testeable, patrón `BonoHistoricoIncidenciasRepository._build_where`)
  - `async def aggregate_semanas_sin_bono_por_empleado(*, empleado_id=None, empleado_ids_scope=None, fecha_inicio=None, fecha_fin=None) -> dict[int, int]`

- [ ] **Step 1: Crear el SQL base**

Crea `app/repositories/sql/bono_progresivo_semanas_sin_bono.sql`:

```sql
-- Semanas con pierde_bono = 1 por empleado, sobre progresivo vigente +
-- historico, unificadas y fechadas por semana_historico.fecha_ini.
-- El WHERE se inyecta desde el repo (BonoProgresivoRepository._build_where);
-- {where} se sustituye por las clausulas de filtro (rango/scope/empleado).
SELECT sub.empleado_id AS empleado_id, COUNT(*) AS semanas
FROM (
    SELECT ip.id_empleado AS empleado_id,
           COALESCE(ip.pierde_bono, 0) AS pierde_bono,
           s.fecha_ini AS fecha_ini
    FROM incidencias_progresivo ip
    JOIN semana_historico s ON s.id = ip.id_semana
    UNION ALL
    SELECT iph.id_empleado AS empleado_id,
           COALESCE(iph.pierde_bono, 0) AS pierde_bono,
           s.fecha_ini AS fecha_ini
    FROM incidencias_progresivo_historico iph
    JOIN semana_historico s ON s.id = iph.id_semana
) AS sub
{where}
GROUP BY sub.empleado_id
```

- [ ] **Step 2: Escribir los tests del helper puro que fallan**

Crea `tests/test_bono_progresivo_repository.py`:

```python
"""Tests del filtro (WHERE) del repositorio de progresivo de bono."""
from datetime import date

from app.repositories.bono_progresivo_repository import BonoProgresivoRepository


def _where(**kwargs):
    # El helper no necesita conexion real; se instancia con engine None solo
    # para ejercitar _build_where (no ejecuta SQL).
    repo = BonoProgresivoRepository(engine=None)  # type: ignore[arg-type]
    return repo._build_where(**kwargs)


def test_where_base_solo_pierde_bono():
    where, params = _where(empleado_id=None, empleado_ids_scope=None,
                           fecha_inicio=None, fecha_fin=None)
    assert "pierde_bono = 1" in where
    # descarte de fechas basura
    assert "fecha_ini IS NOT NULL" in where
    assert "1900" in where and "2100" in where
    assert params == {}


def test_where_rango_de_fechas():
    where, params = _where(empleado_id=None, empleado_ids_scope=None,
                           fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 6, 30))
    assert "fecha_ini >= :f_fecha_inicio" in where
    assert "fecha_ini <= :f_fecha_fin" in where
    assert params["f_fecha_inicio"] == date(2026, 1, 1)
    assert params["f_fecha_fin"] == date(2026, 6, 30)


def test_where_empleado_id():
    where, params = _where(empleado_id=10, empleado_ids_scope=None,
                           fecha_inicio=None, fecha_fin=None)
    assert "empleado_id = :f_empleado_id" in where
    assert params["f_empleado_id"] == 10


def test_where_scope_lista():
    where, params = _where(empleado_id=None, empleado_ids_scope=[1, 2, 3],
                           fecha_inicio=None, fecha_fin=None)
    assert "empleado_id = ANY(:f_empleado_ids_scope)" in where
    assert params["f_empleado_ids_scope"] == [1, 2, 3]


def test_where_scope_vacio_no_devuelve_nada():
    where, _params = _where(empleado_id=None, empleado_ids_scope=[],
                            fecha_inicio=None, fecha_fin=None)
    assert "1=0" in where
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_bono_progresivo_repository.py -v`
Expected: FAIL (módulo/clase inexistente).

- [ ] **Step 4: Implementar el repo**

Crea `app/repositories/bono_progresivo_repository.py` siguiendo el patrón de `app/repositories/bono_historico_incidencias_repository.py`:

```python
"""Repositorio de conteo de semanas sin bono (progresivo) sobre la BD de bono.

La consulta base vive en ``sql/bono_progresivo_semanas_sin_bono.sql``. El WHERE
se construye dinamicamente (patron de BonoHistoricoIncidenciasRepository).
Solo lectura sobre la BD externa de bono (SELECT).
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

from app.services.historial_objetivo.constants import TIPO_PROGRESIVO_PIERDE_BONO

_SQL_FILE = (
    Path(__file__).resolve().parent / "sql" / "bono_progresivo_semanas_sin_bono.sql"
)


def load_bono_progresivo_semanas_sin_bono_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


class BonoProgresivoRepository:
    """Conteo de semanas con pierde_bono=1 por empleado (vigente + historico)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine
        self._base_sql = load_bono_progresivo_semanas_sin_bono_sql()

    def _build_where(
        self,
        *,
        empleado_id: int | None = None,
        empleado_ids_scope: list[int] | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> tuple[str, dict[str, Any]]:
        # Scope vacio explicito -> ningun resultado (no confundir con "todos").
        if empleado_ids_scope is not None and not empleado_ids_scope:
            return "WHERE 1=0", {}

        clauses: list[str] = [
            "pierde_bono = 1",
            "fecha_ini IS NOT NULL",
            "EXTRACT(YEAR FROM fecha_ini) BETWEEN 1900 AND 2100",
        ]
        params: dict[str, Any] = {}

        if empleado_ids_scope is not None:
            clauses.append("empleado_id = ANY(:f_empleado_ids_scope)")
            params["f_empleado_ids_scope"] = empleado_ids_scope
        if empleado_id is not None:
            clauses.append("empleado_id = :f_empleado_id")
            params["f_empleado_id"] = empleado_id
        if fecha_inicio is not None:
            clauses.append("fecha_ini >= :f_fecha_inicio")
            params["f_fecha_inicio"] = fecha_inicio
        if fecha_fin is not None:
            clauses.append("fecha_ini <= :f_fecha_fin")
            params["f_fecha_fin"] = fecha_fin

        return "WHERE " + " AND ".join(clauses), params

    async def aggregate_semanas_sin_bono_por_empleado(
        self,
        *,
        empleado_id: int | None = None,
        empleado_ids_scope: list[int] | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
    ) -> dict[int, int]:
        """{empleado_id: n_semanas_sin_bono}; empleados sin semanas perdidas no
        aparecen. Solo lectura sobre la BD de bono."""
        where_sql, params = self._build_where(
            empleado_id=empleado_id,
            empleado_ids_scope=empleado_ids_scope,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        sql = self._base_sql.replace("{where}", where_sql)
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            rows = result.mappings().all()
        return {int(r["empleado_id"]): int(r["semanas"]) for r in rows}
```

(Verifica el patrón de ejecución exacto — `connect()`/`execute`/`mappings()` — contra `BonoHistoricoIncidenciasRepository`; usa el mismo. `TIPO_PROGRESIVO_PIERDE_BONO` se importa aunque el repo devuelva conteos crudos: si no se usa en el cuerpo, quítalo del import — no dejes imports sin usar.)

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_bono_progresivo_repository.py -v`
Expected: PASS (5 tests del WHERE)

- [ ] **Step 6: Commit**

```bash
git add app/repositories/bono_progresivo_repository.py app/repositories/sql/bono_progresivo_semanas_sin_bono.sql tests/test_bono_progresivo_repository.py
git commit -m "feat(historial-objetivo): repo de semanas sin bono (progresivo)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Integración en `_agregar_bono` + call-sites del service

**Files:**
- Modify: `app/services/historial_objetivo_service.py` (`_BonoAgregado`, `_agregar_bono`, 3 call-sites)
- Test: `tests/test_historial_objetivo_service.py`

**Interfaces:**
- Consumes: `BonoProgresivoRepository.aggregate_semanas_sin_bono_por_empleado` (Task 2); `PESOS_POR_FUENTE[FUENTE_PROGRESIVO]` / `TIPO_PROGRESIVO_PIERDE_BONO` (Task 1); `_conteos_fuente_filtrados`, `ConteosFuente`, `FUENTE_PROGRESIVO`.
- Produces: `_BonoAgregado.progresivo_por_empleado: dict[int, ConteosFuente]`; los 3 call-sites usan el conteo real de progresivo.

- [ ] **Step 1: Escribir los tests de service que fallan**

Añade a `tests/test_historial_objetivo_service.py`. Reusa el andamiaje de mock de `create_read_engine`/repos de bono ya presente (el de `_agregar_bono`/`indice_equipo`/`indices_bulk`); extiéndelo para mockear también `BonoProgresivoRepository.aggregate_semanas_sin_bono_por_empleado`:

```python
@pytest.mark.asyncio
async def test_progresivo_penaliza_indice_empleado(db, monkeypatch):
    # Empleado con 2 semanas sin bono, resto de fuentes limpias -> indice 88.
    # Mockea el engine de bono y los 3 repos; el de progresivo devuelve {eid: 2}.
    ...


@pytest.mark.asyncio
async def test_progresivo_un_solo_engine_y_dispose(db, monkeypatch):
    # _agregar_bono instancia los 3 repos sobre el MISMO engine; 1 create_read_engine, 1 dispose.
    ...


@pytest.mark.asyncio
async def test_progresivo_bono_no_disponible_no_penaliza(db, monkeypatch):
    # create_read_engine -> None: progresivo 0, indice no penaliza por progresivo, sin crash.
    ...


@pytest.mark.asyncio
async def test_progresivo_en_bulk_fase2(db, monkeypatch):
    # indices_historial_por_empleado incorpora la penalizacion de progresivo.
    ...
```

Completa los `...` con el andamiaje real de mock (mira cómo los tests existentes parchean `BonoProductividadReadClient.create_read_engine` y los repos `aggregate_empleados_top_por_tipo`; añade el parche del repo de progresivo). Asserts concretos de índice/penalización.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -k progresivo -v`
Expected: FAIL (progresivo sigue en 0; `progresivo_por_empleado` no existe).

- [ ] **Step 3: Añadir el campo a `_BonoAgregado`**

En `app/services/historial_objetivo_service.py`, en la dataclass `_BonoAgregado` (frozen), añade:

```python
    progresivo_por_empleado: dict[int, ConteosFuente]
```

- [ ] **Step 4: Instanciar el repo en `_agregar_bono` y agregar el conteo**

En `_agregar_bono`:
- En la rama de bono NO disponible (engine None), incluir `progresivo_por_empleado={}` en el `_BonoAgregado` devuelto.
- Importar `BonoProgresivoRepository` (import a nivel módulo, junto a los otros repos de bono).
- Tras instanciar incidencias/faltas repos, instanciar `progresivo_repo = BonoProgresivoRepository(engine)`.
- Dentro del `try` (junto a las otras agregaciones), llamar:

```python
            progresivo_raw = await progresivo_repo.aggregate_semanas_sin_bono_por_empleado(
                empleado_id=empleado_id,
                empleado_ids_scope=empleado_ids_scope,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
            )
```

  (la excepción `SQLAlchemyError` ya se captura y convierte a `ServiceUnavailableError`; `dispose()` en `finally` no cambia.)
- Construir el mapa de conteos filtrados:

```python
        progresivo_por_empleado = {
            eid: self._conteos_fuente_filtrados(
                FUENTE_PROGRESIVO, {TIPO_PROGRESIVO_PIERDE_BONO: semanas}
            )
            for eid, semanas in progresivo_raw.items()
        }
```

- Incluir `progresivo_por_empleado=progresivo_por_empleado` en el `_BonoAgregado` devuelto en la rama disponible.
- Importar `FUENTE_PROGRESIVO` y `TIPO_PROGRESIVO_PIERDE_BONO` de `app.services.historial_objetivo.constants` (verifica el bloque de imports existente).

- [ ] **Step 5: Usar el conteo en los 3 call-sites**

En `_calcular_resultado_empleado` (~294), `indice_equipo` (~397) e `indices_historial_por_empleado` (~457), reemplaza `progresivo=ConteosFuente()` por:

```python
                progresivo=bono.progresivo_por_empleado.get(eid, ConteosFuente()),
```

(en `_calcular_resultado_empleado` la clave es `empleado_id`; en los otros dos es la variable de iteración `eid`. Usa la variable correcta en cada sitio.)

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -k progresivo -v`
Expected: PASS

- [ ] **Step 7: Correr la suite del historial objetivo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py tests/test_historial_objetivo_api.py tests/test_historial_objetivo_scope.py -q`
Expected: PASS (empleados sin semanas perdidas → progresivo 0 → índice sin cambio).

- [ ] **Step 8: Commit**

```bash
git add app/services/historial_objetivo_service.py tests/test_historial_objetivo_service.py
git commit -m "feat(historial-objetivo): integrar semanas sin bono en el indice

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — etiqueta de la fila progresivo

**Files:**
- Modify: el componente que renderiza el desglose por fuente del Historial Objetivo (buscar dónde se listan `actas`/`faltas`/`incidencias`/`progresivo` — probablemente `frontend/src/pages/empleadoVista360.ts` o un archivo bajo `frontend/src/components/vista360/` / `frontend/src/api/historialObjetivo.ts`).
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: el desglose por fuente ya incluye `progresivo` en la respuesta (Task 3 lo llena con conteo real). Sin cambio de tipos ni de API.

- [ ] **Step 1: Localizar el render del desglose**

Busca dónde el frontend muestra las 4 fuentes del historial objetivo:

Run: `grep -rn "progresivo\|incidencias\|desglose\|fuente" frontend/src/pages/empleadoVista360.ts frontend/src/api/historialObjetivo.ts frontend/src/components/vista360/ 2>/dev/null`
Expected: la lista/tabla de fuentes con sus etiquetas.

- [ ] **Step 2: Ajustar la etiqueta de progresivo**

Si la fila `progresivo` usa una etiqueta genérica ("Progresivo"), cámbiala a algo legible para esta señal, p. ej. **"Semanas sin bono"** (o "Progresivo (semanas sin bono)"), usando los mismos tokens/markup que las otras filas. NO cambies el shape de datos ni agregues llamadas. Si la etiqueta actual ya es adecuada y el conteo se renderiza como las demás fuentes, decláralo en el reporte y no cambies nada (esta tarea puede ser un no-op verificado).

- [ ] **Step 3: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build`
Expected: limpio.

Run: `docker-compose exec -T frontend npm run test`
Expected: verde.

- [ ] **Step 4: Commit** (solo si hubo cambio)

```bash
git add frontend/src/
git commit -m "feat(historial-objetivo): etiqueta de semanas sin bono en el desglose

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Si fue un no-op verificado, no hay commit; anótalo en el reporte.

---

### Task 5: Cierre de huecos de cobertura

**Files:**
- Modify: `tests/test_historial_objetivo_service.py` y/o `tests/test_bono_progresivo_repository.py`

- [ ] **Step 1: Añadir tests de huecos** (declara con el nombre del test existente si ya está cubierto)

1. **Progresivo en `indice_equipo`**: un empleado del equipo con semanas sin bono aparece con el índice penalizado en el ranking.
2. **Unión vigente+histórico en el WHERE**: el SQL base contiene `incidencias_progresivo` E `incidencias_progresivo_historico` (test de contenido del SQL cargado, para blindar que no se pierda una tabla en un refactor).
3. **Sin doble conteo**: un empleado con faltas/actas Y semanas sin bono penaliza por AMBAS fuentes de forma independiente (el conteo de faltas no cambia por progresivo y viceversa).
4. **Empleado sin semanas perdidas**: no aparece en el dict del repo y su índice no se penaliza por progresivo.

Ejemplo (contenido del SQL):

```python
def test_sql_progresivo_une_vigente_e_historico():
    from app.repositories.bono_progresivo_repository import (
        load_bono_progresivo_semanas_sin_bono_sql,
    )
    sql = load_bono_progresivo_semanas_sin_bono_sql()
    assert "incidencias_progresivo" in sql
    assert "incidencias_progresivo_historico" in sql
    assert "pierde_bono" in sql
```

- [ ] **Step 2: Correr la suite del módulo**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py tests/test_bono_progresivo_repository.py tests/test_historial_objetivo_formula.py -q`
Expected: PASS

- [ ] **Step 3: Correr la suite completa (sin regresiones)**

Run: `docker-compose run --rm test pytest -q`
Expected: sin fallos nuevos vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(historial-objetivo): cerrar huecos de cobertura de progresivo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest -q` verde sin regresiones (empleados sin semanas sin bono conservan su índice).
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual: abrir la ficha de un empleado con `pierde_bono` en el periodo → la fila progresivo del desglose muestra las semanas sin bono y su penalización; el índice baja `6 × semanas`.
- Con esto se cierra el Historial Objetivo (las 4 fuentes con agregador real).
