# Descansos y fecha de ingreso desde Bono — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar las dos últimas lecturas en vivo a `DATOS_ANALISIS` que ocurren en rutas que dispara un usuario (la fecha de ingreso de la Vista 360 y el cálculo de descansos), pasándolas a tablas `levelup_*` de Bono.

**Architecture:** La fecha de ingreso se cachea en una tabla nueva, `levelup_empleados_tress`, que llena un sync nocturno desde `dbo.COLABORA`. Los descansos se **proyectan en memoria** con el motor de rotación que ya existe (`app/utils/turno_calendario.py`, réplica validada de `dbo.FN_GeneraRitmo`) alimentado por las tres cachés que ya existen: `levelup_turnos_empleados` (turno vigente), `levelup_turnos` (catálogo con el patrón y el ancla) y `levelup_horarios` (jornadas). No se cachean el Kardex ni `dbo.AUSENCIA`; la proyección usa el turno vigente y falla cerrado cuando la caché no alcanza.

**Tech Stack:** FastAPI async, SQLAlchemy 2.0 async, Alembic, PostgreSQL (Bono), pytest + SQLite in-memory, APScheduler.

**Spec:** `docs/superpowers/specs/2026-08-11-descansos-y-fecha-ingreso-desde-bono-design.md`

## Global Constraints

- **Todo corre en Docker.** No hay Python ni Node local.
- **Tests: siempre `docker-compose run --rm test`.** Nunca `docker-compose exec backend pytest` — usa una imagen que puede llevar días sin reconstruirse y da fallos falsos.
- **Prefijo `levelup_` obligatorio** en cualquier tabla nueva. La migración de este plan solo puede hacer `create_table("levelup_empleados_tress")`.
- **`DATOS_ANALISIS` es de solo lectura aquí:** sin DDL, sin DELETE, sin TRUNCATE. La única consulta nueva es un `SELECT`.
- **Prohibido usar cola RPA** (`encolar_tress`, `levelup_tress_robot_queue`, robot GUI).
- **`down_revision` de la migración nueva = `"f1j2o3r4n5a6"`** (head actual, `f1j2o3r4n5a6_comedor_horario_por_jornada.py`). Verificar con `docker-compose exec backend alembic heads` antes de escribirla; si el head cambió, usar el real.
- **Todo CLI de sync es dry-run salvo `--execute`.**
- **Un sync aborta sin escribir si el origen devuelve 0 filas.** Cero filas es señal de consulta rota, no de planta vacía.
- **Respuestas al usuario en español.** Los mensajes de error son texto que lee RH.
- **`openapi.yaml` no se modifica.** Ningún contrato de endpoint cambia en este plan.
- **Commits: Conventional Commits, sin iniciales.** Rama actual: `feat/cm/descansos-fecha-ingreso-desde-bono`.

---

## File Structure

**Se crean:**

| archivo | responsabilidad |
| --- | --- |
| `app/models/empleados_tress.py` | Modelo `EmpleadoTress` de `levelup_empleados_tress` |
| `alembic/versions/g1e2m3p4t5r6_empleados_tress_cache.py` | `create_table("levelup_empleados_tress")` |
| `app/repositories/empleados_tress_repository.py` | Lectura de la caché: `get_fecha_ingreso` |
| `app/repositories/sql/datos_analisis_colabora_datos_generales.sql` | `SELECT CB_CODIGO, CB_FEC_ING FROM dbo.COLABORA` |
| `app/services/sync_empleados_tress_service.py` | El sync: lee TRESS, upsert en Bono, stats |
| `app/scripts/sync_empleados_tress.py` | CLI del sync |
| `app/repositories/turnos_repository.py` | Lectura del catálogo de turnos/jornadas y del turno de un empleado, para consumidores fuera de comedor |
| `tests/test_sync_empleados_tress.py` | Tests del sync |
| `tests/test_descansos_bono.py` | Tests de la proyección desde Bono (reemplaza a `tests/test_descansos_empleado.py`) |

**Se modifican:**

| archivo | cambio |
| --- | --- |
| `app/models/__init__.py` | Registrar `EmpleadoTress` |
| `app/repositories/datos_analisis_catalogos_read_repository.py` | Método `get_datos_generales_por_empleado()` |
| `app/services/usuario_service.py` | Vista 360 lee la fecha de ingreso de Bono |
| `app/main.py` | Job `sync_empleados_tress` a las 04:10 |
| `app/services/descansos_empleado_service.py` | `obtener_descansos_bono` sustituye a `obtener_descansos_tress` |
| `app/services/solicitud_service.py` | 3 llamadas (`:444`, `:471`, `:627`) |
| `app/services/faltas_retardos_service.py` | 3 llamadas (`:509`, `:533`, `:629`) |
| `app/api/v1/empleados/router.py:176` | Docstring del endpoint (ya no hay override de AUSENCIA) |
| `app/utils/turno_calendario.py` | Recibe `parse_hora_tress`; pierde `aplicar_override_ausencia` y `proyectar_calendario` |
| `app/services/comedor_ventana_comida_service.py` | Import de `parse_hora_tress` |
| `app/models/horarios.py` | Docstring: nueva ruta de `parse_hora_tress` |
| `tests/conftest.py` | Factory `make_empleado_tress` |
| `tests/test_vista360_fecha_ingreso.py` | Siembra la caché en vez de mockear ODBC |
| `tests/test_turno_calendario.py` | Quita los casos de `aplicar_override_ausencia` / `proyectar_calendario` |
| `tests/test_solicitud_descansos.py`, `tests/test_faltas_retardos_goce.py`, `tests/test_goce_turno_rotativo.py`, `tests/test_faltas_retardos_suspension_tress.py` | Punto de parcheo |
| `CLAUDE.md` | Documentar la caché nueva, el CLI y la regla de descansos |

**Se eliminan:**

| archivo | motivo |
| --- | --- |
| `app/repositories/datos_analisis_descansos_repository.py` | Sin consumidores tras la migración |
| `app/repositories/sql/datos_analisis_turnos_por_fecha.sql` | Kardex: ya no se consulta |
| `app/repositories/sql/datos_analisis_turno_por_codigo.sql` | El turno sale de `levelup_turnos` |
| `app/repositories/sql/datos_analisis_ausencias_estatus_rango.sql` | El override se descartó |
| `app/repositories/sql/datos_analisis_horario_por_codigo.sql` | La jornada sale de `levelup_horarios` |
| `app/repositories/datos_analisis_colaborador_repository.py` | Su único consumidor era la Vista 360 |
| `app/repositories/sql/datos_analisis_fecha_ingreso.sql` | El sync usa su propio SQL |
| `tests/test_descansos_empleado.py` | Reemplazado por `tests/test_descansos_bono.py` |

---

## Task 1: Tabla y modelo `levelup_empleados_tress`

**Files:**
- Create: `app/models/empleados_tress.py`
- Create: `alembic/versions/g1e2m3p4t5r6_empleados_tress_cache.py`
- Create: `app/repositories/empleados_tress_repository.py`
- Modify: `app/models/__init__.py`
- Modify: `tests/conftest.py`
- Test: `tests/test_sync_empleados_tress.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `app.models.empleados_tress.EmpleadoTress` con columnas `no_empleado: int` (PK), `fecha_ingreso: date | None`, `sincronizado_en: datetime`.
  - `app.repositories.empleados_tress_repository.EmpleadosTressRepository(db).get_fecha_ingreso(no_empleado: int) -> date | None`
  - `tests.conftest.make_empleado_tress(db, no_empleado: int, fecha_ingreso: date | None = None) -> EmpleadoTress`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_sync_empleados_tress.py`:

```python
"""Caché en Bono de los datos generales del colaborador en TRESS."""

from datetime import date

import pytest

from tests.conftest import make_empleado_tress


@pytest.mark.asyncio
async def test_repo_devuelve_fecha_ingreso_de_la_cache(db):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    await make_empleado_tress(db, no_empleado=553, fecha_ingreso=date(2019, 3, 15))

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(553) == date(2019, 3, 15)


@pytest.mark.asyncio
async def test_repo_sin_fila_devuelve_none(db):
    """Sin sincronizar no se inventa una fecha: la Vista 360 pinta vacío."""
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(999999) is None


@pytest.mark.asyncio
async def test_repo_tolera_fila_con_fecha_nula(db):
    """`CB_FEC_ING` puede venir vacío en TRESS; la fila existe pero sin fecha."""
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository

    await make_empleado_tress(db, no_empleado=554, fecha_ingreso=None)

    assert await EmpleadosTressRepository(db).get_fecha_ingreso(554) is None
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py -q`
Expected: FAIL — `ImportError` / `ModuleNotFoundError: app.repositories.empleados_tress_repository`.

- [ ] **Step 3: Crear el modelo**

`app/models/empleados_tress.py`:

```python
from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Date, DateTime, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class EmpleadoTress(Base):
    """Caché en Bono de los datos generales del colaborador que viven en TRESS.

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_empleados_tress_service`` a partir de ``dbo.COLABORA``
    (DATOS_ANALISIS). Existe para que la Vista 360 no abra una conexión ODBC en cada
    apertura del detalle de un empleado.

    Hoy solo guarda la fecha de ingreso (``CB_FEC_ING``), que Bono no tiene en ninguna
    parte: ``empleados`` es una tabla legada del esquema externo y no se le pueden agregar
    columnas.

    Dos decisiones deliberadas:

    - ``no_empleado`` es la llave primaria y es **Integer**, no ``String(50)`` como en
      :class:`app.models.turnos_empleados.TurnoEmpleado`. Aquella columna es texto por
      herencia de listados de Excel; aquí el único origen es ``dbo.COLABORA``, donde
      ``CB_CODIGO`` es numérico y hay a lo sumo una fila por colaborador.
    - **El sync nunca borra filas.** Se sincroniza toda ``dbo.COLABORA``, sin filtrar por
      ``CB_ACTIVO``: la Vista 360 se abre también sobre bajas, y una fecha de ingreso no
      deja de ser cierta cuando alguien se va.
    """

    __tablename__ = "levelup_empleados_tress"

    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    fecha_ingreso: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sincronizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="EmpleadoTress.no_empleado == Empleado.no_empleado",
        foreign_keys="EmpleadoTress.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"<EmpleadoTress no_empleado={self.no_empleado} "
            f"fecha_ingreso={self.fecha_ingreso}>"
        )
```

