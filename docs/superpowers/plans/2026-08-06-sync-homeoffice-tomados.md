# Caché de Home Office tomados en Bono — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los días de Home Office tomados por cada empleado se sincronicen desde `DATOS_ANALISIS` (TRESS) hacia la tabla `levelup_homeoffice_tomados` en Bono, y que el dashboard los lea de ahí en vez de consultar SQL Server en cada carga de página.

**Architecture:** Espeja la caché de vacaciones ya existente (`levelup_vacaciones_disponibles`): tabla propia con prefijo `levelup_`, un servicio de sincronización central, y tres disparadores contra esa misma función (job diario 06:00, aprobación de la solicitud, CLI). La lectura en TRESS es **una sola consulta agregada** `GROUP BY CB_CODIGO` sobre `dbo.PERMISO`; el filtrado por empleado se hace en memoria, de modo que la corrida masiva y la individual comparten el mismo camino de código.

**Tech Stack:** FastAPI async · SQLAlchemy 2.0 async (asyncpg contra Bono, `mssql+aioodbc` contra `DATOS_ANALISIS`) · Alembic · APScheduler · pytest + pytest-asyncio con SQLite en memoria.

**Spec:** `docs/superpowers/specs/2026-08-06-sync-homeoffice-tomados-design.md`

## Global Constraints

- Todo corre en Docker. Tests: `docker-compose run --rm test`. Un solo archivo: `docker-compose run --rm test pytest tests/test_x.py -v`.
- Rama de trabajo: `feat/cm/cache-homeoffice-tomados` (ya creada). **Nunca** commitear a `main`.
- Commits en Conventional Commits, en español, sin iniciales. Terminar el mensaje con `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **BD externa `DATOS_ANALISIS`:** solo `SELECT`. Prohibido cualquier DDL, `DELETE`, `TRUNCATE` o `UPDATE`.
- **BD externa Bono:** toda tabla nueva de este proyecto se llama `levelup_<nombre>`. Prohibido crear/alterar/borrar tablas sin ese prefijo.
- Las migraciones Alembic nuevas solo tocan tablas `levelup_*`. Head actual de la cadena: **`w1c2a3c4h5e6`** (verificado: es el único head).
- Prohibido usar la cola RPA (`encolar_tress`, `levelup_tress_robot_queue`) en código nuevo.
- No se modifica la sincronización de vacaciones (`sync_vacaciones_disponibles_service`, su CLI, su job, su modelo ni sus tests).
- No se modifica `SolicitudRepository.count_home_office_activos_en_mes` ni la regla «un día de HO por mes»: lee la tabla local de Bono, no `DATOS_ANALISIS`.
- Nombre exacto de la tabla: `levelup_homeoffice_tomados`. Constraint única: `uq_levelup_homeoffice_tomados_empleado_anio` sobre `(no_empleado, anio)`.
- Sin variables de entorno nuevas. Se reutilizan `DATOS_ANALISIS_DB_*`, `BONO_DB_*` y `APP_TIMEZONE`.
- El contrato de la API no cambia: `DashboardKpisResponse.home_office_dias_anio` sigue siendo `int | None`. **No** se toca `openapi.yaml`.
- Home Office en TRESS = `dbo.PERMISO` con `RTRIM(PM_TIPO) = 'HO'`; los días son `SUM(PM_DIAS)`; el rango se acota por `PM_FEC_INI` y es semiabierto `[desde, hasta)` porque `PM_FEC_FIN` es exclusiva.
- Los comentarios de los archivos `.sql` **no pueden contener tokens `:palabra`**: `sqlalchemy.text()` los interpreta como binds.

---

### Task 1: Tabla y modelo `levelup_homeoffice_tomados`

**Files:**
- Create: `app/models/homeoffice_tomados.py`
- Create: `alembic/versions/x1h2o3f4f5i6_homeoffice_tomados_cache.py`
- Modify: `tests/conftest.py` (import del modelo + factory `make_homeoffice_tomados`)
- Test: `tests/test_homeoffice_tomados_cache.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `app.models.homeoffice_tomados.HomeOfficeTomados` con columnas `id: int`, `no_empleado: int`, `anio: int`, `dias_tomados: Decimal`, `actualizado_en: datetime`.
  - `tests.conftest.make_homeoffice_tomados(db, *, no_empleado: int, anio: int, dias_tomados: float | Decimal = 0) -> HomeOfficeTomados`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_homeoffice_tomados_cache.py`:

```python
"""Tabla `levelup_homeoffice_tomados`: caché en Bono de los días de home office de TRESS."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.homeoffice_tomados import HomeOfficeTomados
from tests.conftest import make_homeoffice_tomados


@pytest.mark.asyncio
async def test_guarda_dias_por_empleado_y_anio(db):
    fila = await make_homeoffice_tomados(
        db, no_empleado=4001, anio=2026, dias_tomados=3
    )
    assert fila.no_empleado == 4001
    assert fila.anio == 2026
    assert Decimal(str(fila.dias_tomados)) == Decimal("3")
    assert fila.actualizado_en is not None


@pytest.mark.asyncio
async def test_un_empleado_puede_tener_una_fila_por_anio(db):
    await make_homeoffice_tomados(db, no_empleado=4002, anio=2025, dias_tomados=12)
    await make_homeoffice_tomados(db, no_empleado=4002, anio=2026, dias_tomados=4)

    result = await db.execute(
        select(HomeOfficeTomados).where(HomeOfficeTomados.no_empleado == 4002)
    )
    anios = sorted(fila.anio for fila in result.scalars().all())
    assert anios == [2025, 2026]


@pytest.mark.asyncio
async def test_no_admite_dos_filas_del_mismo_empleado_y_anio(db):
    """La unique es lo que hace seguro el upsert del sync ante corridas repetidas."""
    await make_homeoffice_tomados(db, no_empleado=4003, anio=2026, dias_tomados=2)

    db.add(HomeOfficeTomados(no_empleado=4003, anio=2026, dias_tomados=9))
    with pytest.raises(IntegrityError):
        await db.flush()
    await db.rollback()
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_homeoffice_tomados_cache.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.models.homeoffice_tomados'`.

- [ ] **Step 3: Crear el modelo**

Crear `app/models/homeoffice_tomados.py`:

```python
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Integer, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.empleados import Empleado


class HomeOfficeTomados(Base):
    """Caché en Bono de los días de home office que viven en DATOS_ANALISIS (TRESS).

    **No es una fuente editable**: la escribe únicamente
    ``app.services.sync_homeoffice_tomados_service`` a partir de ``dbo.PERMISO``
    (``PM_TIPO = 'HO'``). Existe para que el dashboard no tenga que esperar a esa BD
    externa en cada carga de página.

    Una fila por empleado y año calendario, que es el periodo con el que el negocio cuenta
    el home office. Las filas de años anteriores se conservan: el sync solo reescribe el
    año en curso.
    """

    __tablename__ = "levelup_homeoffice_tomados"
    __table_args__ = (
        UniqueConstraint(
            "no_empleado", "anio", name="uq_levelup_homeoffice_tomados_empleado_anio"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # Relación por no_empleado; sin FK declarativa (patrón Bono / levelup_emails).
    no_empleado: Mapped[int] = mapped_column(Integer, nullable=False)
    anio: Mapped[int] = mapped_column(Integer, nullable=False)
    dias_tomados: Mapped[Decimal] = mapped_column(
        Numeric(6, 2), nullable=False, default=0
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    empleado: Mapped["Empleado"] = relationship(
        "Empleado",
        primaryjoin="HomeOfficeTomados.no_empleado == Empleado.no_empleado",
        foreign_keys="HomeOfficeTomados.no_empleado",
        viewonly=True,
    )

    def __repr__(self) -> str:
        return (
            f"<HomeOfficeTomados no_empleado={self.no_empleado} anio={self.anio} "
            f"dias_tomados={self.dias_tomados}>"
        )
```

- [ ] **Step 4: Registrar el modelo y la factory en conftest**

En `tests/conftest.py`, añadir el import junto a los demás modelos (después de la línea `import app.models.vistas_rol  # noqa: F401`):

```python
import app.models.homeoffice_tomados  # noqa: F401
```

Y añadir la factory justo después de `make_vacaciones_disponibles` (la que termina con `return fila`, antes de `async def link_turno_comedor_empleado`):

```python
async def make_homeoffice_tomados(
    db: AsyncSession,
    *,
    no_empleado: int,
    anio: int,
    dias_tomados: float | Decimal = 0,
):
    """Siembra (o actualiza) la caché de home office tomado de un empleado en un año.

    Es lo que el sync escribiría desde TRESS; los tests la usan para fijar los días que
    verá el dashboard sin tocar datos-analisis.
    """
    from sqlalchemy import select

    from app.models.homeoffice_tomados import HomeOfficeTomados

    result = await db.execute(
        select(HomeOfficeTomados).where(
            HomeOfficeTomados.no_empleado == int(no_empleado),
            HomeOfficeTomados.anio == int(anio),
        )
    )
    fila = result.scalar_one_or_none()
    if fila is None:
        fila = HomeOfficeTomados(no_empleado=int(no_empleado), anio=int(anio))
        db.add(fila)
    fila.dias_tomados = dias_tomados
    await db.flush()
    await db.refresh(fila)
    return fila
```

Si `Decimal` no está importado en `tests/conftest.py`, añadir `from decimal import Decimal` a los imports de la cabecera.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_homeoffice_tomados_cache.py -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Crear la migración Alembic**

Crear `alembic/versions/x1h2o3f4f5i6_homeoffice_tomados_cache.py`:

```python
"""levelup_homeoffice_tomados — caché de los días de home office tomados en TRESS

