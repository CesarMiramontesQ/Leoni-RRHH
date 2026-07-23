# Motor de Sugerencias de Capacitación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar el módulo huérfano de Sugerencias de Capacitación: backend (CRUD + generador desde brechas), conexión de la página ya maquetada, y enlace opcional a un curso del catálogo.

**Architecture:** Service + router nuevos sobre el modelo `SugerenciaCapacitacion` ya existente. Una migración `levelup_` (add `curso_id`). El generador reusa `CompetenciaService.obtener_brechas`. RH-gated (módulo `sugerencias`, hoy con `api_prefixes=()`). Se conecta la página `levelUp.ts` (`mountSugerencias`, hoy con datos falsos).

**Tech Stack:** FastAPI async, SQLAlchemy async, Alembic, Pydantic v2, Vite/TypeScript, pytest (SQLite in-memory).

## Global Constraints

- Responder siempre en español; código y comentarios en español sin acentos en identificadores.
- NUNCA push directo a `main`; rama `feat/cm/sugerencias-capacitacion`, PR a main.
- Toda tabla nueva `levelup_`; migraciones Alembic solo `add_column`/`create_foreign_key` sobre tablas `levelup_*`. La FK a `levelup_cursos` es sobre tabla propia (permitido).
- NUNCA correr `alembic upgrade/downgrade` contra la BD real dentro de una tarea. Tests con SQLite in-memory (`tests/conftest.py`).
- Estados de sugerencia: `("activa", "aprobada", "pospuesta", "descartada")` (enum `EstadoSugerencia`). Prioridad 1-5. Porcentajes 0-100.
- El modelo `SugerenciaCapacitacion` y los schemas `SugerenciaCapacitacionCreate/Update/Response` YA existen (`app/models/level_up.py` L664-692, `app/schemas/level_up.py` L405-447). Se EXTIENDEN, no se recrean.
- `adopcion_sector_pct` no tiene fuente de datos → captura manual; el generador lo deja `None`.
- El generador NO inventa datos manuales (`duracion_sugerida`/`inversion_estimada`/`proveedor_sugerido`/`adopcion_sector_pct`/`curso_id` quedan `None`).
- Mantener `openapi.yaml` sincronizado. Frontend: solo tokens de `frontend/src/ui/uiTokens.ts`.
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

- `app/models/level_up.py` — `curso_id` + relación en `SugerenciaCapacitacion` (Task 1).
- `alembic/versions/s1u2g3e4r5c6_sugerencias_curso_id.py` — migración (Task 1).
- `app/schemas/level_up.py` — `curso_id`/`curso_nombre` en schemas + `GenerarDesdeBrechasRequest` (Task 1).
- `app/services/sugerencia_capacitacion_service.py` — service (Tasks 2-4).
- `app/api/v1/sugerencias/{__init__.py,router.py}` — router (Task 5).
- `app/main.py`, `app/core/rh_module_registry.py`, `openapi.yaml` — registro (Task 5).
- `frontend/src/api/sugerencias.ts`, `frontend/src/pages/levelUp.ts` — frontend (Task 6).
- Tests: `tests/test_sugerencias_capacitacion.py` (nuevo).

---

### Task 1: Migración `curso_id` + modelo + schemas

**Files:**
- Modify: `app/models/level_up.py` (`SugerenciaCapacitacion`, ~L664-692)
- Create: `alembic/versions/s1u2g3e4r5c6_sugerencias_curso_id.py`
- Modify: `app/schemas/level_up.py` (L405-447)
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Produces: `SugerenciaCapacitacion.curso_id: Optional[int]`; `SugerenciaCapacitacionCreate.curso_id`, `SugerenciaCapacitacionUpdate.curso_id`, `SugerenciaCapacitacionResponse.curso_id`/`curso_nombre`; `GenerarDesdeBrechasRequest(area_id, umbral_brecha)`.

