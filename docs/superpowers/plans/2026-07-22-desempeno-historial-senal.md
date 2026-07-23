# Fase 2 — Historial Objetivo como señal del ciclo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar el índice del Historial Objetivo como tercera señal ponderada del score del Ciclo de Desempeño, con peso configurable `peso_historial` (default 0 = sin cambio).

**Architecture:** Extensión del módulo Ciclo de Desempeño. Migración `levelup_` (3 columnas), función pura `combinar_score` extendida a 3 señales preservando el comportamiento actual, un método bulk `indices_historial_por_empleado` en `HistorialObjetivoService` (un solo engine de bono), pre-cargado una vez por operación y solo cuando `peso_historial > 0`. Con `peso_historial=0` el score es idéntico bit a bit al actual y el engine no se abre.

**Tech Stack:** FastAPI async, SQLAlchemy async, Alembic, Pydantic v2, Vite/TypeScript, pytest (SQLite in-memory), engine externo de bono (mockeable).

## Global Constraints

- Responder siempre en español; código y comentarios en español sin acentos en identificadores.
- NUNCA push directo a `main`; rama `feat/cm/desempeno-historial-senal`, PR a main.
- Toda tabla nueva `levelup_`; migraciones Alembic solo `add_column`/`alter_column` sobre tablas `levelup_*`. Las FK a tablas externas son referencias, no DDL.
- NUNCA correr `alembic upgrade/downgrade` contra la BD real dentro de una tarea. Tests con SQLite in-memory (`tests/conftest.py`).
- Señales del score: `bajo`/`medio`/`alto` (`CICLO_DESEMPENO_BANDAS`); estados de ciclo `borrador`/`activo`/`cerrado`.
- **No-regresión (invariante central):** con `peso_historial=0` (default y estado de todos los ciclos existentes), el score y la banda deben ser idénticos al comportamiento actual, y el engine de bono NO debe abrirse.
- El índice del Historial Objetivo es 0–100, 100 = mejor (misma dirección que el score de desempeño).
- El engine de bono se abre una sola vez por operación (patrón `_agregar_bono` de `HistorialObjetivoService`), con `dispose()` en `finally`; degradación graciosa (bono no disponible → índice `None` = señal ausente).
- Periodo del historial = `ciclo.fecha_inicio`/`ciclo.fecha_fin`; si alguna es `None`, últimos 365 días.
- Mantener `openapi.yaml` sincronizado. Frontend: solo tokens de `frontend/src/ui/uiTokens.ts`.
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

- `app/models/ciclo_desempeno.py` — `peso_historial` en `CicloDesempeno`; `indice_historial` + `peso_historial_efectivo` en `CicloDesempenoResultado` (Task 1).
- `alembic/versions/h1s2t3s4e5n6_desempeno_historial_senal.py` — nueva revisión, `down_revision="c1a2l3i4b5r6"` (Task 1).
- `app/services/ciclo_desempeno_service.py` — `combinar_score` a 3 señales (Task 2); integración en el service (Task 4).
- `app/services/historial_objetivo_service.py` — `indices_historial_por_empleado` bulk (Task 3).
- `app/schemas/ciclo_desempeno.py` — `peso_historial` en Create/Update/Response; `indice_historial`/`peso_historial_efectivo` en el resultado (Task 4).
- `openapi.yaml` (Task 4).
- `frontend/src/api/cicloDesempeno.ts`, `frontend/src/pages/cicloDesempeno.ts` (Task 5).
- Tests: `tests/test_ciclo_desempeno_service.py` (actualizar combinar_score), `tests/test_ciclo_desempeno_historial_senal.py` (nuevo, Tasks 3/4/6), `tests/test_historial_objetivo_service.py` (bulk, Task 3).

---

### Task 1: Migración + columnas del modelo

**Files:**
- Modify: `app/models/ciclo_desempeno.py` (`CicloDesempeno` tras `peso_competencias`; `CicloDesempenoResultado` tras `peso_competencias_efectivo`)
- Create: `alembic/versions/h1s2t3s4e5n6_desempeno_historial_senal.py`
- Test: `tests/test_ciclo_desempeno_historial_senal.py`

**Interfaces:**
- Produces: columnas `CicloDesempeno.peso_historial: Decimal`, `CicloDesempenoResultado.indice_historial: Optional[Decimal]`, `CicloDesempenoResultado.peso_historial_efectivo: Optional[Decimal]`.