Espeja a `levelup_vacaciones_disponibles`: no es un dato editable, sino la caché de
`dbo.PERMISO` (PM_TIPO = 'HO', DATOS_ANALISIS) que escriben el job diario de las 06:00, la
aprobación de una solicitud de home office y el CLI de sincronización. Una fila por
empleado y año calendario.

Revision ID: x1h2o3f4f5i6
Revises: w1c2a3c4h5e6
Create Date: 2026-08-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "x1h2o3f4f5i6"
down_revision: Union[str, None] = "w1c2a3c4h5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_homeoffice_tomados"):
        return

    op.create_table(
        "levelup_homeoffice_tomados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("no_empleado", sa.Integer(), nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("dias_tomados", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        # Garantía anti-duplicados del upsert: una fila por empleado y año.
        sa.UniqueConstraint(
            "no_empleado", "anio", name="uq_levelup_homeoffice_tomados_empleado_anio"
        ),
    )


def downgrade() -> None:
    if not table_exists("levelup_homeoffice_tomados"):
        return
    op.drop_table("levelup_homeoffice_tomados")
```

No se crea un índice aparte: el índice que respalda la unique `(no_empleado, anio)` ya
cubre las búsquedas por `no_empleado`.

- [ ] **Step 7: Verificar que la cadena de migraciones sigue con un solo head**

Run:
```bash
docker-compose run --rm test python -c "
from alembic.config import Config
from alembic.script import ScriptDirectory
print(ScriptDirectory.from_config(Config('alembic.ini')).get_heads())
"
```
Expected: `('x1h2o3f4f5i6',)` — exactamente un head.

- [ ] **Step 8: Commit**

```bash
git add app/models/homeoffice_tomados.py alembic/versions/x1h2o3f4f5i6_homeoffice_tomados_cache.py tests/conftest.py tests/test_homeoffice_tomados_cache.py
git commit -m "feat(solicitudes): tabla levelup_homeoffice_tomados para cachear home office

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Lectura agregada de home office en `DATOS_ANALISIS`

**Files:**
- Create: `app/repositories/sql/datos_analisis_home_office_dias_por_empleado.sql`
- Modify: `app/repositories/datos_analisis_home_office_read_repository.py`
- Test: `tests/test_datos_analisis_home_office_read.py`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `app.repositories.datos_analisis_home_office_read_repository.load_home_office_dias_por_empleado_sql() -> str`
  - `DatosAnalisisHomeOfficeReadRepository.get_dias_por_empleado(*, desde: date, hasta: date) -> dict[int, Decimal]`

En esta tarea **no** se borra `get_dias_en_rango`: sigue en uso por `dashboard_kpis_service` hasta la Task 8, que lo retira.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_datos_analisis_home_office_read.py`:

```python
"""Consulta agregada de home office en datos-analisis (dbo.PERMISO).

datos-analisis no existe en el entorno de tests: se comprueba el SQL en sí (binds y
filtros, que es donde se cometen los errores caros) y el mapeo del resultado.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import text

from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
    load_home_office_dias_por_empleado_sql,
)


def test_sql_expone_solo_los_binds_de_fecha():
    """Sin bind de empleado: la consulta trae todos y el filtrado se hace en memoria."""
    parsed = text(load_home_office_dias_por_empleado_sql())
    assert set(parsed._bindparams.keys()) == {"desde", "hasta"}


def test_sql_filtra_el_tipo_ho_y_agrupa_por_empleado():
    sql = load_home_office_dias_por_empleado_sql()
    # PM_TIPO es char(3) con padding ('HO '), por eso el RTRIM.
    assert "RTRIM(PM_TIPO) = 'HO'" in sql
    # Se acota por fecha de inicio: PM_FEC_FIN es exclusiva en TRESS.
    assert "PM_FEC_INI >= :desde" in sql
    assert "PM_FEC_INI < :hasta" in sql
    assert "GROUP BY CB_CODIGO" in sql
    assert "SUM(PM_DIAS)" in sql


def _engine_con_filas(filas):
    """Motor simulado cuyo `connect()` devuelve `filas` como mappings."""
    result = MagicMock()
    result.mappings.return_value.all.return_value = filas
    conn = AsyncMock()
    conn.execute = AsyncMock(return_value=result)
    engine = MagicMock()
    engine.connect.return_value.__aenter__ = AsyncMock(return_value=conn)
    engine.connect.return_value.__aexit__ = AsyncMock(return_value=False)
    return engine, conn


@pytest.mark.asyncio
async def test_devuelve_un_mapa_numero_de_empleado_a_dias():
    engine, conn = _engine_con_filas([
        {"no_empleado": 101, "dias_home_office": 3},
        {"no_empleado": 202, "dias_home_office": Decimal("1.50")},
    ])

    dias = await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_por_empleado(
        desde=date(2026, 1, 1), hasta=date(2027, 1, 1)
    )

    assert dias == {101: Decimal("3"), 202: Decimal("1.50")}
    assert conn.execute.await_args.args[1] == {
        "desde": date(2026, 1, 1),
        "hasta": date(2027, 1, 1),
    }


@pytest.mark.asyncio
async def test_sin_filas_devuelve_un_mapa_vacio():
    engine, _ = _engine_con_filas([])

    dias = await DatosAnalisisHomeOfficeReadRepository(engine).get_dias_por_empleado(
        desde=date(2026, 1, 1), hasta=date(2027, 1, 1)
    )

    assert dias == {}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_datos_analisis_home_office_read.py -v`
Expected: FAIL con `ImportError: cannot import name 'load_home_office_dias_por_empleado_sql'`.

- [ ] **Step 3: Crear el SQL**

Crear `app/repositories/sql/datos_analisis_home_office_dias_por_empleado.sql`:

```sql
-- Dias de home office tomados por empleado en un rango, desde dbo.PERMISO
-- (SQL Server datos-analisis, solo lectura).
--
-- Home office = PM_TIPO 'HO' (catalogo dbo.INCIDEN, TB_CODIGO 'HO ' = "Home Ofice").
-- PM_TIPO es char(3) con padding, por eso el RTRIM.
--
-- Se filtra por PM_FEC_INI porque PM_FEC_FIN es EXCLUSIVA en TRESS (el insert guarda
-- DATEADD(day, 1, fecha_fin_real)); usarla para acotar el rango contaria de mas.
-- El rango es semiabierto -- desde incluido, hasta excluido -- para que el llamador
-- pase el 1 de enero del anio siguiente sin preocuparse por la hora.
--
-- No lleva filtro por empleado a proposito: el sync trae el anio completo de una vez y
-- recorta en memoria, de modo que la corrida masiva y la de un solo empleado comparten
-- exactamente esta consulta.
--
-- Binds: desde y hasta = date.
-- Nota: no usar tokens con dos puntos en comentarios; SQLAlchemy text() los toma como binds.
SELECT CB_CODIGO AS no_empleado,
       ISNULL(SUM(PM_DIAS), 0) AS dias_home_office
FROM dbo.PERMISO
WHERE RTRIM(PM_TIPO) = 'HO'
  AND PM_FEC_INI >= :desde
  AND PM_FEC_INI < :hasta
GROUP BY CB_CODIGO;
```

- [ ] **Step 4: Añadir el loader y el método al repositorio**

En `app/repositories/datos_analisis_home_office_read_repository.py`, añadir `Decimal` a los imports y, debajo de `_SQL_FILE` y `load_home_office_dias_sql`, añadir:

```python
_SQL_POR_EMPLEADO_FILE = (
    Path(__file__).resolve().parent
    / "sql"
    / "datos_analisis_home_office_dias_por_empleado.sql"
)


def load_home_office_dias_por_empleado_sql() -> str:
    return _SQL_POR_EMPLEADO_FILE.read_text(encoding="utf-8")
```

Y dentro de la clase `DatosAnalisisHomeOfficeReadRepository`, el método:

```python
    async def get_dias_por_empleado(
        self, *, desde: date, hasta: date
    ) -> dict[int, Decimal]:
        """Días de home office agrupados por empleado, con ``PM_FEC_INI`` en ``[desde, hasta)``.

        Una sola consulta para toda la plantilla: son unos cientos de grupos y evita un
        round-trip por empleado. Los empleados sin home office simplemente no aparecen en
        el mapa; es el llamador quien decide que eso significa cero.
        """
        sql = load_home_office_dias_por_empleado_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"desde": desde, "hasta": hasta})
            filas = result.mappings().all()

        salida: dict[int, Decimal] = {}
        for fila in filas:
            numero = fila["no_empleado"]
            if numero is None:
                continue
            salida[int(numero)] = Decimal(str(fila["dias_home_office"] or 0))
        return salida
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_datos_analisis_home_office_read.py -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add app/repositories/sql/datos_analisis_home_office_dias_por_empleado.sql app/repositories/datos_analisis_home_office_read_repository.py tests/test_datos_analisis_home_office_read.py
git commit -m "feat(solicitudes): consulta agregada de home office por empleado en TRESS

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Repositorio de la caché en Bono

**Files:**
- Create: `app/repositories/homeoffice_tomados_repository.py`
- Test: `tests/test_homeoffice_tomados_cache.py` (se añaden tests al archivo de la Task 1)

**Interfaces:**
- Consumes: `app.models.homeoffice_tomados.HomeOfficeTomados` (Task 1), `tests.conftest.make_homeoffice_tomados` (Task 1).
- Produces:
  - `HomeOfficeTomadosRepository(db).get_by_no_empleado_anio(no_empleado: int, anio: int) -> HomeOfficeTomados | None`
  - `HomeOfficeTomadosRepository(db).map_existentes(anio: int, no_empleados: Sequence[int] | None = None) -> dict[int, HomeOfficeTomados]`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/test_homeoffice_tomados_cache.py`:

```python
from app.repositories.homeoffice_tomados_repository import HomeOfficeTomadosRepository


@pytest.mark.asyncio
async def test_get_by_no_empleado_anio_devuelve_la_fila_del_anio_pedido(db):
    await make_homeoffice_tomados(db, no_empleado=4101, anio=2025, dias_tomados=12)
    await make_homeoffice_tomados(db, no_empleado=4101, anio=2026, dias_tomados=4)
    repo = HomeOfficeTomadosRepository(db)

    fila = await repo.get_by_no_empleado_anio(4101, 2026)

    assert fila is not None
    assert Decimal(str(fila.dias_tomados)) == Decimal("4")
    assert await repo.get_by_no_empleado_anio(4101, 2024) is None


@pytest.mark.asyncio
async def test_map_existentes_acota_por_anio_y_por_empleados(db):
    await make_homeoffice_tomados(db, no_empleado=4201, anio=2026, dias_tomados=1)
    await make_homeoffice_tomados(db, no_empleado=4202, anio=2026, dias_tomados=2)
    await make_homeoffice_tomados(db, no_empleado=4203, anio=2025, dias_tomados=9)
    repo = HomeOfficeTomadosRepository(db)

    mapa = await repo.map_existentes(2026, [4201, 4203])

    # 4202 no se pidió; 4203 solo tiene fila de 2025.
    assert set(mapa.keys()) == {4201}


@pytest.mark.asyncio
async def test_map_existentes_sin_empleados_devuelve_vacio_sin_consultar(db):
    await make_homeoffice_tomados(db, no_empleado=4301, anio=2026, dias_tomados=1)

    assert await HomeOfficeTomadosRepository(db).map_existentes(2026, []) == {}
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_homeoffice_tomados_cache.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.repositories.homeoffice_tomados_repository'`.

- [ ] **Step 3: Crear el repositorio**

Crear `app/repositories/homeoffice_tomados_repository.py`:

```python
"""Acceso a la caché de home office tomado en Bono (`levelup_homeoffice_tomados`).