- [ ] **Step 1: Escribir el test que falla** (crea el archivo de tests)

En `tests/test_sugerencias_capacitacion.py`:

```python
"""Tests del Motor de Sugerencias de Capacitacion."""
from app.models.level_up import SugerenciaCapacitacion
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
)


def test_modelo_tiene_curso_id():
    cols = set(SugerenciaCapacitacion.__table__.columns.keys())
    assert "curso_id" in cols


def test_schemas_tienen_curso_id():
    c = SugerenciaCapacitacionCreate(titulo="X", curso_id=5)
    assert c.curso_id == 5
    assert "curso_id" in SugerenciaCapacitacionResponse.model_fields
    assert "curso_nombre" in SugerenciaCapacitacionResponse.model_fields


def test_generar_request_default_umbral_cero():
    r = GenerarDesdeBrechasRequest(area_id=1)
    assert r.umbral_brecha == 0
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -v`
Expected: FAIL (columna/campos inexistentes; `GenerarDesdeBrechasRequest` no existe).

- [ ] **Step 3: Añadir `curso_id` al modelo**

En `app/models/level_up.py`, en `SugerenciaCapacitacion`, después de `proveedor_sugerido` (antes de `prioridad`):

```python
    curso_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("levelup_cursos.id", ondelete="SET NULL"), nullable=True
    )
```

Y una relación de solo lectura (para derivar `curso_nombre`):

```python
    curso: Mapped[Optional["Curso"]] = relationship("Curso", foreign_keys=[curso_id])
```

(Verifica que `ForeignKey`, `relationship`, `Optional` estén importados — lo están, el archivo los usa.)

- [ ] **Step 4: Crear la migración Alembic**

Confirma el head:

Run: `docker-compose exec backend alembic heads`
Expected: `h1s2t3s4e5n6 (head)` (si hubiera otro más nuevo, encadena a ESE).

Crea `alembic/versions/s1u2g3e4r5c6_sugerencias_curso_id.py`:

```python
"""sugerencias: curso_id opcional en levelup_sugerencias_capacitacion

Revision ID: s1u2g3e4r5c6
Revises: h1s2t3s4e5n6
Create Date: 2026-07-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s1u2g3e4r5c6"
down_revision: Union[str, None] = "h1s2t3s4e5n6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "levelup_sugerencias_capacitacion"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("curso_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_levelup_sugerencia_curso",
        TABLE, "levelup_cursos",
        ["curso_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_levelup_sugerencia_curso", TABLE, type_="foreignkey")
    op.drop_column(TABLE, "curso_id")
```

No corras `alembic upgrade`.

- [ ] **Step 5: Extender los schemas**

En `app/schemas/level_up.py`:

En `SugerenciaCapacitacionCreate`, añade (antes de `prioridad`):

```python
    curso_id: Optional[int] = None
```

En `SugerenciaCapacitacionUpdate`, añade:

```python
    curso_id: Optional[int] = None
```

En `SugerenciaCapacitacionResponse`, añade (antes de `prioridad`):

```python
    curso_id: Optional[int] = None
    curso_nombre: Optional[str] = None
```

Al final del bloque de sugerencias, añade el request del generador:

```python
class GenerarDesdeBrechasRequest(BaseModel):
    area_id: int
    umbral_brecha: float = Field(default=0, ge=0, le=100)
```

(Verifica que `Field`, `Optional`, `BaseModel` estén importados — lo están.)

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/models/level_up.py alembic/versions/s1u2g3e4r5c6_sugerencias_curso_id.py app/schemas/level_up.py tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): curso_id opcional + schemas del generador

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Función pura `prioridad_desde_brecha`

**Files:**
- Create: `app/services/sugerencia_capacitacion_service.py` (función módulo-nivel + esqueleto de clase)
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Produces: `prioridad_desde_brecha(gap_porcentaje: float) -> int`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_sugerencias_capacitacion.py`:

```python
from app.services.sugerencia_capacitacion_service import prioridad_desde_brecha