- [ ] **Step 1: Escribir el test que falla** (crea el archivo de tests)

En `tests/test_ciclo_desempeno_historial_senal.py`:

```python
"""Tests de la fase 2: historial objetivo como senal del ciclo de desempeno."""
from decimal import Decimal

from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado


def test_ciclo_tiene_peso_historial_default_cero():
    ciclo = CicloDesempeno(nombre="C")
    cols = set(CicloDesempeno.__table__.columns.keys())
    assert "peso_historial" in cols
    assert CicloDesempeno.__table__.columns["peso_historial"].default.arg == Decimal("0")


def test_resultado_tiene_columnas_historial():
    cols = set(CicloDesempenoResultado.__table__.columns.keys())
    assert {"indice_historial", "peso_historial_efectivo"} <= cols
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py -v`
Expected: FAIL (columnas inexistentes / KeyError).

- [ ] **Step 3: Añadir las columnas al modelo**

En `app/models/ciclo_desempeno.py`, en `CicloDesempeno`, después de la columna `peso_competencias`:

```python
    peso_historial: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), nullable=False, default=Decimal("0"),
        comment="Peso del indice de historial objetivo en el score (0 = no cuenta)",
    )
```

En `CicloDesempenoResultado`, después de `peso_competencias_efectivo`:

```python
    indice_historial: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), nullable=True)
    peso_historial_efectivo: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py -v`
Expected: PASS

- [ ] **Step 5: Crear la migración Alembic**

Confirma el head:

Run: `docker-compose exec backend alembic heads`
Expected: `c1a2l3i4b5r6 (head)` (si hubiera otro head más nuevo del módulo, encadena a ESE).

Crea `alembic/versions/h1s2t3s4e5n6_desempeno_historial_senal.py`:

```python
"""desempeno: historial objetivo como senal (peso_historial + indice)

Revision ID: h1s2t3s4e5n6
Revises: c1a2l3i4b5r6
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h1s2t3s4e5n6"
down_revision: Union[str, None] = "c1a2l3i4b5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CICLO = "levelup_ciclo_desempeno"
RESULTADO = "levelup_ciclo_desempeno_resultado"


def upgrade() -> None:
    op.add_column(
        CICLO,
        sa.Column("peso_historial", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )
    op.add_column(RESULTADO, sa.Column("indice_historial", sa.Numeric(6, 2), nullable=True))
    op.add_column(
        RESULTADO, sa.Column("peso_historial_efectivo", sa.Numeric(5, 2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column(RESULTADO, "peso_historial_efectivo")
    op.drop_column(RESULTADO, "indice_historial")
    op.drop_column(CICLO, "peso_historial")
```

(`server_default="0"` para que las filas de ciclos existentes queden en 0 sin fallar el NOT NULL. No corras `alembic upgrade`.)

- [ ] **Step 6: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py tests/test_ciclo_desempeno_service.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/models/ciclo_desempeno.py alembic/versions/h1s2t3s4e5n6_desempeno_historial_senal.py tests/test_ciclo_desempeno_historial_senal.py
git commit -m "feat(desempeno): columnas peso_historial e indice_historial + migracion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `combinar_score` a 3 señales (pura) + actualizar call-site y tests

**Files:**
- Modify: `app/services/ciclo_desempeno_service.py` (función pura `combinar_score` ~línea 101; call-site `_calcular_resultado_vivo` ~línea 622)
- Modify: `tests/test_ciclo_desempeno_service.py` (6 tests de `combinar_score`, líneas ~203-256)

**Interfaces:**
- Produces: `combinar_score(cumplimiento_metas, calificacion_360_norm, indice_historial, peso_metas, peso_competencias, peso_historial) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]` devolviendo `(score, peso_metas_efectivo, peso_competencias_efectivo, peso_historial_efectivo)`.

- [ ] **Step 1: Actualizar los tests existentes de `combinar_score` a la firma nueva**

En `tests/test_ciclo_desempeno_service.py`, reemplaza los 6 tests (líneas ~203-256) por su equivalente con la firma nueva (índice `None`, `peso_historial=0`, 4 valores de retorno). La aritmética no cambia:

```python
def test_combinar_score_ambas_senales_60_40():
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, 60, None, 60, 40, 0)
    assert score == 72.0
    assert (pm_ef, pc_ef, ph_ef) == (60.0, 40.0, 0.0)


def test_combinar_score_solo_metas_presente():
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, None, None, 60, 40, 0)
    assert score == 80.0
    assert (pm_ef, pc_ef, ph_ef) == (100.0, 0.0, 0.0)


def test_combinar_score_solo_360_presente():
    score, pm_ef, pc_ef, ph_ef = combinar_score(None, 60, None, 60, 40, 0)
    assert score == 60.0
    assert (pm_ef, pc_ef, ph_ef) == (0.0, 100.0, 0.0)


def test_combinar_score_ninguna_senal_presente_es_none():
    assert combinar_score(None, None, None, 60, 40, 0) == (None, None, None, None)


def test_combinar_score_metas_en_cero_real_cuenta_distinto_de_ausente():
    solo_360, _, _, _ = combinar_score(None, 60, None, 60, 40, 0)
    con_cero_real, pm_ef, pc_ef, _ = combinar_score(0, 60, None, 60, 40, 0)
    assert solo_360 == 60.0
    assert con_cero_real == 24.0
    assert (pm_ef, pc_ef) == (60.0, 40.0)


def test_combinar_score_pesos_configurables_70_30():
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, 60, None, 70, 30, 0)
    assert score == 74.0
    assert (pm_ef, pc_ef, ph_ef) == (70.0, 30.0, 0.0)


def test_combinar_score_pesos_100_0_con_ambas_senales_presentes():
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, 60, None, 100, 0, 0)
    assert score == 80.0
    assert (pm_ef, pc_ef, ph_ef) == (100.0, 0.0, 0.0)
```

Añade tests nuevos para la 3ª señal:

```python
def test_combinar_score_tres_senales_presentes():
    # 60/30/10 sobre 80/60/90 -> (60*80+30*60+10*90)/100 = (4800+1800+900)/100 = 75
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, 60, 90, 60, 30, 10)
    assert score == 75.0
    assert (pm_ef, pc_ef, ph_ef) == (60.0, 30.0, 10.0)


def test_combinar_score_historial_ausente_redistribuye():
    # historial None con peso 10: cuentan metas(60) y 360(30); score=(60*80+30*60)/90=73.33
    score, pm_ef, pc_ef, ph_ef = combinar_score(80, 60, None, 60, 30, 10)
    assert score == 73.33
    assert ph_ef == 0.0
    # metas y 360 re-escalan a sumar 100 (falta el historial): 60*100/90, 30*100/90
    assert pm_ef == 66.67
    assert pc_ef == 33.33


def test_combinar_score_peso_historial_cero_identico_a_dos_senales():
    con_hist_cero = combinar_score(80, 60, 90, 60, 40, 0)
    assert con_hist_cero == (72.0, 60.0, 40.0, 0.0)  # el indice 90 se ignora por peso 0


def test_combinar_score_solo_historial_presente():
    score, pm_ef, pc_ef, ph_ef = combinar_score(None, None, 90, 60, 40, 20)
    assert score == 90.0
    assert (pm_ef, pc_ef, ph_ef) == (0.0, 0.0, 100.0)
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_service.py -k combinar_score -v`
Expected: FAIL (firma vieja: `combinar_score()` toma 4 args, no 6; desempaqueta 3, no 4).

- [ ] **Step 3: Reimplementar `combinar_score` a 3 señales**

Reemplaza la función `combinar_score` en `app/services/ciclo_desempeno_service.py` por:

```python
def combinar_score(
    cumplimiento_metas: Optional[Numero],
    calificacion_360_norm: Optional[Numero],
    indice_historial: Optional[Numero],
    peso_metas: Numero,
    peso_competencias: Numero,
    peso_historial: Numero,
) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float]]:
    """Combina hasta tres senales (metas, 360 normalizada, historial objetivo),
    todas 0-100 y en la misma direccion (mayor = mejor), ponderadas por sus
    pesos configurados. `None` en una senal = AUSENTE (distinto de un `0` real,
    que si cuenta).

    Una senal CUENTA si su valor no es None y su peso configurado es > 0.
      - score = suma(peso_i * valor_i) / suma(peso_i) sobre las que cuentan.
      - peso efectivo: si TODAS las senales con peso configurado > 0 estan
        presentes, cada efectivo es su peso configurado tal cual; si falta
        alguna, los pesos de las presentes se re-escalan proporcionalmente para
        sumar 100 (reproduce el comportamiento anterior de 2 senales: una sola
        presente -> 100). Una senal que no cuenta -> efectivo 0.
      - ninguna cuenta -> (None, None, None, None).

    Con `peso_historial=0` el resultado (score, pm_ef, pc_ef) es identico a la
    version anterior de dos senales y ph_ef = 0.
    """
    senales = [
        (cumplimiento_metas, float(peso_metas)),
        (calificacion_360_norm, float(peso_competencias)),
        (indice_historial, float(peso_historial)),
    ]
    cuentan = [(v, p) for (v, p) in senales if v is not None and p > 0]
    if not cuentan:
        return None, None, None, None

    suma_pesos = sum(p for _v, p in cuentan)
    score = round(sum(p * float(v) for v, p in cuentan) / suma_pesos, 2)

    # Todas las senales configuradas (peso > 0) presentes?
    configuradas = [(v, p) for (v, p) in senales if p > 0]
    todas_presentes = all(v is not None for v, _p in configuradas)

    efectivos: list[float] = []
    for (v, p) in senales:
        if v is not None and p > 0:
            efectivos.append(p if todas_presentes else round(p * 100.0 / suma_pesos, 2))
        else:
            efectivos.append(0.0)
    return score, efectivos[0], efectivos[1], efectivos[2]
```

- [ ] **Step 4: Actualizar el único call-site `_calcular_resultado_vivo`**

En `_calcular_resultado_vivo`, añade el parámetro `indice_historial` (el índice pre-cargado del empleado, o `None`) y usa la firma nueva. Reemplaza la firma y el bloque de `combinar_score`/return:

```python
    async def _calcular_resultado_vivo(
        self,
        ciclo: CicloDesempeno,
        empleado_id: int,
        participante_by_empleado: dict[int, int],
        escala: Optional[Eval360Escala],
        indice_historial: Optional[float] = None,
    ) -> dict:
        cumplimiento = await self._cumplimiento_metas_o_none(ciclo, empleado_id)
        raw360, norm360, vmin, vmax = await self._calificacion_360_o_none(
            empleado_id, participante_by_empleado, escala
        )
        score, pm_ef, pc_ef, ph_ef = combinar_score(
            cumplimiento, norm360, indice_historial,
            ciclo.peso_metas, ciclo.peso_competencias, ciclo.peso_historial,
        )
        banda_desempeno = (
            banda(score, ciclo.umbral_medio, ciclo.umbral_alto) if score is not None else None
        )
        return {
            "cumplimiento_metas": cumplimiento,
            "calificacion_360_raw": raw360,
            "calificacion_360_norm": norm360,
            "escala_min": float(vmin) if vmin is not None else None,
            "escala_max": float(vmax) if vmax is not None else None,
            "calificacion_desempeno": score,
            "peso_metas_efectivo": pm_ef,
            "peso_competencias_efectivo": pc_ef,
            "indice_historial": indice_historial,
            "peso_historial_efectivo": ph_ef,
            "banda_desempeno": banda_desempeno,
        }
```

(Los callers actuales de `_calcular_resultado_vivo` pasan 4 args posicionales; el nuevo `indice_historial` es opcional con default `None`, así que siguen compilando. La Task 4 los actualiza para pasar el índice pre-cargado.)

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_service.py -k combinar_score -v`
Expected: PASS (11 tests: 7 existentes actualizados + 4 nuevos)

- [ ] **Step 6: Correr la suite del ciclo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_service.py tests/test_ciclo_desempeno_api.py tests/test_ciclo_desempeno_calibracion.py -q`
Expected: PASS (con `peso_historial=0` en todos los ciclos de test existentes, el score no cambia).

- [ ] **Step 7: Commit**