- [ ] **Step 4: Registrar el modelo**

En `app/models/__init__.py`, junto a las otras cachés (cerca de `from app.models.homeoffice_tomados import HomeOfficeTomados`):

```python
from app.models.empleados_tress import EmpleadoTress
```

Y agregar `"EmpleadoTress"` a `__all__` si el archivo lo declara.

- [ ] **Step 5: Crear el repositorio de lectura**

`app/repositories/empleados_tress_repository.py`:

```python
"""Acceso a la caché de datos generales del colaborador en Bono (`levelup_empleados_tress`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.empleados_tress import EmpleadoTress
from app.repositories.base import BaseRepository


class EmpleadosTressRepository(BaseRepository[EmpleadoTress]):
    def __init__(self, db: AsyncSession):
        super().__init__(EmpleadoTress, db)

    async def get_fecha_ingreso(self, no_empleado: int) -> date | None:
        """`CB_FEC_ING` cacheada. `None` si no hay fila o si TRESS no la tenía."""
        result = await self.db.execute(
            select(EmpleadoTress.fecha_ingreso).where(
                EmpleadoTress.no_empleado == int(no_empleado)
            )
        )
        return result.scalar_one_or_none()

    async def map_existentes(self) -> dict[int, EmpleadoTress]:
        """Todas las filas por `no_empleado`, para que el sync decida insert/update en memoria."""
        result = await self.db.execute(select(EmpleadoTress))
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}
```

- [ ] **Step 6: Agregar la factory de tests**

En `tests/conftest.py`, junto a `make_homeoffice_tomados`:

```python
async def make_empleado_tress(
    db: AsyncSession,
    no_empleado: int,
    fecha_ingreso: date | None = None,
):
    """Fila de `levelup_empleados_tress` (caché de datos generales de dbo.COLABORA)."""
    from app.models.empleados_tress import EmpleadoTress

    fila = EmpleadoTress(no_empleado=int(no_empleado), fecha_ingreso=fecha_ingreso)
    db.add(fila)
    await db.flush()
    await db.refresh(fila)
    return fila
```

