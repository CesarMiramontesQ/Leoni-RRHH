# Caché de incidencias de TRESS en Bono — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la página Incidencias (módulo `faltas-retardos`) lea exclusivamente de una tabla caché en Bono, alimentada desde DATOS_ANALISIS por un sync semanal y una carga inicial.

**Architecture:** Tabla nueva `levelup_incidencias_tress` con llave de idempotencia `(origen, origen_id)`. Un servicio de sync lee TRESS con el SQL que la página ya usa, hace upsert, reconcilia bajas y refleja los eventos locales de `levelup_faltas_retardos`. Un job de APScheduler lo corre los miércoles a las 10:00. `FaltasRetardosService` cambia su repositorio de DATOS_ANALISIS por uno sobre la caché, sin tocar filtros, permisos ni endpoints.

**Tech Stack:** FastAPI async, SQLAlchemy 2 async, Alembic, APScheduler, pytest + pytest-asyncio (SQLite in-memory), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-06-cache-incidencias-tress-design.md`

## Global Constraints

- **DATOS_ANALISIS es solo lectura en todo este plan.** Usar únicamente `DatosAnalisisReadClient.create_read_engine()`. Nunca `create_write_engine()`, nunca INSERT/UPDATE/DELETE/DDL sobre TRESS.
- Toda tabla nueva lleva prefijo `levelup_`. Las migraciones solo pueden tocar tablas `levelup_*`.
- No modificar el SQL `app/repositories/sql/datos_analisis_faltas_retardos_base.sql`. Contiene las reglas de negocio vigentes.
- No cambiar endpoints, permisos, validaciones, `openapi.yaml`, el frontend, ni el comportamiento de los botones existentes.
- Zona horaria del proyecto: `settings.APP_TIMEZONE` = `America/Mexico_City`.
- Tests: `docker-compose run --rm test`. Un solo archivo: `docker-compose run --rm test pytest tests/test_x.py -v`.
- Commits: Conventional Commits, sin iniciales. Rama actual: `feat/cm/cache-incidencias-tress`.
- Los logs del sync llevan conteos e IDs numéricos. Nunca nombres, números de empleado en texto libre ni observaciones.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `app/models/incidencias_tress.py` (crear) | Modelo `IncidenciaTress` de `levelup_incidencias_tress` |
| `alembic/versions/y1i2n3c4t5r6_incidencias_tress_cache.py` (crear) | Migración de la tabla |
| `app/repositories/incidencias_tress_cache_repository.py` (crear) | Único acceso a la caché: métodos de sync (Tarea 2) y de lectura/agregados (Tarea 4) |
| `app/services/sync_incidencias_tress_service.py` (crear) | Orquesta la sincronización; único punto de entrada |
| `app/scripts/sync_incidencias_tress.py` (crear) | CLI de carga inicial y sync manual |
| `app/services/faltas_retardos/mapper_cache.py` (crear) | Fila de la caché → `FaltaRetardoResponse` |
| `app/repositories/datos_analisis_faltas_retardos_repository.py` (modificar) | Agregar `list_todos` (lectura por rango sin OFFSET) |
| `app/services/faltas_retardos_service.py` (modificar) | Cambia el repo de lectura; se elimina la mezcla en memoria |
| `app/main.py` (modificar) | Job del miércoles 10:00 |
| `app/core/config.py`, `.env.example` (modificar) | `SYNC_INCIDENCIAS_TRESS_SEMANAS` |
| `app/models/__init__.py` (modificar) | Registrar el modelo |
| `tests/conftest.py` (modificar) | Factory `make_incidencia_tress` |
| `tests/test_sync_incidencias_tress.py` (crear) | Sync: upsert, bajas, locales, idempotencia, semana en curso |
| `tests/test_incidencias_tress_job.py` (crear) | El job queda registrado con el cron correcto |
| `tests/test_faltas_retardos_datos_analisis.py` (modificar) | Reorientado a leer de la caché |
| `CLAUDE.md`, `docs/DEPLOY.md` (modificar) | Documentación |

---

### Task 1: Modelo y migración de `levelup_incidencias_tress`

**Files:**
- Create: `app/models/incidencias_tress.py`
- Create: `alembic/versions/y1i2n3c4t5r6_incidencias_tress_cache.py`
- Modify: `app/models/__init__.py`
- Test: `tests/test_incidencias_tress_model.py`

**Interfaces:**
- Consumes: nada.
- Produces: `IncidenciaTress` (modelo SQLAlchemy) con las columnas `id, origen, origen_id, no_empleado, empleado_id, tipo, fecha_evento, fecha_fin, observaciones, fecha_registro, registrado_por_id, synced_at, created_at` y `UNIQUE (origen, origen_id)` llamada `uq_levelup_incidencias_tress_origen`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_incidencias_tress_model.py`:

```python
"""levelup_incidencias_tress — caché en Bono de las incidencias que viven en TRESS."""

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.incidencias_tress import IncidenciaTress


@pytest.mark.asyncio
async def test_guarda_una_fila_de_ausencia(db):
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=1001,
            no_empleado=553,
            empleado_id=10,
            tipo="falta_injustificada",
            fecha_evento=date(2026, 7, 1),
        )
    )
    await db.flush()

    fila = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 1001)
        )
    ).scalar_one()
    assert fila.tipo == "falta_injustificada"
    assert fila.fecha_fin is None
    assert fila.empleado_id == 10


@pytest.mark.asyncio
async def test_empleado_id_puede_ser_nulo(db):
    """Hay CB_CODIGO en TRESS que no existen en Bono; la fila no se descarta."""
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=1002,
            no_empleado=999999,
            empleado_id=None,
            tipo="retardo",
            fecha_evento=date(2026, 7, 2),
        )
    )
    await db.flush()

    fila = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 1002)
        )
    ).scalar_one()
    assert fila.empleado_id is None


@pytest.mark.asyncio
async def test_origen_y_origen_id_son_unicos(db):
    """Es la llave que hace idempotente al sync."""
    for _ in range(2):
        db.add(
            IncidenciaTress(
                origen="permiso",
                origen_id=2001,
                no_empleado=553,
                tipo="matrimonio",
                fecha_evento=date(2026, 7, 3),
                fecha_fin=date(2026, 7, 4),
            )
        )
    with pytest.raises(IntegrityError):
        await db.flush()


@pytest.mark.asyncio
async def test_mismo_origen_id_en_distinto_origen_convive(db):
    """AUSENCIA.LLAVE y PERMISO.LLAVE son secuencias independientes."""
    db.add(
        IncidenciaTress(
            origen="ausencia",
            origen_id=3001,
            no_empleado=553,
            tipo="retardo",
            fecha_evento=date(2026, 7, 5),
        )
    )
    db.add(
        IncidenciaTress(
            origen="permiso",
            origen_id=3001,
            no_empleado=553,
            tipo="defuncion",
            fecha_evento=date(2026, 7, 5),
            fecha_fin=date(2026, 7, 7),
        )
    )
    await db.flush()

    filas = (
        await db.execute(
            select(IncidenciaTress).where(IncidenciaTress.origen_id == 3001)
        )
    ).scalars().all()
    assert len(filas) == 2
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_incidencias_tress_model.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.models.incidencias_tress'`

- [ ] **Step 3: Crear el modelo**

Crear `app/models/incidencias_tress.py`:

```python
from datetime import date, datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS

# Orígenes válidos. Los dos primeros son las ramas del SQL base de datos-analisis
# (dbo.AUSENCIA y dbo.PERMISO); `manual` son los eventos que solo viven en
# levelup_faltas_retardos y que el sync refleja aquí.
ORIGENES_CACHE = ("ausencia", "permiso", "manual")

_TIPOS_SQL = ", ".join(f"'{t}'" for t in FALTA_RETARDO_TIPOS)


class IncidenciaTress(Base):
    """Caché en Bono de las incidencias que viven en DATOS_ANALISIS (TRESS).

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_incidencias_tress_service`` a partir de ``dbo.AUSENCIA`` y
    ``dbo.PERMISO``, más el reflejo de ``levelup_faltas_retardos``. Existe para que la
    página Incidencias no tenga que esperar a esa BD externa en cada carga.

    Una fila por evento de origen. ``(origen, origen_id)`` es la llave de idempotencia:
    ``LLAVE`` de TRESS para ``ausencia``/``permiso``, ``levelup_faltas_retardos.id`` para
    ``manual``.
    """

    __tablename__ = "levelup_incidencias_tress"
    __table_args__ = (
        UniqueConstraint(
            "origen", "origen_id", name="uq_levelup_incidencias_tress_origen"
        ),
        CheckConstraint(f"tipo IN ({_TIPOS_SQL})", name="chk_levelup_incidencias_tress_tipo"),
        Index("ix_levelup_incidencias_tress_fecha_evento", "fecha_evento"),
        Index("ix_levelup_incidencias_tress_no_empleado", "no_empleado"),
        Index("ix_levelup_incidencias_tress_tipo", "tipo"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origen: Mapped[str] = mapped_column(String(16), nullable=False)
    origen_id: Mapped[int] = mapped_column(Integer, nullable=False)
    # CB_CODIGO en TRESS. Sin FK a empleados: patrón Bono, igual que
    # levelup_homeoffice_tomados.
    no_empleado: Mapped[int] = mapped_column(Integer, nullable=False)
    # NULL cuando el empleado existe en TRESS pero no en Bono. La respuesta lo expone
    # como 0 para que el total de la página cuadre con lo que se ve.
    empleado_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tipo: Mapped[str] = mapped_column(String(32), nullable=False)
    fecha_evento: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # PM_CAPTURA en TRESS; alimenta el created_at de la respuesta.
    fecha_registro: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    registrado_por_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<IncidenciaTress {self.origen}:{self.origen_id} tipo={self.tipo} "
            f"fecha={self.fecha_evento}>"
        )
```