```bash
git add app/services/ciclo_desempeno_service.py tests/test_ciclo_desempeno_service.py
git commit -m "feat(desempeno): combinar_score a tres senales preservando no-regresion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Bulk `indices_historial_por_empleado` en HistorialObjetivoService

**Files:**
- Modify: `app/services/historial_objetivo_service.py` (nuevo método público, cerca de las firmas-espejo ~línea 417)
- Test: `tests/test_historial_objetivo_service.py`

**Interfaces:**
- Consumes: `self.acta_repo.count_por_empleado_por_estado(empleado_ids, fi, ff)`, `self._agregar_bono(...)`, `self._conteos_fuente_filtrados`, `self._faltas_conteos_por_codigo_a_tipo`, `ConteosHistorial`, `calcular_indice`, `FUENTE_ACTAS`, `ConteosFuente` (todos ya en el módulo).
- Produces: `async def indices_historial_por_empleado(self, empleado_ids: list[int], fecha_inicio: date | None, fecha_fin: date | None) -> dict[int, float | None]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_historial_objetivo_service.py` (reusa el patrón de mock de `create_read_engine`/repos de bono que ya usan los tests de `indice_equipo` en ese archivo — búscalo y replícalo):

```python
@pytest.mark.asyncio
async def test_indices_bulk_un_solo_engine_y_dispose(db, monkeypatch):
    # Monta empleados y mockea create_read_engine para contar aperturas/dispose.
    # (Reusa el helper/mocks de los tests de indice_equipo de este archivo.)
    # Verifica: 1 sola apertura de engine, dispose llamado, y dict con los ids.
    ...


@pytest.mark.asyncio
async def test_indices_bulk_bono_no_disponible_devuelve_none(db, monkeypatch):
    # create_read_engine -> None (BONO_DB_* ausente).
    svc = HistorialObjetivoService(db)
    out = await svc.indices_historial_por_empleado([10, 20], None, None)
    assert out == {10: None, 20: None}


@pytest.mark.asyncio
async def test_indices_bulk_lista_vacia(db):
    svc = HistorialObjetivoService(db)
    assert await svc.indices_historial_por_empleado([], None, None) == {}
```

Completa el primer test replicando EXACTAMENTE el andamiaje de mock de engine/repos de bono de los tests de `indice_equipo` en el mismo archivo (mismo `monkeypatch` de `BonoProductividadReadClient.create_read_engine` y de los repos de agregación), afirmando conteo de aperturas de engine == 1 y `dispose` invocado.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -k indices_bulk -v`
Expected: FAIL (método inexistente).

- [ ] **Step 3: Implementar el bulk**

En `app/services/historial_objetivo_service.py`, junto a las firmas-espejo, añade:

```python
    async def indices_historial_por_empleado(
        self,
        empleado_ids: list[int],
        fecha_inicio: date | None,
        fecha_fin: date | None,
    ) -> dict[int, float | None]:
        """Indice objetivo por empleado para el conjunto dado, con UN solo engine
        de bono (reusa `_agregar_bono`, que hace `dispose()` en `finally`).
        Pensado para consumo interno servicio-a-servicio (Ciclo de Desempeno),
        sin resolver scope de `current_user`. Si el bono no esta disponible o
        falla la consulta, degrada devolviendo `None` para todos (senal ausente,
        no crash). Lista vacia -> dict vacio."""
        if not empleado_ids:
            return {}
        self._validar_rango_fechas(fecha_inicio, fecha_fin)
        try:
            actas_counts = await self.acta_repo.count_por_empleado_por_estado(
                empleado_ids, fecha_inicio, fecha_fin
            )
            bono = await self._agregar_bono(
                empleado_id=None,
                empleado_ids_scope=list(empleado_ids),
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                limit=len(empleado_ids) or 1,
            )
        except LeoniException:
            return {eid: None for eid in empleado_ids}

        out: dict[int, float | None] = {}
        for eid in empleado_ids:
            if not bono.disponible:
                out[eid] = None
                continue
            conteos = ConteosHistorial(
                actas=self._conteos_fuente_filtrados(FUENTE_ACTAS, actas_counts.get(eid, {})),
                faltas=bono.faltas_por_empleado.get(eid, ConteosFuente()),
                incidencias=bono.incidencias_por_empleado.get(eid, ConteosFuente()),
                progresivo=ConteosFuente(),
            )
            out[eid] = calcular_indice(conteos).indice
        return out
```