- [ ] **Step 7: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py -q`
Expected: PASS (3 tests).

- [ ] **Step 8: Escribir la migración**

Primero confirmar el head: `docker-compose exec backend alembic heads` → debe imprimir `f1j2o3r4n5a6`.

`alembic/versions/g1e2m3p4t5r6_empleados_tress_cache.py`:

```python
"""levelup_empleados_tress — caché de los datos generales del colaborador en TRESS

Hoy solo la fecha de ingreso (`dbo.COLABORA.CB_FEC_ING`, DATOS_ANALISIS), que Bono no
tiene en ninguna parte: `empleados` es tabla legada del esquema externo. Elimina la
consulta ODBC en vivo que la Vista 360 hacía en cada apertura del detalle de un empleado.

La escribe el job de las 04:10 y el CLI `python -m app.scripts.sync_empleados_tress`.

Revision ID: g1e2m3p4t5r6
Revises: f1j2o3r4n5a6
Create Date: 2026-08-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "g1e2m3p4t5r6"
down_revision: Union[str, None] = "f1j2o3r4n5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_empleados_tress"):
        return

    op.create_table(
        "levelup_empleados_tress",
        # CB_CODIGO de TRESS = empleados.no_empleado en Bono. Es la llave: una fila por
        # colaborador, sin autoincrement que obligaría a una UNIQUE redundante.
        sa.Column("no_empleado", sa.Integer(), autoincrement=False, nullable=False),
        # CB_FEC_ING puede venir vacío en TRESS.
        sa.Column("fecha_ingreso", sa.Date(), nullable=True),
        sa.Column(
            "sincronizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("no_empleado"),
    )


def downgrade() -> None:
    if not table_exists("levelup_empleados_tress"):
        return
    op.drop_table("levelup_empleados_tress")
```

- [ ] **Step 9: Verificar que la migración sube y baja**

Run:
```bash
docker-compose exec backend alembic heads          # debe imprimir un solo head: g1e2m3p4t5r6
docker-compose exec backend alembic upgrade head
docker-compose exec backend alembic downgrade -1
docker-compose exec backend alembic upgrade head
```
Expected: sin error, y `alembic heads` con **un solo** head.

- [ ] **Step 10: Commit**

```bash
git add app/models/empleados_tress.py app/models/__init__.py \
        app/repositories/empleados_tress_repository.py \
        alembic/versions/g1e2m3p4t5r6_empleados_tress_cache.py \
        tests/conftest.py tests/test_sync_empleados_tress.py
git commit -m "feat(empleados): cachear datos generales de TRESS en levelup_empleados_tress"
```

---

## Task 2: Lectura de `dbo.COLABORA` para el sync

**Files:**
- Create: `app/repositories/sql/datos_analisis_colabora_datos_generales.sql`
- Modify: `app/repositories/datos_analisis_catalogos_read_repository.py`
- Test: `tests/test_sync_empleados_tress.py`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `app.repositories.datos_analisis_catalogos_read_repository.load_colabora_datos_generales_sql() -> str`
  - `DatosAnalisisCatalogosReadRepository(engine).get_datos_generales_por_empleado() -> dict[int, date | None]`

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_sync_empleados_tress.py`:

```python
from sqlalchemy import text


def test_sql_colabora_datos_generales_sin_binds_ni_ddl():
    """Sin parámetros (se lee toda COLABORA) y sin una sola sentencia de esquema.

    Los tokens `:algo` en comentarios también los toma SQLAlchemy como bind, así que el
    set de binds debe quedar vacío.
    """
    from app.repositories.datos_analisis_catalogos_read_repository import (
        load_colabora_datos_generales_sql,
    )

    sql = load_colabora_datos_generales_sql()

    assert set(text(sql)._bindparams) == set()
    assert "FROM dbo.COLABORA" in sql
    assert "CB_FEC_ING" in sql
    # No se filtra por CB_ACTIVO: la Vista 360 se abre también sobre bajas.
    assert "CB_ACTIVO" not in sql.upper()
    for prohibido in ("CREATE ", "ALTER ", "DROP ", "DELETE ", "TRUNCATE ", "INSERT ", "UPDATE "):
        assert prohibido not in sql.upper()
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py::test_sql_colabora_datos_generales_sin_binds_ni_ddl -q`
Expected: FAIL — `ImportError: cannot import name 'load_colabora_datos_generales_sql'`.

- [ ] **Step 3: Escribir el SQL**

`app/repositories/sql/datos_analisis_colabora_datos_generales.sql`:

```sql
-- Datos generales de cada colaborador de TRESS. SOLO LECTURA. Sin parametros.
--
-- Alimenta levelup_empleados_tress, de donde la Vista 360 lee la fecha de ingreso.
-- Ninguna carga de pagina pasa por aqui; solo el sync de la madrugada.
--
-- CB_CODIGO corresponde a empleados.no_empleado en Bono. CB_FEC_ING es datetime en TRESS
-- y el servicio lo normaliza a date.
--
-- A diferencia de datos_analisis_colabora_turnos.sql, aqui NO se filtra por CB_ACTIVO:
-- la Vista 360 se abre tambien sobre bajas, y la fecha de ingreso de quien se fue sigue
-- siendo cierta. Un turno de una baja no sirve para nada; su fecha de ingreso si.
--
-- Nota: no usar tokens con dos puntos en los comentarios; SQLAlchemy text() los toma
-- como parametros de enlace.
SELECT c.CB_CODIGO  AS no_empleado,
       c.CB_FEC_ING AS fecha_ingreso
FROM dbo.COLABORA c
WHERE c.CB_CODIGO IS NOT NULL;
```

- [ ] **Step 4: Agregar el loader y el método al repositorio**

En `app/repositories/datos_analisis_catalogos_read_repository.py`, junto a los otros tres:

```python
_SQL_COLABORA_DATOS_GENERALES_FILE = _SQL_DIR / "datos_analisis_colabora_datos_generales.sql"


def load_colabora_datos_generales_sql() -> str:
    return _SQL_COLABORA_DATOS_GENERALES_FILE.read_text(encoding="utf-8")
```

Y como método de `DatosAnalisisCatalogosReadRepository`:

```python
    async def get_datos_generales_por_empleado(self) -> dict[int, date | None]:
        """``{no_empleado: fecha_ingreso}`` de todo ``dbo.COLABORA``.

        La clave es ``int`` porque la columna destino lo es. ``CB_FEC_ING`` es ``datetime``
        en TRESS y se normaliza a ``date``; un valor ausente viaja como ``None``.
        """
        salida: dict[int, date | None] = {}
        for fila in await self._filas(load_colabora_datos_generales_sql()):
            crudo = fila.get("no_empleado")
            if crudo is None:
                continue
            try:
                no_empleado = int(crudo)
            except (TypeError, ValueError):
                continue
            valor = fila.get("fecha_ingreso")
            if isinstance(valor, datetime):
                valor = valor.date()
            salida[no_empleado] = valor if isinstance(valor, date) else None
        return salida
```

Y en los imports del módulo:

```python
from datetime import date, datetime
```

Actualizar la docstring de la clase: `"""Ejecuta los cuatro SELECT de catálogo (una consulta cada uno, sin parámetros)."""`

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py -q`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/repositories/sql/datos_analisis_colabora_datos_generales.sql \
        app/repositories/datos_analisis_catalogos_read_repository.py \
        tests/test_sync_empleados_tress.py
git commit -m "feat(empleados): leer CB_FEC_ING de dbo.COLABORA para la cache de Bono"
```

---

## Task 3: Servicio de sync, CLI y job de las 04:10

**Files:**
- Create: `app/services/sync_empleados_tress_service.py`
- Create: `app/scripts/sync_empleados_tress.py`
- Modify: `app/main.py`
- Modify: `CLAUDE.md`
- Test: `tests/test_sync_empleados_tress.py`

**Interfaces:**
- Consumes:
  - `app.models.empleados_tress.EmpleadoTress` (Task 1)
  - `EmpleadosTressRepository(db).map_existentes() -> dict[int, EmpleadoTress]` (Task 1)
  - `DatosAnalisisCatalogosReadRepository(engine).get_datos_generales_por_empleado() -> dict[int, date | None]` (Task 2)
- Produces:
  - `app.services.sync_empleados_tress_service.SyncEmpleadosTressStats` con campos `empleados_origen`, `insertados`, `actualizados`, `omitidos`, `sin_empleado_en_bono` (todos `int`, default 0)
  - `sincronizar_empleados_tress(db: AsyncSession, *, origen: str = "scheduler", execute: bool = True, solo_no_empleado: int | None = None) -> SyncEmpleadosTressStats`

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `tests/test_sync_empleados_tress.py`:

```python
@pytest.fixture
def fake_datos_generales(monkeypatch):
    """Sustituye la lectura a DATOS_ANALISIS por un dict, sin tocar SQL Server."""

    def _apply(por_empleado):
        class _FakeEngine:
            async def dispose(self):
                return None

        class _FakeRepo:
            def __init__(self, engine):
                self._engine = engine

            async def get_datos_generales_por_empleado(self):
                return dict(por_empleado)

        monkeypatch.setattr(
            "app.services.sync_empleados_tress_service.DatosAnalisisReadClient.create_read_engine",
            lambda: _FakeEngine(),
        )
        monkeypatch.setattr(
            "app.services.sync_empleados_tress_service.DatosAnalisisCatalogosReadRepository",
            _FakeRepo,
        )

    return _apply


@pytest.mark.asyncio
async def test_sync_inserta_y_actualiza_sin_borrar(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress
    from tests.conftest import make_empleado

    nuevo = await make_empleado(db, email="et-nuevo@test")
    existente = await make_empleado(db, email="et-existente@test")
    await make_empleado_tress(db, no_empleado=existente.no_empleado, fecha_ingreso=date(2010, 1, 1))
    # Fila cacheada de alguien que ya no viene de TRESS: NO se borra.
    await make_empleado_tress(db, no_empleado=777001, fecha_ingreso=date(2005, 5, 5))
    await db.commit()

    fake_datos_generales(
        {
            nuevo.no_empleado: date(2019, 3, 15),
            existente.no_empleado: date(2011, 2, 2),
        }
    )

    stats = await sincronizar_empleados_tress(db, origen="test", execute=True)

    repo = EmpleadosTressRepository(db)
    assert stats.insertados == 1
    assert stats.actualizados == 1
    assert await repo.get_fecha_ingreso(nuevo.no_empleado) == date(2019, 3, 15)
    assert await repo.get_fecha_ingreso(existente.no_empleado) == date(2011, 2, 2)
    # El que dejó de venir de TRESS conserva su fila y su fecha.
    assert await repo.get_fecha_ingreso(777001) == date(2005, 5, 5)


@pytest.mark.asyncio
async def test_sync_omite_numeros_que_bono_no_conoce(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    fake_datos_generales({888001: date(2020, 1, 1)})

    stats = await sincronizar_empleados_tress(db, origen="test", execute=True)

    assert stats.sin_empleado_en_bono == 1
    assert stats.insertados == 0
    assert await EmpleadosTressRepository(db).get_fecha_ingreso(888001) is None


@pytest.mark.asyncio
async def test_sync_aborta_si_tress_devuelve_cero_filas(db, fake_datos_generales):
    """Cero colaboradores es consulta rota, no planta vacía: no se escribe nada."""
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    fake_datos_generales({})

    with pytest.raises(ValueError, match="0 colaboradores"):
        await sincronizar_empleados_tress(db, origen="test", execute=True)


@pytest.mark.asyncio
async def test_sync_dry_run_no_persiste(db, fake_datos_generales):
    from app.repositories.empleados_tress_repository import EmpleadosTressRepository
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress
    from tests.conftest import make_empleado

    emp = await make_empleado(db, email="et-dry@test")
    await db.commit()
    fake_datos_generales({emp.no_empleado: date(2018, 6, 1)})

    stats = await sincronizar_empleados_tress(db, origen="test", execute=False)

    assert stats.insertados == 1
    assert await EmpleadosTressRepository(db).get_fecha_ingreso(emp.no_empleado) is None


@pytest.mark.asyncio
async def test_sync_sin_datos_analisis_configurada_levanta_connection_error(db, monkeypatch):
    from app.services.sync_empleados_tress_service import sincronizar_empleados_tress

    monkeypatch.setattr(
        "app.services.sync_empleados_tress_service.DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_empleados_tress(db, origen="test", execute=True)
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py -q`
Expected: FAIL — `ModuleNotFoundError: app.services.sync_empleados_tress_service`.

- [ ] **Step 3: Escribir el servicio de sync**

`app/services/sync_empleados_tress_service.py`:

```python
"""Sincroniza los datos generales del colaborador desde DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_empleados_tress.fecha_ingreso`, que es de donde la Vista 360 lee la fecha
de ingreso. Se dispara desde dos lugares, ambos contra esta misma función:

- el job diario de las 04:10 (`app/main.py`), en la misma ventana que los syncs de turnos,
- el CLI `python -m app.scripts.sync_empleados_tress`.

Antes de esto la Vista 360 abría un motor ODBC contra SQL Server en **cada** apertura del
detalle de un empleado, para un dato que no cambia nunca.

Tres reglas que conviene no revertir:

- **Se lee toda `dbo.COLABORA`, sin filtrar `CB_ACTIVO`.** La Vista 360 se abre también
  sobre bajas, y la fecha de ingreso de quien se fue sigue siendo cierta. Es la diferencia
  deliberada frente al sync de turnos, que sí filtra porque el turno de una baja no sirve
  para nada.
- **Nunca borra.** No hay reconciliación de bajas: si un `CB_CODIGO` deja de venir, su fila
  se queda. Borrarla destruiría el dato sin ganar nada.
- **Solo se crean filas para números que existan en `empleados`.** Sembrar filas huérfanas
  llenaría la caché de gente que Bono no conoce.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.empleados import Empleado
from app.models.empleados_tress import EmpleadoTress
from app.repositories.datos_analisis_catalogos_read_repository import (
    DatosAnalisisCatalogosReadRepository,
)
from app.repositories.empleados_tress_repository import EmpleadosTressRepository

logger = logging.getLogger(__name__)

# Evita que dos corridas se pisen (job diario + CLI).
_sync_lock = asyncio.Lock()


@dataclass
class SyncEmpleadosTressStats:
    """Resultado de una corrida, para logs y para el resumen del CLI."""

    empleados_origen: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    # Viene en COLABORA pero Bono no lo conoce: no se crea fila.
    sin_empleado_en_bono: int = 0


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


async def sincronizar_empleados_tress(
    db: AsyncSession,
    *,
    origen: str = "scheduler",
    execute: bool = True,
    solo_no_empleado: int | None = None,
) -> SyncEmpleadosTressStats:
    """Refresca los datos generales por empleado.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde, y
    `ValueError` si TRESS devuelve cero colaboradores. En ambos casos no se escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(
            db, origen=origen, execute=execute, solo_no_empleado=solo_no_empleado
        )


async def _leer_origen(*, origen: str) -> dict[int, date | None]:
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar los datos "
            "generales del colaborador."
        )
    try:
        return await DatosAnalisisCatalogosReadRepository(
            engine
        ).get_datos_generales_por_empleado()
    except SQLAlchemyError as exc:
        logger.error(
            "Sync datos generales | error de lectura en datos-analisis | origen=%s | %s: %s",
            origen,
            type(exc).__name__,
            exc,
        )
        raise ConnectionError(
            f"Error al leer dbo.COLABORA de datos-analisis: {type(exc).__name__}: {exc}"
        ) from exc
    finally:
        await engine.dispose()


async def _sincronizar(
    db: AsyncSession,
    *,
    origen: str,
    execute: bool,
    solo_no_empleado: int | None,
) -> SyncEmpleadosTressStats:
    stats = SyncEmpleadosTressStats()
    inicio = time.monotonic()
    logger.info(
        "Sync datos generales | inicio | origen=%s | execute=%s", origen, execute
    )

    por_empleado = await _leer_origen(origen=origen)
    stats.empleados_origen = len(por_empleado)

    # Freno de seguridad: dbo.COLABORA nunca está vacía en una planta en marcha. Cero
    # filas es señal de consulta rota, no de que no haya colaboradores.
    if not por_empleado:
        raise ValueError(
            "datos-analisis devolvió 0 colaboradores; no se escribe nada."
        )

    if solo_no_empleado is not None:
        clave = int(solo_no_empleado)
        por_empleado = {k: v for k, v in por_empleado.items() if k == clave}

    conocidos = {
        int(no)
        for (no,) in (
            await db.execute(
                select(Empleado.no_empleado).where(Empleado.no_empleado.isnot(None))
            )
        ).all()
        if no is not None
    }
    existentes = await EmpleadosTressRepository(db).map_existentes()

    try:
        for no_empleado, fecha_ingreso in por_empleado.items():
            fila = existentes.get(no_empleado)
            if fila is None:
                if no_empleado not in conocidos:
                    stats.sin_empleado_en_bono += 1
                    continue
                db.add(
                    EmpleadoTress(
                        no_empleado=no_empleado,
                        fecha_ingreso=fecha_ingreso,
                        sincronizado_en=_ahora(),
                    )
                )
                stats.insertados += 1
                continue

            cambio = fila.fecha_ingreso != fecha_ingreso
            fila.fecha_ingreso = fecha_ingreso
            fila.sincronizado_en = _ahora()
            if cambio:
                stats.actualizados += 1
            else:
                stats.omitidos += 1

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync datos generales | fin | origen=%s | origen_filas=%d | insertados=%d | "
        "actualizados=%d | omitidos=%d | sin_empleado_en_bono=%d | duracion=%.2fs",
        origen,
        stats.empleados_origen,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.sin_empleado_en_bono,
        time.monotonic() - inicio,
    )
    return stats
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sync_empleados_tress.py -q`
Expected: PASS (9 tests).