La escribe solo el servicio de sincronización; el resto de la aplicación únicamente lee.
"""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.homeoffice_tomados import HomeOfficeTomados
from app.repositories.base import BaseRepository


class HomeOfficeTomadosRepository(BaseRepository[HomeOfficeTomados]):
    def __init__(self, db: AsyncSession):
        super().__init__(HomeOfficeTomados, db)

    async def get_by_no_empleado_anio(
        self, no_empleado: int, anio: int
    ) -> HomeOfficeTomados | None:
        result = await self.db.execute(
            select(HomeOfficeTomados).where(
                HomeOfficeTomados.no_empleado == int(no_empleado),
                HomeOfficeTomados.anio == int(anio),
            )
        )
        return result.scalar_one_or_none()

    async def map_existentes(
        self, anio: int, no_empleados: Sequence[int] | None = None
    ) -> dict[int, HomeOfficeTomados]:
        """Mapa `no_empleado` -> fila de ese año. Sin lista, todas las filas del año.

        El sync lo carga de una sola vez para decidir insert/update en memoria en lugar de
        hacer un SELECT por empleado.
        """
        query = select(HomeOfficeTomados).where(HomeOfficeTomados.anio == int(anio))
        if no_empleados is not None:
            ids = {int(n) for n in no_empleados}
            if not ids:
                return {}
            query = query.where(HomeOfficeTomados.no_empleado.in_(ids))
        result = await self.db.execute(query)
        return {int(fila.no_empleado): fila for fila in result.scalars().all()}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_homeoffice_tomados_cache.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/repositories/homeoffice_tomados_repository.py tests/test_homeoffice_tomados_cache.py
git commit -m "feat(solicitudes): repositorio de lectura de la cache de home office

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Servicio central de sincronización

**Files:**
- Create: `app/services/sync_homeoffice_tomados_service.py`
- Test: `tests/test_sync_homeoffice_tomados.py`

**Interfaces:**
- Consumes: `HomeOfficeTomados` (Task 1), `DatosAnalisisHomeOfficeReadRepository.get_dias_por_empleado` (Task 2), `HomeOfficeTomadosRepository` (Task 3).
- Produces:
  - `rango_anio(anio: int) -> tuple[date, date]`
  - `SyncHomeOfficeStats` (dataclass con `consultados: int`, `insertados: int`, `actualizados: int`, `omitidos: int`)
  - `sincronizar_homeoffice_tomados(db: AsyncSession, *, no_empleado: int | None = None, anio: int | None = None, origen: str = "scheduler", execute: bool = True) -> SyncHomeOfficeStats`
  - `sincronizar_homeoffice_empleado_background(no_empleado: int, solicitud_id: int | None = None) -> None`

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_sync_homeoffice_tomados.py`:

```python
"""Sincronización de home office: datos-analisis → `levelup_homeoffice_tomados`.

datos-analisis no existe en el entorno de tests: se mockea el motor y la consulta agregada
(`get_dias_por_empleado`), pero la escritura en Bono es real, así que estos tests cubren el
upsert, los contadores y la idempotencia contra la BD.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.models.homeoffice_tomados import HomeOfficeTomados
from app.services.sync_homeoffice_tomados_service import (
    rango_anio,
    sincronizar_homeoffice_empleado_background,
    sincronizar_homeoffice_tomados,
)
from tests.conftest import make_empleado, make_homeoffice_tomados

ANIO = 2026


def _mock_tress(monkeypatch, *, dias=None, side_effect=None):
    """Motor y repositorio de datos-analisis simulados."""
    engine = AsyncMock()
    engine.dispose = AsyncMock()
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: engine,
    )

    repo = AsyncMock()
    if side_effect is not None:
        repo.get_dias_por_empleado = AsyncMock(side_effect=side_effect)
    else:
        repo.get_dias_por_empleado = AsyncMock(return_value=dias or {})
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisHomeOfficeReadRepository",
        lambda _engine: repo,
    )
    return repo, engine


async def _fila(db, no_empleado: int, anio: int = ANIO):
    result = await db.execute(
        select(HomeOfficeTomados).where(
            HomeOfficeTomados.no_empleado == no_empleado,
            HomeOfficeTomados.anio == anio,
        )
    )
    return result.scalar_one_or_none()