Verifica que `LeoniException`, `ConteosHistorial`, `ConteosFuente`, `calcular_indice`, `FUENTE_ACTAS` ya estén importados (lo están: los usan `_calcular_resultado_empleado`/`indice_equipo`).

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -k indices_bulk -v`
Expected: PASS

- [ ] **Step 5: Correr la suite del historial objetivo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_historial_objetivo_service.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/historial_objetivo_service.py tests/test_historial_objetivo_service.py
git commit -m "feat(historial-objetivo): bulk indices_historial_por_empleado (un engine)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Integración en el service del ciclo + schemas + validación + openapi

**Files:**
- Modify: `app/services/ciclo_desempeno_service.py` (`resultados_ciclo`, `cerrar_ciclo`, pre-carga del índice)
- Modify: `app/schemas/ciclo_desempeno.py` (`peso_historial` en Create/Update/Response; `indice_historial`/`peso_historial_efectivo` en resultado; validación de pesos)
- Modify: `openapi.yaml`
- Test: `tests/test_ciclo_desempeno_historial_senal.py`

**Interfaces:**
- Consumes: `combinar_score` de 6 args (Task 2), `HistorialObjetivoService.indices_historial_por_empleado` (Task 3), columnas del modelo (Task 1).
- Produces: el score del ciclo incorpora el índice cuando `peso_historial > 0`; response con `indice_historial`/`peso_historial_efectivo`; validación `peso_metas+peso_competencias+peso_historial > 0`.

- [ ] **Step 1: Escribir los tests de service que fallan**

Añade a `tests/test_ciclo_desempeno_historial_senal.py`. Usa el patrón de montaje con señales reales de `tests/test_ciclo_desempeno_service.py` (helper `_armar_ciclo_activo_con_ambas_senales` o equivalente; búscalo y reúsalo) y mockea `HistorialObjetivoService.indices_historial_por_empleado` para inyectar índices deterministas:

```python
@pytest.mark.asyncio
async def test_peso_historial_cero_no_abre_engine_ni_cambia_score(db, monkeypatch):
    # Ciclo activo con peso_historial=0 y senales metas/360 reales.
    # Espia indices_historial_por_empleado: NO debe llamarse.
    # El score/banda es identico al calculado sin historial.
    ...


@pytest.mark.asyncio
async def test_peso_historial_mayor_cero_incorpora_indice_en_score(db, monkeypatch):
    # Ciclo activo con peso_historial>0; mock del bulk devuelve un indice conocido.
    # El score refleja la 3a senal y el response trae indice_historial/peso_historial_efectivo.
    ...


@pytest.mark.asyncio
async def test_cerrar_congela_indice_historial(db, monkeypatch):
    # Con peso_historial>0, tras cerrar, el resultado persistido tiene
    # indice_historial y peso_historial_efectivo poblados.
    ...


@pytest.mark.asyncio
async def test_indice_none_degrada_a_metas_360(db, monkeypatch):
    # bulk devuelve None para el empleado; el score cae a metas+360 (peso historial redistribuido).
    ...
```

Completa los `...` con el andamiaje real (montaje de ciclo con señales + mock del bulk) y asserts concretos de score/banda/response.

Añade tests de validación de pesos:

```python
def test_create_rechaza_los_tres_pesos_en_cero():
    import pytest, pydantic
    from app.schemas.ciclo_desempeno import CicloDesempenoCreate
    with pytest.raises(pydantic.ValidationError):
        CicloDesempenoCreate(nombre="C", peso_metas=0, peso_competencias=0, peso_historial=0)


def test_create_acepta_solo_peso_historial():
    from app.schemas.ciclo_desempeno import CicloDesempenoCreate
    c = CicloDesempenoCreate(nombre="C", peso_metas=0, peso_competencias=0, peso_historial=100)
    assert c.peso_historial == 100
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py -q`
Expected: FAIL (campos/validación/pre-carga inexistentes).

- [ ] **Step 3: Schemas — pesos y campos nuevos**

En `app/schemas/ciclo_desempeno.py`:

En `CicloDesempenoCreate`, añade el campo (junto a `peso_competencias`):

```python
    peso_historial: Decimal = Field(default=Decimal("0"), ge=0)
```

Y actualiza el validador de suma de pesos (el que hoy exige `peso_metas + peso_competencias > 0`):

```python
        if (self.peso_metas + self.peso_competencias + self.peso_historial) <= 0:
            raise ValueError("peso_metas + peso_competencias + peso_historial debe ser > 0")