- [ ] **Step 5: Escribir el CLI**

`app/scripts/sync_empleados_tress.py`:

```python
"""
Sincroniza los datos generales del colaborador de datos-analisis (TRESS) hacia Bono
(`levelup_empleados_tress`).

Es la misma función que corre el job diario de las 04:10. Sirve para la carga inicial —sin
ella la Vista 360 muestra la fecha de ingreso vacía— y para forzar un refresco.

Uso:
    docker-compose exec backend python -m app.scripts.sync_empleados_tress
    docker-compose exec backend python -m app.scripts.sync_empleados_tress --execute
    docker-compose exec backend python -m app.scripts.sync_empleados_tress --no-empleado 553 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_empleados_tress_service import (
    SyncEmpleadosTressStats,
    sincronizar_empleados_tress,
)


def _print_stats(stats: SyncEmpleadosTressStats, *, execute: bool) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync datos generales del colaborador → Bono [{modo}] ===")
    print(f"Colaboradores en origen: {stats.empleados_origen}")
    print(f"Insertados:              {stats.insertados}")
    print(f"Actualizados:            {stats.actualizados}")
    print(f"Sin cambios:             {stats.omitidos}")
    print(f"Sin empleado en Bono:    {stats.sin_empleado_en_bono}")


async def ejecutar(*, execute: bool, no_empleado: int | None) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_empleados_tress(
                db, origen="manual", execute=execute, solo_no_empleado=no_empleado
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    _print_stats(stats, execute=execute)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza los datos generales del colaborador desde datos-analisis (TRESS) "
            "hacia levelup_empleados_tress."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    parser.add_argument(
        "--no-empleado",
        type=int,
        default=None,
        help="Sincronizar un solo número de empleado, para depurar.",
    )
    args = parser.parse_args(argv)
    return asyncio.run(ejecutar(execute=args.execute, no_empleado=args.no_empleado))


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Verificar que el CLI arranca en dry-run**

Run: `docker-compose exec backend python -m app.scripts.sync_empleados_tress`
Expected: o el resumen `[DRY-RUN]`, o `ERROR de conexión:` si el túnel a datos-analisis no está arriba. Cualquiera de los dos confirma el wiring; lo que no debe salir es un traceback.

- [ ] **Step 7: Registrar el job de las 04:10**

En `app/main.py`, junto a `_sync_turnos_empleados_job`:

```python
async def _sync_empleados_tress_job():
    """Refresca los datos generales del colaborador desde DATOS_ANALISIS (diario, 04:10).

    Alimenta la fecha de ingreso que muestra la Vista 360. Va en la misma ventana que los
    syncs de turnos; no hay dependencia entre ellos, solo se agrupan las lecturas a TRESS.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_empleados_tress_service import (
            sincronizar_empleados_tress,
        )

        async with AsyncSessionLocal() as db:
            stats = await sincronizar_empleados_tress(db, origen="scheduler")
        logger.info(
            "Sync datos generales job | origen=%d | insertados=%d | actualizados=%d "
            "| omitidos=%d | sin_empleado_en_bono=%d",
            stats.empleados_origen,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
            stats.sin_empleado_en_bono,
        )
    except Exception as exc:
        logger.error(
            "Error en sync de datos generales job: %s", str(exc), exc_info=True
        )
```

Y en `registrar_jobs_programados`, entre el de turnos en uso (04:00) y el de turno por empleado (04:20):

```python
    # Datos generales del colaborador: diario a las 04:10, en la misma ventana que los
    # syncs de turnos. Es la fuente de la fecha de ingreso de la Vista 360.
    sched.add_job(
        _sync_empleados_tress_job,
        "cron",
        hour=4,
        minute=10,
        id="sync_empleados_tress",
    )
```

- [ ] **Step 8: Verificar que el backend levanta y registra el job**

Run:
```bash
docker-compose up -d backend
docker-compose logs backend | grep -i "sync_empleados_tress\|Traceback"
```
Expected: sin `Traceback`. El backend arranca y el scheduler acepta el job.

- [ ] **Step 9: Documentar el CLI en `CLAUDE.md`**

En la sección `### Database / Migraciones`, después del bloque de «Turno por empleado»:

```markdown
# Datos generales del colaborador: dbo.COLABORA → levelup_empleados_tress (Bono).
# Mismo servicio que el job de las 04:10; necesario para la carga inicial (sin él, la
# Vista 360 muestra la fecha de ingreso vacía).
docker-compose exec backend python -m app.scripts.sync_empleados_tress            # dry-run
docker-compose exec backend python -m app.scripts.sync_empleados_tress --execute
docker-compose exec backend python -m app.scripts.sync_empleados_tress --no-empleado 553 --execute
```

En la lista de `### Key Patterns`, agregar el job a la enumeración de APScheduler: `**sync de datos generales del colaborador a las 04:10** (`sync_empleados_tress`)`.

- [ ] **Step 10: Commit**

```bash
git add app/services/sync_empleados_tress_service.py app/scripts/sync_empleados_tress.py \
        app/main.py CLAUDE.md tests/test_sync_empleados_tress.py
git commit -m "feat(empleados): sync diario de datos generales de TRESS a Bono"
```

---

## Task 4: Vista 360 lee la fecha de ingreso de Bono

**Files:**
- Modify: `app/services/usuario_service.py` (borra `_obtener_fecha_ingreso_datos_analisis`, líneas 64-95; cambia la llamada de `:620`)
- Delete: `app/repositories/datos_analisis_colaborador_repository.py`
- Delete: `app/repositories/sql/datos_analisis_fecha_ingreso.sql`
- Test: `tests/test_vista360_fecha_ingreso.py`

**Interfaces:**
- Consumes: `EmpleadosTressRepository(db).get_fecha_ingreso(no_empleado: int) -> date | None` (Task 1); `make_empleado_tress` (Task 1).
- Produces: nada nuevo. `UsuarioVista360Response.fecha_ingreso` mantiene su tipo `date | None`.

- [ ] **Step 1: Reescribir el test**

Reemplazar el contenido completo de `tests/test_vista360_fecha_ingreso.py`:

```python
"""Fecha de ingreso en Vista 360, leída de la caché en Bono (`levelup_empleados_tress`).

Antes se consultaba `dbo.COLABORA.CB_FEC_ING` en vivo por ODBC en cada apertura del
detalle. Ahora la escribe el sync de las 04:10 y aquí solo se siembra la fila.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_empleado_tress


@pytest.mark.asyncio
async def test_vista360_incluye_fecha_ingreso_de_la_cache(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="fi-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-emp@test")
    await make_empleado_tress(db, no_empleado=emp.no_empleado, fecha_ingreso=date(2019, 3, 15))
    await db.commit()
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] == "2019-03-15"


@pytest.mark.asyncio
async def test_vista360_fecha_ingreso_null_sin_fila_en_cache(client: AsyncClient, db):
    """Empleado no sincronizado: la Vista 360 sigue en 200 y el campo viaja como null.

    Es la misma degradación que había ante un fallo de la BD externa: este dato nunca
    debe romper el detalle.
    """
    rh = await make_empleado(db, rol="rh", email="fi-null-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-null-emp@test")
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] is None