def test_prioridad_desde_brecha_bandas():
    assert prioridad_desde_brecha(0) == 1       # sin brecha -> mantener
    assert prioridad_desde_brecha(15) == 3      # 1-30
    assert prioridad_desde_brecha(30) == 3
    assert prioridad_desde_brecha(45) == 4      # 31-50
    assert prioridad_desde_brecha(50) == 4
    assert prioridad_desde_brecha(80) == 5      # >50
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k prioridad -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Crear el archivo del service con la función pura**

Crea `app/services/sugerencia_capacitacion_service.py`:

```python
"""Motor de Sugerencias de Capacitacion: CRUD + generador desde brechas."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


def prioridad_desde_brecha(gap_porcentaje: float) -> int:
    """Deriva la prioridad 1-5 desde el porcentaje de brecha, alineado a los
    rangos de AccionRecomendada (0 / 1-30 / 31-50 / 51-100):
      <= 0 -> 1 (mantener nivel); <= 30 -> 3; <= 50 -> 4; > 50 -> 5."""
    g = float(gap_porcentaje)
    if g <= 0:
        return 1
    if g <= 30:
        return 3
    if g <= 50:
        return 4
    return 5


class SugerenciaCapacitacionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k prioridad -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/sugerencia_capacitacion_service.py tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): funcion pura prioridad_desde_brecha

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Service CRUD

**Files:**
- Modify: `app/services/sugerencia_capacitacion_service.py`
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Consumes: `SugerenciaCapacitacion` (modelo), schemas Create/Update/Response, `Curso` (`levelup_cursos`), `NotFoundError` (`app/core/exceptions`).
- Produces: `listar`, `crear`, `actualizar`, `eliminar` en `SugerenciaCapacitacionService`.

- [ ] **Step 1: Escribir los tests de service que fallan**

Añade a `tests/test_sugerencias_capacitacion.py`:

```python
import pytest

from app.core.exceptions import NotFoundError
from app.schemas.level_up import (
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionUpdate,
)
from app.services.sugerencia_capacitacion_service import SugerenciaCapacitacionService


@pytest.mark.asyncio
async def test_crear_y_listar(db):
    svc = SugerenciaCapacitacionService(db)
    creada = await svc.crear(SugerenciaCapacitacionCreate(titulo="Curso A", prioridad=4))
    assert creada.id is not None
    assert creada.estado == "activa"
    todas = await svc.listar()
    assert any(s.id == creada.id for s in todas)


@pytest.mark.asyncio
async def test_listar_filtra_por_estado_y_prioridad(db):
    svc = SugerenciaCapacitacionService(db)
    await svc.crear(SugerenciaCapacitacionCreate(titulo="A", prioridad=5))
    b = await svc.crear(SugerenciaCapacitacionCreate(titulo="B", prioridad=2))
    await svc.actualizar(b.id, SugerenciaCapacitacionUpdate(estado="descartada"))
    activas = await svc.listar(estado="activa")
    assert all(s.estado == "activa" for s in activas)
    prio5 = await svc.listar(prioridad=5)
    assert all(s.prioridad == 5 for s in prio5)


@pytest.mark.asyncio
async def test_actualizar_cambia_estado(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="A"))
    upd = await svc.actualizar(s.id, SugerenciaCapacitacionUpdate(estado="aprobada"))
    assert upd.estado == "aprobada"


@pytest.mark.asyncio
async def test_crear_con_curso_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(SugerenciaCapacitacionCreate(titulo="A", curso_id=999999))


@pytest.mark.asyncio
async def test_eliminar(db):
    svc = SugerenciaCapacitacionService(db)
    s = await svc.crear(SugerenciaCapacitacionCreate(titulo="A"))
    await svc.eliminar(s.id)
    assert all(x.id != s.id for x in await svc.listar())


