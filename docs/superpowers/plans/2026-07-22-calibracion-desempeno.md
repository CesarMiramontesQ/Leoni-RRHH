# Calibración de Desempeño — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el admin RH ajuste directamente la banda de desempeño de cada empleado (con justificación obligatoria, auditado y reversible) antes de cerrar el ciclo, y ver la distribución de bandas contra una distribución objetivo como guía.

**Architecture:** Extensión del módulo Ciclo de Desempeño existente (mismo prefijo `/api/v1/ciclo-desempeno`, mismo registro `RH_MODULES`, misma página frontend). El ajuste vive como override persistente en 4 columnas nuevas de `levelup_ciclo_desempeno_resultado`. La regla central es **banda efectiva = `banda_desempeno_ajustada or banda_desempeno`**, aplicada al recomponer `segmento_9box`, al 9box, al export y al congelar el snapshot en el cierre. El score numérico calculado nunca se modifica.

**Tech Stack:** FastAPI async, SQLAlchemy async, Alembic, Pydantic v2, Vite/TypeScript, pytest (SQLite in-memory), openpyxl.

## Global Constraints

- Responder siempre en español; código y comentarios en español (sin acentos en identificadores).
- NUNCA push directo a `main`; rama `feat/cm/calibracion-desempeno`, PR a main.
- Toda tabla nueva `levelup_`; las migraciones Alembic solo pueden `add_column`/`alter_column`/`create_table` sobre tablas `levelup_*`. Prohibido DDL sobre tablas sin prefijo (`empleados`, etc.). Las FK a `empleados.empleado_id` son referencias, no DDL sobre `empleados`.
- NUNCA correr `alembic upgrade/downgrade` contra la BD real dentro de una tarea. Los tests usan SQLite in-memory (`tests/conftest.py`). Las migraciones dev las corre el usuario manualmente.
- Bandas válidas: `("bajo", "medio", "alto")` (`CICLO_DESEMPENO_BANDAS`). Estados de ciclo: `("borrador", "activo", "cerrado")`.
- Calibración es **global-only** (admin RH, scope `None`). Un jefe de equipo puede VER la distribución de su equipo pero NO ajustar (403).
- Solo se calibra la banda de **desempeño**. `banda_potencial` no cambia. El `segmento_9box` se recompone con la banda de desempeño efectiva.
- Calibración solo con ciclo `estado == "activo"`.
- Frontend: solo tokens de `frontend/src/ui/uiTokens.ts`; sin hex/fuentes nuevas. Leer `design.md` antes de tocar UI.
- Mantener `openapi.yaml` sincronizado con los endpoints/schemas nuevos.
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Distribución objetivo default: `{"alto": 20.0, "medio": 70.0, "bajo": 10.0}` (porcentajes).

## File Structure

- `app/models/ciclo_desempeno.py` — añadir 4 columnas a `CicloDesempenoResultado` (Task 1).
- `alembic/versions/c1a2l3i4b5r6_calibracion_desempeno.py` — nueva revisión, `down_revision="c1d2e3s4e5f1"` (Task 1).
- `app/services/ciclo_desempeno_service.py` — funciones puras `banda_efectiva`/`distribucion_bandas` + constante `DISTRIBUCION_OBJETIVO_DEFAULT` (Task 2); métodos `ajustar_banda`/`distribucion_ciclo`, y cambios en `cerrar_ciclo`/`resultados_ciclo`/`construir_9box` (Task 3).
- `app/schemas/ciclo_desempeno.py` — `BandaAjusteItem`, `CalibracionRequest`, `DistribucionBanda`, `DistribucionResponse`; campos nuevos en `CicloDesempenoResultadoResponse` (Task 4).
- `app/api/v1/ciclo_desempeno/router.py` — endpoints `PUT /calibracion`, `GET /distribucion` (Task 4).
- `openapi.yaml` — paths + schemas (Task 4).
- `frontend/src/api/cicloDesempeno.ts` — `calibrarCiclo`, `getDistribucionCiclo` + tipos (Task 5).
- `frontend/src/pages/cicloDesempeno.ts` — sub-vista Calibración gated a RH global (Task 5).
- Tests: `tests/test_ciclo_desempeno_calibracion.py` (nuevo, puro + service + API). Coverage gaps (Task 6).

---

### Task 1: Migración + columnas del modelo

**Files:**
- Modify: `app/models/ciclo_desempeno.py:157` (tras `snapshot_at`, dentro de `CicloDesempenoResultado`)
- Create: `alembic/versions/c1a2l3i4b5r6_calibracion_desempeno.py`
- Test: `tests/test_ciclo_desempeno_calibracion.py`

**Interfaces:**
- Consumes: `CicloDesempenoResultado` (`app/models/ciclo_desempeno.py`, `__tablename__="levelup_ciclo_desempeno_resultado"`).
- Produces: columnas `banda_desempeno_ajustada: Optional[str]`, `banda_ajuste_motivo: Optional[str]`, `banda_ajustada_por_id: Optional[int]`, `banda_ajustada_at: Optional[datetime]` en el modelo ORM.

- [ ] **Step 1: Escribir el test que falla** (crea el archivo de tests del módulo)

En `tests/test_ciclo_desempeno_calibracion.py`:

```python
"""Tests del módulo de Calibración de Desempeño."""
from datetime import datetime, timezone

from app.models.ciclo_desempeno import CicloDesempenoResultado


def test_modelo_resultado_tiene_columnas_de_ajuste():
    r = CicloDesempenoResultado(ciclo_id=1, empleado_id=10)
    r.banda_desempeno_ajustada = "alto"
    r.banda_ajuste_motivo = "corrige sesgo del jefe"
    r.banda_ajustada_por_id = 99
    r.banda_ajustada_at = datetime.now(timezone.utc)
    assert r.banda_desempeno_ajustada == "alto"
    assert r.banda_ajuste_motivo == "corrige sesgo del jefe"
    assert r.banda_ajustada_por_id == 99
    assert r.banda_ajustada_at is not None
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py::test_modelo_resultado_tiene_columnas_de_ajuste -v`
Expected: FAIL con `AttributeError` (o el mapper rechaza el kwarg) porque las columnas no existen.