@pytest.mark.asyncio
async def test_vista360_no_abre_conexion_a_datos_analisis(client: AsyncClient, db, monkeypatch):
    """Regresión del objetivo del cambio: la Vista 360 no debe tocar SQL Server.

    Si alguien reintroduce la lectura en vivo, `create_read_engine` explota y el test cae.
    """
    from app.integrations import datos_analisis_db

    def _prohibido(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("La Vista 360 no debe abrir un engine a datos-analisis")

    monkeypatch.setattr(
        datos_analisis_db.DatosAnalisisReadClient, "create_read_engine", _prohibido
    )

    rh = await make_empleado(db, rol="rh", email="fi-noodbc-rh@test")
    emp = await make_empleado(db, rol="empleado", email="fi-noodbc-emp@test")
    await make_empleado_tress(db, no_empleado=emp.no_empleado, fecha_ingreso=date(2021, 7, 1))
    await db.commit()
    headers = await auth_headers(client, rh)

    res = await client.get(f"/api/v1/empleados/{emp.id}/vista360", headers=headers)

    assert res.status_code == 200
    assert res.json()["fecha_ingreso"] == "2021-07-01"
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_vista360_fecha_ingreso.py -q`
Expected: FAIL — el primer test devuelve `fecha_ingreso: null` (la Vista 360 sigue leyendo de ODBC, que no está configurada en tests).

- [ ] **Step 3: Cambiar la fuente en `usuario_service.py`**

Borrar la función `_obtener_fecha_ingreso_datos_analisis` completa (líneas 64-95) y estos imports, que quedan sin uso:

```python
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.datos_analisis_colaborador_repository import (
    DatosAnalisisColaboradorRepository,
)
```

Agregar:

```python
from app.repositories.empleados_tress_repository import EmpleadosTressRepository
```

Y en `get_vista_360`, sustituir la línea 620:

```python
        fecha_ingreso = await _obtener_fecha_ingreso_datos_analisis(usuario.no_empleado)
```

por:

```python
        # Caché en Bono (`levelup_empleados_tress`, sync de las 04:10). Sin fila ⇒ None:
        # este dato nunca debe romper la Vista 360, y era la misma degradación que había
        # cuando se consultaba dbo.COLABORA en vivo.
        fecha_ingreso = await EmpleadosTressRepository(self.db).get_fecha_ingreso(
            usuario.no_empleado
        )
```

Verificar que `logger` siga usándose en el módulo; si la función borrada era su único consumidor, quitar también su definición y el import de `logging`.

- [ ] **Step 4: Borrar el repositorio ODBC del colaborador**

```bash
git rm app/repositories/datos_analisis_colaborador_repository.py \
       app/repositories/sql/datos_analisis_fecha_ingreso.sql
```

Confirmar que no queda ninguna referencia:

```bash
rg -n "DatosAnalisisColaboradorRepository|datos_analisis_fecha_ingreso" app/ tests/
```
Expected: sin resultados.

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_vista360_fecha_ingreso.py tests/test_sync_empleados_tress.py -q`
Expected: PASS (12 tests).

- [ ] **Step 6: Commit**

```bash
git add -A app/services/usuario_service.py app/repositories tests/test_vista360_fecha_ingreso.py
git commit -m "refactor(vista360): leer fecha de ingreso de Bono en vez de datos-analisis"
```

---

## Task 5: Proyección de descansos desde Bono

**Files:**
- Create: `app/repositories/turnos_repository.py`
- Create: `tests/test_descansos_bono.py`
- Modify: `app/services/descansos_empleado_service.py`

**Interfaces:**
- Consumes: nada de tareas anteriores. Usa lo que ya existe: `app.utils.turno_ciclo.turno_tress_desde_modelo`, `ancla_valida`; `app.utils.turno_calendario.proyectar_dia`, `expandir_patron_rotativo`, `normalizar_codigo`; `app.utils.turno_empleado_match.turno_no_empleado_matches`.
- Produces:
  - `app.repositories.turnos_repository.TurnosRepository(db)` con:
    - `get_tu_codigo_de_empleado(no_empleado: int) -> str | None`
    - `get_turno(tu_codigo: str) -> Turno | None`
    - `map_jornadas() -> dict[str, tuple[time | None, time | None, Decimal | None]]`
  - `app.services.descansos_empleado_service.obtener_descansos_bono(db: AsyncSession, *, cb_codigo: int, fecha_inicio: date, fecha_fin: date) -> list[date]`

**Nota de diseño:** `obtener_descansos_bono` llama a `proyectar_dia` por fecha en vez de a `proyectar_calendario`, porque esa función aplica el override de `dbo.AUSENCIA` que este diseño descartó. `proyectar_calendario` y `aplicar_override_ausencia` se eliminan en la Task 7, cuando su último consumidor (el repositorio ODBC) ya no exista.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_descansos_bono.py`:

```python
"""Descansos proyectados desde Bono, sin tocar DATOS_ANALISIS.

La cadena es `empleado → turno vigente (levelup_turnos_empleados) → catálogo
(levelup_turnos) → jornadas (levelup_horarios) → proyección del ciclo`. No se consulta el
Kardex ni `dbo.AUSENCIA`: la proyección usa el turno vigente y falla cerrado cuando la
caché no alcanza.
"""

from datetime import date, datetime

import pytest

from app.core.exceptions import ServiceUnavailableError
from tests.conftest import make_empleado, make_horario, make_turno, make_turno_empleado


async def _sembrar_turno_fijo(db, no_empleado: int, *, tu_codigo: str = "F1"):
    """Turno fijo de lunes a sábado; domingo descansa (TU_TIP_7 = 2)."""
    await make_horario(db, "010", "Diurno", intime="0800", outtime="1700")
    await make_turno(
        db,
        tu_codigo,
        "Fijo L-S",
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("010", "010", "010", "010", "010", "010", ""),
    )
    await make_turno_empleado(db, str(no_empleado), "Test", tu_codigo=tu_codigo)
    await db.commit()


@pytest.mark.asyncio
async def test_turno_fijo_descansa_los_domingos(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await _sembrar_turno_fijo(db, 4001)

    # 2026-07-01 es miércoles; los domingos del rango son 5, 12, 19 y 26 de julio.
    descansos = await obtener_descansos_bono(
        db, cb_codigo=4001, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 31)
    )

    assert descansos == [date(2026, 7, 5), date(2026, 7, 12), date(2026, 7, 19), date(2026, 7, 26)]


@pytest.mark.asyncio
async def test_turno_rotativo_usa_el_patron_y_el_ancla(db):
    """Ciclo de 4 días: 2 laborables + 2 de descanso, anclado el 2026-07-01."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R1",
        "Rotativo 2x2",
        rit_pat="2:011,2:000",
        rit_ini=datetime(2026, 7, 1),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4002", "Rotativo", tu_codigo="R1")
    await db.commit()

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4002, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 8)
    )

    # 1 y 2 laborables, 3 y 4 descanso, 5 y 6 laborables, 7 y 8 descanso.
    assert descansos == [date(2026, 7, 3), date(2026, 7, 4), date(2026, 7, 7), date(2026, 7, 8)]


@pytest.mark.asyncio
async def test_no_abre_conexion_a_datos_analisis(db, monkeypatch):
    """Regresión del objetivo del cambio: cero ODBC en el camino de descansos."""
    from app.integrations import datos_analisis_db
    from app.services.descansos_empleado_service import obtener_descansos_bono

    def _prohibido(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("Los descansos no deben abrir un engine a datos-analisis")

    monkeypatch.setattr(
        datos_analisis_db.DatosAnalisisReadClient, "create_read_engine", _prohibido
    )
    await _sembrar_turno_fijo(db, 4003, tu_codigo="F3")

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4003, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
    )

    assert descansos == [date(2026, 7, 5)]


@pytest.mark.asyncio
async def test_falla_cerrado_sin_fila_en_la_cache_de_turnos(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    with pytest.raises(ServiceUnavailableError, match="no se ha sincronizado"):
        await obtener_descansos_bono(
            db, cb_codigo=4004, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_con_tu_codigo_vacio(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno_empleado(db, "4005", "Sin turno", tu_codigo=None)
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no se ha sincronizado"):
        await obtener_descansos_bono(
            db, cb_codigo=4005, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_turno_no_esta_en_el_catalogo(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno_empleado(db, "4006", "Turno fantasma", tu_codigo="ZZ")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="catálogo"):
        await obtener_descansos_bono(
            db, cb_codigo=4006, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_rotativo_no_tiene_ancla(db):
    """`tu_rit_ini = 1899-12-30` es el «vacío» de TRESS: daría una posición creíble y falsa."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R2",
        "Rotativo sin ancla",
        rit_pat="2:011,2:000",
        rit_ini=datetime(1899, 12, 30),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4007", "Sin ancla", tu_codigo="R2")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="inicio de ciclo"):
        await obtener_descansos_bono(
            db, cb_codigo=4007, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_el_patron_no_se_interpreta(db):
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_turno(
        db,
        "R3",
        "Patrón inválido",
        rit_pat="esto-no-es-un-patron",
        rit_ini=datetime(2026, 7, 1),
    )
    await make_turno_empleado(db, "4008", "Patrón roto", tu_codigo="R3")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no interpreta"):
        await obtener_descansos_bono(
            db, cb_codigo=4008, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
        )


@pytest.mark.asyncio
async def test_falla_cerrado_si_la_fecha_es_anterior_al_ancla(db):
    """El motor no puede ubicar en el ciclo una fecha previa a `TU_RIT_INI`."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "011", "Nocturno", intime="1800", outtime="0600")
    await make_turno(
        db,
        "R4",
        "Rotativo reciente",
        rit_pat="2:011,2:000",
        rit_ini=datetime(2026, 7, 1),
        hors=("011", "", "", "", "", "", ""),
    )
    await make_turno_empleado(db, "4009", "Antes del ancla", tu_codigo="R4")
    await db.commit()

    with pytest.raises(ServiceUnavailableError, match="no se pudo calcular"):
        await obtener_descansos_bono(
            db, cb_codigo=4009, fecha_inicio=date(2026, 6, 1), fecha_fin=date(2026, 6, 7)
        )


@pytest.mark.asyncio
async def test_valida_el_rango_antes_de_tocar_la_bd(db):
    from app.core.exceptions import DomainValidationError
    from app.services.descansos_empleado_service import obtener_descansos_bono

    with pytest.raises(DomainValidationError, match="posterior"):
        await obtener_descansos_bono(
            db, cb_codigo=4010, fecha_inicio=date(2026, 7, 2), fecha_fin=date(2026, 7, 1)
        )

    with pytest.raises(DomainValidationError, match="366"):
        await obtener_descansos_bono(
            db, cb_codigo=4010, fecha_inicio=date(2025, 1, 1), fecha_fin=date(2026, 1, 2)
        )


@pytest.mark.asyncio
async def test_tolera_el_sufijo_punto_cero_del_seed_viejo(db):
    """El seed de Excel dejó números como "4011.0"; el turno debe encontrarse igual."""
    from app.services.descansos_empleado_service import obtener_descansos_bono

    await make_horario(db, "010", "Diurno", intime="0800", outtime="1700")
    await make_turno(
        db,
        "F4",
        "Fijo L-S",
        tips=(0, 0, 0, 0, 0, 0, 2),
        hors=("010", "010", "010", "010", "010", "010", ""),
    )
    await make_turno_empleado(db, "4011.0", "Sufijo viejo", tu_codigo="F4")
    await db.commit()

    descansos = await obtener_descansos_bono(
        db, cb_codigo=4011, fecha_inicio=date(2026, 7, 1), fecha_fin=date(2026, 7, 7)
    )

    assert descansos == [date(2026, 7, 5)]
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_descansos_bono.py -q`
Expected: FAIL — `ImportError: cannot import name 'obtener_descansos_bono'`.

- [ ] **Step 3: Crear el repositorio de turnos**

`app/repositories/turnos_repository.py`:

```python
"""Lectura del catálogo de turnos y jornadas replicado en Bono.

Es el acceso que necesitan los consumidores **fuera de comedor** (hoy, la proyección de
descansos). `ComedorHorarioJornadaRepository` conserva sus propios accesores porque
también gestiona la ventana de comida; unificarlos queda fuera del alcance de este cambio.

`tu_codigo` conserva el relleno de `CHAR(6)` en `levelup_turnos` (es una réplica 1:1 de
`dbo.TURNO`), así que se compara con `rtrim`. `ho_codigo` en `levelup_horarios` ya se
guarda normalizado y no lo necesita.
"""

from __future__ import annotations

from datetime import time
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.horarios import Horario
from app.models.turnos import Turno
from app.models.turnos_empleados import TurnoEmpleado
from app.utils.turno_calendario import parse_hora_tress
from app.utils.turno_empleado_match import turno_no_empleado_matches


class TurnosRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_tu_codigo_de_empleado(self, no_empleado: int) -> str | None:
        """Turno vigente de la persona, desde `levelup_turnos_empleados`.

        Es una foto: TRESS guarda el histórico de cambios en el kardex, no en COLABORA.
        """
        result = await self.db.execute(
            select(TurnoEmpleado.tu_codigo).where(turno_no_empleado_matches(no_empleado))
        )
        codigo = result.scalars().first()
        return (codigo or "").strip() or None

    async def get_turno(self, tu_codigo: str) -> Turno | None:
        stmt = select(Turno).where(func.rtrim(Turno.tu_codigo) == tu_codigo.strip())
        return (await self.db.execute(stmt)).scalars().first()

    async def map_jornadas(self) -> dict[str, tuple[time | None, time | None, Decimal | None]]:
        """`{ho_codigo: (entrada, salida, horas)}` en la forma que consume `proyectar_dia`."""
        result = await self.db.execute(select(Horario))
        return {
            (h.ho_codigo or "").strip(): (
                parse_hora_tress(h.ho_intime),
                parse_hora_tress(h.ho_outtime),
                h.ho_jornada,
            )
            for h in result.scalars().all()
        }
```

> `parse_hora_tress` todavía vive en `app/repositories/datos_analisis_descansos_repository.py`
> en este punto del plan. Importarlo desde `app.utils.turno_calendario` **fallará** hasta la
> Task 7. Para no dejar el árbol roto, en esta tarea el import es:
> `from app.repositories.datos_analisis_descansos_repository import parse_hora_tress`
> y la Task 7 lo cambia a `from app.utils.turno_calendario import parse_hora_tress`.

- [ ] **Step 4: Escribir `obtener_descansos_bono`**

En `app/services/descansos_empleado_service.py`, agregar (dejando `obtener_descansos_tress` en su sitio; se borra en la Task 7):

```python
_MSG_SIN_TURNO = (
    "El turno de este empleado aún no se ha sincronizado, así que no se pueden calcular "
    "sus descansos. Se actualiza automáticamente cada día; si persiste, contacta a RH."
)
_MSG_TURNO_SIN_CATALOGO = (
    "El turno {codigo} de este empleado no está en el catálogo sincronizado de nómina, "
    "así que no se pueden calcular sus descansos."
)
_MSG_SIN_ANCLA = (
    "Este turno es rotativo pero no tiene fecha de inicio de ciclo en nómina, así que no "
    "se puede saber qué días descansa."
)
_MSG_PATRON_INVALIDO = (
    "El patrón de rotación de este turno usa un formato que el sistema no interpreta; "
    "revísalo en nómina."
)
_MSG_PROYECCION_IMPOSIBLE = (
    "No se pudo calcular el calendario de este turno para el rango solicitado; revísalo "
    "en nómina."
)


async def obtener_descansos_bono(
    db: AsyncSession,
    *,
    cb_codigo: int,
    fecha_inicio: date,
    fecha_fin: date,
) -> list[date]:
    """Descansos proyectados desde Bono, sin consultar DATOS_ANALISIS.

    Cadena: `empleado → turno vigente → catálogo del turno → jornadas → proyección`. El
    motor de rotación (`app.utils.turno_calendario`) replica `dbo.FN_GeneraRitmo` y ya fue
    validado día a día contra lo que TRESS computó.

    **No se aplica el override de `dbo.AUSENCIA` ni se consulta el kardex**: se proyecta con
    el turno **vigente**. Para fechas anteriores a un cambio de turno la proyección puede
    diferir de lo que nómina aplicó; se acepta porque el uso real es hacia el futuro
    (pedir vacaciones, otorgar goce).

    **Falla cerrado** (`ServiceUnavailableError`) cuando la caché no alcanza para proyectar
    con confianza, en vez de devolver una lista vacía: de esta lista sale el conteo de días
    de una solicitud de vacaciones, y un falso «no descansa» contaría días de más.
    """
    validar_rango_descansos(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)

    repo = TurnosRepository(db)
    tu_codigo = await repo.get_tu_codigo_de_empleado(cb_codigo)
    if not tu_codigo:
        raise ServiceUnavailableError(_MSG_SIN_TURNO)

    modelo = await repo.get_turno(tu_codigo)
    if modelo is None:
        raise ServiceUnavailableError(_MSG_TURNO_SIN_CATALOGO.format(codigo=tu_codigo))

    turno = turno_tress_desde_modelo(modelo)
    if not ancla_valida(turno):
        raise ServiceUnavailableError(_MSG_SIN_ANCLA)

    if turno.es_rotativo:
        try:
            expandir_patron_rotativo(
                turno.rit_pat or "",
                horario1=turno.hors[0],
                horario2=turno.hors[1],
                horario3=turno.hors[2],
            )
        except ValueError as exc:
            raise ServiceUnavailableError(_MSG_PATRON_INVALIDO) from exc

    horarios = await repo.map_jornadas()
    descansos: list[date] = []
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        try:
            dia = proyectar_dia(turno, cursor, horarios=horarios)
        except ValueError as exc:
            # Fecha anterior a TU_RIT_INI, o rotativo sin ancla que `ancla_valida` no
            # atrapó. No se proyecta a medias: el rango completo se declara no calculable.
            raise ServiceUnavailableError(_MSG_PROYECCION_IMPOSIBLE) from exc
        if dia.estatus == "DESCANSO":
            descansos.append(cursor)
        cursor += timedelta(days=1)
    return descansos
```

Y en los imports del módulo:

```python
from datetime import date, timedelta

from app.repositories.turnos_repository import TurnosRepository
from app.utils.turno_calendario import expandir_patron_rotativo, proyectar_dia
from app.utils.turno_ciclo import ancla_valida, turno_tress_desde_modelo
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_descansos_bono.py -q`
Expected: PASS (11 tests).

Si `test_falla_cerrado_si_el_patron_no_se_interpreta` no pasa, comprobar qué hace
`expandir_patron_rotativo` con `"esto-no-es-un-patron"`: si no levanta `ValueError`, cambiar
el patrón del test por uno que sí lo haga (p. ej. `"9:"`), sin ampliar el regex de tokens —
descansos y goce dependen de esa misma expansión.

- [ ] **Step 6: Commit**

```bash
git add app/repositories/turnos_repository.py \
        app/services/descansos_empleado_service.py tests/test_descansos_bono.py
git commit -m "feat(descansos): proyectar descansos desde las caches de Bono"
```

---

## Task 6: Cablear los siete consumidores

**Files:**
- Modify: `app/services/descansos_empleado_service.py` (`DescansosEmpleadoService.obtener_descansos`)
- Modify: `app/services/solicitud_service.py:444`, `:471`, `:627`
- Modify: `app/services/faltas_retardos_service.py:509`, `:533`, `:629`
- Modify: `app/api/v1/empleados/router.py:176`
- Test: `tests/test_descansos_bono.py`, `tests/test_solicitud_descansos.py`, `tests/test_faltas_retardos_goce.py`, `tests/test_goce_turno_rotativo.py`, `tests/test_faltas_retardos_suspension_tress.py`
- Delete: `tests/test_descansos_empleado.py`

**Interfaces:**
- Consumes: `obtener_descansos_bono(db, *, cb_codigo, fecha_inicio, fecha_fin) -> list[date]` (Task 5).
- Produces: nada nuevo. `obtener_descansos_tress` queda sin consumidores.

- [ ] **Step 1: Escribir los tests del endpoint**

Añadir a `tests/test_descansos_bono.py`:

```python
@pytest.mark.asyncio
async def test_endpoint_descansos_resuelve_no_empleado_y_ordena(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-emp@test")
    await _sembrar_turno_fijo(db, emp.no_empleado, tu_codigo="F9")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-14"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 200
    assert res.json() == {
        "empleado_id": emp.id,
        "no_empleado": emp.no_empleado,
        "fecha_inicio": "2026-07-01",
        "fecha_fin": "2026-07-14",
        "descansos": ["2026-07-05", "2026-07-12"],
    }


@pytest.mark.asyncio
async def test_endpoint_descansos_sin_turno_en_cache_devuelve_503(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-503-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-503-emp@test")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 503
    assert "no se ha sincronizado" in res.json()["detail"]


@pytest.mark.asyncio
async def test_endpoint_descansos_requiere_rol_de_directorio(client, db):
    from tests.conftest import auth_headers

    solicitante = await make_empleado(db, rol="empleado", email="descansos-no-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-objetivo@test")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, solicitante),
    )

    assert res.status_code == 403


@pytest.mark.asyncio
async def test_endpoint_descansos_permite_supervisor(client, db):
    from tests.conftest import auth_headers

    supervisor = await make_empleado(db, rol="supervisor", email="descansos-sup@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-sup-obj@test")
    await _sembrar_turno_fijo(db, emp.no_empleado, tu_codigo="F8")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-07"},
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["descansos"] == ["2026-07-05"]


@pytest.mark.asyncio
async def test_endpoint_descansos_rechaza_rango_mayor_a_366_dias(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-rango-rh@test")
    emp = await make_empleado(db, rol="empleado", email="descansos-rango-emp@test")

    res = await client.get(
        f"/api/v1/empleados/{emp.id}/descansos",
        params={"fecha_inicio": "2025-01-01", "fecha_fin": "2026-01-02"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 422


@pytest.mark.asyncio
async def test_endpoint_descansos_empleado_inexistente_404(client, db):
    from tests.conftest import auth_headers

    rh = await make_empleado(db, rol="rh", email="descansos-404-rh@test")

    res = await client.get(
        "/api/v1/empleados/99999999/descansos",
        params={"fecha_inicio": "2026-07-01", "fecha_fin": "2026-07-31"},
        headers=await auth_headers(client, rh),
    )

    assert res.status_code == 404
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_descansos_bono.py -q`
Expected: FAIL — el endpoint sigue llamando a `obtener_descansos_tress` y devuelve 503 con «No se pudieron consultar los descansos.» donde se esperan 200.

- [ ] **Step 3: Cambiar el servicio del endpoint**

En `app/services/descansos_empleado_service.py`, `DescansosEmpleadoService`:

```python
class DescansosEmpleadoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    async def obtener_descansos(
        self,
        *,
        empleado_id: int,
        fecha_inicio: date,
        fecha_fin: date,
    ) -> DescansosEmpleadoResponse:
        validar_rango_descansos(fecha_inicio=fecha_inicio, fecha_fin=fecha_fin)
        empleado = await self.empleado_repo.get_by_empleado_id(empleado_id)
        if empleado is None:
            raise NotFoundError(entidad="Empleado", id=empleado_id)

        descansos = await obtener_descansos_bono(
            self.db,
            cb_codigo=empleado.no_empleado,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
        )
        return DescansosEmpleadoResponse(
            empleado_id=empleado_id,
            no_empleado=empleado.no_empleado,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            descansos=sorted(set(descansos)),
        )
```

- [ ] **Step 4: Cambiar las seis llamadas de los otros dos servicios**

En `app/services/solicitud_service.py`, las tres llamadas (`:444`, `:471`, `:627`) pasan de:

```python
await obtener_descansos_tress(
    cb_codigo=no_empleado,
```

a:

```python
await obtener_descansos_bono(
    self.db,
    cb_codigo=no_empleado,
```

(en `:627` el argumento es `cb_codigo=int(empleado.no_empleado)`; se conserva tal cual).

Cambiar el import:

```python
from app.services.descansos_empleado_service import obtener_descansos_bono
```

Repetir exactamente lo mismo en `app/services/faltas_retardos_service.py` para `:509`, `:533` y `:629`.

Los tres servicios ya tienen `self.db`: `solicitud_service.py:351`, `faltas_retardos_service.py:91`, y `DescansosEmpleadoService` lo gana en el Step 3.

- [ ] **Step 5: Ajustar los mensajes de dominio y el docstring del endpoint**

Los mensajes que dicen «descanso aplicado en TRESS» ya no describen lo que nómina aplicó,
sino lo que proyecta el turno. En `solicitud_service.py` y `faltas_retardos_service.py`,
sustituir:

```python
"La fecha inicial no puede ser un descanso aplicado en TRESS."
```

por:

```python
"La fecha inicial no puede ser un día de descanso."
```

En `app/api/v1/empleados/router.py:176`, el docstring:

```python
    """Descansos del empleado, proyectados desde el turno vigente (cachés de Bono). Mismos roles que faltas/directorio."""
```

Buscar cualquier test que asserte el texto viejo y actualizarlo:

```bash
rg -n "aplicado en TRESS" app/ tests/ frontend/src/
```

- [ ] **Step 6: Cambiar el punto de parcheo en los cuatro tests existentes**

En `tests/test_solicitud_descansos.py`, `tests/test_faltas_retardos_goce.py`,
`tests/test_faltas_retardos_suspension_tress.py` y `tests/test_goce_turno_rotativo.py`,
sustituir el nombre parcheado:

```python
monkeypatch.setattr(
    "app.services.solicitud_service.obtener_descansos_tress", fake
)
```

por

```python
monkeypatch.setattr(
    "app.services.solicitud_service.obtener_descansos_bono", fake
)
```

(análogamente `app.services.faltas_retardos_service.obtener_descansos_bono`).

**El doble ahora recibe la sesión como primer argumento posicional.** Cambiar su firma:

```python
async def fake(db, *, cb_codigo, fecha_inicio, fecha_fin):  # noqa: ANN001
    ...
```

Localizar todos los sitios con:

```bash
rg -n "obtener_descansos_tress" tests/
```

- [ ] **Step 7: Borrar el test viejo del endpoint**

`tests/test_descansos_bono.py` ya cubre lo que probaba `tests/test_descansos_empleado.py`,
excepto los tres tests que verifican los `.sql` de ODBC — que dejan de tener sentido porque
esos archivos desaparecen en la Task 7.

```bash
git rm tests/test_descansos_empleado.py
```

- [ ] **Step 8: Correr los tests afectados**

Run:
```bash
docker-compose run --rm test pytest tests/test_descansos_bono.py \
  tests/test_solicitud_descansos.py tests/test_faltas_retardos_goce.py \
  tests/test_faltas_retardos_suspension_tress.py tests/test_goce_turno_rotativo.py -q
```
Expected: PASS. Ningún test debe quedar en `SKIP` silencioso.

- [ ] **Step 9: Verificar que no quedan consumidores del camino ODBC**

Run: `rg -n "obtener_descansos_tress" app/ tests/`
Expected: solo la definición en `app/services/descansos_empleado_service.py`.

- [ ] **Step 10: Commit**

```bash
git add -A app/services app/api/v1/empleados/router.py tests
git commit -m "refactor(descansos): mover los siete consumidores a la proyeccion de Bono"
```

---

## Task 7: Retirar el camino ODBC de descansos

**Files:**
- Delete: `app/repositories/datos_analisis_descansos_repository.py`
- Delete: `app/repositories/sql/datos_analisis_turnos_por_fecha.sql`, `datos_analisis_turno_por_codigo.sql`, `datos_analisis_ausencias_estatus_rango.sql`, `datos_analisis_horario_por_codigo.sql`
- Modify: `app/utils/turno_calendario.py`
- Modify: `app/services/descansos_empleado_service.py`
- Modify: `app/services/comedor_ventana_comida_service.py:39`
- Modify: `app/repositories/turnos_repository.py`
- Modify: `app/models/horarios.py` (docstring)
- Test: `tests/test_turno_calendario.py`

**Interfaces:**
- Consumes: nada.
- Produces: `app.utils.turno_calendario.parse_hora_tress(value: str | None) -> time | None` (misma firma que tenía en el repositorio).

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/test_turno_calendario.py`:

```python
def test_parse_hora_tress_vive_en_turno_calendario():
    """Es parseo de formatos de TRESS, no acceso a datos: su casa es este módulo."""
    from datetime import time

    from app.utils.turno_calendario import parse_hora_tress

    assert parse_hora_tress("0600") == time(6, 0)
    assert parse_hora_tress("2200") == time(22, 0)
    assert parse_hora_tress("600") == time(6, 0)
    assert parse_hora_tress(None) is None
    assert parse_hora_tress("") is None
    assert parse_hora_tress("2560") is None
    assert parse_hora_tress("abcd") is None


def test_no_queda_camino_odbc_de_descansos():
    """Regresión del objetivo del cambio: el repositorio ODBC de descansos no debe volver."""
    import importlib

    import pytest as _pytest

    with _pytest.raises(ModuleNotFoundError):
        importlib.import_module("app.repositories.datos_analisis_descansos_repository")
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_turno_calendario.py -q`
Expected: FAIL — `ImportError` en el primero (`parse_hora_tress` no está en `turno_calendario`) y `Failed: DID NOT RAISE` en el segundo.

- [ ] **Step 3: Mover `parse_hora_tress` a `turno_calendario.py`**

En `app/utils/turno_calendario.py`, añadir junto a `normalizar_codigo`:

```python
def parse_hora_tress(value: str | None) -> time | None:
    """Hora de TRESS (`'0600'`, `'600'`) a `time`. `None` si no es interpretable.

    Una jornada puede cruzar medianoche (`'2200'` → `'0600'`), así que la salida **no** es
    necesariamente mayor que la entrada.
    """
    raw = (value or "").strip()
    if not raw or not raw.isdigit() or len(raw) not in (3, 4):
        return None
    padded = raw.zfill(4)
    hour = int(padded[:2])
    minute = int(padded[2:])
    if hour > 23 or minute > 59:
        return None
    return time(hour, minute)
```

- [ ] **Step 4: Eliminar `aplicar_override_ausencia` y `proyectar_calendario`**

Borrar de `app/utils/turno_calendario.py` las funciones `aplicar_override_ausencia`
(línea 234) y `proyectar_calendario` (línea 261). Quedaron sin consumidores: el override de
`dbo.AUSENCIA` se descartó por diseño y la proyección de un rango la hace ahora
`obtener_descansos_bono` llamando a `proyectar_dia` por fecha.

Quitar de `tests/test_turno_calendario.py` los imports y los casos que las usaban
(`test_proyectar_calendario_pares_de_descanso`, línea 171, y cualquier test de override).

- [ ] **Step 5: Actualizar los tres imports**

En `app/repositories/turnos_repository.py`:

```python
from app.utils.turno_calendario import parse_hora_tress
```

En `app/services/comedor_ventana_comida_service.py`, sustituir la línea 39:

```python
from app.repositories.datos_analisis_descansos_repository import parse_hora_tress
```

por:

```python
from app.utils.turno_calendario import parse_hora_tress
```

En `app/models/horarios.py`, la docstring dice
``se convierten con ``app.repositories.datos_analisis_descansos_repository.parse_hora_tress``.``
→ cambiar a ``app.utils.turno_calendario.parse_hora_tress``.

- [ ] **Step 6: Borrar el repositorio ODBC, sus SQL y `obtener_descansos_tress`**

```bash
git rm app/repositories/datos_analisis_descansos_repository.py \
       app/repositories/sql/datos_analisis_turnos_por_fecha.sql \
       app/repositories/sql/datos_analisis_turno_por_codigo.sql \
       app/repositories/sql/datos_analisis_ausencias_estatus_rango.sql \
       app/repositories/sql/datos_analisis_horario_por_codigo.sql
```

En `app/services/descansos_empleado_service.py`, borrar la función `obtener_descansos_tress`
completa y los imports que quedan sin uso:

```python
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.repositories.datos_analisis_descansos_repository import (
    DatosAnalisisDescansosRepository,
)
```

Actualizar la docstring del módulo: `"""Descansos por empleado, proyectados desde las cachés de Bono."""`

- [ ] **Step 7: Verificar que no quedan referencias**

Run:
```bash
rg -n "datos_analisis_descansos_repository|DatosAnalisisDescansosRepository|obtener_descansos_tress|aplicar_override_ausencia|proyectar_calendario" app/ tests/
```
Expected: sin resultados.

- [ ] **Step 8: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_turno_calendario.py tests/test_descansos_bono.py tests/test_comedor_ventana_comida.py -q`
Expected: PASS. (Si el archivo de tests de la ventana de comida tiene otro nombre, localizarlo con `rg -l "ventana_comida" tests/`.)

- [ ] **Step 9: Commit**

```bash
git add -A app tests
git commit -m "refactor(descansos): retirar el repositorio ODBC y el override de AUSENCIA"
```

---

## Task 8: Verificación final y documentación

**Files:**
- Modify: `CLAUDE.md`
- Test: toda la suite

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada de código.

- [ ] **Step 1: Documentar las dos reglas nuevas en `CLAUDE.md`**

En la sección `### TRESS / DATOS_ANALISIS (sin RPA)`, junto a las viñetas de las otras
cachés, agregar:

```markdown
- **Fecha de ingreso = caché en Bono.** La Vista 360 no consulta `dbo.COLABORA`: la fuente
  única de lectura es `levelup_empleados_tress`, que escribe `sync_empleados_tress_service`
  (job 04:10 y `python -m app.scripts.sync_empleados_tress`). El sync lee **toda**
  `dbo.COLABORA`, sin filtrar `CB_ACTIVO` —la Vista 360 se abre también sobre bajas— y
  **nunca borra**. Empleado sin fila ⇒ el campo viaja como `null`, igual que degradaba
  antes ante un fallo de la BD externa.
- **Descansos = proyección desde Bono, no lectura de TRESS.** Ninguna ruta que dispare un
  usuario consulta el kardex (`SP_KARDEX_CB_TURNO`) ni `dbo.AUSENCIA`.
  `obtener_descansos_bono` resuelve `empleado → turno vigente (levelup_turnos_empleados) →
  catálogo (levelup_turnos) → jornadas (levelup_horarios) → proyección` con el motor de
  `app/utils/turno_calendario.py`. Consecuencias que conviene no revertir:
  - **Se proyecta con el turno vigente.** Para fechas anteriores a un cambio de turno la
    proyección puede diferir de lo que nómina aplicó. Es una decisión, no un bug: el uso
    real es hacia el futuro (pedir vacaciones, otorgar goce).
  - **El override de `dbo.AUSENCIA` se descartó.** El motor ya fue validado día a día
    contra `AUSENCIA.HO_CODIGO`, así que la proyección coincide con lo que TRESS computó.
  - **Falla cerrado con 503**, nunca con lista vacía: de esa lista sale el conteo de días
    de una solicitud de vacaciones y un falso «no descansa» contaría días de más. Los cinco
    casos son sin fila en la caché de turnos, `tu_codigo` vacío, turno ausente del catálogo,
    rotativo sin ancla válida y patrón no interpretable.
  - **Los siete consumidores usan la misma función.** El endpoint y las seis validaciones de
    `solicitud_service` / `faltas_retardos_service` comparten fuente: si el modal contara
    con una y el servidor validara con otra, el usuario vería rechazada una solicitud por un
    cálculo que la UI nunca le mostró.
```

- [ ] **Step 2: Correr la suite completa**

Run: `docker-compose run --rm test`
Expected: PASS. Toma ~7 minutos. Comparar el conteo de fallos contra `main`: no debe haber
ninguno nuevo.

- [ ] **Step 3: Verificar que el frontend sigue compilando**

Run:
```bash
docker-compose exec frontend npm run build
docker-compose exec frontend npm run test
```
Expected: PASS. Ningún contrato de API cambió, así que no debería haber cambios de tipos;
si `npm run typecheck` reporta errores, **comparar el conteo contra `main`** — esa rama
arrastra decenas de errores preexistentes y el gate es «no agregar», no «cero».

- [ ] **Step 4: Verificar la cobertura de la caché de turnos — bloqueante**

Este es el paso que decide si el cambio se puede desplegar. Hoy `/descansos` funciona para
cualquier empleado porque va a TRESS en vivo; después depende de que
`levelup_turnos_empleados` tenga cobertura, y hay registro de que esa tabla llegó a tener
**una sola fila**.

```bash
docker-compose exec backend python -m app.scripts.sync_turnos_catalogo --execute
docker-compose exec backend python -m app.scripts.sync_turnos_empleados --execute
docker-compose exec backend python -m app.scripts.sync_empleados_tress --execute
```

Después, contar la cobertura contra los empleados activos de Bono:

```sql
-- Activos sin turno utilizable: si esto no es ~0, el modal de nueva solicitud dará 503.
SELECT count(*) AS activos,
       count(te.tu_codigo)                            AS con_tu_codigo,
       count(t.tu_codigo)                             AS con_turno_en_catalogo
FROM empleados e
LEFT JOIN levelup_turnos_empleados te
       ON te.no_empleado IN (e.no_empleado::text, e.no_empleado::text || '.0')
      AND te.activo
LEFT JOIN levelup_turnos t
       ON rtrim(t.tu_codigo) = te.tu_codigo
WHERE e.estado_id = 1;
```

**Criterio de salida:** `con_turno_en_catalogo` debe ser prácticamente igual a `activos`.
Si no lo es, **esto no se despliega**: primero se corrige el sync. Documentar el resultado
en el PR.

- [ ] **Step 5: Confirmar que solo los syncs tocan DATOS_ANALISIS**

Run:
```bash
rg -n "create_read_engine|create_write_engine" app/ | grep -v "^app/integrations/datos_analisis_db.py"
```
Expected: todas las apariciones de `DatosAnalisisReadClient` están en `app/services/sync_*_service.py`
(o `app/scripts/check_datos_analisis_connection.py`), y las de `DatosAnalisisWriteClient` en
`tress_goce_service.py`, `tress_suspension_service.py`, `tress_home_office_service.py` y
`tress_vacaciones_service.py`. **Ninguna en `usuario_service.py` ni en
`descansos_empleado_service.py`.**

- [ ] **Step 6: Commit y PR**

```bash
git add CLAUDE.md
git commit -m "docs: documentar las caches de datos generales y la proyeccion de descansos"
git push -u origin feat/cm/descansos-fecha-ingreso-desde-bono
```

Crear el PR describiendo: qué se movió a Bono, la decisión de proyectar con el turno vigente
(y su riesgo aceptado), y **el resultado de la consulta de cobertura del Step 4**.

---

## Self-Review

**Cobertura del spec:**

| sección del spec | tarea |
| --- | --- |
| §1 Tabla `levelup_empleados_tress` | Task 1 |
| §2 Sync `sync_empleados_tress` (SQL, servicio, CLI, job 04:10) | Tasks 2 y 3 |
| §3 Lectura de la fecha de ingreso + retiro del repo ODBC del colaborador | Task 4 |
| §4 `obtener_descansos_bono` y los cinco fail-closed | Task 5 |
| §5 Los siete llamadores cambian juntos | Task 6 |
| §6 Limpieza (`parse_hora_tress`, `aplicar_override_ausencia`, repo + 4 SQL) | Task 7 |
| §7 Migración | Task 1, steps 8-9 |
| §8 Tests | distribuidos; `test_turno_calendario` en Task 7, los 4 de parcheo en Task 6 |
| Riesgo de despliegue (cobertura de la caché) | Task 8, step 4 (bloqueante) |
| Fuera de alcance (`sincronizado_en` en la respuesta, resto de COLABORA, Kardex) | no implementado, correcto |
| Contrato de API sin cambios / `openapi.yaml` intacto | Global Constraints + Task 8 step 3 |

**Consistencia de tipos y nombres:**

- `no_empleado` es `int` en `EmpleadoTress`, `EmpleadosTressRepository.get_fecha_ingreso`,
  `get_datos_generales_por_empleado` y `make_empleado_tress`. Es `str` solo en
  `levelup_turnos_empleados`, donde ya lo era, y por eso la búsqueda de turno pasa por
  `turno_no_empleado_matches`.
- `obtener_descansos_bono` recibe `db` **posicional** y el resto por keyword, en las siete
  llamadas y en los dobles de test (Task 6, step 6, lo señala explícitamente).
- `map_jornadas` devuelve `dict[str, tuple[time | None, time | None, Decimal | None]]`, que
  es exactamente lo que `proyectar_dia(horarios=...)` consume. Nótese que la homónima de
  `ComedorHorarioJornadaRepository` devuelve `dict[str, Horario]`: son repositorios
  distintos y no se cruzan.
- `SyncEmpleadosTressStats` no tiene `bajas_marcadas`, a diferencia de
  `SyncTurnosEmpleadosStats`: este sync no borra ni marca bajas. El CLI y el log del job
  imprimen solo los cinco campos que existen.

**Orden de dependencias:** Task 5 importa `parse_hora_tress` desde el repositorio ODBC y la
Task 7 lo repunta a `turno_calendario`. Está señalado en el cuerpo de la Task 5 para que el
árbol quede verde después de cada tarea; ejecutar la 7 antes de la 5 rompería el import.