@pytest.mark.asyncio
async def test_actualizar_inexistente_404(db):
    svc = SugerenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.actualizar(999999, SugerenciaCapacitacionUpdate(estado="aprobada"))
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k "crear or listar or actualizar or eliminar" -v`
Expected: FAIL (métodos inexistentes).

- [ ] **Step 3: Implementar el CRUD**

En `app/services/sugerencia_capacitacion_service.py`, añade los imports y los métodos a la clase:

```python
from typing import Optional

from sqlalchemy import select

from app.core.exceptions import NotFoundError
from app.models.level_up import Curso, SugerenciaCapacitacion
from app.schemas.level_up import (
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
```

Métodos de la clase:

```python
    async def _to_response(
        self, s: SugerenciaCapacitacion
    ) -> SugerenciaCapacitacionResponse:
        data = SugerenciaCapacitacionResponse.model_validate(s)
        if s.curso_id is not None:
            curso = await self.db.get(Curso, s.curso_id)
            data.curso_nombre = curso.nombre if curso is not None else None
        return data

    async def _validar_curso(self, curso_id: Optional[int]) -> None:
        if curso_id is None:
            return
        curso = await self.db.get(Curso, curso_id)
        if curso is None:
            raise NotFoundError("Curso", curso_id)

    async def _get_o_404(self, sugerencia_id: int) -> SugerenciaCapacitacion:
        s = await self.db.get(SugerenciaCapacitacion, sugerencia_id)
        if s is None:
            raise NotFoundError("SugerenciaCapacitacion", sugerencia_id)
        return s

    async def listar(
        self, estado: Optional[str] = None, prioridad: Optional[int] = None
    ) -> list[SugerenciaCapacitacionResponse]:
        stmt = select(SugerenciaCapacitacion)
        if estado is not None:
            stmt = stmt.where(SugerenciaCapacitacion.estado == estado)
        if prioridad is not None:
            stmt = stmt.where(SugerenciaCapacitacion.prioridad == prioridad)
        stmt = stmt.order_by(
            SugerenciaCapacitacion.prioridad.desc(),
            SugerenciaCapacitacion.created_at.desc(),
        )
        filas = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(s) for s in filas]

    async def crear(
        self, data: SugerenciaCapacitacionCreate
    ) -> SugerenciaCapacitacionResponse:
        await self._validar_curso(data.curso_id)
        s = SugerenciaCapacitacion(**data.model_dump())
        self.db.add(s)
        await self.db.flush()
        await self.db.refresh(s)
        return await self._to_response(s)

    async def actualizar(
        self, sugerencia_id: int, data: SugerenciaCapacitacionUpdate
    ) -> SugerenciaCapacitacionResponse:
        s = await self._get_o_404(sugerencia_id)
        campos = data.model_dump(exclude_unset=True)
        if "curso_id" in campos:
            await self._validar_curso(campos["curso_id"])
        for k, v in campos.items():
            setattr(s, k, v)
        await self.db.flush()
        await self.db.refresh(s)
        return await self._to_response(s)

    async def eliminar(self, sugerencia_id: int) -> None:
        s = await self._get_o_404(sugerencia_id)
        await self.db.delete(s)
        await self.db.flush()
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k "crear or listar or actualizar or eliminar" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/sugerencia_capacitacion_service.py tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): CRUD de sugerencias de capacitacion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Generador `generar_desde_brechas`

**Files:**
- Modify: `app/services/sugerencia_capacitacion_service.py`
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Consumes: `CompetenciaService.obtener_brechas(area_id) -> BrechasResponse` (`app/services/competencia_service.py`); `BrechaItem` (`competencia_id`, `competencia_nombre`, `gap_porcentaje`, `empleados_afectados`); `prioridad_desde_brecha` (Task 2).
- Produces: `generar_desde_brechas(area_id, umbral_brecha, current_user_id=None) -> list[SugerenciaCapacitacionResponse]`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_sugerencias_capacitacion.py`. Mockea `CompetenciaService.obtener_brechas` para inyectar brechas deterministas (así el test no depende de datos de competencias montados):

```python
from unittest.mock import AsyncMock, patch