Registrar el modelo en `app/models/__init__.py`, junto a la línea que ya importa `Incidencia`:

```python
from app.models.incidencias_tress import IncidenciaTress
```

Si el archivo tiene `__all__`, agregar `"IncidenciaTress"` a la lista.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_incidencias_tress_model.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir la migración**

Crear `alembic/versions/y1i2n3c4t5r6_incidencias_tress_cache.py`:

```python
"""levelup_incidencias_tress — caché en Bono de las incidencias de TRESS

Espeja a `levelup_homeoffice_tomados`: no es un dato editable, sino la caché de
`dbo.AUSENCIA` + `dbo.PERMISO` (DATOS_ANALISIS) que escribe el sync semanal. Una fila
por evento de origen, con `(origen, origen_id)` como llave de idempotencia.

Revision ID: y1i2n3c4t5r6
Revises: x1h2o3f4f5i6
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.utils.migration_helpers import table_exists

revision: str = "y1i2n3c4t5r6"
down_revision: Union[str, None] = "x1h2o3f4f5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TIPOS_SQL = ", ".join(f"'{t}'" for t in FALTA_RETARDO_TIPOS)


def upgrade() -> None:
    if table_exists("levelup_incidencias_tress"):
        return

    op.create_table(
        "levelup_incidencias_tress",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("origen", sa.String(16), nullable=False),
        sa.Column("origen_id", sa.Integer(), nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=True),
        sa.Column("tipo", sa.String(32), nullable=False),
        sa.Column("fecha_evento", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("fecha_registro", sa.Date(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=True),
        sa.Column(
            "synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # Garantía anti-duplicados del upsert.
        sa.UniqueConstraint(
            "origen", "origen_id", name="uq_levelup_incidencias_tress_origen"
        ),
        sa.CheckConstraint(
            f"tipo IN ({_TIPOS_SQL})", name="chk_levelup_incidencias_tress_tipo"
        ),
    )
    op.create_index(
        "ix_levelup_incidencias_tress_fecha_evento",
        "levelup_incidencias_tress",
        ["fecha_evento"],
    )
    op.create_index(
        "ix_levelup_incidencias_tress_no_empleado",
        "levelup_incidencias_tress",
        ["no_empleado"],
    )
    op.create_index(
        "ix_levelup_incidencias_tress_tipo", "levelup_incidencias_tress", ["tipo"]
    )


def downgrade() -> None:
    if not table_exists("levelup_incidencias_tress"):
        return
    op.drop_table("levelup_incidencias_tress")
```

- [ ] **Step 6: Verificar que la cadena de migraciones tiene un solo head**

Run: `docker-compose exec -e PYTHONPATH=/app -w /app backend alembic heads`
Expected: una sola línea, `y1i2n3c4t5r6 (head)`

Si aparecen dos heads, la nueva revisión tiene mal el `down_revision`: corregirlo a la revisión que `alembic heads` reportaba antes de este cambio.

- [ ] **Step 7: Commit**

```bash
git add app/models/incidencias_tress.py app/models/__init__.py \
        alembic/versions/y1i2n3c4t5r6_incidencias_tress_cache.py \
        tests/test_incidencias_tress_model.py
git commit -m "feat(incidencias): tabla levelup_incidencias_tress para la cache de TRESS"
```

---

### Task 2: Servicio de sincronización y CLI de carga inicial

**Files:**
- Create: `app/services/sync_incidencias_tress_service.py`
- Create: `app/scripts/sync_incidencias_tress.py`
- Create: `app/repositories/incidencias_tress_cache_repository.py`
- Modify: `app/repositories/datos_analisis_faltas_retardos_repository.py` (agregar `list_todos`)
- Test: `tests/test_sync_incidencias_tress.py`

**Interfaces:**
- Consumes: `IncidenciaTress` (Tarea 1); `DatosAnalisisFaltasRetardosRepository`; `EmpleadoRepository.map_por_no_empleados(no_empleados) -> dict[int, tuple[int, str | None]]`; `FaltasRetardosRepository.list_levelup_filtered(...) -> list[FaltaRetardoEvento]`.
- Produces:
  - `IncidenciasTressCacheRepository(db)` con `map_existentes(desde, hasta) -> dict[tuple[str, int], IncidenciaTress]` y `delete_llaves(llaves: set[tuple[str, int]]) -> int`.
  - `sincronizar_incidencias_tress(db, *, desde=None, hasta=None, origen="scheduler", execute=True) -> SyncIncidenciasTressStats`.
  - `rango_semanas(semanas: int, hoy: date | None = None) -> tuple[date, date]`.
  - `rango_carga_inicial(hoy: date | None = None) -> tuple[None, date]`.
  - `SyncIncidenciasTressStats` con `leidos, empleados, insertados, actualizados, omitidos, eliminados, errores, mensajes_error, duracion_segundos, desde, hasta`.
  - `DatosAnalisisFaltasRetardosRepository.list_todos(*, fecha_inicio, fecha_fin, cb_codigos=None, tipo=None) -> list[dict]`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_sync_incidencias_tress.py`:

```python
"""Sincronización de incidencias: datos-analisis → `levelup_incidencias_tress`.

datos-analisis no existe en el entorno de tests: se mockea el motor y la lectura por
rango (`list_todos`), pero la escritura en Bono es real, así que estos tests cubren el
upsert, la reconciliación de bajas, el reflejo de los eventos locales y la idempotencia
contra la BD.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models.faltas_retardos import FaltaRetardoEvento
from app.models.incidencias_tress import IncidenciaTress
from app.services.sync_incidencias_tress_service import (
    rango_carga_inicial,
    rango_semanas,
    sincronizar_incidencias_tress,
)
from tests.conftest import make_empleado

DESDE = date(2026, 6, 1)
HASTA = date(2026, 7, 31)


def _fila(
    *,
    origen="ausencia",
    origen_id=1,
    no_empleado=553,
    tipo="falta_injustificada",
    fecha_evento=date(2026, 7, 1),
    fecha_fin=None,
    observaciones=None,
    fecha_registro=None,
):
    """Fila tal como la emite el SQL base de datos-analisis."""
    return {
        "origen": origen,
        "origen_id": origen_id,
        "no_empleado": no_empleado,
        "tipo": tipo,
        "fecha_evento": fecha_evento,
        "fecha_fin": fecha_fin,
        "observaciones": observaciones,
        "fecha_registro": fecha_registro,
    }


def _mock_tress(monkeypatch, filas):
    """Motor y repositorio de datos-analisis simulados. Devuelve el repo."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )
    repo = AsyncMock()
    repo.list_todos = AsyncMock(return_value=list(filas))
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisFaltasRetardosRepository",
        lambda _engine: repo,
    )
    return repo


async def _filas_cache(db):
    result = await db.execute(
        select(IncidenciaTress).order_by(IncidenciaTress.origen, IncidenciaTress.origen_id)
    )
    return list(result.scalars().all())


@pytest.mark.asyncio
async def test_inserta_filas_nuevas(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")])

    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 2
    assert stats.insertados == 2
    assert stats.actualizados == 0
    assert stats.leidos == 2
    # El empleado se resuelve contra Bono.
    assert filas[0].empleado_id == 10


@pytest.mark.asyncio
async def test_empleado_ausente_en_bono_se_guarda_con_empleado_id_nulo(db, monkeypatch):
    _mock_tress(monkeypatch, [_fila(origen_id=1, no_empleado=999999)])

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].empleado_id is None
    assert filas[0].no_empleado == 999999


@pytest.mark.asyncio
async def test_actualiza_una_fila_corregida_en_tress(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1, tipo="falta_injustificada")])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    # Nómina reclasifica el día: misma LLAVE, otro tipo.
    _mock_tress(monkeypatch, [_fila(origen_id=1, tipo="falta_justificada")])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].tipo == "falta_justificada"
    assert stats.actualizados == 1
    assert stats.insertados == 0


@pytest.mark.asyncio
async def test_es_idempotente(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    filas_tress = [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")]
    _mock_tress(monkeypatch, filas_tress)

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)
    _mock_tress(monkeypatch, filas_tress)
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert len(await _filas_cache(db)) == 2
    assert stats.insertados == 0
    assert stats.actualizados == 0
    assert stats.omitidos == 2


@pytest.mark.asyncio
async def test_borra_lo_que_desaparecio_de_tress_en_el_rango(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1), _fila(origen_id=2, tipo="retardo")])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    # La falta 2 se canceló en nómina.
    _mock_tress(monkeypatch, [_fila(origen_id=1)])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert [f.origen_id for f in filas] == [1]
    assert stats.eliminados == 1


@pytest.mark.asyncio
async def test_no_borra_fuera_del_rango_sincronizado(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1, fecha_evento=date(2025, 1, 15))])
    await sincronizar_incidencias_tress(
        db, desde=date(2025, 1, 1), hasta=date(2025, 1, 31)
    )

    # Corrida de otro rango: la fila vieja no se toca.
    _mock_tress(monkeypatch, [])
    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert len(await _filas_cache(db)) == 1
    assert stats.eliminados == 0