- [ ] **Step 3: Añadir las columnas al modelo**

En `app/models/ciclo_desempeno.py`, dentro de `CicloDesempenoResultado`, inmediatamente después de la línea `snapshot_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)`:

```python
    # ── Calibración: override de banda de desempeño (auditado, reversible) ──
    banda_desempeno_ajustada: Mapped[Optional[str]] = mapped_column(
        String(10), nullable=True, comment="Override RH de banda: bajo|medio|alto",
    )
    banda_ajuste_motivo: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    banda_ajustada_por_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("empleados.empleado_id"), nullable=True
    )
    banda_ajustada_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

Verifica que `Text` esté importado al inicio del archivo (junto a `String`, `DateTime`, `ForeignKey`, `Numeric`). Si `Text` no está en el import de `sqlalchemy`, agrégalo.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py::test_modelo_resultado_tiene_columnas_de_ajuste -v`
Expected: PASS

- [ ] **Step 5: Crear la migración Alembic**

Confirma primero el head vigente:

Run: `docker-compose exec backend alembic heads`
Expected: incluye `c1d2e3s4e5f1` como head (si hubiera otro head más nuevo del módulo, encadena a ESE — ajusta `down_revision`).

Crea `alembic/versions/c1a2l3i4b5r6_calibracion_desempeno.py`:

```python
"""calibracion desempeno: override de banda en ciclo_desempeno_resultado

Revision ID: c1a2l3i4b5r6
Revises: c1d2e3s4e5f1
Create Date: 2026-07-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1a2l3i4b5r6"
down_revision: Union[str, None] = "c1d2e3s4e5f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "levelup_ciclo_desempeno_resultado"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("banda_desempeno_ajustada", sa.String(length=10), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajuste_motivo", sa.Text(), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajustada_por_id", sa.Integer(), nullable=True))
    op.add_column(TABLE, sa.Column("banda_ajustada_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_levelup_ciclo_desempeno_resultado_banda_ajustada_por",
        TABLE, "empleados",
        ["banda_ajustada_por_id"], ["empleado_id"],
        ondelete=None,
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_levelup_ciclo_desempeno_resultado_banda_ajustada_por", TABLE, type_="foreignkey"
    )
    op.drop_column(TABLE, "banda_ajustada_at")
    op.drop_column(TABLE, "banda_ajustada_por_id")
    op.drop_column(TABLE, "banda_ajuste_motivo")
    op.drop_column(TABLE, "banda_desempeno_ajustada")
```

No corras `alembic upgrade` (lo hace el usuario). El único DDL es sobre `levelup_ciclo_desempeno_resultado` (tabla propia) — permitido.

- [ ] **Step 6: Correr la suite del módulo para verificar que nada se rompió**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py tests/test_ciclo_desempeno_service.py -q`
Expected: PASS (los tests de servicio existentes siguen verdes; el nuevo test del modelo pasa).

- [ ] **Step 7: Commit**

```bash
git add app/models/ciclo_desempeno.py alembic/versions/c1a2l3i4b5r6_calibracion_desempeno.py tests/test_ciclo_desempeno_calibracion.py
git commit -m "feat(calibracion-desempeno): columnas de override de banda + migracion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Funciones puras `banda_efectiva` / `distribucion_bandas`

**Files:**
- Modify: `app/services/ciclo_desempeno_service.py` (zona de funciones puras módulo-nivel, después de `def banda(...)` que termina ~línea 160)
- Test: `tests/test_ciclo_desempeno_calibracion.py`

**Interfaces:**
- Produces:
  - `banda_efectiva(banda_calculada: Optional[str], banda_ajustada: Optional[str]) -> Optional[str]`
  - `distribucion_bandas(bandas: list[Optional[str]]) -> dict` → `{"bajo": int, "medio": int, "alto": int, "total": int, "pct": {"bajo": float, "medio": float, "alto": float}}`
  - `DISTRIBUCION_OBJETIVO_DEFAULT: dict[str, float]` = `{"alto": 20.0, "medio": 70.0, "bajo": 10.0}`

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_ciclo_desempeno_calibracion.py`:

```python
from app.services.ciclo_desempeno_service import (
    DISTRIBUCION_OBJETIVO_DEFAULT,
    banda_efectiva,
    distribucion_bandas,
)


def test_banda_efectiva_ajustada_gana():
    assert banda_efectiva("bajo", "alto") == "alto"


def test_banda_efectiva_sin_ajuste_usa_calculada():
    assert banda_efectiva("medio", None) == "medio"


def test_banda_efectiva_ambas_none():
    assert banda_efectiva(None, None) is None


def test_distribucion_bandas_mezcla():
    d = distribucion_bandas(["alto", "alto", "medio", "bajo", None])
    assert d["alto"] == 2 and d["medio"] == 1 and d["bajo"] == 1
    assert d["total"] == 4  # None se ignora
    assert d["pct"]["alto"] == 50.0
    assert d["pct"]["medio"] == 25.0
    assert d["pct"]["bajo"] == 25.0


def test_distribucion_bandas_vacia():
    d = distribucion_bandas([])
    assert d["total"] == 0
    assert d["pct"] == {"bajo": 0.0, "medio": 0.0, "alto": 0.0}