```

En `CicloDesempenoUpdate`, añade `peso_historial: Optional[Decimal] = Field(None, ge=0)`. Si `CicloDesempenoUpdate` revalida la suma de pesos, incorpora `peso_historial` (usa 0 cuando venga `None`, o replica la lógica existente para los opcionales).

En `CicloDesempenoResponse`, añade `peso_historial: Decimal` (o `Optional[Decimal]` si el schema usa opcionales para reflejar el modelo). En `CicloDesempenoResultadoResponse`, añade:

```python
    indice_historial: Optional[Decimal] = None
    peso_historial_efectivo: Optional[Decimal] = None
```

- [ ] **Step 3b: Pre-carga condicional del índice + integración en lecturas y cierre**

En `app/services/ciclo_desempeno_service.py`, añade un helper que pre-carga los índices del scope una sola vez, solo si `peso_historial > 0`:

```python
    async def _indices_historial_ciclo(
        self, ciclo: CicloDesempeno, empleado_ids: list[int]
    ) -> dict[int, float | None]:
        """Pre-carga los indices de historial objetivo del conjunto de empleados
        con UNA sola apertura de engine de bono, SOLO si el ciclo pondera el
        historial (`peso_historial > 0`). Si el peso es 0, devuelve {} sin abrir
        el engine (no-regresion de costo). Periodo = fechas del ciclo; si faltan,
        ultimos 365 dias."""
        if ciclo.peso_historial is None or float(ciclo.peso_historial) <= 0 or not empleado_ids:
            return {}
        from datetime import date, timedelta
        fi = ciclo.fecha_inicio
        ff = ciclo.fecha_fin
        if fi is None or ff is None:
            hoy = date.today()
            fi, ff = hoy - timedelta(days=365), hoy
        historial_svc = HistorialObjetivoService(self.db)
        return await historial_svc.indices_historial_por_empleado(empleado_ids, fi, ff)
```

Importa `HistorialObjetivoService` en el service del ciclo (import local dentro del método si hay riesgo de ciclo de imports; preferible import a nivel módulo si no lo hay — verifica).

En `resultados_ciclo` (rama viva, antes del loop de `r`), pre-carga:

```python
        campana, participante_by_empleado, escala = await self._contexto_senales(ciclo)
        indices_hist = await self._indices_historial_ciclo(
            ciclo, [r.empleado_id for r in resultados]
        )
```

y pasa el índice a `_calcular_resultado_vivo(..., indice_historial=indices_hist.get(r.empleado_id))`. Añade al `CicloDesempenoResultadoResponse(...)` construido a mano los campos `indice_historial=_dec(datos["indice_historial"])` y `peso_historial_efectivo=_dec(datos["peso_historial_efectivo"])`.

En `cerrar_ciclo` (antes del loop), pre-carga igual (`indices_hist = await self._indices_historial_ciclo(ciclo, [r.empleado_id for r in ciclo.resultados])`), pasa el índice a `_calcular_resultado_vivo`, y añade al `upsert_resultado(...)` los campos `indice_historial=_dec(datos["indice_historial"])`, `peso_historial_efectivo=_dec(datos["peso_historial_efectivo"])`.

(La rama cerrada de `resultados_ciclo` usa `model_validate(r)`, así que toma `indice_historial`/`peso_historial_efectivo` del snapshot automáticamente — no requiere cambio salvo que los campos existan en el schema, ya añadidos en Step 3.)

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py -q`
Expected: PASS

- [ ] **Step 5: Actualizar `openapi.yaml`**

Añade `peso_historial` a los schemas `CicloDesempenoCreate`/`Update`/`Response` (o sus equivalentes en el yaml) e `indice_historial`/`peso_historial_efectivo` a `CicloDesempenoResultadoResponse`. Sin paths nuevos.