@pytest.mark.asyncio
async def test_refleja_incapacidad_interna_que_solo_vive_en_levelup(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="incapacidad_interna",
            fecha_evento=date(2026, 7, 10),
            fecha_fin=date(2026, 7, 12),
            observaciones="reposo",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(monkeypatch, [])

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert len(filas) == 1
    assert filas[0].origen == "manual"
    assert filas[0].tipo == "incapacidad_interna"
    assert filas[0].registrado_por_id == 11
    assert filas[0].observaciones == "reposo"


@pytest.mark.asyncio
async def test_estampa_registrado_por_en_la_fila_de_tress_que_empata(db, monkeypatch):
    """Un permiso con goce registrado desde la app existe en TRESS y en levelup."""
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="matrimonio",
            fecha_evento=date(2026, 7, 20),
            fecha_fin=date(2026, 7, 21),
            observaciones="PERMISO MATRIMONIO",
            registrado_por_id=11,
        )
    )
    await db.flush()
    _mock_tress(
        monkeypatch,
        [
            _fila(
                origen="permiso",
                origen_id=77,
                tipo="matrimonio",
                fecha_evento=date(2026, 7, 20),
                fecha_fin=date(2026, 7, 21),
            )
        ],
    )

    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    # No se duplica: una sola fila, la de TRESS, con la atribución local encima.
    assert len(filas) == 1
    assert filas[0].origen == "permiso"
    assert filas[0].registrado_por_id == 11
    assert filas[0].observaciones == "PERMISO MATRIMONIO"


@pytest.mark.asyncio
async def test_elimina_el_manual_cuando_el_evento_ya_llego_a_tress(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto")
    db.add(
        FaltaRetardoEvento(
            empleado_id=10,
            tipo="defuncion",
            fecha_evento=date(2026, 7, 20),
            fecha_fin=date(2026, 7, 22),
            observaciones="DEFUNCION",
            registrado_por_id=11,
        )
    )
    await db.flush()

    # Primera corrida: TRESS aún no lo tiene → entra como manual.
    _mock_tress(monkeypatch, [])
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)
    assert [f.origen for f in await _filas_cache(db)] == ["manual"]

    # Segunda corrida: ya está en TRESS → el manual desaparece.
    _mock_tress(
        monkeypatch,
        [
            _fila(
                origen="permiso",
                origen_id=88,
                tipo="defuncion",
                fecha_evento=date(2026, 7, 20),
                fecha_fin=date(2026, 7, 22),
            )
        ],
    )
    await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    filas = await _filas_cache(db)
    assert [f.origen for f in filas] == ["permiso"]
    assert filas[0].registrado_por_id == 11


@pytest.mark.asyncio
async def test_dry_run_no_escribe(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    _mock_tress(monkeypatch, [_fila(origen_id=1)])

    stats = await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA, execute=False)

    assert stats.insertados == 1
    assert await _filas_cache(db) == []


@pytest.mark.asyncio
async def test_sin_configuracion_de_datos_analisis_no_escribe(db, monkeypatch):
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    monkeypatch.setattr(
        "app.services.sync_incidencias_tress_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_incidencias_tress(db, desde=DESDE, hasta=HASTA)

    assert await _filas_cache(db) == []


def test_rango_semanas_arranca_en_lunes():
    # 2026-08-06 es jueves; 8 semanas atrás arranca el lunes 2026-06-15.
    desde, hasta = rango_semanas(8, hoy=date(2026, 8, 6))
    assert desde == date(2026, 6, 15)
    assert desde.weekday() == 0
    assert hasta == date(2026, 8, 6)


def test_rango_carga_inicial_excluye_la_semana_en_curso():
    # Jueves 2026-08-06 → la semana en curso empieza el lunes 2026-08-03,
    # así que la carga inicial llega hasta el domingo 2026-08-02.
    desde, hasta = rango_carga_inicial(hoy=date(2026, 8, 6))
    assert desde is None
    assert hasta == date(2026, 8, 2)


def test_rango_carga_inicial_en_lunes_excluye_ese_lunes():
    desde, hasta = rango_carga_inicial(hoy=date(2026, 8, 3))
    assert desde is None
    assert hasta == date(2026, 8, 2)
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_sync_incidencias_tress.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.services.sync_incidencias_tress_service'`

- [ ] **Step 3: Agregar `list_todos` al repositorio de datos-analisis**

En `app/repositories/datos_analisis_faltas_retardos_repository.py`, después de `list_offset` (que termina alrededor de la línea 132), agregar:

```python
    async def list_todos(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[dict[str, Any]]:
        """Todas las filas del rango, sin OFFSET.

        El sync recorre la historia en tramos anuales: con OFFSET profundo SQL Server
        vuelve a recorrer todo lo anterior en cada página, y el barrido completo se
        vuelve cuadrático.
        """
        sql = f"SELECT * FROM ({self._filtrado()}) AS sub"
        params = self._params(
            fecha_inicio=fecha_inicio, fecha_fin=fecha_fin, cb_codigos=cb_codigos, tipo=tipo
        )
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), params)
            return [self._normalizar(dict(row)) for row in result.mappings().all()]
```

- [ ] **Step 4: Crear los métodos de sync del repositorio de caché**

Crear `app/repositories/incidencias_tress_cache_repository.py`:

```python
"""Acceso a `levelup_incidencias_tress`, la caché en Bono de las incidencias de TRESS.

Los métodos de escritura los usa el sync; los de lectura y agregado, la página
Incidencias. Ninguno toca datos-analisis.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.incidencias_tress import IncidenciaTress


class IncidenciasTressCacheRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sync ─────────────────────────────────────────────────────────────────

    async def map_existentes(
        self, desde: date | None, hasta: date | None
    ) -> dict[tuple[str, int], IncidenciaTress]:
        """Filas del rango indexadas por su llave de idempotencia."""
        stmt = select(IncidenciaTress)
        if desde is not None:
            stmt = stmt.where(IncidenciaTress.fecha_evento >= desde)
        if hasta is not None:
            stmt = stmt.where(IncidenciaTress.fecha_evento <= hasta)
        result = await self.db.execute(stmt)
        return {
            (fila.origen, fila.origen_id): fila for fila in result.scalars().all()
        }

    async def delete_llaves(self, llaves: set[tuple[str, int]]) -> int:
        """Borra por (origen, origen_id). Devuelve cuántas filas se fueron."""
        if not llaves:
            return 0
        borradas = 0
        for origen, origen_id in llaves:
            result = await self.db.execute(
                delete(IncidenciaTress).where(
                    IncidenciaTress.origen == origen,
                    IncidenciaTress.origen_id == origen_id,
                )
            )
            borradas += int(result.rowcount or 0)
        return borradas
```

- [ ] **Step 5: Crear el servicio de sincronización**

Crear `app/services/sync_incidencias_tress_service.py`:

```python
"""Sincroniza las incidencias de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_incidencias_tress`, la **única** fuente que consulta la página
Incidencias (módulo `faltas-retardos`). Se dispara desde dos lugares, ambos contra esta
misma función:

- el job semanal de los miércoles a las 10:00 (`app/main.py`),
- el CLI `python -m app.scripts.sync_incidencias_tress` (carga inicial y corridas
  manuales).

Lee TRESS con el mismo SQL que ya usaba la página
(`sql/datos_analisis_faltas_retardos_base.sql`), en tramos anuales, y **solo lee**: en
DATOS_ANALISIS no se escribe nada desde aquí.

Además refleja los eventos de `levelup_faltas_retardos` que TRESS no tiene
(`incapacidad_interna` siempre; permisos con goce viejos que nunca llegaron a nómina) y
estampa sobre las filas de TRESS la atribución local —quién registró y el motivo— que
TRESS no guarda.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.models.incidencias_tress import IncidenciaTress
from app.repositories.datos_analisis_faltas_retardos_repository import (
    DatosAnalisisFaltasRetardosRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.faltas_retardos_repository import FaltasRetardosRepository
from app.repositories.incidencias_tress_cache_repository import (
    IncidenciasTressCacheRepository,
)
from app.services.faltas_retardos.constants import ORIGEN_MANUAL

logger = logging.getLogger(__name__)

# Evita que se pisen el job semanal y el CLI. Mismo mecanismo que el sync de home office.
_sync_lock = asyncio.Lock()

# Sin `desde`, el barrido arranca aquí: el AU_FECHA más viejo de TRESS es de 1999.
_INICIO_HISTORIA = date(1990, 1, 1)


@dataclass
class SyncIncidenciasTressStats:
    """Resultado de una corrida, para los logs y el resumen del CLI."""

    desde: date | None = None
    hasta: date | None = None
    leidos: int = 0
    empleados: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    eliminados: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)
    duracion_segundos: float = 0.0

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


def _hoy_app() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def rango_semanas(semanas: int, hoy: date | None = None) -> tuple[date, date]:
    """Ventana móvil: del lunes de hace `semanas` semanas hasta hoy (inclusive)."""
    dia = hoy or _hoy_app()
    lunes_actual = dia - timedelta(days=dia.weekday())
    return lunes_actual - timedelta(weeks=max(1, int(semanas)) - 1), dia


def rango_carga_inicial(hoy: date | None = None) -> tuple[None, date]:
    """Todo el histórico hasta el domingo anterior: excluye la semana en curso."""
    dia = hoy or _hoy_app()
    lunes_actual = dia - timedelta(days=dia.weekday())
    return None, lunes_actual - timedelta(days=1)


def _tramos_anuales(desde: date | None, hasta: date | None) -> list[tuple[date, date]]:
    """Parte el rango en tramos de año calendario para no leer 27 años de una vez."""
    inicio = desde or _INICIO_HISTORIA
    fin = hasta or _hoy_app()
    if fin < inicio:
        return []
    tramos: list[tuple[date, date]] = []
    anio = inicio.year
    while anio <= fin.year:
        tramo_ini = max(inicio, date(anio, 1, 1))
        tramo_fin = min(fin, date(anio, 12, 31))
        tramos.append((tramo_ini, tramo_fin))
        anio += 1
    return tramos


async def _leer_tress(desde: date | None, hasta: date | None) -> list[dict[str, Any]]:
    """Lee todas las filas del rango. Solo lectura; levanta ConnectionError si falla."""
    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar las incidencias."
        )

    repo = DatosAnalisisFaltasRetardosRepository(engine)
    filas: list[dict[str, Any]] = []
    try:
        for tramo_ini, tramo_fin in _tramos_anuales(desde, hasta):
            filas.extend(
                await repo.list_todos(fecha_inicio=tramo_ini, fecha_fin=tramo_fin)
            )
    except SQLAlchemyError as exc:
        logger.error(
            "Sync incidencias | error de lectura en datos-analisis | %s",
            type(exc).__name__,
        )
        raise ConnectionError(
            f"Error al leer incidencias de datos-analisis: {type(exc).__name__}"
        ) from exc
    finally:
        await engine.dispose()
    return filas