def test_distribucion_objetivo_default_suma_100():
    assert sum(DISTRIBUCION_OBJETIVO_DEFAULT.values()) == 100.0
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -k "banda_efectiva or distribucion" -v`
Expected: FAIL con `ImportError` (funciones no definidas).

- [ ] **Step 3: Implementar las funciones puras**

En `app/services/ciclo_desempeno_service.py`, después de la función `banda(...)` (antes de la clase `CicloDesempenoService`):

```python
DISTRIBUCION_OBJETIVO_DEFAULT: dict[str, float] = {"alto": 20.0, "medio": 70.0, "bajo": 10.0}


def banda_efectiva(
    banda_calculada: Optional[str], banda_ajustada: Optional[str]
) -> Optional[str]:
    """Banda oficial de desempeño: la ajustada (override RH) si existe, si no
    la calculada. `None` en ambas => sin banda (señal ausente)."""
    return banda_ajustada or banda_calculada


def distribucion_bandas(bandas: list[Optional[str]]) -> dict:
    """Cuenta bandas `bajo`/`medio`/`alto` (ignora `None`) y calcula el
    porcentaje de cada una sobre el total de bandas no nulas. `total == 0`
    => todos los porcentajes en `0.0`."""
    conteo = {"bajo": 0, "medio": 0, "alto": 0}
    for b in bandas:
        if b in conteo:
            conteo[b] += 1
    total = conteo["bajo"] + conteo["medio"] + conteo["alto"]
    if total == 0:
        pct = {"bajo": 0.0, "medio": 0.0, "alto": 0.0}
    else:
        pct = {k: round(v * 100.0 / total, 2) for k, v in conteo.items()}
    return {**conteo, "total": total, "pct": pct}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -k "banda_efectiva or distribucion" -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/services/ciclo_desempeno_service.py tests/test_ciclo_desempeno_calibracion.py
git commit -m "feat(calibracion-desempeno): funciones puras banda efectiva y distribucion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Service — `ajustar_banda`, `distribucion_ciclo` y banda efectiva en cierre/lecturas

**Files:**
- Modify: `app/services/ciclo_desempeno_service.py` (métodos `cerrar_ciclo` ~291, `resultados_ciclo` ~418, `construir_9box` ~480; nuevos métodos `ajustar_banda`, `distribucion_ciclo`)
- Test: `tests/test_ciclo_desempeno_calibracion.py`

**Interfaces:**
- Consumes: `banda_efectiva`, `distribucion_bandas`, `DISTRIBUCION_OBJETIVO_DEFAULT` (Task 2); `CicloDesempenoResultadoResponse` con campos nuevos (Task 4 los define en el schema — este task los usa por keyword; si el schema aún no tiene los campos al ejecutar en orden, Task 4 corre después: por eso este task construye el response por keyword y Task 4 añade los campos. Para que este task pase en aislamiento, **añade los campos del schema como parte de este task** — ver Step 3b). `repo.upsert_resultado(ciclo_id, empleado_id, **campos)`, `repo.get_resultado`, `repo.list_resultados`, `repo.get_nombres_empleados`.
- Produces:
  - `async def ajustar_banda(self, ciclo_id: int, items: list["BandaAjusteItem"], current_user_id: int) -> list[CicloDesempenoResultadoResponse]`
  - `async def distribucion_ciclo(self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None) -> "DistribucionResponse"`
  - `resultados_ciclo` expone `banda_desempeno_efectiva`, `banda_desempeno_ajustada`, `banda_ajuste_motivo`, `banda_ajustada_por_id`, `banda_ajustada_at`; `segmento_9box` se recompone con la banda efectiva.

> **Nota de ordenamiento:** este task depende de los schemas del Task 4. Para mantener cada task testeable en aislamiento, **este task incluye la adición mínima de campos al schema `CicloDesempenoResultadoResponse` y las clases `BandaAjusteItem`/`CalibracionRequest`/`DistribucionBanda`/`DistribucionResponse`** (Step 3b). El Task 4 solo añade los endpoints, el registro y `openapi.yaml`.

- [ ] **Step 1: Escribir los tests de service que fallan**

Añade a `tests/test_ciclo_desempeno_calibracion.py`. Estos tests montan un ciclo `activo` con un `CicloDesempenoResultado` que ya tiene `banda_desempeno` seteada, escribiendo directamente por el repo (evita montar metas/360 completos):

```python
import pytest

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.schemas.ciclo_desempeno import BandaAjusteItem
from app.services.ciclo_desempeno_service import CicloDesempenoService


async def _ciclo_activo_con_resultado(db, banda="medio", potencial=None, banda_potencial=None):
    """Crea un ciclo activo con un resultado ya poblado (banda_desempeno set)
    sin depender de fuentes metas/360."""
    ciclo = CicloDesempeno(nombre="C1", estado="activo", umbral_medio=50, umbral_alto=75)
    db.add(ciclo)
    await db.flush()
    repo = CicloDesempenoRepository(db)
    await repo.upsert_resultado(
        ciclo.id, 10,
        calificacion_desempeno=60,
        banda_desempeno=banda,
        potencial=potencial,
        banda_potencial=banda_potencial,
        segmento_9box=(f"{banda}_{banda_potencial}" if banda_potencial else None),
    )
    await db.commit()
    return ciclo


@pytest.mark.asyncio
async def test_ajustar_banda_sube_banda_y_audita(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id,
        [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="corrige sesgo")],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada == "alto"
    assert out[0].banda_desempeno_efectiva == "alto"
    assert out[0].banda_desempeno == "medio"  # la calculada se preserva
    assert out[0].banda_ajuste_motivo == "corrige sesgo"
    assert out[0].banda_ajustada_por_id == 99
    assert out[0].banda_ajustada_at is not None


@pytest.mark.asyncio
async def test_ajustar_banda_reversion_limpia_columnas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada=None, motivo=None)],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada is None
    assert out[0].banda_ajuste_motivo is None
    assert out[0].banda_ajustada_por_id is None
    assert out[0].banda_ajustada_at is None
    assert out[0].banda_desempeno_efectiva == "medio"  # vuelve a la calculada


@pytest.mark.asyncio
async def test_ajustar_banda_motivo_vacio_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(DomainValidationError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="  ")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_banda_invalida_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(DomainValidationError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="excelente", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_ciclo_no_activo_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    ciclo.estado = "cerrado"
    db.add(ciclo)
    await db.commit()
    svc = CicloDesempenoService(db)
    with pytest.raises(ConflictError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_empleado_fuera_del_ciclo_404(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(NotFoundError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=777, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_recompone_segmento_con_efectiva(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio", potencial=90, banda_potencial="alto")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    assert out[0].segmento_9box == "alto_alto"  # banda efectiva (alto), no la calculada (medio)


@pytest.mark.asyncio
async def test_distribucion_ciclo_cuenta_bandas_efectivas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="bajo")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    dist = await svc.distribucion_ciclo(ciclo.id)
    assert dist.actual.alto == 1
    assert dist.actual.bajo == 0  # la calculada era bajo, pero cuenta la efectiva (alto)
    assert dist.objetivo["alto"] == 20.0
    assert dist.desviacion["alto"] == round(100.0 - 20.0, 2)
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -k "ajustar_banda or distribucion_ciclo" -v`
Expected: FAIL con `ImportError` (`BandaAjusteItem` no existe) y `AttributeError` (métodos no existen).