from app.schemas.talento import BrechaItem, BrechasResponse


def _brechas(*items):
    return BrechasResponse(
        area_id=1, area_nombre="Produccion",
        brechas=[
            BrechaItem(
                competencia_id=i + 1, competencia_nombre=n, categoria="tecnica",
                nivel_requerido_promedio=3.0, gap_porcentaje=g, empleados_afectados=e,
            )
            for i, (n, g, e) in enumerate(items)
        ],
    )


@pytest.mark.asyncio
async def test_generar_desde_brechas_crea_sobre_umbral(db):
    svc = SugerenciaCapacitacionService(db)
    fake = _brechas(("Soldadura", 60.0, 8), ("Calidad", 10.0, 2))
    with patch(
        "app.services.sugerencia_capacitacion_service.CompetenciaService.obtener_brechas",
        new=AsyncMock(return_value=fake),
    ):
        creadas = await svc.generar_desde_brechas(area_id=1, umbral_brecha=30)
    # Solo Soldadura (60 >= 30); Calidad (10 < 30) se ignora.
    assert len(creadas) == 1
    s = creadas[0]
    assert s.titulo == "Capacitacion: Soldadura"
    assert s.brecha_pct == 60.0
    assert s.personas_alcanzables == 8
    assert s.capacidades_afectadas == ["Soldadura"]
    assert s.areas_afectadas == ["Produccion"]
    assert s.prioridad == 5  # >50
    # No inventa datos manuales:
    assert s.duracion_sugerida is None
    assert s.inversion_estimada is None
    assert s.proveedor_sugerido is None
    assert s.adopcion_sector_pct is None
    assert s.curso_id is None
    assert s.estado == "activa"