def _clave_evento(fila: IncidenciaTress) -> tuple[int, date, str] | None:
    if fila.empleado_id is None:
        return None
    return (fila.empleado_id, fila.fecha_evento, fila.tipo)


async def sincronizar_incidencias_tress(
    db: AsyncSession,
    *,
    desde: date | None = None,
    hasta: date | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncIncidenciasTressStats:
    """Refresca la caché para el rango indicado (`fecha_evento`, ambos inclusive).

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde: en ese
    caso no se escribe nada.
    """
    async with _sync_lock:
        return await _sincronizar(
            db, desde=desde, hasta=hasta, origen=origen, execute=execute
        )


async def _sincronizar(
    db: AsyncSession,
    *,
    desde: date | None,
    hasta: date | None,
    origen: str,
    execute: bool,
) -> SyncIncidenciasTressStats:
    stats = SyncIncidenciasTressStats(desde=desde, hasta=hasta)
    inicio = time.monotonic()
    logger.info(
        "Sync incidencias | inicio | origen=%s | desde=%s | hasta=%s | execute=%s",
        origen,
        desde,
        hasta,
        execute,
    )

    filas_tress = await _leer_tress(desde, hasta)
    stats.leidos = len(filas_tress)

    nos = [f["no_empleado"] for f in filas_tress if f.get("no_empleado") is not None]
    empleados = await EmpleadoRepository(db).map_por_no_empleados(nos)
    stats.empleados = len({n for n in nos})

    cache_repo = IncidenciasTressCacheRepository(db)
    existentes = await cache_repo.map_existentes(desde, hasta)

    try:
        vistas: set[tuple[str, int]] = set()
        # (empleado_id, fecha_evento, tipo) -> fila de TRESS ya en la caché.
        por_clave: dict[tuple[int, date, str], IncidenciaTress] = {}

        for fila in filas_tress:
            aplicada = _aplicar_fila_tress(
                fila, existentes=existentes, empleados=empleados, db=db, stats=stats
            )
            if aplicada is None:
                continue
            vistas.add((aplicada.origen, aplicada.origen_id))
            clave = _clave_evento(aplicada)
            if clave is not None:
                por_clave.setdefault(clave, aplicada)

        # Bajas: lo que estaba en la caché dentro del rango y ya no viene de TRESS.
        obsoletas = {
            llave
            for llave, fila in existentes.items()
            if fila.origen != ORIGEN_MANUAL and llave not in vistas
        }

        manuales_obsoletos = await _reflejar_locales(
            db,
            desde=desde,
            hasta=hasta,
            existentes=existentes,
            por_clave=por_clave,
            stats=stats,
        )
        obsoletas |= manuales_obsoletos

        await db.flush()
        stats.eliminados = await cache_repo.delete_llaves(obsoletas)

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    stats.duracion_segundos = time.monotonic() - inicio
    logger.info(
        "Sync incidencias | fin | origen=%s | desde=%s | hasta=%s | leidos=%d | "
        "empleados=%d | insertados=%d | actualizados=%d | omitidos=%d | eliminados=%d | "
        "errores=%d | duracion=%.2fs",
        origen,
        desde,
        hasta,
        stats.leidos,
        stats.empleados,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        stats.eliminados,
        stats.errores,
        stats.duracion_segundos,
    )
    return stats


def _aplicar_fila_tress(
    fila: dict[str, Any],
    *,
    existentes: dict[tuple[str, int], IncidenciaTress],
    empleados: dict[int, tuple[int, str | None]],
    db: AsyncSession,
    stats: SyncIncidenciasTressStats,
) -> IncidenciaTress | None:
    """Inserta o actualiza una fila de TRESS. Devuelve la fila de caché resultante."""
    origen = str(fila.get("origen") or "").strip()
    origen_id = fila.get("origen_id")
    tipo = str(fila.get("tipo") or "").strip()
    fecha_evento = fila.get("fecha_evento")
    no_empleado = fila.get("no_empleado")

    if not origen or origen_id is None or fecha_evento is None or no_empleado is None:
        stats.registrar_error(f"fila incompleta: origen={origen!r} id={origen_id!r}")
        return None
    if tipo not in FALTA_RETARDO_TIPOS:
        stats.registrar_error(f"tipo no reconocido: {tipo!r} (origen_id={origen_id})")
        return None

    empleado_id = empleados.get(int(no_empleado), (None, None))[0]
    valores = {
        "no_empleado": int(no_empleado),
        "empleado_id": empleado_id,
        "tipo": tipo,
        "fecha_evento": fecha_evento,
        "fecha_fin": fila.get("fecha_fin"),
        "observaciones": fila.get("observaciones"),
        "fecha_registro": fila.get("fecha_registro"),
    }

    actual = existentes.get((origen, int(origen_id)))
    if actual is None:
        nueva = IncidenciaTress(
            origen=origen, origen_id=int(origen_id), synced_at=_ahora(), **valores
        )
        db.add(nueva)
        existentes[(origen, int(origen_id))] = nueva
        stats.insertados += 1
        return nueva

    cambio = any(getattr(actual, campo) != valor for campo, valor in valores.items())
    for campo, valor in valores.items():
        setattr(actual, campo, valor)
    # `synced_at` marca la última corrida que confirmó la fila, cambie o no, para poder
    # distinguir «sin movimiento» de «caché rancia».
    actual.synced_at = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1
    return actual


async def _reflejar_locales(
    db: AsyncSession,
    *,
    desde: date | None,
    hasta: date | None,
    existentes: dict[tuple[str, int], IncidenciaTress],
    por_clave: dict[tuple[int, date, str], IncidenciaTress],
    stats: SyncIncidenciasTressStats,
) -> set[tuple[str, int]]:
    """Refleja `levelup_faltas_retardos` en la caché.

    - Si el evento local empata con una fila de TRESS por (empleado, fecha, tipo), le
      estampa `registrado_por_id` y `observaciones`: es la atribución que TRESS no guarda.
    - Si no empata, entra como fila `manual` (siempre el caso de `incapacidad_interna`,
      que no existe en TRESS).

    Devuelve las llaves `manual` que dejaron de hacer falta porque el evento ya llegó a
    TRESS.
    """
    eventos = await FaltasRetardosRepository(db).list_levelup_filtered(
        fecha_inicio=desde, fecha_fin=hasta
    )
    obsoletos: set[tuple[str, int]] = set()

    for evento in eventos:
        clave = (evento.empleado_id, evento.fecha_evento, evento.tipo)
        gemela = por_clave.get(clave)
        if gemela is not None:
            gemela.registrado_por_id = evento.registrado_por_id
            if evento.observaciones is not None:
                gemela.observaciones = evento.observaciones
            if evento.fecha_fin is not None:
                gemela.fecha_fin = evento.fecha_fin
            # Si en una corrida previa entró como manual, ya sobra.
            if (ORIGEN_MANUAL, evento.id) in existentes:
                obsoletos.add((ORIGEN_MANUAL, evento.id))
            continue

        valores = {
            "no_empleado": _no_empleado_de(evento),
            "empleado_id": evento.empleado_id,
            "tipo": evento.tipo,
            "fecha_evento": evento.fecha_evento,
            "fecha_fin": evento.fecha_fin,
            "observaciones": evento.observaciones,
            "fecha_registro": None,
            "registrado_por_id": evento.registrado_por_id,
        }
        actual = existentes.get((ORIGEN_MANUAL, evento.id))
        if actual is None:
            nueva = IncidenciaTress(
                origen=ORIGEN_MANUAL,
                origen_id=evento.id,
                synced_at=_ahora(),
                **valores,
            )
            db.add(nueva)
            existentes[(ORIGEN_MANUAL, evento.id)] = nueva
            stats.insertados += 1
            continue

        cambio = any(getattr(actual, campo) != valor for campo, valor in valores.items())
        for campo, valor in valores.items():
            setattr(actual, campo, valor)
        actual.synced_at = _ahora()
        if cambio:
            stats.actualizados += 1
        else:
            stats.omitidos += 1

    return obsoletos


def _no_empleado_de(evento) -> int:
    """`no_empleado` del evento local; 0 si el empleado no trae número."""
    empleado = getattr(evento, "empleado", None)
    numero = getattr(empleado, "no_empleado", None) if empleado is not None else None
    try:
        return int(numero) if numero is not None else 0
    except (TypeError, ValueError):
        return 0
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_sync_incidencias_tress.py -v`
Expected: PASS (14 tests)

Si `test_refleja_incapacidad_interna_que_solo_vive_en_levelup` falla porque `evento.empleado` no viene cargado, revisar que `FaltasRetardosRepository._base_query()` traiga `selectinload(FaltaRetardoEvento.empleado)`; si no lo trae, leer el número con una consulta al `EmpleadoRepository` en vez de por relación (acceder a una relación no precargada en async revienta con `MissingGreenlet`).

- [ ] **Step 7: Commit del servicio**

```bash
git add app/services/sync_incidencias_tress_service.py \
        app/repositories/incidencias_tress_cache_repository.py \
        app/repositories/datos_analisis_faltas_retardos_repository.py \
        tests/test_sync_incidencias_tress.py
git commit -m "feat(incidencias): servicio de sync de incidencias TRESS hacia la cache en Bono"
```

- [ ] **Step 8: Crear el CLI de carga inicial**

Crear `app/scripts/sync_incidencias_tress.py`:

```python
"""
Sincroniza las incidencias de datos-analisis (TRESS) hacia Bono
(`levelup_incidencias_tress`).

Es el mismo servicio que corre el job semanal de los miércoles a las 10:00. Sirve para la
carga inicial —al desplegar, la tabla está vacía hasta la primera corrida— y para forzar
un refresco puntual.

Sin `--desde` ni `--hasta` hace la **carga inicial**: todo el histórico hasta el domingo
anterior, es decir excluyendo la semana en curso.

Uso:
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress --execute
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress \\
        --desde 2026-01-01 --hasta 2026-06-30 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date

from app.services.sync_incidencias_tress_service import (
    SyncIncidenciasTressStats,
    rango_carga_inicial,
    sincronizar_incidencias_tress,
)


def _fecha(valor: str) -> date:
    return date.fromisoformat(valor)


def _print_stats(stats: SyncIncidenciasTressStats, *, execute: bool) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync incidencias TRESS → Bono [{modo}] ===")
    print(f"Rango:        {stats.desde or 'inicio del histórico'} → {stats.hasta}")
    print(f"Leídos:       {stats.leidos}")
    print(f"Empleados:    {stats.empleados}")
    print(f"Insertados:   {stats.insertados}")
    print(f"Actualizados: {stats.actualizados}")
    print(f"Omitidos:     {stats.omitidos}")
    print(f"Eliminados:   {stats.eliminados}")
    print(f"Errores:      {stats.errores}")
    print(f"Duración:     {stats.duracion_segundos:.2f}s")
    for mensaje in stats.mensajes_error[:10]:
        print(f"  - {mensaje}")


async def ejecutar(
    *, desde: date | None, hasta: date | None, execute: bool
) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    if desde is None and hasta is None:
        desde, hasta = rango_carga_inicial()

    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_incidencias_tress(
                db, desde=desde, hasta=hasta, origen="manual", execute=execute
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1

    _print_stats(stats, execute=execute)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza las incidencias de TRESS hacia levelup_incidencias_tress (Bono). "
            "Sin --desde ni --hasta hace la carga inicial del histórico, excluyendo la "
            "semana en curso."
        )
    )
    parser.add_argument("--desde", type=_fecha, default=None, help="Fecha inicial (YYYY-MM-DD).")
    parser.add_argument("--hasta", type=_fecha, default=None, help="Fecha final (YYYY-MM-DD).")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(
        ejecutar(desde=args.desde, hasta=args.hasta, execute=args.execute)
    )


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 9: Verificar el CLI en dry-run**

Run: `docker-compose exec backend python -m app.scripts.sync_incidencias_tress --desde 2026-06-01 --hasta 2026-06-30`
Expected: imprime el resumen con `[DRY-RUN]` y conteos. Si datos-analisis no está accesible desde el entorno, imprime `ERROR de conexión` y devuelve 1 — eso también es correcto y no bloquea el avance; anotarlo y seguir.

- [ ] **Step 10: Commit**

```bash
git add app/scripts/sync_incidencias_tress.py
git commit -m "feat(incidencias): CLI de carga inicial y sync manual de incidencias TRESS"
```

---

### Task 3: Job semanal de los miércoles a las 10:00

**Files:**
- Modify: `app/core/config.py`
- Modify: `.env.example`
- Modify: `app/main.py`
- Test: `tests/test_incidencias_tress_job.py`

**Interfaces:**
- Consumes: `sincronizar_incidencias_tress`, `rango_semanas` (Tarea 2); `settings.APP_TIMEZONE`.
- Produces: `settings.SYNC_INCIDENCIAS_TRESS_SEMANAS: int = 8`; job de APScheduler con `id="sync_incidencias_tress"`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_incidencias_tress_job.py`:

```python
"""El sync de incidencias corre los miércoles a las 10:00 (America/Mexico_City)."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.main import registrar_jobs_programados


def _job_incidencias():
    sched = AsyncIOScheduler()
    registrar_jobs_programados(sched)
    return sched.get_job("sync_incidencias_tress")


def test_el_job_esta_registrado():
    assert _job_incidencias() is not None


def test_corre_los_miercoles_a_las_diez():
    campos = {f.name: str(f) for f in _job_incidencias().trigger.fields}
    assert campos["day_of_week"] == "wed"
    assert campos["hour"] == "10"
    assert campos["minute"] == "0"


def test_no_pisa_los_jobs_existentes():
    sched = AsyncIOScheduler()
    registrar_jobs_programados(sched)
    ids = {job.id for job in sched.get_jobs()}
    assert {
        "eval360_recordatorios",
        "encuestas_rh_recordatorios",
        "metas_recordatorios",
        "sync_vacaciones_disponibles",
        "sync_homeoffice_tomados",
        "sync_incidencias_tress",
    } <= ids
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_incidencias_tress_job.py -v`
Expected: FAIL — `assert None is not None` en `test_el_job_esta_registrado`

- [ ] **Step 3: Agregar el setting**

En `app/core/config.py`, junto a los demás ajustes de integración con TRESS (cerca de `DATOS_ANALISIS_DB_CONNECT_TIMEOUT`), agregar:

```python
    # Ventana del sync semanal de incidencias (miércoles 10:00): cuántas semanas hacia
    # atrás se releen para capturar capturas y correcciones retroactivas de nómina.
    SYNC_INCIDENCIAS_TRESS_SEMANAS: int = 8
```

En `.env.example`, después del bloque `DATOS_ANALISIS_DB_*`:

```
# Ventana (en semanas) que relee el sync de incidencias de los miercoles 10:00.
SYNC_INCIDENCIAS_TRESS_SEMANAS=8
```

- [ ] **Step 4: Registrar el job**

En `app/main.py`, después de `_sync_homeoffice_tomados_job` (que termina alrededor de la línea 152), agregar:

```python
async def _sync_incidencias_tress_job():
    """Refresca la caché de incidencias desde DATOS_ANALISIS (semanal, miércoles 10:00).

    Relee una ventana móvil de semanas en vez de solo la anterior: nómina captura y
    corrige de forma retroactiva. Nunca propaga la excepción — un fallo de TRESS no debe
    tumbar el scheduler, y la caché queda como estaba.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_incidencias_tress_service import (
            rango_semanas,
            sincronizar_incidencias_tress,
        )

        desde, hasta = rango_semanas(settings.SYNC_INCIDENCIAS_TRESS_SEMANAS)
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_incidencias_tress(
                db, desde=desde, hasta=hasta, origen="scheduler"
            )
        logger.info(
            "Sync incidencias job | desde=%s | hasta=%s | leidos=%d | insertados=%d | "
            "actualizados=%d | omitidos=%d | eliminados=%d | errores=%d",
            desde,
            hasta,
            stats.leidos,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
            stats.eliminados,
            stats.errores,
        )
    except Exception as e:  # noqa: BLE001 — el scheduler no debe caerse por esto
        logger.error(
            "Error en job de sync de incidencias: %s: %s", type(e).__name__, str(e)
        )
```

Y dentro de `registrar_jobs_programados`, después del job de home office:

```python
    # Caché de incidencias de TRESS: semanal, miércoles a las 10:00.
    sched.add_job(
        _sync_incidencias_tress_job,
        "cron",
        day_of_week="wed",
        hour=10,
        minute=0,
        id="sync_incidencias_tress",
    )
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_incidencias_tress_job.py -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Verificar el arranque real**

Run: `docker-compose restart backend && sleep 5 && docker-compose logs --tail=30 backend | grep APScheduler`
Expected: `APScheduler iniciado con 6 jobs`

- [ ] **Step 7: Commit**

```bash
git add app/main.py app/core/config.py .env.example tests/test_incidencias_tress_job.py
git commit -m "feat(incidencias): job semanal de sync de incidencias los miercoles a las 10:00"
```

---

### Task 4: La página lee de la caché

**Files:**
- Modify: `app/repositories/incidencias_tress_cache_repository.py` (métodos de lectura)
- Create: `app/services/faltas_retardos/mapper_cache.py`
- Modify: `app/services/faltas_retardos_service.py`
- Modify: `tests/conftest.py` (factory `make_incidencia_tress`)
- Test: `tests/test_faltas_retardos_datos_analisis.py` (reorientado)

**Interfaces:**
- Consumes: `IncidenciaTress` (Tarea 1); `IncidenciasTressCacheRepository` (Tarea 2); `synthetic_falta_retardo_id(origen, origen_id)` de `app/services/faltas_retardos/constants.py`; `FaltaRetardoResponse`.
- Produces:
  - En `IncidenciasTressCacheRepository`: `count(*, fecha_inicio, fecha_fin, cb_codigos, tipo) -> int`; `list_offset(offset, limit, *, fecha_inicio, fecha_fin, cb_codigos, tipo) -> list[dict]`; `aggregate_por_tipo(...) -> dict[str, int]`; `aggregate_por_periodo_y_tipo(*, agrupacion, ...) -> list[tuple[str, str, int]]`; `aggregate_por_mes(...) -> list[tuple[str, int]]`; `aggregate_empleados_top(*, limit=10, ...) -> list[tuple[int, int, dict[str, int]]]`. Mismas firmas que `DatosAnalisisFaltasRetardosRepository`.
  - `map_cache_row(row: dict) -> FaltaRetardoResponse | None` en `mapper_cache.py`.
  - `make_incidencia_tress(db, *, origen, origen_id, no_empleado, tipo, fecha_evento, ...)` en `conftest`.

- [ ] **Step 1: Escribir los tests que fallan**

Reemplazar el contenido de `tests/test_faltas_retardos_datos_analisis.py` por:

```python
"""Listado de incidencias leído desde la caché en Bono (`levelup_incidencias_tress`).

La tabla de la página "Incidencias" (módulo `faltas-retardos`) ya no consulta
datos-analisis: lee la caché que escribe `sync_incidencias_tress_service`. Aquí la caché
y los empleados son reales (SQLite) y datos-analisis se sabotea a propósito para
comprobar que la página no lo toca.
"""

from datetime import date

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado, make_incidencia_tress


def _sabotear_datos_analisis(monkeypatch):
    """Cualquier intento de abrir datos-analisis revienta el test."""

    def _boom():
        raise AssertionError("la página no debe consultar datos-analisis")

    monkeypatch.setattr(
        "app.services.faltas_retardos_service.DatosAnalisisReadClient.create_read_engine",
        _boom,
    )


@pytest.mark.asyncio
async def test_listado_lee_de_la_cache_sin_tocar_datos_analisis(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db,
        origen="ausencia",
        origen_id=1,
        no_empleado=553,
        empleado_id=10,
        tipo="falta_injustificada",
        fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=auth_headers(rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["tipo"] == "falta_injustificada"
    assert data["items"][0]["empleado_nombre"] == "Ana"
    assert data["items"][0]["numero_empleado"] == "553"


@pytest.mark.asyncio
async def test_estadisticas_leen_de_la_cache_sin_tocar_datos_analisis(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    for i, tipo in enumerate(["retardo", "retardo", "falta_injustificada"], start=1):
        await make_incidencia_tress(
            db,
            origen="ausencia",
            origen_id=i,
            no_empleado=553,
            empleado_id=10,
            tipo=tipo,
            fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos/estadisticas", headers=auth_headers(rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total_eventos"] == 3
    assert data["retardo"] == 2
    assert data["falta_injustificada"] == 1


@pytest.mark.asyncio
async def test_filtro_por_tipo(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=2, no_empleado=553, empleado_id=10,
        tipo="falta_injustificada", fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?tipo=retardo", headers=auth_headers(rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["tipo"] == "retardo"


@pytest.mark.asyncio
async def test_paginacion(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    for i in range(1, 6):
        await make_incidencia_tress(
            db, origen="ausencia", origen_id=i, no_empleado=553, empleado_id=10,
            tipo="retardo", fecha_evento=date.today(),
        )

    resp = await client.get(
        "/api/v1/faltas-retardos?page=2&page_size=2", headers=auth_headers(rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 5
    assert data["page"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_busqueda_por_nombre(db, client: AsyncClient, monkeypatch):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana Lopez")
    await make_empleado(db, empleado_id=11, no_empleado=554, nombre="Beto Ruiz")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="retardo", fecha_evento=date.today(),
    )
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=2, no_empleado=554, empleado_id=11,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?busqueda=Beto", headers=auth_headers(rh)
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["empleado_nombre"] == "Beto Ruiz"


@pytest.mark.asyncio
async def test_empleado_sin_registro_en_bono_se_expone_como_cero(
    db, client: AsyncClient, monkeypatch
):
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_incidencia_tress(
        db, origen="ausencia", origen_id=1, no_empleado=999999, empleado_id=None,
        tipo="retardo", fecha_evento=date.today(),
    )

    resp = await client.get("/api/v1/faltas-retardos", headers=auth_headers(rh))

    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["empleado_id"] == 0
    assert data["items"][0]["empleado_nombre"] is None


@pytest.mark.asyncio
async def test_permiso_con_rango_aparece_si_solapa_la_ventana(
    db, client: AsyncClient, monkeypatch
):
    """El permiso empezó antes del filtro pero sigue vigente dentro: debe salir."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")
    await make_empleado(db, empleado_id=10, no_empleado=553, nombre="Ana")
    await make_incidencia_tress(
        db, origen="permiso", origen_id=1, no_empleado=553, empleado_id=10,
        tipo="incapacidad", fecha_evento=date(2026, 6, 25), fecha_fin=date(2026, 7, 10),
    )

    resp = await client.get(
        "/api/v1/faltas-retardos?fecha_inicio=2026-07-01&fecha_fin=2026-07-31",
        headers=auth_headers(rh),
    )

    assert resp.status_code == 200
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_cache_vacia_devuelve_lista_vacia_no_error(
    db, client: AsyncClient, monkeypatch
):
    """Sin sync todavía, la página muestra 0 resultados en vez de 503."""
    _sabotear_datos_analisis(monkeypatch)
    rh = await make_empleado(db, empleado_id=1, no_empleado=100, nombre="RH", rol="rh")

    resp = await client.get("/api/v1/faltas-retardos", headers=auth_headers(rh))

    assert resp.status_code == 200
    assert resp.json()["total"] == 0