- [ ] **Step 3b: Añadir los schemas al modelo Pydantic**

En `app/schemas/ciclo_desempeno.py`, dentro de `CicloDesempenoResultadoResponse`, después de `segmento_9box` (línea 194) añade:

```python
    banda_desempeno_ajustada: Optional[str] = None
    banda_desempeno_efectiva: Optional[str] = None
    banda_ajuste_motivo: Optional[str] = None
    banda_ajustada_por_id: Optional[int] = None
    banda_ajustada_at: Optional[datetime] = None
```

Amplía el `@field_validator` existente para incluir las bandas nuevas (la línea `@field_validator("banda_desempeno", "banda_potencial")`):

```python
    @field_validator("banda_desempeno", "banda_potencial", "banda_desempeno_ajustada", "banda_desempeno_efectiva")
```

Al final del archivo `app/schemas/ciclo_desempeno.py`, añade las clases nuevas:

```python
# ── Calibración ──────────────────────────────────────────────────────────


class BandaAjusteItem(BaseModel):
    empleado_id: int
    banda_ajustada: Optional[str] = None
    motivo: Optional[str] = None

    @field_validator("banda_ajustada")
    @classmethod
    def _banda_ajustada_valida(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, CICLO_DESEMPENO_BANDAS, "banda_ajustada")


class CalibracionRequest(BaseModel):
    items: list[BandaAjusteItem] = Field(..., min_length=1)


class DistribucionBanda(BaseModel):
    bajo: int = 0
    medio: int = 0
    alto: int = 0
    total: int = 0
    pct: dict[str, float] = Field(default_factory=dict)


class DistribucionResponse(BaseModel):
    ciclo_id: int
    actual: DistribucionBanda
    objetivo: dict[str, float] = Field(default_factory=dict)
    desviacion: dict[str, float] = Field(default_factory=dict)
```

Verifica que `_validar_pertenece`, `CICLO_DESEMPENO_BANDAS`, `field_validator`, `Field` y `BaseModel` ya están importados en el archivo (lo están: los usa el resto del módulo).

- [ ] **Step 3c: Implementar `ajustar_banda` y `distribucion_ciclo` en el service**

Primero, importa los schemas nuevos en `app/services/ciclo_desempeno_service.py` (en el bloque `from app.schemas.ciclo_desempeno import (...)`, añade `BandaAjusteItem`, `DistribucionBanda`, `DistribucionResponse`).

Añade estos métodos a `CicloDesempenoService` (por ejemplo después de `set_potencial`, antes de la sección Resultados/9-Box):