def test_rango_anio_es_semiabierto():
    assert rango_anio(2026) == (date(2026, 1, 1), date(2027, 1, 1))


@pytest.mark.asyncio
async def test_inserta_empleado_sin_registro_previo(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-nuevo@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("3")})

    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert fila is not None
    assert Decimal(str(fila.dias_tomados)) == Decimal("3.00")
    assert (stats.consultados, stats.insertados, stats.actualizados, stats.omitidos) == (
        1, 1, 0, 0,
    )


@pytest.mark.asyncio
async def test_actualiza_empleado_con_registro_existente(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-upd@test")
    await make_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, dias_tomados=1
    )
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("5")})

    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert Decimal(str(fila.dias_tomados)) == Decimal("5.00")
    assert (stats.insertados, stats.actualizados, stats.omitidos) == (0, 1, 0)


@pytest.mark.asyncio
async def test_empleado_sin_home_office_se_guarda_como_cero(db, monkeypatch):
    """Sin filas en dbo.PERMISO el empleado tomó 0 días: es un dato, no una ausencia."""
    emp = await make_empleado(db, email="ho-sync-cero@test")
    _mock_tress(monkeypatch, dias={})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    fila = await _fila(db, emp.no_empleado)
    assert fila is not None
    assert Decimal(str(fila.dias_tomados)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_es_idempotente_y_no_duplica(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-idem@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("2")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )
    stats = await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    result = await db.execute(
        select(HomeOfficeTomados).where(
            HomeOfficeTomados.no_empleado == emp.no_empleado,
            HomeOfficeTomados.anio == ANIO,
        )
    )
    assert len(result.scalars().all()) == 1
    # Sin cambios: se cuenta como omitido, no como actualizado.
    assert (stats.insertados, stats.actualizados, stats.omitidos) == (0, 0, 1)


@pytest.mark.asyncio
async def test_la_corrida_masiva_cubre_a_los_activos(db, monkeypatch):
    uno = await make_empleado(db, email="ho-sync-masivo-1@test")
    dos = await make_empleado(db, email="ho-sync-masivo-2@test")
    _mock_tress(monkeypatch, dias={uno.no_empleado: Decimal("4")})

    stats = await sincronizar_homeoffice_tomados(db, anio=ANIO, origen="scheduler")

    assert stats.consultados >= 2
    assert Decimal(str((await _fila(db, uno.no_empleado)).dias_tomados)) == Decimal("4.00")
    # El que no aparece en TRESS también queda escrito, con cero.
    assert Decimal(str((await _fila(db, dos.no_empleado)).dias_tomados)) == Decimal("0.00")


@pytest.mark.asyncio
async def test_solo_toca_el_anio_pedido(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-anio@test")
    await make_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=2025, dias_tomados=12
    )
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("1")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    assert Decimal(str((await _fila(db, emp.no_empleado, 2025)).dias_tomados)) == Decimal("12.00")
    assert Decimal(str((await _fila(db, emp.no_empleado, ANIO)).dias_tomados)) == Decimal("1.00")


@pytest.mark.asyncio
async def test_pide_a_tress_el_rango_del_anio(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-rango@test")
    repo, _ = _mock_tress(monkeypatch, dias={})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
    )

    kwargs = repo.get_dias_por_empleado.await_args.kwargs
    assert kwargs["desde"] == date(ANIO, 1, 1)
    assert kwargs["hasta"] == date(ANIO + 1, 1, 1)


@pytest.mark.asyncio
async def test_dry_run_no_persiste(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-dry@test")
    _mock_tress(monkeypatch, dias={emp.no_empleado: Decimal("7")})

    await sincronizar_homeoffice_tomados(
        db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual", execute=False
    )

    assert await _fila(db, emp.no_empleado) is None


@pytest.mark.asyncio
async def test_sin_datos_analisis_configurada_levanta_connection_error(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-sinconf@test")
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service."
        "DatosAnalisisReadClient.create_read_engine",
        lambda: None,
    )

    with pytest.raises(ConnectionError):
        await sincronizar_homeoffice_tomados(
            db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
        )

    assert await _fila(db, emp.no_empleado) is None


@pytest.mark.asyncio
async def test_error_de_consulta_no_escribe_nada(db, monkeypatch):
    emp = await make_empleado(db, email="ho-sync-boom@test")
    _, engine = _mock_tress(
        monkeypatch, side_effect=OperationalError("stmt", {}, Exception("boom"))
    )

    with pytest.raises(ConnectionError):
        await sincronizar_homeoffice_tomados(
            db, no_empleado=emp.no_empleado, anio=ANIO, origen="manual"
        )

    assert await _fila(db, emp.no_empleado) is None
    # El motor se libera aunque la consulta falle.
    engine.dispose.assert_awaited()


@pytest.mark.asyncio
async def test_el_sync_de_fondo_nunca_propaga(monkeypatch):
    """La aprobación ya está confirmada: un fallo aquí se registra, no revienta."""
    fallo = AsyncMock(side_effect=RuntimeError("boom"))
    monkeypatch.setattr(
        "app.services.sync_homeoffice_tomados_service.sincronizar_homeoffice_tomados",
        fallo,
    )

    await sincronizar_homeoffice_empleado_background(12345, solicitud_id=7)
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_sync_homeoffice_tomados.py -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.services.sync_homeoffice_tomados_service'`.

- [ ] **Step 3: Escribir el servicio**

Crear `app/services/sync_homeoffice_tomados_service.py`:

```python
"""Sincroniza los días de home office tomados de DATOS_ANALISIS (TRESS) hacia Bono.

Escribe `levelup_homeoffice_tomados`, la **única** fuente que consulta el dashboard. Se
dispara desde tres lugares, todos contra esta misma función:

- el job diario de las 06:00 (`app/main.py`),
- la aprobación de una solicitud de home office (solo el empleado afectado),
- el CLI `python -m app.scripts.sync_homeoffice_tomados`.

Lee con **una sola** consulta agregada sobre `dbo.PERMISO` (`GROUP BY CB_CODIGO`) y recorta
en memoria. Por eso la corrida de un empleado y la de toda la plantilla comparten camino:
lo caro de esta integración es la conexión, no las filas.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.integrations.datos_analisis_db import DatosAnalisisReadClient
from app.models.homeoffice_tomados import HomeOfficeTomados
from app.repositories.datos_analisis_home_office_read_repository import (
    DatosAnalisisHomeOfficeReadRepository,
)
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.homeoffice_tomados_repository import HomeOfficeTomadosRepository

logger = logging.getLogger(__name__)

# Evita que dos corridas masivas se pisen (job diario + CLI). Mismo mecanismo que el sync
# de vacaciones. El sync de un solo empleado no lo toma: escribe una fila y es idempotente.
_sync_masivo_lock = asyncio.Lock()

_CERO = Decimal("0.00")


@dataclass
class SyncHomeOfficeStats:
    """Resultado de una corrida, para logs y para el resumen del CLI.

    Sin contador de errores: aquí hay una sola consulta a TRESS, así que un fallo aborta la
    corrida como excepción en vez de contarse por empleado.
    """

    consultados: int = 0
    insertados: int = 0
    actualizados: int = 0
    omitidos: int = 0


def rango_anio(anio: int) -> tuple[date, date]:
    """``[1-ene del año, 1-ene del siguiente)`` — rango semiabierto para la consulta."""
    return date(anio, 1, 1), date(anio + 1, 1, 1)


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _dec(valor: float | Decimal | None) -> Decimal:
    """Normaliza a 2 decimales para que la comparación con lo guardado no dé falsos cambios."""
    if valor is None:
        return _CERO
    return Decimal(str(valor)).quantize(Decimal("0.01"))


async def sincronizar_homeoffice_tomados(
    db: AsyncSession,
    *,
    no_empleado: int | None = None,
    anio: int | None = None,
    origen: str = "scheduler",
    execute: bool = True,
) -> SyncHomeOfficeStats:
    """Refresca la caché. Con `no_empleado`, solo ese empleado; si no, todos los activos.

    Levanta `ConnectionError` si datos-analisis no está configurada o no responde: en ese
    caso no se escribe nada.
    """
    anio = anio or date.today().year

    if no_empleado is not None:
        return await _sincronizar(
            db, [int(no_empleado)], anio=anio, origen=origen, execute=execute
        )

    # Solo la corrida masiva serializa: es la que puede solaparse consigo misma.
    async with _sync_masivo_lock:
        no_empleados = await EmpleadoRepository(db).list_no_empleados_activos(
            settings.ESTADOS_ACTIVOS_IDS
        )
        return await _sincronizar(
            db, no_empleados, anio=anio, origen=origen, execute=execute
        )


async def sincronizar_homeoffice_empleado_background(
    no_empleado: int, solicitud_id: int | None = None
) -> None:
    """Refresca el home office de un empleado tras aprobar su solicitud, con sesión propia.

    **Nunca levanta.** La aprobación ya está guardada cuando esto corre: si la
    sincronización falla, se registra el error y el dato se corrige en la corrida diaria de
    las 06:00. Revertir una aprobación por esto sería peor que una caché rancia.
    """
    from app.core.database import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            await sincronizar_homeoffice_tomados(
                db, no_empleado=no_empleado, origen="aprobacion"
            )
    except Exception:
        logger.exception(
            "Falló el sync de home office tras aprobación | no_empleado=%s | solicitud_id=%s",
            no_empleado,
            solicitud_id,
        )


async def _sincronizar(
    db: AsyncSession,
    no_empleados: list[int],
    *,
    anio: int,
    origen: str,
    execute: bool,
) -> SyncHomeOfficeStats:
    stats = SyncHomeOfficeStats()
    inicio = time.monotonic()
    alcance = (
        f"empleado={no_empleados[0]}"
        if len(no_empleados) == 1
        else f"activos={len(no_empleados)}"
    )
    logger.info(
        "Sync home office | inicio | origen=%s | anio=%d | %s | execute=%s",
        origen,
        anio,
        alcance,
        execute,
    )

    if not no_empleados:
        logger.info("Sync home office | fin | sin empleados que sincronizar")
        return stats

    try:
        engine = DatosAnalisisReadClient.create_read_engine()
    except Exception as exc:  # noqa: BLE001 — driver ausente o URL inválida
        raise ConnectionError(
            f"No se pudo crear el motor de datos-analisis: {type(exc).__name__}"
        ) from exc
    if engine is None:
        raise ConnectionError(
            "datos-analisis no está configurada; no se pueden sincronizar los días de "
            "home office."
        )

    desde, hasta = rango_anio(anio)
    try:
        dias_por_empleado = await DatosAnalisisHomeOfficeReadRepository(
            engine
        ).get_dias_por_empleado(desde=desde, hasta=hasta)
    except SQLAlchemyError as exc:
        logger.error(
            "Sync home office | error de lectura en datos-analisis | origen=%s | %s",
            origen,
            type(exc).__name__,
        )
        raise ConnectionError(
            f"Error al leer home office de datos-analisis: {type(exc).__name__}"
        ) from exc
    finally:
        await engine.dispose()

    existentes = await HomeOfficeTomadosRepository(db).map_existentes(anio, no_empleados)

    try:
        for numero in no_empleados:
            stats.consultados += 1
            _aplicar(
                existentes.get(numero),
                numero,
                anio,
                _dec(dias_por_empleado.get(numero)),
                db=db,
                stats=stats,
            )

        if execute:
            await db.commit()
        else:
            await db.rollback()
    except Exception:
        await db.rollback()
        raise

    logger.info(
        "Sync home office | fin | origen=%s | anio=%d | %s | consultados=%d | "
        "insertados=%d | actualizados=%d | omitidos=%d | duracion=%.2fs",
        origen,
        anio,
        alcance,
        stats.consultados,
        stats.insertados,
        stats.actualizados,
        stats.omitidos,
        time.monotonic() - inicio,
    )
    return stats


def _aplicar(
    fila: HomeOfficeTomados | None,
    no_empleado: int,
    anio: int,
    dias: Decimal,
    *,
    db: AsyncSession,
    stats: SyncHomeOfficeStats,
) -> None:
    """Inserta, actualiza o solo refresca la marca de tiempo de un empleado."""
    if fila is None:
        db.add(
            HomeOfficeTomados(
                no_empleado=no_empleado,
                anio=anio,
                dias_tomados=dias,
                actualizado_en=_ahora(),
            )
        )
        stats.insertados += 1
        return

    cambio = _dec(fila.dias_tomados) != dias
    fila.dias_tomados = dias
    # `actualizado_en` marca la última sincronización exitosa, cambien o no los días, para
    # poder distinguir «sin movimiento» de «caché rancia».
    fila.actualizado_en = _ahora()
    if cambio:
        stats.actualizados += 1
    else:
        stats.omitidos += 1
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_sync_homeoffice_tomados.py -v`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add app/services/sync_homeoffice_tomados_service.py tests/test_sync_homeoffice_tomados.py
git commit -m "feat(solicitudes): servicio de sincronizacion de home office tomado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: CLI de sincronización manual

**Files:**
- Create: `app/scripts/sync_homeoffice_tomados.py`
- Test: `tests/test_sync_homeoffice_tomados.py` (se añaden tests al archivo de la Task 4)

**Interfaces:**
- Consumes: `sincronizar_homeoffice_tomados`, `SyncHomeOfficeStats` (Task 4).
- Produces: `app.scripts.sync_homeoffice_tomados.main(argv: list[str] | None = None) -> int`.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `tests/test_sync_homeoffice_tomados.py`:

```python
def test_cli_es_dry_run_si_no_se_pasa_execute(monkeypatch):
    """Sin --execute el CLI no debe persistir: se comprueba el flag que arma `main`."""
    import app.scripts.sync_homeoffice_tomados as cli

    recibido = {}

    async def _fake_ejecutar(*, no_empleado, execute):
        recibido.update({"no_empleado": no_empleado, "execute": execute})
        return 0

    monkeypatch.setattr(cli, "ejecutar", _fake_ejecutar)

    assert cli.main([]) == 0
    assert recibido == {"no_empleado": None, "execute": False}


@pytest.mark.asyncio
async def test_cli_pasa_los_argumentos_al_servicio(monkeypatch, capsys):
    import app.scripts.sync_homeoffice_tomados as cli

    llamado = {}

    async def _fake_sync(db, *, no_empleado, origen, execute, anio=None):
        llamado.update(
            {"no_empleado": no_empleado, "origen": origen, "execute": execute}
        )
        from app.services.sync_homeoffice_tomados_service import SyncHomeOfficeStats

        return SyncHomeOfficeStats(consultados=1, insertados=1)

    monkeypatch.setattr(cli, "sincronizar_homeoffice_tomados", _fake_sync)

    codigo = await cli.ejecutar(no_empleado=553, execute=True)

    assert codigo == 0
    assert llamado == {"no_empleado": 553, "origen": "manual", "execute": True}
    salida = capsys.readouterr().out
    assert "EXECUTE" in salida
    assert "empleado 553" in salida
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_sync_homeoffice_tomados.py -k cli -v`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.scripts.sync_homeoffice_tomados'`.

- [ ] **Step 3: Escribir el CLI**

Crear `app/scripts/sync_homeoffice_tomados.py`:

```python
"""
Sincroniza los días de home office tomados de datos-analisis (TRESS) hacia Bono
(`levelup_homeoffice_tomados`).

Es la misma función que corre el job diario de las 06:00 y la aprobación de solicitudes.
Sirve para el backfill inicial —al desplegar, la tabla está vacía hasta la primera
corrida— y para forzar un refresco puntual.

Uso:
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --execute
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados \\
        --no-empleado 553 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_homeoffice_tomados_service import (
    SyncHomeOfficeStats,
    sincronizar_homeoffice_tomados,
)


def _print_stats(stats: SyncHomeOfficeStats, *, execute: bool, alcance: str) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync home office tomado → Bono [{modo}] ===")
    print(f"Alcance:      {alcance}")
    print(f"Consultados:  {stats.consultados}")
    print(f"Insertados:   {stats.insertados}")
    print(f"Actualizados: {stats.actualizados}")
    print(f"Omitidos:     {stats.omitidos}")


async def ejecutar(*, no_empleado: int | None, execute: bool) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen (un IN con cientos de binds impreso entero). Bajar el nivel del logger no
    # basta: `echo` emite sin consultarlo, así que se apaga en el engine.
    engine.echo = False

    alcance = f"empleado {no_empleado}" if no_empleado is not None else "empleados activos"
    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_homeoffice_tomados(
                db,
                no_empleado=no_empleado,
                origen="manual",
                execute=execute,
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1

    _print_stats(stats, execute=execute, alcance=alcance)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza los días de home office tomados de TRESS hacia "
            "levelup_homeoffice_tomados (Bono)."
        )
    )
    parser.add_argument(
        "--no-empleado",
        type=int,
        default=None,
        help="Sincronizar solo ese número de empleado. Sin el flag: todos los activos.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(ejecutar(no_empleado=args.no_empleado, execute=args.execute))


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_sync_homeoffice_tomados.py -v`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add app/scripts/sync_homeoffice_tomados.py tests/test_sync_homeoffice_tomados.py
git commit -m "feat(solicitudes): CLI de sincronizacion manual de home office

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Job diario a las 06:00

**Files:**
- Modify: `app/main.py` (nueva función `_sync_homeoffice_tomados_job` + registro en `registrar_jobs_programados`)
- Test: `tests/test_jobs_programados.py`

**Interfaces:**
- Consumes: `sincronizar_homeoffice_tomados` (Task 4).
- Produces: job APScheduler con id `sync_homeoffice_tomados`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_jobs_programados.py`:

```python
"""Jobs periódicos registrados en el scheduler (`registrar_jobs_programados`)."""

from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.main import registrar_jobs_programados


@pytest.fixture
async def scheduler():
    """Scheduler arrancado en pausa: sin `start()`, los jobs quedan pendientes y
    `get_job` no los ve."""
    sched = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    sched.start(paused=True)
    registrar_jobs_programados(sched)
    yield sched
    sched.shutdown(wait=False)


@pytest.mark.asyncio
async def test_el_sync_de_home_office_corre_a_las_seis(scheduler):
    job = scheduler.get_job("sync_homeoffice_tomados")
    assert job is not None
    trigger = str(job.trigger)
    assert "hour='6'" in trigger
    assert "minute='0'" in trigger
    # La zona horaria la fija el scheduler, no el job.
    assert settings.APP_TIMEZONE in trigger


@pytest.mark.asyncio
async def test_home_office_y_vacaciones_son_jobs_independientes(scheduler):
    """Comparten hora pero no proceso: un fallo de uno no debe impedir el otro."""
    assert scheduler.get_job("sync_vacaciones_disponibles") is not None
    assert scheduler.get_job("sync_homeoffice_tomados") is not None
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_jobs_programados.py -v`
Expected: FAIL — `test_el_sync_de_home_office_corre_a_las_seis` con `assert job is not None`.

- [ ] **Step 3: Registrar el job**

En `app/main.py`, añadir la función justo después de `_sync_vacaciones_disponibles_job`:

```python
async def _sync_homeoffice_tomados_job():
    """Refresca la caché de home office tomado desde DATOS_ANALISIS (diario, 06:00).

    Job aparte del de vacaciones aunque compartan hora: un fallo de uno no debe impedir el
    otro.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.services.sync_homeoffice_tomados_service import (
            sincronizar_homeoffice_tomados,
        )

        async with AsyncSessionLocal() as db:
            stats = await sincronizar_homeoffice_tomados(db, origen="scheduler")
        logger.info(
            "Sync home office job | consultados=%d | insertados=%d | actualizados=%d "
            "| omitidos=%d",
            stats.consultados,
            stats.insertados,
            stats.actualizados,
            stats.omitidos,
        )
    except Exception as exc:
        logger.error("Error en sync de home office job: %s", str(exc), exc_info=True)
```

Y en `registrar_jobs_programados`, después del bloque de `sync_vacaciones_disponibles`:

```python
    # Caché de home office tomado: una vez al día (06:00), antes de la jornada.
    sched.add_job(
        _sync_homeoffice_tomados_job,
        "cron",
        hour=6,
        minute=0,
        id="sync_homeoffice_tomados",
    )
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_jobs_programados.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/main.py tests/test_jobs_programados.py
git commit -m "feat(solicitudes): job diario 06:00 para la cache de home office

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Sincronizar al aprobar una solicitud de Home Office

**Files:**
- Modify: `app/services/solicitud_service.py` (import + bloque de BackgroundTask en `_aprobar_final_con_tress`, alrededor de la línea 1281)
- Modify: `tests/conftest.py` (mock del sync en el fixture `client`)
- Test: `tests/test_aprobar_home_office_sync.py`

**Interfaces:**
- Consumes: `sincronizar_homeoffice_empleado_background(no_empleado, solicitud_id)` (Task 4).
- Produces: nada nuevo para tareas posteriores.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_aprobar_home_office_sync.py`:

```python
"""Refresco de la caché de home office tras aprobar una solicitud.

El fixture `client` mockea `sincronizar_homeoffice_empleado_background` (necesitaría
datos-analisis); aquí se inspeccionan sus llamadas para comprobar CUÁNDO se dispara.
"""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.repositories.datos_analisis_home_office_write_repository import (
    InsertarHomeOfficeResult,
)
from tests.conftest import auth_headers, make_empleado, make_solicitud

APROBACION_PAYLOAD = {"accion": "approve", "nivel": 1, "comentario": "ok"}
RECHAZO_PAYLOAD = {"accion": "reject", "nivel": 1, "comentario": "no procede"}


@pytest.fixture
def sync_mock(monkeypatch):
    mock = AsyncMock(return_value=None)
    monkeypatch.setattr(
        "app.services.solicitud_service.sincronizar_homeoffice_empleado_background",
        mock,
    )
    return mock


@pytest.fixture
def tress_ok(monkeypatch):
    """El INSERT en dbo.PERMISO que precede a la aprobación, simulado con éxito."""
    registrar = AsyncMock(
        return_value=InsertarHomeOfficeResult(
            ok=True, codigo_error=None, mensaje="ok", nueva_llave=88
        )
    )
    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress", registrar
    )
    return registrar


async def _equipo(db, sufijo: str, *, no_empleado: int | None = None):
    supervisor = await make_empleado(
        db, rol="supervisor", email=f"ho-sync-sup-{sufijo}@test"
    )
    subordinado = await make_empleado(
        db,
        rol="empleado",
        email=f"ho-sync-sub-{sufijo}@test",
        lider_id=supervisor.empleado_id,
        no_empleado=no_empleado,
    )
    return supervisor, subordinado


async def _solicitud_home_office(db, empleado_id: int, estado: str = "pending"):
    return await make_solicitud(
        db,
        empleado_id=empleado_id,
        tipo="home_office",
        estado=estado,
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 15),
    )


@pytest.mark.asyncio
async def test_aprobar_dispara_el_sync_del_empleado(
    client: AsyncClient, db, sync_mock, tress_ok
):
    supervisor, subordinado = await _equipo(db, "ok", no_empleado=66611)
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["estado"] == "approved"
    # Solo el empleado de la solicitud, y con la solicitud para poder rastrear el log.
    sync_mock.assert_awaited_once_with(66611, solicitud.id)


@pytest.mark.asyncio
async def test_rechazar_no_dispara_el_sync(client: AsyncClient, db, sync_mock, tress_ok):
    supervisor, subordinado = await _equipo(db, "rej")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/reject",
        json=RECHAZO_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    assert res.json()["estado"] == "rejected"
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_cancelar_una_pendiente_no_dispara_el_sync(
    client: AsyncClient, db, sync_mock
):
    """Nunca llegó a dbo.PERMISO: no hay nada que recalcular."""
    _, subordinado = await _equipo(db, "can")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/cancel",
        headers=await auth_headers(client, subordinado),
    )

    assert res.status_code == 200
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_si_falla_el_insert_en_tress_no_se_sincroniza(
    client: AsyncClient, db, sync_mock, monkeypatch
):
    """Sin aprobación confirmada no hay nada que reflejar en la caché."""
    from app.core.exceptions import ServiceUnavailableError

    monkeypatch.setattr(
        "app.services.solicitud_service.registrar_home_office_en_tress",
        AsyncMock(side_effect=ServiceUnavailableError(detail="TRESS caido")),
    )
    supervisor, subordinado = await _equipo(db, "fallo")
    solicitud = await _solicitud_home_office(db, subordinado.id)

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code >= 400
    sync_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_aprobar_vacaciones_no_dispara_el_sync_de_home_office(
    client: AsyncClient, db, sync_mock
):
    supervisor, subordinado = await _equipo(db, "vac")
    solicitud = await make_solicitud(
        db,
        empleado_id=subordinado.id,
        tipo="vacaciones",
        estado="pending",
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
    )

    res = await client.put(
        f"/api/v1/solicitudes/{solicitud.id}/approve",
        json=APROBACION_PAYLOAD,
        headers=await auth_headers(client, supervisor),
    )

    assert res.status_code == 200
    sync_mock.assert_not_awaited()
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `docker-compose run --rm test pytest tests/test_aprobar_home_office_sync.py -v`
Expected: FAIL con `AttributeError: <module 'app.services.solicitud_service'> does not have the attribute 'sincronizar_homeoffice_empleado_background'`.

- [ ] **Step 3: Disparar el sync en la aprobación**

En `app/services/solicitud_service.py`, junto al import ya existente de
`sincronizar_vacaciones_empleado_background` (alrededor de la línea 78), añadir:

```python
from app.services.sync_homeoffice_tomados_service import (
    sincronizar_homeoffice_empleado_background,
)
```

Y en `_aprobar_final_con_tress`, sustituir el bloque que hoy dice:

```python
        if solicitud.tipo == "vacaciones":
            background_tasks.add_task(
                sincronizar_vacaciones_empleado_background,
                int(no_empleado_solicitante),
            )
```

por:

```python
        if solicitud.tipo == "vacaciones":
            background_tasks.add_task(
                sincronizar_vacaciones_empleado_background,
                int(no_empleado_solicitante),
            )
        elif solicitud.tipo == "home_office":
            background_tasks.add_task(
                sincronizar_homeoffice_empleado_background,
                int(no_empleado_solicitante),
                solicitud_id,
            )
```

El comentario que ya precede a ese bloque explica por qué va en BackgroundTask (Starlette
las corre después de la respuesta, o sea después del commit de `get_db`). Ampliarlo para
que nombre también el home office:

```python
        # Vacaciones y home office aprobados: TRESS ya cambió, así que hay que refrescar la
        # caché de Bono de la que leen dashboards y formularios. Va en BackgroundTask
        # porque Starlette las ejecuta DESPUÉS de la respuesta, es decir después del commit
        # de `get_db`: nunca se sincroniza sobre una aprobación no confirmada, y un fallo
        # aquí no revierte nada (se corrige en la corrida diaria).
```

- [ ] **Step 4: Mockear el sync en el fixture `client`**

En `tests/conftest.py`, dentro del `with (...)` del fixture `client`, añadir un patch más
junto al de `sincronizar_vacaciones_empleado_background`:

```python
        patch(
            "app.services.solicitud_service.sincronizar_homeoffice_empleado_background",
            new_callable=AsyncMock,
            return_value=None,
        ),
```

Y añadir la línea correspondiente al docstring del fixture, después de la de
`sincronizar_vacaciones_empleado_background`:

```
      - sincronizar_homeoffice_empleado_background: el refresco de la cache tras aprobar
        home office, que necesitaria datos-analisis. Los tests de ese flujo comprueban las
        llamadas a este mock.
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `docker-compose run --rm test pytest tests/test_aprobar_home_office_sync.py -v`
Expected: PASS (5 tests).

- [ ] **Step 6: Verificar que no se rompió el flujo de aprobación existente**

Run:
```bash
docker-compose run --rm test pytest tests/test_aprobar_home_office_tress_insert.py tests/test_aprobar_vacaciones_sync.py -v
```
Expected: PASS, sin fallos nuevos.

- [ ] **Step 7: Commit**

```bash
git add app/services/solicitud_service.py tests/conftest.py tests/test_aprobar_home_office_sync.py
git commit -m "feat(solicitudes): refrescar la cache de home office al aprobar la solicitud

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: El dashboard lee de Bono y se retira la lectura directa

**Files:**
- Modify: `app/services/dashboard_kpis_service.py`
- Modify: `app/repositories/datos_analisis_home_office_read_repository.py` (eliminar `get_dias_en_rango`, `load_home_office_dias_sql` y `_SQL_FILE`)
- Delete: `app/repositories/sql/datos_analisis_home_office_dias.sql`
- Modify: `tests/test_dashboard_kpis.py`

**Interfaces:**
- Consumes: `HomeOfficeTomadosRepository.get_by_no_empleado_anio` (Task 3), `make_homeoffice_tomados` (Task 1).
- Produces: nada nuevo. `DashboardKpisResponse` no cambia.

- [ ] **Step 1: Reescribir los tests del dashboard**

En `tests/test_dashboard_kpis.py`:

1. Actualizar el docstring del módulo:

```python
"""KPIs de nómina del dashboard (`GET /api/v1/dashboard/mis-kpis`).

Vacaciones y home office salen de sus cachés en Bono (`levelup_vacaciones_disponibles` y
`levelup_homeoffice_tomados`): los tests siembran las filas reales, sin mocks, porque el
endpoint ya no consulta datos-analisis para nada.
"""
```

2. Sustituir los imports de la cabecera por:

```python
from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.repositories.datos_analisis_vacaciones_repository import load_kpis_ciclo_sql
from tests.conftest import (
    auth_headers,
    make_empleado,
    make_homeoffice_tomados,
    make_vacaciones_disponibles,
)
```

3. Borrar la función `_mock_home_office` completa y sustituirla por:

```python
async def _sembrar_home_office(db, no_empleado: int, dias: int = 3):
    return await make_homeoffice_tomados(
        db, no_empleado=no_empleado, anio=date.today().year, dias_tomados=dias
    )
```

4. Borrar estos tests, que cubrían la consulta directa a SQL Server (su equivalente vive
   ahora en `tests/test_datos_analisis_home_office_read.py` y
   `tests/test_sync_homeoffice_tomados.py`):
   - `test_sql_home_office_expone_sus_tres_binds`
   - `test_sql_home_office_filtra_solo_el_tipo_ho`
   - `test_rango_anio_en_curso_es_semiabierto`
   - `test_home_office_se_pide_por_el_anio_en_curso`
   - `test_si_el_home_office_falla_el_dashboard_sigue_cargando`

5. En los tests que quedan, sustituir cada llamada `_mock_home_office(monkeypatch)` por
   `await _sembrar_home_office(db, emp.no_empleado)` (después de crear `emp`), y quitar el
   parámetro `monkeypatch` de las firmas que dejen de usarlo. Concretamente:
   - `test_devuelve_los_kpis_del_ciclo_vigente`
   - `test_consulta_por_el_numero_del_usuario_autenticado` — quitar además las dos
     aserciones sobre `ho_repo.get_dias_en_rango`
   - `test_empleado_sin_periodos_en_tress` — sembrar con `dias=0`
   - `test_empleado_sin_sincronizar_degrada`
   - `test_es_autoservicio_para_los_tres_roles` — sembrar dentro del bucle

6. Sustituir `test_las_vacaciones_no_consultan_datos_analisis` por este, que ahora cubre
   ambos datos:

```python
@pytest.mark.asyncio
async def test_ningun_kpi_consulta_datos_analisis(client: AsyncClient, db, monkeypatch):
    """Si el endpoint intentara abrir un motor a datos-analisis, este test lo delataría."""
    def _prohibido(*args, **kwargs):
        raise AssertionError("El dashboard no debe abrir conexiones a datos-analisis")

    monkeypatch.setattr(
        "app.integrations.datos_analisis_db.DatosAnalisisReadClient.create_read_engine",
        _prohibido,
    )
    emp = await make_empleado(db, rol="empleado", email="kpis-sin-tress@test")
    await _sembrar_ciclo(db, emp.no_empleado)
    await _sembrar_home_office(db, emp.no_empleado, dias=2)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["disponible"] is True
    assert body["vacaciones_disponibles"] == 8.0
    assert body["home_office_dias_anio"] == 2
```

7. Añadir el caso del empleado sin fila de home office:

```python
@pytest.mark.asyncio
async def test_sin_fila_de_home_office_devuelve_cero(client: AsyncClient, db):
    """Sin filas 'HO' en TRESS el empleado tomó 0 días; no es un dato ausente."""
    emp = await make_empleado(db, rol="empleado", email="kpis-ho-cero@test")
    await _sembrar_ciclo(db, emp.no_empleado)

    body = (await client.get(URL, headers=await auth_headers(client, emp))).json()
    assert body["home_office_dias_anio"] == 0
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_dashboard_kpis.py -v`
Expected: FAIL — `test_ningun_kpi_consulta_datos_analisis` con el `AssertionError` del motor prohibido, y `test_sin_fila_de_home_office_devuelve_cero` con `home_office_dias_anio` en `None` en vez de `0`.

- [ ] **Step 3: Cambiar la fuente de lectura del dashboard**

Reescribir `app/services/dashboard_kpis_service.py` así (el cuerpo de `obtener_kpis_dashboard` solo cambia en las líneas marcadas):

```python
"""
KPIs personales de nómina para las tarjetas del dashboard (empleado, supervisor, gerente).

Todo sale de cachés en Bono, ninguna carga de página espera a DATOS_ANALISIS:

- Días disponibles y días tomados del ciclo, de `levelup_vacaciones_disponibles`
  (`dbo.GET_SALDOS_VACACION`). Ambas tarjetas vienen de la misma fila, así que no pueden
  contradecirse.
- Días de home office del año, de `levelup_homeoffice_tomados` (`dbo.PERMISO`, `PM_TIPO = 'HO'`).

**Degrada en vez de bloquear.** El resto de consumidores del saldo levanta 503 porque opera
sobre él (crear/validar solicitudes); un dashboard no puede romperse por eso, así que ante
un fallo devuelve ``disponible=False`` con los valores en ``None`` y la UI pinta «—».
"""

from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.homeoffice_tomados_repository import HomeOfficeTomadosRepository
from app.repositories.vacaciones_disponibles_repository import (
    VacacionesDisponiblesRepository,
)
from app.schemas.dashboard_kpis import DashboardKpisResponse

logger = logging.getLogger(__name__)


def _sin_datos(anio: int) -> DashboardKpisResponse:
    return DashboardKpisResponse(disponible=False, anio=anio)


async def _home_office_dias_anio(
    db: AsyncSession, *, no_empleado: int, anio: int
) -> int | None:
    """Días de home office del año, desde la caché de Bono.

    Sin fila ⇒ ``0``: el empleado no tiene home office registrado en TRESS, que es un dato,
    no una ausencia. ``None`` solo si la propia lectura de Bono falla.
    """
    try:
        fila = await HomeOfficeTomadosRepository(db).get_by_no_empleado_anio(
            no_empleado, anio
        )
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudieron leer los días de home office del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return None
    return int(fila.dias_tomados) if fila is not None else 0


async def obtener_kpis_dashboard(
    db: AsyncSession, *, no_empleado: int, hoy: date | None = None
) -> DashboardKpisResponse:
    """KPIs de un empleado. Nunca levanta: ante un fallo devuelve el payload degradado."""
    hoy = hoy or date.today()

    try:
        vacaciones = await VacacionesDisponiblesRepository(db).get_by_no_empleado(no_empleado)
    except Exception as exc:  # noqa: BLE001 — el dashboard degrada, no falla
        logger.warning(
            "No se pudo leer el saldo de vacaciones del empleado %s (%s)",
            no_empleado,
            type(exc).__name__,
        )
        return _sin_datos(hoy.year)

    if vacaciones is None:
        # Empleado aún no sincronizado: la UI pinta «—» en vez de un 0 engañoso.
        return _sin_datos(hoy.year)

    home_office = await _home_office_dias_anio(
        db, no_empleado=no_empleado, anio=hoy.year
    )

    def _num(valor) -> float | None:
        return float(valor) if valor is not None else None

    return DashboardKpisResponse(
        disponible=True,
        vacaciones_disponibles=_num(vacaciones.dias_disponibles),
        vacaciones_tomadas_ciclo=_num(vacaciones.tomados_ciclo),
        vacaciones_derecho_ciclo=_num(vacaciones.derecho_ciclo),
        ciclo_aniversario=vacaciones.aniversario,
        ciclo_vence=vacaciones.fecha_vence,
        home_office_dias_anio=home_office,
        anio=hoy.year,
    )
```

- [ ] **Step 4: Retirar la lectura directa que quedó sin consumidor**

En `app/repositories/datos_analisis_home_office_read_repository.py`, eliminar `_SQL_FILE`,
`load_home_office_dias_sql` y el método `get_dias_en_rango`, dejando solo la variante
agregada de la Task 2. Actualizar el docstring del módulo:

```python
"""
Lectura de días de home office desde SQL Server datos-analisis (motor separado).

Complementa a ``datos_analisis_home_office_write_repository`` (que inserta en
``dbo.PERMISO`` al aprobar una solicitud): aquí solo se consulta lo ya registrado, y solo
lo hace el sync que llena ``levelup_homeoffice_tomados`` — ninguna carga de página pasa por
aquí. La consulta vive en ``sql/datos_analisis_home_office_dias_por_empleado.sql``.
"""
```

Borrar el archivo:

```bash
git rm app/repositories/sql/datos_analisis_home_office_dias.sql
```

- [ ] **Step 5: Verificar que no quedan referencias al código retirado**

Run:
```bash
grep -rn "get_dias_en_rango\|load_home_office_dias_sql\|rango_anio_en_curso" --include="*.py" . | grep -v __pycache__
```
Expected: sin resultados.

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_dashboard_kpis.py -v`
Expected: PASS.

- [ ] **Step 7: Correr la suite completa**

Run: `docker-compose run --rm test`
Expected: sin fallos nuevos respecto al estado de `main`. Si algún test falla, comparar
contra `git stash && docker-compose run --rm test` antes de darlo por preexistente.

- [ ] **Step 8: Commit**

```bash
git add -A app/services/dashboard_kpis_service.py app/repositories tests/test_dashboard_kpis.py
git commit -m "feat(dashboard): leer los dias de home office desde la cache en Bono

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Documentación

**Files:**
- Modify: `CLAUDE.md`
- Test: ninguno (documentación).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Documentar el comando de sincronización manual**

En `CLAUDE.md`, en la sección `### Database / Migraciones`, justo después del bloque de
`sync_vacaciones_disponibles`, añadir:

```markdown
# Home office tomado: DATOS_ANALISIS → levelup_homeoffice_tomados (Bono).
# Mismo servicio que el job de las 06:00; necesario para el backfill inicial.
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados            # dry-run
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --execute
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --no-empleado 553 --execute
```

- [ ] **Step 2: Documentar la nueva caché en la sección de TRESS**

En `CLAUDE.md`, en `### TRESS / DATOS_ANALISIS (sin RPA)`, después de la viñeta
«**Saldo de vacaciones = caché en Bono.**», añadir:

```markdown
- **Home office tomado = caché en Bono.** Ninguna carga de página cuenta días de home
  office en DATOS_ANALISIS: la fuente única de lectura es `levelup_homeoffice_tomados`
  (una fila por empleado y año calendario), que escribe
  `sync_homeoffice_tomados_service` (job 06:00, aprobación de home office y
  `python -m app.scripts.sync_homeoffice_tomados`). La consulta a `dbo.PERMISO`
  (`PM_TIPO = 'HO'`) es una sola, agregada por `CB_CODIGO`, y solo la hace ese sync.
  Empleado sin fila ⇒ el dashboard muestra 0.
```

- [ ] **Step 3: Actualizar la viñeta de APScheduler**

En `CLAUDE.md`, en la sección `### Key Patterns`, dentro de la viñeta de APScheduler,
sustituir «**sync de saldos de vacaciones a las 06:00**» por:

```markdown
**sync de saldos de vacaciones y de home office tomado a las 06:00**, en dos jobs
independientes (`sync_vacaciones_disponibles` y `sync_homeoffice_tomados`)
```

- [ ] **Step 4: Verificar en el entorno real que el proceso quedó activo**

Estas comprobaciones son manuales, contra el backend levantado. Ejecutarlas y pegar la
salida en el PR:

```bash
# 1. La tabla existe con su unique
docker-compose exec backend alembic upgrade head
docker-compose exec backend python -c "
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as c:
        r = await c.execute(text(\"\"\"
            SELECT column_name, data_type FROM information_schema.columns
            WHERE table_name = 'levelup_homeoffice_tomados' ORDER BY ordinal_position
        \"\"\"))
        for fila in r: print(fila)
asyncio.run(main())
"

# 2. Backfill (primero dry-run)
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados
docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --execute

# 3. El job quedó registrado
docker-compose logs backend | grep -i "scheduler\|sync_homeoffice"

# 4. Los logs de una corrida
docker-compose logs backend | grep "Sync home office"

# 5. El dashboard responde sin tocar datos-analisis
curl -s -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/dashboard/mis-kpis
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documentar la cache de home office tomado y su sync diario

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final

- [ ] `docker-compose run --rm test` — suite completa sin fallos nuevos frente a `main`.
- [ ] `git diff main --stat` — revisar que no se tocó nada fuera de: modelo, migración, repos de home office, servicio de sync, CLI, `app/main.py`, el bloque de aprobación en `solicitud_service.py`, `dashboard_kpis_service.py`, conftest, tests y `CLAUDE.md`.
- [ ] Confirmar que `app/services/sync_vacaciones_disponibles_service.py`, `app/scripts/sync_vacaciones_disponibles.py` y `app/models/vacaciones_disponibles.py` **no** aparecen en el diff.
- [ ] Confirmar que `openapi.yaml` **no** aparece en el diff (el contrato no cambió).
- [ ] `grep -rn "get_dias_en_rango" --include="*.py" .` sin resultados.
- [ ] Ejecutar los pasos manuales de la Task 9 Step 4 y pegar la salida en el PR.
- [ ] Abrir PR contra `main` describiendo qué se hizo y cómo probarlo.