```

Agregar la factory al final de las factories de `tests/conftest.py` (junto a `make_homeoffice_tomados`):

```python
async def make_incidencia_tress(
    db: AsyncSession,
    *,
    origen: str = "ausencia",
    origen_id: int,
    no_empleado: int,
    tipo: str,
    fecha_evento,
    empleado_id: int | None = None,
    fecha_fin=None,
    observaciones: str | None = None,
    fecha_registro=None,
    registrado_por_id: int | None = None,
):
    """Siembra una fila en la caché de incidencias de TRESS.

    Es lo que el sync escribiría desde datos-analisis; los tests la usan para fijar lo
    que verá la página Incidencias sin tocar esa BD externa.
    """
    from app.models.incidencias_tress import IncidenciaTress

    fila = IncidenciaTress(
        origen=origen,
        origen_id=int(origen_id),
        no_empleado=int(no_empleado),
        empleado_id=empleado_id,
        tipo=tipo,
        fecha_evento=fecha_evento,
        fecha_fin=fecha_fin,
        observaciones=observaciones,
        fecha_registro=fecha_registro,
        registrado_por_id=registrado_por_id,
    )
    db.add(fila)
    await db.flush()
    await db.refresh(fila)
    return fila
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_faltas_retardos_datos_analisis.py -v`
Expected: FAIL — `ImportError: cannot import name 'make_incidencia_tress'`

- [ ] **Step 3: Agregar los métodos de lectura al repositorio de caché**

En `app/repositories/incidencias_tress_cache_repository.py`, agregar los imports y la sección de lectura:

```python
from sqlalchemy import delete, func, select   # `func` es lo nuevo
from sqlalchemy.orm import aliased