- [ ] **Step 6: Correr la suite del ciclo completa (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_service.py tests/test_ciclo_desempeno_api.py tests/test_ciclo_desempeno_calibracion.py tests/test_ciclo_desempeno_historial_senal.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/services/ciclo_desempeno_service.py app/schemas/ciclo_desempeno.py openapi.yaml tests/test_ciclo_desempeno_historial_senal.py
git commit -m "feat(desempeno): integrar indice de historial en el score del ciclo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — peso_historial en el form + índice en resultados

**Files:**
- Modify: `frontend/src/api/cicloDesempeno.ts` (tipos)
- Modify: `frontend/src/pages/cicloDesempeno.ts` (form de ciclo + columna resultados)
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: `peso_historial` en create/update/response; `indice_historial`/`peso_historial_efectivo` en el resultado (Task 4).

- [ ] **Step 1: Leer patrones**

Lee `design.md` y `frontend/src/ui/uiTokens.ts`. En `frontend/src/pages/cicloDesempeno.ts`, localiza el form de alta/edición de ciclo (campos `peso_metas`/`peso_competencias`) y la tabla de resultados (donde se muestran `cumplimiento_metas`/`calificacion_360_norm`/`calificacion_desempeno`).

- [ ] **Step 2: Tipos del api client**

En `frontend/src/api/cicloDesempeno.ts`, añade `peso_historial: number` a `CicloDesempenoCreate`, `CicloDesempenoUpdate` (opcional) y `CicloDesempenoResponse`; añade a `CicloDesempenoResultadoResponse`:

```typescript
  indice_historial: number | null;
  peso_historial_efectivo: number | null;
```

- [ ] **Step 3: Campo en el form + columna en resultados**

En el form de ciclo (`cicloDesempeno.ts`), añade el input `peso_historial` junto a `peso_metas`/`peso_competencias`, con ayuda "0 = el historial no cuenta en el score", usando los mismos tokens/markup que los otros dos pesos. Inclúyelo en el estado del form y en el payload de create/update (default 0).

En la tabla de resultados, añade una columna "Índice objetivo" que muestre `indice_historial` (o "—" si `null`) en `tabular-nums`. Opcional: el peso efectivo entre paréntesis cuando `> 0`.

- [ ] **Step 4: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build`
Expected: limpio (sin errores TS nuevos).

Run: `docker-compose exec -T frontend npm run test`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/cicloDesempeno.ts frontend/src/pages/cicloDesempeno.ts
git commit -m "feat(desempeno): peso_historial en el form del ciclo e indice en resultados

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Cierre de huecos de cobertura

**Files:**
- Modify: `tests/test_ciclo_desempeno_historial_senal.py`

- [ ] **Step 1: Añadir tests de huecos** (declara con el nombre del test existente si ya está cubierto)

1. **Regresión end-to-end sin ajuste**: un ciclo con `peso_historial=0` produce el mismo `calificacion_desempeno` y `banda_desempeno` con y sin la feature (compara contra el valor esperado del cálculo de 2 señales).
2. **Rango = fechas del ciclo**: espía `indices_historial_por_empleado` y verifica que recibe `ciclo.fecha_inicio`/`fecha_fin`; con un ciclo sin fechas, recibe una ventana de ~365 días.
3. **Snapshot de ciclo cerrado sin la feature**: un ciclo cerrado antes de la fase 2 (columnas `indice_historial` NULL) expone `indice_historial=None` en el response sin crash.
4. **9box y calibración intactos con historial**: con `peso_historial>0`, la banda calculada incluye el historial y el override de calibración sigue ganando (banda efectiva = ajustada).

Ejemplo (regresión):

```python
@pytest.mark.asyncio
async def test_regresion_peso_cero_score_identico(db, monkeypatch):
    # Mismo ciclo/senales con peso_historial=0: score y banda == calculo de 2 senales.
    ...
```

- [ ] **Step 2: Correr la suite del módulo**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_historial_senal.py -q`
Expected: PASS

- [ ] **Step 3: Correr la suite completa (sin regresiones)**

Run: `docker-compose run --rm test pytest -q`
Expected: sin fallos nuevos vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add tests/test_ciclo_desempeno_historial_senal.py
git commit -m "test(desempeno): cerrar huecos de cobertura del historial como senal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest -q` verde sin regresiones (con `peso_historial=0` en todos los ciclos existentes, score idéntico).
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual (tras `alembic upgrade head`): crear un ciclo con `peso_historial>0`, activarlo, ver que los resultados muestran el índice objetivo y que el score lo pondera; confirmar que un ciclo con `peso_historial=0` no cambia respecto a antes.
- Fase 2 completa el módulo Desempeño (queda como follow-up separado el agregador de progresivo/bono en el Historial Objetivo).