```python
    # ══════════════════════════════════════════════════════════════════════
    # Calibración (ajuste directo de banda, solo RH global, ciclo activo)
    # ══════════════════════════════════════════════════════════════════════
    async def ajustar_banda(
        self,
        ciclo_id: int,
        items: list[BandaAjusteItem],
        current_user_id: int,
    ) -> list[CicloDesempenoResultadoResponse]:
        """Aplica overrides de banda de desempeño. Exige ciclo `activo`
        (`ConflictError` 409 si no). Por item: `banda_ajustada=None` limpia el
        override (reversión, pone las 4 columnas de auditoría a None);
        `banda_ajustada` in bandas requiere `motivo` no vacío
        (`DomainValidationError` 422 si vacío) y setea override + auditoría.
        `banda_ajustada` fuera de las bandas => 422. Empleado sin resultado en
        el ciclo => `NotFoundError` 404. Recompone `segmento_9box` con la banda
        efectiva. El score numérico `calificacion_desempeno` NO se toca."""
        ciclo = await self._get_ciclo_o_404(ciclo_id)
        if ciclo.estado != "activo":
            raise ConflictError("Solo se puede calibrar un ciclo activo")

        ahora = datetime.now(timezone.utc)
        afectados: list[int] = []
        for item in items:
            resultado = await self.repo.get_resultado(ciclo_id, item.empleado_id)
            if resultado is None:
                raise NotFoundError("CicloDesempenoResultado", item.empleado_id)

            if item.banda_ajustada is None:
                # Reversión: limpia el override y su auditoría.
                nueva_ajustada = None
                banda_efe = banda_efectiva(resultado.banda_desempeno, None)
                campos = dict(
                    banda_desempeno_ajustada=None,
                    banda_ajuste_motivo=None,
                    banda_ajustada_por_id=None,
                    banda_ajustada_at=None,
                )
            else:
                if item.banda_ajustada not in CICLO_DESEMPENO_BANDAS:
                    raise DomainValidationError(
                        "banda_ajustada invalida", field="banda_ajustada"
                    )
                if item.motivo is None or not item.motivo.strip():
                    raise DomainValidationError(
                        "El motivo del ajuste es obligatorio", field="motivo"
                    )
                nueva_ajustada = item.banda_ajustada
                banda_efe = banda_efectiva(resultado.banda_desempeno, nueva_ajustada)
                campos = dict(
                    banda_desempeno_ajustada=nueva_ajustada,
                    banda_ajuste_motivo=item.motivo.strip(),
                    banda_ajustada_por_id=current_user_id,
                    banda_ajustada_at=ahora,
                )

            # Recompone el segmento con la banda efectiva (banda_potencial no cambia).
            segmento = (
                f"{banda_efe}_{resultado.banda_potencial}"
                if banda_efe is not None and resultado.banda_potencial is not None
                else None
            )
            await self.repo.upsert_resultado(
                ciclo_id, item.empleado_id, segmento_9box=segmento, **campos
            )
            afectados.append(item.empleado_id)

        return await self.resultados_ciclo(ciclo_id, set(afectados))

    async def distribucion_ciclo(
        self, ciclo_id: int, empleado_ids_scope: Optional[set[int]] = None
    ) -> DistribucionResponse:
        """Distribución de bandas EFECTIVAS del ciclo (scope aplicado) vs. la
        distribución objetivo (config del ciclo o default). `desviacion` =
        pct actual - objetivo por banda."""
        resultados = await self.resultados_ciclo(ciclo_id, empleado_ids_scope)
        bandas = [r.banda_desempeno_efectiva for r in resultados]
        dist = distribucion_bandas(bandas)
        actual = DistribucionBanda(**dist)

        ciclo = await self._get_ciclo_o_404(ciclo_id)
        objetivo = DISTRIBUCION_OBJETIVO_DEFAULT
        if ciclo.config and isinstance(ciclo.config, dict):
            cfg = ciclo.config.get("distribucion_objetivo")
            if isinstance(cfg, dict):
                objetivo = {k: float(cfg.get(k, 0.0)) for k in ("bajo", "medio", "alto")}

        desviacion = {
            k: round(actual.pct.get(k, 0.0) - objetivo.get(k, 0.0), 2)
            for k in ("bajo", "medio", "alto")
        }
        return DistribucionResponse(
            ciclo_id=ciclo_id, actual=actual, objetivo=objetivo, desviacion=desviacion
        )
```

- [ ] **Step 3d: Exponer la banda efectiva en `resultados_ciclo` (rama vivo y cerrado)**

En `resultados_ciclo`, **rama cerrado** (el bloque `if ciclo.estado == "cerrado":`), después de `data.empleado_nombre = nombres.get(r.empleado_id)` añade:

```python
                data.banda_desempeno_efectiva = banda_efectiva(
                    data.banda_desempeno, data.banda_desempeno_ajustada
                )
```

(los campos `banda_desempeno_ajustada`/`banda_ajuste_motivo`/`banda_ajustada_por_id`/`banda_ajustada_at` los toma `model_validate(r)` del ORM automáticamente).

En la **rama vivo** (construcción manual de `CicloDesempenoResultadoResponse(...)`), calcula la banda efectiva y usa el segmento efectivo. Reemplaza el bloque de `segmento` y el `CicloDesempenoResultadoResponse(...)` por:

```python
            banda_efe = banda_efectiva(datos["banda_desempeno"], r.banda_desempeno_ajustada)
            segmento = (
                f"{banda_efe}_{banda_potencial}"
                if banda_efe is not None and banda_potencial is not None
                else None
            )
            out.append(
                CicloDesempenoResultadoResponse(
                    id=r.id,
                    ciclo_id=r.ciclo_id,
                    empleado_id=r.empleado_id,
                    empleado_nombre=nombres.get(r.empleado_id),
                    cumplimiento_metas=_dec(datos["cumplimiento_metas"]),
                    calificacion_360_raw=_dec(datos["calificacion_360_raw"]),
                    calificacion_360_norm=_dec(datos["calificacion_360_norm"]),
                    escala_min=_dec(datos["escala_min"]),
                    escala_max=_dec(datos["escala_max"]),
                    calificacion_desempeno=_dec(datos["calificacion_desempeno"]),
                    peso_metas_efectivo=_dec(datos["peso_metas_efectivo"]),
                    peso_competencias_efectivo=_dec(datos["peso_competencias_efectivo"]),
                    potencial=r.potencial,
                    banda_desempeno=datos["banda_desempeno"],
                    banda_potencial=banda_potencial,
                    segmento_9box=segmento,
                    banda_desempeno_ajustada=r.banda_desempeno_ajustada,
                    banda_desempeno_efectiva=banda_efe,
                    banda_ajuste_motivo=r.banda_ajuste_motivo,
                    banda_ajustada_por_id=r.banda_ajustada_por_id,
                    banda_ajustada_at=r.banda_ajustada_at,
                    potencial_capturado_por_id=r.potencial_capturado_por_id,
                    potencial_capturado_at=r.potencial_capturado_at,
                    snapshot_at=r.snapshot_at,
                )
            )
```

- [ ] **Step 3e: Agrupar el 9box por banda efectiva**

En `construir_9box`, la línea `if r.banda_desempeno is None or r.banda_potencial is None:` y `clave = (r.banda_desempeno, r.banda_potencial)` deben usar la banda efectiva. Reemplaza por:

```python
        for r in resultados:
            bd_efe = r.banda_desempeno_efectiva
            if bd_efe is None or r.banda_potencial is None:
                continue
            clave = (bd_efe, r.banda_potencial)
```

(en ciclo cerrado, `banda_desempeno_efectiva == banda_desempeno` del snapshot, así que el comportamiento no cambia; en activo con ajuste, agrupa por la banda calibrada).