from app.models.empleados import Empleado
```

y dentro de la clase, después de `delete_llaves`:

```python
    # ── Lectura (página Incidencias) ──────────────────────────────────────────

    @staticmethod
    def _filtros(
        *,
        fecha_inicio: date | None,
        fecha_fin: date | None,
        cb_codigos: list[int] | None,
        tipo: str | None,
    ) -> list:
        conds: list = []
        if fecha_inicio is not None:
            # Un evento con rango cuenta si sigue vigente dentro de la ventana, aunque
            # haya empezado antes: misma semántica que el SQL de datos-analisis.
            conds.append(
                func.coalesce(IncidenciaTress.fecha_fin, IncidenciaTress.fecha_evento)
                >= fecha_inicio
            )
        if fecha_fin is not None:
            conds.append(IncidenciaTress.fecha_evento <= fecha_fin)
        if cb_codigos is not None:
            # Lista vacía = ningún empleado pasa el filtro; no equivale a "sin filtro".
            conds.append(IncidenciaTress.no_empleado.in_(cb_codigos or [-1]))
        if tipo and tipo.strip():
            conds.append(IncidenciaTress.tipo == tipo.strip())
        return conds

    async def count(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(IncidenciaTress).where(
            *self._filtros(
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                cb_codigos=cb_codigos,
                tipo=tipo,
            )
        )
        return int((await self.db.execute(stmt)).scalar() or 0)

    async def list_offset(
        self,
        offset: int,
        limit: int,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[dict]:
        """Filas de la página, ya con el nombre del empleado y de quien registró.

        El join sale gratis porque la caché y `empleados` viven en la misma BD; antes
        esto era un viaje aparte por cada página.
        """
        emp = aliased(Empleado)
        registrador = aliased(Empleado)
        stmt = (
            select(
                IncidenciaTress.origen,
                IncidenciaTress.origen_id,
                IncidenciaTress.no_empleado,
                IncidenciaTress.empleado_id,
                emp.nombre.label("empleado_nombre"),
                IncidenciaTress.tipo,
                IncidenciaTress.fecha_evento,
                IncidenciaTress.fecha_fin,
                IncidenciaTress.observaciones,
                IncidenciaTress.fecha_registro,
                IncidenciaTress.registrado_por_id,
                registrador.nombre.label("registrado_por_nombre"),
            )
            .outerjoin(emp, emp.empleado_id == IncidenciaTress.empleado_id)
            .outerjoin(
                registrador, registrador.empleado_id == IncidenciaTress.registrado_por_id
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            # Misma terna determinista que usaba datos-analisis.
            .order_by(
                IncidenciaTress.fecha_evento.desc(),
                IncidenciaTress.origen.asc(),
                IncidenciaTress.origen_id.desc(),
            )
            .offset(max(0, offset))
            .limit(max(0, limit))
        )
        result = await self.db.execute(stmt)
        return [dict(row) for row in result.mappings().all()]

    async def aggregate_por_tipo(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> dict[str, int]:
        stmt = (
            select(IncidenciaTress.tipo, func.count().label("cnt"))
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        return {str(clave): int(cnt) for clave, cnt in result.all() if clave}

    async def aggregate_por_periodo_y_tipo(
        self,
        *,
        agrupacion: str,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, str, int]]:
        """Agrupa por día y tipo en SQL, y arma el periodo en Python.

        `date_trunc` no existe en SQLite (los tests) y `strftime` no existe en
        PostgreSQL: agrupar el día en la BD y el periodo aquí es lo único portable.
        """
        stmt = (
            select(
                IncidenciaTress.fecha_evento,
                IncidenciaTress.tipo,
                func.count().label("cnt"),
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.fecha_evento, IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        merged: dict[tuple[str, str], int] = {}
        for fecha, clave, cnt in result.all():
            if fecha is None or not clave:
                continue
            llave = (periodo_de_fecha(fecha, agrupacion), str(clave))
            merged[llave] = merged.get(llave, 0) + int(cnt)
        return [
            (periodo, clave, total)
            for (periodo, clave), total in sorted(merged.items())
        ]

    async def aggregate_por_mes(
        self,
        *,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[str, int]]:
        rows = await self.aggregate_por_periodo_y_tipo(
            agrupacion="mes",
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            cb_codigos=cb_codigos,
            tipo=tipo,
        )
        merged: dict[str, int] = {}
        for periodo, _clave, count in rows:
            merged[periodo] = merged.get(periodo, 0) + count
        return sorted(merged.items())

    async def aggregate_empleados_top(
        self,
        *,
        limit: int = 10,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        cb_codigos: list[int] | None = None,
        tipo: str | None = None,
    ) -> list[tuple[int, int, dict[str, int]]]:
        """(no_empleado, total, {tipo: total}) de los empleados con más eventos."""
        stmt = (
            select(
                IncidenciaTress.no_empleado,
                IncidenciaTress.tipo,
                func.count().label("cnt"),
            )
            .where(
                *self._filtros(
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    cb_codigos=cb_codigos,
                    tipo=tipo,
                )
            )
            .group_by(IncidenciaTress.no_empleado, IncidenciaTress.tipo)
        )
        result = await self.db.execute(stmt)
        por_empleado: dict[int, dict[str, int]] = {}
        for no_empleado, clave, cnt in result.all():
            if no_empleado is None or not clave:
                continue
            destino = por_empleado.setdefault(int(no_empleado), {})
            destino[str(clave)] = destino.get(str(clave), 0) + int(cnt)

        totales = [
            (no_empleado, sum(por_tipo.values()), por_tipo)
            for no_empleado, por_tipo in por_empleado.items()
        ]
        totales.sort(key=lambda item: (-item[1], item[0]))
        return totales[: max(0, int(limit))]
```

Y al final del módulo (fuera de la clase), la función de periodo:

```python
def periodo_de_fecha(fecha: date, agrupacion: str) -> str:
    """Etiqueta del periodo: día ISO, lunes de la semana, o `YYYY-MM`."""
    if agrupacion == "dia":
        return fecha.isoformat()
    if agrupacion == "semana":
        return (fecha - timedelta(days=fecha.weekday())).isoformat()
    return fecha.strftime("%Y-%m")
```

Agregar `timedelta` al import de `datetime` en la cabecera del archivo:

```python
from datetime import date, timedelta
```

- [ ] **Step 4: Crear el mapper de la caché**

Crear `app/services/faltas_retardos/mapper_cache.py`:

```python
"""Mapeo de filas de `levelup_incidencias_tress` → respuesta API de faltas y retardos."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from app.models.faltas_retardos import FALTA_RETARDO_TIPOS
from app.schemas.faltas_retardos import FaltaRetardoResponse
from app.services.faltas_retardos.constants import synthetic_falta_retardo_id


def map_cache_row(row: dict[str, Any]) -> FaltaRetardoResponse | None:
    """Convierte una fila de la caché. Devuelve None si la fila es inservible.

    `empleado_id` puede ser None cuando el empleado existe en TRESS pero no en Bono: se
    expone como 0 en vez de descartar la fila, para que el total de la página cuadre con
    lo que se ve.
    """
    origen = str(row.get("origen") or "").strip()
    origen_id = row.get("origen_id")
    tipo = str(row.get("tipo") or "").strip()
    fecha_evento = row.get("fecha_evento")
    if not origen or origen_id is None or tipo not in FALTA_RETARDO_TIPOS:
        return None
    if not isinstance(fecha_evento, date):
        return None

    # created_at sale de fecha_registro (PM_CAPTURA) cuando existe. Sin ese dato se usa
    # la fecha del evento: poner "hoy" pintaría la fecha de registro de todas las filas.
    fecha_registro = row.get("fecha_registro")
    base = fecha_registro if isinstance(fecha_registro, date) else fecha_evento
    created_at = datetime.combine(base, datetime.min.time(), tzinfo=timezone.utc)

    empleado_id = row.get("empleado_id")
    no_empleado = row.get("no_empleado")
    nombre = row.get("empleado_nombre")
    registrador = row.get("registrado_por_nombre")

    return FaltaRetardoResponse(
        id=synthetic_falta_retardo_id(origen, int(origen_id)),
        empleado_id=int(empleado_id) if empleado_id is not None else 0,
        empleado_nombre=str(nombre).strip() if nombre else None,
        numero_empleado=str(no_empleado) if no_empleado is not None else None,
        tipo=tipo,  # type: ignore[arg-type]
        fecha_evento=fecha_evento,
        fecha_fin=row.get("fecha_fin"),
        observaciones=row.get("observaciones"),
        registrado_por_id=row.get("registrado_por_id"),
        registrado_por_nombre=str(registrador).strip() if registrador else None,
        created_at=created_at,
        origen=origen,
        origen_id=int(origen_id),
    )
```

- [ ] **Step 5: Cambiar la fuente de lectura del servicio**

En `app/services/faltas_retardos_service.py`:

1. Agregar los imports:

```python
from app.repositories.incidencias_tress_cache_repository import (
    IncidenciasTressCacheRepository,
)
from app.services.faltas_retardos.mapper_cache import map_cache_row
```

2. En `__init__`, agregar el repo de caché:

```python
        self.cache_repo = IncidenciasTressCacheRepository(db)
```

3. Reemplazar el cuerpo de `list_eventos` (líneas 422-513) por:

```python
    async def list_eventos(
        self,
        current_user: Empleado,
        *,
        page: int,
        page_size: int,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
    ) -> FaltasRetardosPageResponse:
        """Listado paginado desde la caché en Bono (`levelup_incidencias_tress`).

        La caché la escribe el sync semanal; esta ruta nunca toca datos-analisis.
        """
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        fecha_inicio, fecha_fin = _ventana_por_defecto(fecha_inicio, fecha_fin)

        cb_codigos = await self._cb_codigos_filtrados(
            empleado_id=empleado_id, busqueda=busqueda, scope_ids=scope_ids
        )
        filtros = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "cb_codigos": cb_codigos,
            "tipo": tipo,
        }

        total = await self.cache_repo.count(**filtros)
        page, offset = self._normalizar_pagina(page, page_size, total)
        rows = await self.cache_repo.list_offset(offset, page_size, **filtros)

        items = [
            mapped for mapped in (map_cache_row(row) for row in rows) if mapped is not None
        ]
        return FaltasRetardosPageResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )
```

4. Reemplazar el cuerpo de `estadisticas_eventos` (líneas 616-692) por:

```python
    async def estadisticas_eventos(
        self,
        current_user: Empleado,
        *,
        rh_ui_mode: str | None = None,
        empleado_id: int | None = None,
        tipo: str | None = None,
        fecha_inicio: date | None = None,
        fecha_fin: date | None = None,
        busqueda: str | None = None,
        area: str | None = None,
        tendencia_agrupacion: str | None = None,
    ) -> FaltasRetardosEstadisticasResponse:
        """Agregados desde la caché, con los mismos filtros que el listado."""
        scope_ids = await self._empleado_ids_scope(current_user, rh_ui_mode)
        fecha_inicio, fecha_fin = _ventana_por_defecto(fecha_inicio, fecha_fin)
        agr = (
            tendencia_agrupacion.strip().lower()
            if tendencia_agrupacion and tendencia_agrupacion.strip()
            else None
        )
        agr = agr if agr in ("dia", "semana", "mes") else None

        cb_codigos = await self._cb_codigos_filtrados(
            empleado_id=empleado_id, busqueda=busqueda, scope_ids=scope_ids, area=area
        )
        filtros = {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "cb_codigos": cb_codigos,
            "tipo": tipo,
        }

        por_tipo = await self.cache_repo.aggregate_por_tipo(**filtros)
        por_mes = await self.cache_repo.aggregate_por_mes(**filtros)
        top = await self.cache_repo.aggregate_empleados_top(limit=10, **filtros)
        periodo_rows = (
            await self.cache_repo.aggregate_por_periodo_y_tipo(agrupacion=agr, **filtros)
            if agr
            else []
        )

        empleados_top = await self._hidratar_empleados_top(top, [])
        return self._build_estadisticas_response(
            por_tipo,
            por_mes,
            empleados_top,
            por_periodo_y_tipo=self._map_periodo_tipo_rows(periodo_rows) if agr else None,
            tendencia_agrupacion=agr,
        )
```

5. Borrar lo que quedó sin llamador en el camino de lectura — comprobar con `grep -n` antes de borrar cada uno:

- `_with_datos_analisis_repo`
- `_map_tress_rows`
- `_enriquecer_con_levelup`
- `_extras_levelup`
- `_list_levelup_items`
- `_estadisticas_solo_levelup`
- `_periodos_de_extras`
- `_sumar_periodos`
- `_periodo_de_fecha`
- `_paginar_en_memoria`
- las constantes `_MAX_PREFETCH_TRESS` y `_TIPOS_SOLO_LEVELUP`
- los imports que queden huérfanos: `DatosAnalisisFaltasRetardosRepository`, `map_tress_row`, `_error_tress` si ya nadie lo usa, `SQLAlchemyError` si ya nadie lo usa

**No borrar** `_error_tress` ni `DatosAnalisisReadClient` si siguen usándolos `crear_evento` o los servicios de goce/suspensión; ese camino de escritura no se toca en este plan.

Comando de verificación por cada nombre antes de borrarlo:

```bash
grep -rn "_extras_levelup" app tests | grep -v "\.pyc"
```

Expected: sin resultados salvo la definición que se va a borrar.

- [ ] **Step 6: Correr los tests del listado**

Run: `docker-compose run --rm test pytest tests/test_faltas_retardos_datos_analisis.py -v`
Expected: PASS (8 tests)

- [ ] **Step 7: Correr la suite completa**

Run: `docker-compose run --rm test`
Expected: PASS. Los tests de los botones (`test_faltas_retardos_goce.py`, `test_faltas_retardos_suspension_tress.py`, `test_sync_ausencias_fi.py`) deben pasar **sin haberlos editado**.

Si `test_faltas_retardos.py` o `test_faltas_retardos_errores_limpios.py` fallan porque esperaban un 503 al caerse datos-analisis en el listado, ése es el cambio buscado: actualizar esos casos para que esperen 200 con lista vacía, y dejar intactos los que cubren el 503 al **registrar** (ahí sí se escribe en TRESS y el 503 sigue siendo correcto).

- [ ] **Step 8: Verificar en la app real**

Run: `docker-compose restart backend && sleep 5 && curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost:8000/api/v1/faltas-retardos`
Expected: `401` (sin token) — lo que importa es que el backend levantó sin errores de import. Revisar además `docker-compose logs --tail=20 backend` sin trazas de error.

- [ ] **Step 9: Commit**

```bash
git add app/repositories/incidencias_tress_cache_repository.py \
        app/services/faltas_retardos/mapper_cache.py \
        app/services/faltas_retardos_service.py \
        tests/conftest.py tests/test_faltas_retardos_datos_analisis.py
git commit -m "feat(incidencias): la pagina lee de levelup_incidencias_tress y no de datos-analisis"
```

---

### Task 5: Documentación

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DEPLOY.md`

**Interfaces:**
- Consumes: los comandos y nombres definidos en las tareas 2 y 3.
- Produces: nada de código.

- [ ] **Step 1: Documentar los comandos en `CLAUDE.md`**

En la sección `### Database / Migraciones`, después del bloque de home office, agregar:

```markdown
# Incidencias de TRESS: DATOS_ANALISIS → levelup_incidencias_tress (Bono).
# Mismo servicio que el job semanal de los miércoles 10:00; necesario para la carga inicial.
# Sin --desde/--hasta importa todo el histórico excluyendo la semana en curso.
docker-compose exec backend python -m app.scripts.sync_incidencias_tress            # dry-run
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --execute
docker-compose exec backend python -m app.scripts.sync_incidencias_tress --desde 2026-01-01 --hasta 2026-06-30 --execute
```

- [ ] **Step 2: Documentar la regla en la sección de TRESS de `CLAUDE.md`**

En `### TRESS / DATOS_ANALISIS (sin RPA)`, después de la viñeta de home office, agregar:

```markdown
- **Incidencias (página "Incidencias", módulo `faltas-retardos`) = caché en Bono.** Ninguna
  carga de página consulta `dbo.AUSENCIA` ni `dbo.PERMISO`: la fuente única de lectura es
  `levelup_incidencias_tress`, que escribe `sync_incidencias_tress_service` (job semanal
  de los miércoles 10:00 y `python -m app.scripts.sync_incidencias_tress`). El SQL
  `sql/datos_analisis_faltas_retardos_base.sql` ya solo lo usa ese sync. La caché es
  **solo lectura de TRESS**: el sync nunca escribe en DATOS_ANALISIS. Lo que RH registra
  aparece en la tabla tras la siguiente corrida semanal. Caché vacía ⇒ la página muestra
  0 resultados, no 503.
```

Y en la línea que describe APScheduler, agregar el job semanal a la enumeración de jobs.

- [ ] **Step 3: Documentar la carga inicial en `docs/DEPLOY.md`**

Siguiendo el formato del bloque de home office que ya existe ahí, agregar una sección:

```markdown
### Carga inicial de incidencias (levelup_incidencias_tress)

Tras aplicar migraciones, la caché de incidencias está vacía y la página Incidencias
muestra 0 resultados hasta la primera corrida. La carga inicial trae todo el histórico
(~187k filas) excluyendo la semana en curso:

```bash
# 1. Dry-run: valida conexión a DATOS_ANALISIS y reporta conteos sin escribir.
docker compose exec backend python -m app.scripts.sync_incidencias_tress

# 2. Carga real.
docker compose exec backend python -m app.scripts.sync_incidencias_tress --execute
```

Es idempotente: reejecutarla no duplica filas. Si se corta a la mitad, volver a lanzarla
continúa sin efectos colaterales.

**Verificar que quedó bien:**

```bash
docker compose exec backend python -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine
async def main():
    async with engine.connect() as c:
        r = await c.execute(text('SELECT count(*), max(synced_at) FROM levelup_incidencias_tress'))
        print(r.first())
asyncio.run(main())
"
```

A partir de ahí el job semanal (miércoles 10:00, `America/Mexico_City`) mantiene al día
las últimas `SYNC_INCIDENCIAS_TRESS_SEMANAS` semanas (default 8). Para comprobar que el
job quedó registrado, buscar `APScheduler iniciado con N jobs` en los logs del backend al
arrancar, y `Sync incidencias job |` tras cada corrida.
```

- [ ] **Step 4: Verificar que no quedaron referencias obsoletas**

Run: `grep -rn "datos-analisis" CLAUDE.md docs/DEPLOY.md | grep -i incidencia`
Expected: solo las líneas nuevas que dicen que ya **no** se consulta en la carga de página.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/DEPLOY.md
git commit -m "docs(incidencias): documentar la cache de incidencias de TRESS y su sync semanal"
```

---

## Verificación final

- [ ] `docker-compose run --rm test` en verde.
- [ ] `docker-compose exec -e PYTHONPATH=/app -w /app backend alembic heads` reporta un solo head.
- [ ] `grep -rn "DatosAnalisis" app/services/faltas_retardos_service.py` — solo aparece en el camino de **escritura** (registro en TRESS), nunca en `list_eventos` ni en `estadisticas_eventos`.
- [ ] `docker-compose logs backend | grep "APScheduler iniciado"` reporta 6 jobs.
- [ ] Abrir la página Incidencias en el navegador: filtros, búsqueda, paginación y los botones se comportan igual que antes.
- [ ] PR contra `main` describiendo qué cambió y cómo probarlo. Recordar en la descripción que **la carga inicial hay que correrla a mano en el servidor** después del deploy.