@pytest.mark.asyncio
async def test_generar_desde_brechas_deduplica(db):
    svc = SugerenciaCapacitacionService(db)
    fake = _brechas(("Soldadura", 60.0, 8))
    with patch(
        "app.services.sugerencia_capacitacion_service.CompetenciaService.obtener_brechas",
        new=AsyncMock(return_value=fake),
    ):
        primera = await svc.generar_desde_brechas(area_id=1, umbral_brecha=0)
        segunda = await svc.generar_desde_brechas(area_id=1, umbral_brecha=0)
    assert len(primera) == 1
    assert len(segunda) == 0  # ya existe una activa con ese titulo
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k generar -v`
Expected: FAIL (método inexistente).

- [ ] **Step 3: Implementar el generador**

En `app/services/sugerencia_capacitacion_service.py`, añade el import y el método:

```python
from app.services.competencia_service import CompetenciaService
```

```python
    async def generar_desde_brechas(
        self, area_id: int, umbral_brecha: float, current_user_id: Optional[int] = None
    ) -> list[SugerenciaCapacitacionResponse]:
        """Crea sugerencias BORRADOR (estado 'activa') desde las brechas del area
        con gap_porcentaje >= umbral_brecha. Deduplica por titulo canonico contra
        las sugerencias ya 'activa'. No inventa datos manuales. Devuelve solo las
        creadas."""
        brechas_resp = await CompetenciaService(self.db).obtener_brechas(area_id)
        area_nombre = brechas_resp.area_nombre

        # Titulos ya activos, para deduplicar.
        activos_stmt = select(SugerenciaCapacitacion.titulo).where(
            SugerenciaCapacitacion.estado == "activa"
        )
        titulos_activos = set((await self.db.execute(activos_stmt)).scalars().all())

        creadas: list[SugerenciaCapacitacionResponse] = []
        for b in brechas_resp.brechas:
            if float(b.gap_porcentaje) < float(umbral_brecha):
                continue
            titulo = f"Capacitacion: {b.competencia_nombre}"
            if titulo in titulos_activos:
                continue
            justificacion = (
                f"Brecha de {b.gap_porcentaje}% en {area_nombre or 'el area'}: "
                f"{b.empleados_afectados} persona(s) por debajo del nivel requerido."
            )
            s = SugerenciaCapacitacion(
                titulo=titulo,
                justificacion=justificacion,
                brecha_pct=float(b.gap_porcentaje),
                capacidades_afectadas=[b.competencia_nombre],
                areas_afectadas=[area_nombre] if area_nombre else [],
                personas_alcanzables=b.empleados_afectados,
                prioridad=prioridad_desde_brecha(b.gap_porcentaje),
            )
            self.db.add(s)
            await self.db.flush()
            await self.db.refresh(s)
            titulos_activos.add(titulo)
            creadas.append(await self._to_response(s))
        return creadas
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k generar -v`
Expected: PASS

- [ ] **Step 5: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/sugerencia_capacitacion_service.py tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): generar borradores desde brechas de competencia

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Router + registro + openapi

**Files:**
- Create: `app/api/v1/sugerencias/__init__.py`, `app/api/v1/sugerencias/router.py`
- Modify: `app/main.py` (include_router), `app/core/rh_module_registry.py` (poblar `api_prefixes`), `openapi.yaml`
- Test: `tests/test_sugerencias_capacitacion.py`

**Interfaces:**
- Consumes: `SugerenciaCapacitacionService` (Tasks 3-4); schemas; `role_checker(["operativo"])` (`app/core/dependencies`).
- Produces: `GET/POST /api/v1/level-up/sugerencias`, `PUT/DELETE /api/v1/level-up/sugerencias/{id}`, `POST /api/v1/level-up/sugerencias/generar-desde-brechas`.

- [ ] **Step 1: Escribir los tests de API que fallan**

Añade a `tests/test_sugerencias_capacitacion.py`. Usa el patrón de auth de los tests de otros módulos RH-operativo (busca en `tests/` cómo montan un usuario RH con módulo y `auth_headers`; el módulo aquí es `sugerencias`). Reproduce ese andamiaje:

```python
@pytest.mark.asyncio
async def test_api_listar_rh_200(client, db, ...):
    resp = await client.get("/api/v1/level-up/sugerencias", headers=headers_rh)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_api_crear_rh_200(client, db, ...):
    resp = await client.post(
        "/api/v1/level-up/sugerencias",
        json={"titulo": "Curso X", "prioridad": 4},
        headers=headers_rh,
    )
    assert resp.status_code in (200, 201)
    assert resp.json()["titulo"] == "Curso X"


@pytest.mark.asyncio
async def test_api_sin_modulo_403(client, db, ...):
    resp = await client.get("/api/v1/level-up/sugerencias", headers=headers_sin_modulo)
    assert resp.status_code == 403
```

Completa los `...` reproduciendo el andamiaje real (fixtures `client`/`db`, creación de usuario con el módulo `sugerencias`, `auth_headers`) de un test de módulo RH-operativo existente (por ejemplo los tests de competencias o capacitaciones). Nombres y asserts concretos como arriba.

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k api -v`
Expected: FAIL (404, rutas inexistentes).

- [ ] **Step 3: Crear el router**

Crea `app/api/v1/sugerencias/__init__.py`:

```python
from app.api.v1.sugerencias.router import router

__all__ = ["router"]
```

Crea `app/api/v1/sugerencias/router.py`:

```python
"""Router del Motor de Sugerencias de Capacitacion (RH-gated, modulo 'sugerencias')."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    GenerarDesdeBrechasRequest,
    SugerenciaCapacitacionCreate,
    SugerenciaCapacitacionResponse,
    SugerenciaCapacitacionUpdate,
)
from app.services.sugerencia_capacitacion_service import SugerenciaCapacitacionService

router = APIRouter(
    prefix="/api/v1/level-up/sugerencias", tags=["Level Up - Sugerencias"]
)


def _svc(db: AsyncSession = Depends(get_db)) -> SugerenciaCapacitacionService:
    return SugerenciaCapacitacionService(db)


@router.get("", response_model=list[SugerenciaCapacitacionResponse])
async def listar(
    estado: Optional[str] = Query(None),
    prioridad: Optional[int] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.listar(estado=estado, prioridad=prioridad)


@router.post("", response_model=SugerenciaCapacitacionResponse, status_code=status.HTTP_201_CREATED)
async def crear(
    data: SugerenciaCapacitacionCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.crear(data)


@router.put("/{sugerencia_id}", response_model=SugerenciaCapacitacionResponse)
async def actualizar(
    sugerencia_id: int,
    data: SugerenciaCapacitacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.actualizar(sugerencia_id, data)


@router.delete("/{sugerencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    sugerencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    await svc.eliminar(sugerencia_id)


@router.post("/generar-desde-brechas", response_model=list[SugerenciaCapacitacionResponse])
async def generar_desde_brechas(
    data: GenerarDesdeBrechasRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: SugerenciaCapacitacionService = Depends(_svc),
):
    return await svc.generar_desde_brechas(
        data.area_id, data.umbral_brecha, current_user_id=current_user.empleado_id
    )
```

- [ ] **Step 4: Registrar el router + poblar `api_prefixes`**

En `app/main.py`, importa e incluye el router (junto a los otros `include_router`):

```python
from app.api.v1.sugerencias import router as sugerencias_router
...
app.include_router(sugerencias_router)
```

En `app/core/rh_module_registry.py`, en `RhModuleDef` `sugerencias` (L330-337), cambia `api_prefixes=()` por:

```python
        api_prefixes=("/api/v1/level-up/sugerencias",),
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -k api -v`
Expected: PASS

- [ ] **Step 6: Actualizar `openapi.yaml`**

Añade los 5 paths bajo `/api/v1/level-up/sugerencias` y los schemas `GenerarDesdeBrechasRequest` + los campos nuevos (`curso_id`, `curso_nombre`) de `SugerenciaCapacitacionCreate/Update/Response`. Sigue el estilo de los paths existentes de level-up.

- [ ] **Step 7: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/api/v1/sugerencias/ app/main.py app/core/rh_module_registry.py openapi.yaml tests/test_sugerencias_capacitacion.py
git commit -m "feat(sugerencias): router, registro de modulo y openapi

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — conectar la página maquetada