- [ ] **Step 3f: Congelar la banda efectiva en `cerrar_ciclo`**

En `cerrar_ciclo`, dentro del `for resultado in ciclo.resultados:`, después de calcular `datos` y `banda_potencial`, reemplaza el cálculo de `segmento` y el `upsert_resultado(...)` para persistir la banda efectiva en `banda_desempeno`:

```python
            banda_efe = banda_efectiva(datos["banda_desempeno"], resultado.banda_desempeno_ajustada)
            segmento = (
                f"{banda_efe}_{banda_potencial}"
                if banda_efe is not None and banda_potencial is not None
                else None
            )
            await self.repo.upsert_resultado(
                ciclo.id,
                resultado.empleado_id,
                cumplimiento_metas=_dec(datos["cumplimiento_metas"]),
                calificacion_360_raw=_dec(datos["calificacion_360_raw"]),
                calificacion_360_norm=_dec(datos["calificacion_360_norm"]),
                escala_min=_dec(datos["escala_min"]),
                escala_max=_dec(datos["escala_max"]),
                calificacion_desempeno=_dec(datos["calificacion_desempeno"]),
                peso_metas_efectivo=_dec(datos["peso_metas_efectivo"]),
                peso_competencias_efectivo=_dec(datos["peso_competencias_efectivo"]),
                banda_desempeno=banda_efe,
                banda_potencial=banda_potencial,
                segmento_9box=segmento,
                snapshot_at=ahora,
            )
```

(las columnas de auditoría del ajuste quedan intactas — registro de qué se ajustó; `calificacion_desempeno` sigue siendo el score calculado, sin tocar).

- [ ] **Step 4: Correr los tests del módulo para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -q`
Expected: PASS (todos: modelo + puras + service).

- [ ] **Step 5: Correr la suite del ciclo completa (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_service.py tests/test_ciclo_desempeno_api.py tests/test_ciclo_desempeno_calibracion.py -q`
Expected: PASS (los cambios en `resultados_ciclo`/`construir_9box`/`cerrar_ciclo` no rompen los tests existentes; en ciclos sin ajuste, banda efectiva == calculada).

- [ ] **Step 6: Commit**

```bash
git add app/services/ciclo_desempeno_service.py app/schemas/ciclo_desempeno.py tests/test_ciclo_desempeno_calibracion.py
git commit -m "feat(calibracion-desempeno): ajustar_banda, distribucion y banda efectiva en cierre/lecturas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: API — endpoints `PUT /calibracion` y `GET /distribucion` + openapi

**Files:**
- Modify: `app/api/v1/ciclo_desempeno/router.py` (nuevos handlers + import de schemas)
- Modify: `openapi.yaml`
- Test: `tests/test_ciclo_desempeno_calibracion.py`

**Interfaces:**
- Consumes: `svc.ajustar_banda(ciclo_id, items, current_user_id)`, `svc.distribucion_ciclo(ciclo_id, empleado_ids_scope)` (Task 3); `_resolve_scope`, `_gestion_or_equipo`, `role_checker(["operativo"])` (existentes); `CalibracionRequest`, `DistribucionResponse` (Task 3 schema); `ForbiddenError` (`app.core.exceptions`).
- Produces: `PUT /api/v1/ciclo-desempeno/ciclos/{ciclo_id}/calibracion`, `GET /api/v1/ciclo-desempeno/ciclos/{ciclo_id}/distribucion`.

- [ ] **Step 1: Escribir los tests de API que fallan**

Añade a `tests/test_ciclo_desempeno_calibracion.py`. Usa el patrón de auth de `tests/test_ciclo_desempeno_api.py` (helper `auth_headers`, `make_empleado`; RH global = admin en modo operativo, jefe = supervisor con subordinados). Lee ese archivo para reproducir el montaje exacto de un ciclo activo con resultado y de los usuarios RH/jefe.

```python
@pytest.mark.asyncio
async def test_api_calibracion_admin_rh_200(client, db, ...):
    # Monta ciclo activo con resultado (empleado_id=10, banda_desempeno="medio").
    # Usuario admin RH en modo operativo.
    resp = await client.put(
        f"/api/v1/ciclo-desempeno/ciclos/{ciclo_id}/calibracion",
        json={"items": [{"empleado_id": 10, "banda_ajustada": "alto", "motivo": "corrige sesgo"}]},
        headers=headers_admin_rh,
    )
    assert resp.status_code == 200
    assert resp.json()[0]["banda_desempeno_efectiva"] == "alto"