**Files:**
- Create: `frontend/src/api/sugerencias.ts`
- Modify: `frontend/src/pages/levelUp.ts` (`mountSugerencias`/`renderSugerenciasPage`/`renderSugCard`/`FAKE_SUGERENCIAS`)
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/v1/level-up/sugerencias`, `POST .../generar-desde-brechas` (Task 5).
- Produces: `listarSugerencias`, `crearSugerencia`, `actualizarSugerencia`, `eliminarSugerencia`, `generarSugerenciasDesdeBrechas`; la página consume datos reales.

- [ ] **Step 1: Leer patrones**

Lee `design.md` y `frontend/src/ui/uiTokens.ts`. En `frontend/src/pages/levelUp.ts`, localiza `FAKE_SUGERENCIAS` (~L3469), `mountSugerencias` (~L3702), `renderSugerenciasPage` (~L3678), `renderSugCard` (~L3598) y la interfaz `SugerenciaItem` (~L3449). Estudia un api client existente (`frontend/src/api/cursos.ts` o `competencias.ts`) para el mecanismo de fetch/error.

- [ ] **Step 2: Crear el api client**

Crea `frontend/src/api/sugerencias.ts` con tipos espejo de los schemas (`SugerenciaResponse` con `id`, `titulo`, `justificacion`, `brecha_pct`, `adopcion_sector_pct`, `capacidades_afectadas`, `areas_afectadas`, `personas_alcanzables`, `duracion_sugerida`, `inversion_estimada`, `proveedor_sugerido`, `prioridad`, `estado`, `curso_id`, `curso_nombre`, `created_at`, `updated_at`) y funciones `listarSugerencias({estado?, prioridad?})`, `crearSugerencia(payload)`, `actualizarSugerencia(id, payload)`, `eliminarSugerencia(id)`, `generarSugerenciasDesdeBrechas({area_id, umbral_brecha})`. Usa el mismo mecanismo de fetch/error del api client de referencia.

- [ ] **Step 3: Conectar la página**

En `frontend/src/pages/levelUp.ts`:
- Reemplaza el uso de `FAKE_SUGERENCIAS` por `listarSugerencias(...)` (mapea el shape del backend a lo que `renderSugCard` espera: `brecha_pct`→`brechaPct`, `capacidades_afectadas`→`capCubre`, `areas_afectadas`→`areas`, `personas_alcanzables`→`personas`, `justificacion`→`razon`, `duracion_sugerida`→`dur`, `inversion_estimada`→`costo`, `proveedor_sugerido`→`proveedor`, `adopcion_sector_pct`→`mercadoPct`).
- Acciones de tarjeta (aprobar/posponer/descartar) → `actualizarSugerencia(id, {estado})` y recarga.
- Botón "Generar desde brechas": selector de área + umbral → `generarSugerenciasDesdeBrechas(...)` → recarga.
- Estados cargando (`skeletonBlock`) / vacío / error (`errorState`). Reusa el `AbortController` por mount si la página lo tiene.
- Elimina `FAKE_SUGERENCIAS`/`DASH_SUGERENCIAS` si quedan sin uso (o déjalos solo si otra vista los usa — verifica con grep antes de borrar).

- [ ] **Step 4: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build`
Expected: limpio (sin errores TS nuevos).

Run: `docker-compose exec -T frontend npm run test`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/sugerencias.ts frontend/src/pages/levelUp.ts
git commit -m "feat(sugerencias): conectar la pagina de sugerencias al backend real

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Cierre de huecos de cobertura

**Files:**
- Modify: `tests/test_sugerencias_capacitacion.py`

- [ ] **Step 1: Añadir tests de huecos** (declara con el nombre del test existente si ya está cubierto)

1. **Generar respeta el umbral exacto**: brecha justo en el umbral (`gap == umbral`) SÍ se crea (`>=`); una por debajo no.
2. **Actualizar asigna curso_id válido**: crear un `Curso`, asignarlo vía `actualizar(id, {curso_id})`, y verificar que `curso_nombre` aparece en el Response.
3. **API generar-desde-brechas**: 200 con lista de creadas (mockeando `obtener_brechas` o con datos mínimos), 403 sin módulo.
4. **Listar orden**: prioridad desc como criterio principal.

- [ ] **Step 2: Correr la suite del módulo**

Run: `docker-compose run --rm test pytest tests/test_sugerencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 3: Correr la suite completa (sin regresiones)**

Run: `docker-compose run --rm test pytest -q`
Expected: sin fallos nuevos vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add tests/test_sugerencias_capacitacion.py
git commit -m "test(sugerencias): cerrar huecos de cobertura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest -q` verde sin regresiones.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual (tras `alembic upgrade head`): como RH abrir `#/sugerencias` → ver la lista real (vacía al inicio); crear una sugerencia; "Generar desde brechas" sobre un área con brechas → aparecen borradores; aprobar/posponer/descartar; asignar un curso a una sugerencia.
- Con esto se activa el primer placeholder de Aprendizaje (Sugerencias). Follow-ups posibles: OPLs, Evidencias+firmas (requieren infra de archivos).