@pytest.mark.asyncio
async def test_api_calibracion_jefe_equipo_403(client, db, ...):
    # Jefe (supervisor con scope de equipo) NO puede calibrar.
    resp = await client.put(
        f"/api/v1/ciclo-desempeno/ciclos/{ciclo_id}/calibracion",
        json={"items": [{"empleado_id": 10, "banda_ajustada": "alto", "motivo": "x"}]},
        headers=headers_jefe,
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_api_distribucion_admin_rh_200(client, db, ...):
    resp = await client.get(
        f"/api/v1/ciclo-desempeno/ciclos/{ciclo_id}/distribucion",
        headers=headers_admin_rh,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "actual" in body and "objetivo" in body and "desviacion" in body
```

Completa los `...` reproduciendo el montaje de `tests/test_ciclo_desempeno_api.py` (fixtures `client`, `db`, creación de empleados/roles, `auth_headers`, y modo RH operativo vía header `X-RH-UI-Mode` u homólogo que use ese archivo). Nombra los tests y usa asserts concretos como arriba.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -k "api_calibracion or api_distribucion" -v`
Expected: FAIL con 404 (rutas inexistentes).

- [ ] **Step 3: Implementar los endpoints**

En `app/api/v1/ciclo_desempeno/router.py`:

Añade al import de schemas (`from app.schemas.ciclo_desempeno import (...)`): `CalibracionRequest`, `DistribucionResponse`. Añade al import de excepciones (crea la línea si no existe): `from app.core.exceptions import ForbiddenError`.

Después del handler `set_potencial` (línea ~210), añade:

```python
# ══════════════════════════════════════════════════════════════════════════
# Calibración — ajuste directo de banda (solo RH global) + distribución
# ══════════════════════════════════════════════════════════════════════════
@router.put(
    "/ciclos/{ciclo_id}/calibracion",
    response_model=list[CicloDesempenoResultadoResponse],
)
async def calibrar_ciclo(
    ciclo_id: int,
    data: CalibracionRequest,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    """Calibración es potestad de RH corporativo (scope global). Un jefe de
    equipo (scope != None) recibe 403."""
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    if scope is not None:
        raise ForbiddenError("La calibración es exclusiva de RH (alcance global)")
    return await svc.ajustar_banda(
        ciclo_id, data.items, current_user_id=current_user.empleado_id
    )


@router.get("/ciclos/{ciclo_id}/distribucion", response_model=DistribucionResponse)
async def distribucion_ciclo(
    ciclo_id: int,
    current_user: Empleado = Depends(_gestion_or_equipo()),
    rh_ui_mode: Optional[str] = Depends(get_rh_ui_mode),
    db: AsyncSession = Depends(get_db),
    svc: CicloDesempenoService = Depends(_svc),
):
    scope = await _resolve_scope(current_user, rh_ui_mode, db)
    return await svc.distribucion_ciclo(ciclo_id, empleado_ids_scope=scope)
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -k "api_calibracion or api_distribucion" -v`
Expected: PASS

- [ ] **Step 5: Actualizar `openapi.yaml`**

Añade los dos paths bajo `/api/v1/ciclo-desempeno/ciclos/{ciclo_id}/calibracion` (PUT) y `.../distribucion` (GET), y los component schemas `CalibracionRequest`, `BandaAjusteItem`, `DistribucionResponse`, `DistribucionBanda`; añade a `CicloDesempenoResultadoResponse` (o su schema equivalente en el yaml) los campos `banda_desempeno_ajustada`, `banda_desempeno_efectiva`, `banda_ajuste_motivo`, `banda_ajustada_por_id`, `banda_ajustada_at`. Sigue el estilo de los paths ya presentes del ciclo (`/potencial`, `/9box`).

- [ ] **Step 6: Correr la suite completa del ciclo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py tests/test_ciclo_desempeno_api.py -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/api/v1/ciclo_desempeno/router.py openapi.yaml tests/test_ciclo_desempeno_calibracion.py
git commit -m "feat(calibracion-desempeno): endpoints calibracion y distribucion + openapi

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — api client + sub-vista de Calibración

**Files:**
- Modify: `frontend/src/api/cicloDesempeno.ts` (tipos + `calibrarCiclo`, `getDistribucionCiclo`)
- Modify: `frontend/src/pages/cicloDesempeno.ts` (sub-vista Calibración gated a RH global)
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: `PUT /api/v1/ciclo-desempeno/ciclos/{id}/calibracion`, `GET .../distribucion` (Task 4); `esGestionRh = canAccessRhAssignedModule("ciclo-desempeno", {blockGestorTeam: true, blockEmpleado: true})` (patrón existente en `pages/cicloDesempeno.ts:200`); tokens de `frontend/src/ui/uiTokens.ts` (`SELECT_CHEVRON`, `skeletonBlock`, `errorState`, badge functions, `alertWarning`).
- Produces: `calibrarCiclo(cicloId, items)`, `getDistribucionCiclo(cicloId)`; sub-vista "Calibración" en la pestaña de resultados de RH.

- [ ] **Step 1: Leer el design system y los patrones**

Lee `design.md` y `frontend/src/ui/uiTokens.ts`. Estudia `frontend/src/pages/cicloDesempeno.ts` (cómo `esGestionRh` distingue RH global de jefe; cómo `loadResultadosYBox` carga datos y `renderTabNav` arma pestañas; el patrón de event delegation y AbortController por mount). Estudia `frontend/src/api/cicloDesempeno.ts` (patrón `apiFetch`/error class, tipos espejo de schemas).

- [ ] **Step 2: Extender el api client con tipos y funciones**

En `frontend/src/api/cicloDesempeno.ts`:

Añade a `CicloDesempenoResultadoResponse` (interface, ~línea 85) los campos:

```typescript
  banda_desempeno_ajustada: CicloDesempenoBanda | null;
  banda_desempeno_efectiva: CicloDesempenoBanda | null;
  banda_ajuste_motivo: string | null;
  banda_ajustada_por_id: number | null;
  banda_ajustada_at: string | null;
```

Añade tipos y funciones nuevas:

```typescript
export interface BandaAjusteItem {
  empleado_id: number;
  banda_ajustada: CicloDesempenoBanda | null;
  motivo: string | null;
}

export interface DistribucionBanda {
  bajo: number;
  medio: number;
  alto: number;
  total: number;
  pct: Record<string, number>;
}

export interface DistribucionResponse {
  ciclo_id: number;
  actual: DistribucionBanda;
  objetivo: Record<string, number>;
  desviacion: Record<string, number>;
}

export async function calibrarCiclo(
  cicloId: number,
  items: BandaAjusteItem[],
): Promise<CicloDesempenoResultadoResponse[]> {
  return apiFetch<CicloDesempenoResultadoResponse[]>(
    `${BASE}/ciclos/${cicloId}/calibracion`,
    { method: "PUT", body: JSON.stringify({ items }) },
  );
}

export async function getDistribucionCiclo(cicloId: number): Promise<DistribucionResponse> {
  return apiFetch<DistribucionResponse>(`${BASE}/ciclos/${cicloId}/distribucion`);
}
```

Usa exactamente el mismo mecanismo de fetch/parse que las funciones ya presentes en el archivo (si usan `apiFetch`, úsalo; si usan otro helper, replícalo). No inventes un cliente nuevo.

- [ ] **Step 3: Añadir la sub-vista de Calibración en la página**

En `frontend/src/pages/cicloDesempeno.ts`, dentro de la pestaña "Resultados y 9-Box", añade una sección **Calibración** que se renderiza **solo si `esGestionRh` es true** (RH global). No la muestres al jefe de equipo.

La sección incluye:
- **Barra de distribución**: para cada banda (orden `alto`, `medio`, `bajo`), muestra conteo, `pct` actual, objetivo y desviación. Usa las funciones de badge existentes: `alto` → tono positivo, `medio` → neutro, `bajo` → negativo (reusa las funciones de badge de `uiTokens.ts`; no definas colores). Datos desde `getDistribucionCiclo(cicloId)`.
- **Tabla por empleado**: columnas nombre, banda calculada (`banda_desempeno`), selector de banda ajustada (`<select>` con `SELECT_CHEVRON`, opciones vacío/bajo/medio/alto donde "vacío" = reversión), campo de texto motivo, y quién/cuándo del ajuste (`banda_ajustada_por_id`/`banda_ajustada_at` si presentes).
- **Aviso "stale"**: si `banda_desempeno_ajustada` existe y difiere de `banda_desempeno_efectiva` no aplica (son iguales por definición); el aviso correcto es informativo: cuando hay ajuste (`banda_desempeno_ajustada != null`), muestra con `alertWarning` un texto tipo "Banda ajustada manualmente (calculada: {banda_desempeno})" para que RH vea el override sobre el cálculo vivo.
- **Botón "Guardar calibración"**: envía con `calibrarCiclo(cicloId, items)` solo las filas modificadas (banda ajustada cambiada respecto al valor cargado, o motivo editado). Tras éxito, recarga resultados + distribución.
- Estados: `skeletonBlock` (cargando), `errorState` (error), vacío (sin resultados).

Respeta el AbortController por mount y el event delegation ya usados en la página. No toques el nav ni `shellNavPolicy.ts` (vive dentro del módulo ya registrado).

- [ ] **Step 4: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build`
Expected: build limpio (sin errores TS nuevos).

Run: `docker-compose exec -T frontend npm run test`
Expected: verde. Si el repo tiene tests de la página del ciclo, no deben romperse.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/cicloDesempeno.ts frontend/src/pages/cicloDesempeno.ts
git commit -m "feat(calibracion-desempeno): sub-vista de calibracion con distribucion y ajuste de banda

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Cierre de huecos de cobertura

**Files:**
- Modify: `tests/test_ciclo_desempeno_calibracion.py`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Añadir tests de huecos**

Cubre, si no están ya cubiertos (declara el nombre del test existente si sí):
1. **Cierre persiste la banda efectiva**: ciclo activo con resultado ajustado (`banda_desempeno` calculada = "bajo", ajustada = "alto") → tras `cerrar_ciclo`, el `CicloDesempenoResultado` persistido tiene `banda_desempeno == "alto"` (efectiva) y `segmento_9box` recompuesto; `calificacion_desempeno` intacto; las columnas de auditoría del ajuste conservadas.
2. **Cierre sin ajuste = comportamiento idéntico**: resultado sin override → `banda_desempeno` tras cierre == la calculada.
3. **9box agrupa por banda efectiva**: en ciclo activo, un empleado con `banda_desempeno` calculada distinta de la ajustada cae en la celda de la banda ajustada.
4. **Distribución con scope de jefe**: `distribucion_ciclo(ciclo_id, scope={ids})` cuenta solo el equipo del jefe.
5. **Reversión en snapshot**: si se revierte antes de cerrar, el cierre usa la banda calculada.

Ejemplo (cierre persiste efectiva):

```python
@pytest.mark.asyncio
async def test_cerrar_persiste_banda_efectiva(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="bajo")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    await svc.cerrar_ciclo(ciclo.id, forzar=True)
    repo = CicloDesempenoRepository(db)
    r = await repo.get_resultado(ciclo.id, 10)
    assert r.banda_desempeno == "alto"          # efectiva congelada
    assert r.banda_desempeno_ajustada == "alto" # auditoría conservada
```

> Nota: `_ciclo_activo_con_resultado` no vincula metas/360, así que al recalcular en vivo durante el cierre, `_calcular_resultado_vivo` podría devolver `banda_desempeno=None` (sin señales). En ese caso la banda efectiva = ajustada ("alto") igualmente (banda_efectiva(None, "alto") == "alto"), que es justo lo que el test valida. Si el montaje real requiere señales, reutiliza el fixture de `tests/test_ciclo_desempeno_service.py` que sí las monta.

- [ ] **Step 2: Correr toda la suite del módulo**

Run: `docker-compose run --rm test pytest tests/test_ciclo_desempeno_calibracion.py -q`
Expected: PASS

- [ ] **Step 3: Correr la suite completa (sin regresiones)**

Run: `docker-compose run --rm test pytest -q`
Expected: sin fallos nuevos vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add tests/test_ciclo_desempeno_calibracion.py
git commit -m "test(calibracion-desempeno): cerrar huecos de cobertura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest -q` verde sin regresiones.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual (tras `alembic upgrade head` que corre el usuario): como admin RH abrir `#/talento/ciclo-desempeno` → pestaña Resultados → sección Calibración: ver distribución actual vs objetivo, ajustar una banda con motivo, guardar, ver el override reflejado; revertir; como jefe confirmar que la sección de calibración NO aparece y que `PUT /calibracion` da 403.
- Fase 2 (fuera de alcance): consumir `indice_historial_empleado` del historial objetivo como señal del score.
