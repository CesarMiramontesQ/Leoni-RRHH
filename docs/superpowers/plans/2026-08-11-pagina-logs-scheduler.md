# Página oculta de logs del scheduler — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en Bono cada corrida de los 11 jobs de APScheduler y exponerlas en una página solo-admin que no aparece en ningún menú.

**Architecture:** Un envoltorio alrededor de cada job inserta una fila `en_curso`, fija un `ContextVar` que hace que un `logging.Handler` copie las líneas que ese job emite, y al terminar cierra la fila con duración, resultado y líneas. El resultado se deduce del nivel máximo de log, no de una excepción, porque los 11 jobs atrapan la suya. La página lee esas filas por un router nuevo protegido con `require_admin_user`.

**Tech Stack:** FastAPI async, SQLAlchemy 2.0 (`Mapped`/`mapped_column`), Alembic, APScheduler, pytest+SQLite, TypeScript sin framework, vitest.

**Spec:** `docs/superpowers/specs/2026-08-11-pagina-logs-scheduler-design.md`

## Global Constraints

- Toda tabla nueva lleva prefijo `levelup_`. Está prohibido crear, alterar o borrar tablas sin ese prefijo.
- La migración solo puede hacer `create_table` / `drop_table` sobre `levelup_*`.
- Los tests se corren **siempre** con `docker-compose run --rm test`, nunca con `docker-compose exec backend pytest` (usa una imagen vieja y da fallos falsos).
- Admin = `require_admin_user` (flag BD `puede_administrar_permisos_rh`), **nunca** por rol.
- El frontend usa solo tokens de `frontend/src/ui/uiTokens.ts`. Nada de colores nuevos.
- `npm run build` **no** typechequea: el gate es `npm run typecheck`, y `main` arrastra **32 errores preexistentes**. El criterio es que el conteo no suba de 32, no que sea cero.
- Ningún paso puede modificar el comportamiento de los 11 jobs ni su logging a stdout.
- Al cambiar cualquier endpoint hay que actualizar `openapi.yaml`.
- Commits en Conventional Commits, en español, sin iniciales.
- Zona horaria de la app: `settings.APP_TIMEZONE` (`America/Mexico_City`). Las marcas de tiempo se **guardan en UTC** (`datetime.now(timezone.utc)`) y se formatean en el cliente.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `app/models/scheduler_job_log.py` | modelo `SchedulerJobLog` |
| `alembic/versions/s1c2h3e4d5j6_scheduler_job_log.py` | crea la tabla |
| `app/integrations/scheduler_job_log.py` | buffer, handler, clasificación, persistencia y envoltorio |
| `app/repositories/scheduler_job_log_repository.py` | consultas de la página |
| `app/schemas/scheduler_logs.py` | contratos de la API |
| `app/api/v1/scheduler_logs/router.py` | los tres endpoints |
| `frontend/src/api/schedulerLogs.ts` | cliente HTTP + tipos |
| `frontend/src/pages/schedulerLogs.ts` | la página |

---

### Task 1: Modelo y migración de `levelup_scheduler_job_log`

**Files:**
- Create: `app/models/scheduler_job_log.py`
- Create: `alembic/versions/s1c2h3e4d5j6_scheduler_job_log.py`
- Modify: `app/models/__init__.py` (agregar el import; es lo que registra la tabla en `Base.metadata`)
- Test: `tests/test_scheduler_job_log.py`

**Interfaces:**
- Consumes: nada.
- Produces: `SchedulerJobLog` con columnas `id, job_id, inicio_at, fin_at, duracion_ms, resultado, resumen, lineas, lineas_descartadas, error, created_at`. `resultado ∈ {en_curso, ok, advertencia, error}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_scheduler_job_log.py`:

```python
"""Historial de corridas de los jobs del scheduler: modelo, envoltorio y API."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.scheduler_job_log import SchedulerJobLog


@pytest.mark.asyncio
async def test_modelo_persiste_una_corrida_con_defaults(db):
    fila = SchedulerJobLog(
        job_id="sync_turnos_uso",
        inicio_at=datetime(2026, 8, 12, 10, 0, tzinfo=timezone.utc),
    )
    db.add(fila)
    await db.commit()

    guardada = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert guardada.job_id == "sync_turnos_uso"
    assert guardada.resultado == "en_curso"
    assert guardada.lineas == []
    assert guardada.lineas_descartadas == 0
    assert guardada.fin_at is None
    assert guardada.duracion_ms is None
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log.py -q
```

Esperado: FAIL con `ModuleNotFoundError: No module named 'app.models.scheduler_job_log'`.

- [ ] **Step 3: Crear el modelo**

`app/models/scheduler_job_log.py`:

```python
"""Historial de corridas de los jobs de APScheduler.

Una fila por ejecución. Se inserta como `en_curso` al arrancar el job y se cierra al
terminar: una fila que se queda en `en_curso` es la señal de que el proceso murió a
media corrida, no un bug del registro.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SchedulerJobLog(Base):
    __tablename__ = "levelup_scheduler_job_log"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    inicio_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fin_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duracion_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    resultado: Mapped[str] = mapped_column(
        Enum(
            "en_curso",
            "ok",
            "advertencia",
            "error",
            name="scheduler_job_resultado_enum",
        ),
        nullable=False,
        default="en_curso",
    )
    # Última línea INFO de la corrida (la del resumen con conteos). Se guarda aparte para
    # que el listado no tenga que traer `lineas`.
    resumen: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    lineas: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    lineas_descartadas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_levelup_scheduler_job_log_job_inicio", "job_id", "inicio_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<SchedulerJobLog id={self.id} job_id={self.job_id} "
            f"resultado={self.resultado}>"
        )
```

- [ ] **Step 4: Registrar el modelo en el paquete**

En `app/models/__init__.py`, junto a la línea que importa `BonoHistoricoImportLog`, agregar:

```python
from app.models.scheduler_job_log import SchedulerJobLog
```

Si el archivo tiene `__all__`, agregar `"SchedulerJobLog"` a la lista. Esto es lo que hace
que `Base.metadata` conozca la tabla en los tests (`tests/conftest.py` importa
`app.models.*`, lo que ejecuta el `__init__` del paquete).

- [ ] **Step 5: Correr el test y verificar que pasa**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log.py -q
```

Esperado: 1 passed. Si falla con `no such table`, el import del Step 4 no quedó.

- [ ] **Step 6: Crear la migración**

`alembic/versions/s1c2h3e4d5j6_scheduler_job_log.py`:

```python
"""levelup_scheduler_job_log — historial de corridas de los jobs de APScheduler

Una fila por ejecución de job: inicio, fin, duración, resultado y las líneas de log que
ese job emitió. La escribe el envoltorio de `registrar_jobs_programados`; la lee la
página `#/ajustes/scheduler-logs`.

Revision ID: s1c2h3e4d5j6
Revises: g1e2m3p4t5r6
Create Date: 2026-08-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.utils.migration_helpers import table_exists

revision: str = "s1c2h3e4d5j6"
down_revision: Union[str, None] = "g1e2m3p4t5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_scheduler_job_log"):
        return

    op.create_table(
        "levelup_scheduler_job_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("inicio_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fin_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duracion_ms", sa.Integer(), nullable=True),
        sa.Column(
            "resultado",
            sa.Enum(
                "en_curso",
                "ok",
                "advertencia",
                "error",
                name="scheduler_job_resultado_enum",
            ),
            nullable=False,
            server_default="en_curso",
        ),
        sa.Column("resumen", sa.Text(), nullable=True),
        sa.Column(
            "lineas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "lineas_descartadas", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_scheduler_job_log_job_id",
        "levelup_scheduler_job_log",
        ["job_id"],
    )
    op.create_index(
        "ix_levelup_scheduler_job_log_job_inicio",
        "levelup_scheduler_job_log",
        ["job_id", "inicio_at"],
    )


def downgrade() -> None:
    if not table_exists("levelup_scheduler_job_log"):
        return
    op.drop_index(
        "ix_levelup_scheduler_job_log_job_inicio",
        table_name="levelup_scheduler_job_log",
    )
    op.drop_index(
        "ix_levelup_scheduler_job_log_job_id", table_name="levelup_scheduler_job_log"
    )
    op.drop_table("levelup_scheduler_job_log")
    sa.Enum(name="scheduler_job_resultado_enum").drop(op.get_bind(), checkfirst=True)
```

- [ ] **Step 7: Verificar que la cadena de Alembic queda con un solo head**

```bash
docker-compose exec backend alembic heads
python3 scripts/check_alembic_heads.py
```

Esperado: `s1c2h3e4d5j6 (head)` y el checker en verde. Si aparecen dos heads, `down_revision` está mal.

- [ ] **Step 8: Commit**

```bash
git add app/models/scheduler_job_log.py app/models/__init__.py \
        alembic/versions/s1c2h3e4d5j6_scheduler_job_log.py tests/test_scheduler_job_log.py
git commit -m "feat(scheduler): agregar tabla levelup_scheduler_job_log"
```

---

### Task 2: Buffer de líneas, handler y clasificación del resultado

Toda la lógica pura, sin base de datos. Es lo que hace que un job que loguea ERROR sin
propagar quede registrado como fallo.

**Files:**
- Create: `app/integrations/scheduler_job_log.py`
- Test: `tests/test_scheduler_job_log_captura.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `MAX_LINEAS: int = 200`
  - `CorridaBuffer(job_id: str)` con `.lineas: list[dict]`, `.descartadas: int`, `.nivel_max: int`, `.agregar(record: logging.LogRecord) -> None`
  - `_CORRIDA: ContextVar[CorridaBuffer | None]`
  - `resultado_desde_nivel(nivel_max: int) -> str`
  - `resumen_desde_lineas(lineas: list[dict]) -> str | None`
  - `primer_error(lineas: list[dict]) -> str | None`
  - `CapturaCorridaHandler(logging.Handler)`
  - `instalar_captura_logs() -> None` (idempotente)

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_scheduler_job_log_captura.py`:

```python
"""Captura de líneas por corrida: buffer, handler y clasificación del resultado."""

import logging

from app.integrations.scheduler_job_log import (
    MAX_LINEAS,
    CapturaCorridaHandler,
    CorridaBuffer,
    _CORRIDA,
    primer_error,
    resultado_desde_nivel,
    resumen_desde_lineas,
)


def _record(nivel: int, mensaje: str) -> logging.LogRecord:
    return logging.LogRecord(
        name="app.main",
        level=nivel,
        pathname=__file__,
        lineno=1,
        msg=mensaje,
        args=(),
        exc_info=None,
    )


def test_buffer_guarda_nivel_y_mensaje_formateado():
    buf = CorridaBuffer(job_id="sync_turnos_uso")
    buf.agregar(_record(logging.INFO, "Sync turnos en uso job | insertados=3"))

    assert buf.lineas == [
        {
            "ts": buf.lineas[0]["ts"],
            "nivel": "INFO",
            "mensaje": "Sync turnos en uso job | insertados=3",
        }
    ]
    assert buf.nivel_max == logging.INFO
    assert buf.descartadas == 0


def test_buffer_corta_en_max_lineas_y_cuenta_las_descartadas():
    buf = CorridaBuffer(job_id="x")
    for i in range(MAX_LINEAS + 5):
        buf.agregar(_record(logging.INFO, f"linea {i}"))

    assert len(buf.lineas) == MAX_LINEAS
    assert buf.descartadas == 5
    # Se conservan las PRIMERAS: el arranque de un job dice más que su cola.
    assert buf.lineas[0]["mensaje"] == "linea 0"


def test_buffer_recuerda_el_nivel_maximo_aunque_despues_baje():
    buf = CorridaBuffer(job_id="x")
    buf.agregar(_record(logging.ERROR, "truena"))
    buf.agregar(_record(logging.INFO, "sigue"))

    assert buf.nivel_max == logging.ERROR


def test_resultado_desde_nivel():
    assert resultado_desde_nivel(logging.INFO) == "ok"
    assert resultado_desde_nivel(logging.DEBUG) == "ok"
    assert resultado_desde_nivel(logging.WARNING) == "advertencia"
    assert resultado_desde_nivel(logging.ERROR) == "error"
    assert resultado_desde_nivel(logging.CRITICAL) == "error"


def test_resumen_es_la_ultima_linea_info():
    lineas = [
        {"ts": "t", "nivel": "INFO", "mensaje": "arranca"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "algo falló"},
        {"ts": "t", "nivel": "INFO", "mensaje": "leidos=10 insertados=2"},
    ]
    assert resumen_desde_lineas(lineas) == "leidos=10 insertados=2"


def test_resumen_cae_a_la_primera_linea_si_no_hubo_info():
    lineas = [{"ts": "t", "nivel": "ERROR", "mensaje": "TRESS caído"}]
    assert resumen_desde_lineas(lineas) == "TRESS caído"
    assert resumen_desde_lineas([]) is None


def test_primer_error_devuelve_el_primer_mensaje_de_nivel_error():
    lineas = [
        {"ts": "t", "nivel": "INFO", "mensaje": "arranca"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "primero"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "segundo"},
    ]
    assert primer_error(lineas) == "primero"
    assert primer_error([{"ts": "t", "nivel": "INFO", "mensaje": "ok"}]) is None


def test_handler_ignora_records_cuando_no_hay_corrida_activa():
    handler = CapturaCorridaHandler()
    assert _CORRIDA.get() is None
    handler.emit(_record(logging.INFO, "fuera de corrida"))  # no debe reventar


def test_handler_escribe_en_el_buffer_de_la_corrida_activa():
    handler = CapturaCorridaHandler()
    buf = CorridaBuffer(job_id="sync_empleados_tress")
    token = _CORRIDA.set(buf)
    try:
        handler.emit(_record(logging.WARNING, "ojo"))
    finally:
        _CORRIDA.reset(token)

    assert buf.lineas[0]["mensaje"] == "ojo"
    assert buf.nivel_max == logging.WARNING
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log_captura.py -q
```

Esperado: FAIL con `ModuleNotFoundError: No module named 'app.integrations.scheduler_job_log'`.

- [ ] **Step 3: Implementar el módulo**

`app/integrations/scheduler_job_log.py`:

```python
"""Registro de corridas de los jobs del scheduler.

El envoltorio `con_registro` deja una fila por ejecución en `levelup_scheduler_job_log`.
Mientras el job corre, un `ContextVar` apunta al buffer de esa corrida y
`CapturaCorridaHandler` copia ahí las líneas que el job emite — los logs siguen saliendo
a stdout igual que siempre, esto solo las duplica.

Por qué se deduce el resultado del nivel de log y no de una excepción: los 11 jobs
atrapan la suya para no tumbar el scheduler y registran el fallo con `logger.error(...)`
sin propagar nada. Un listener de APScheduler los vería «ejecutados correctamente».
"""

from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Tope de líneas guardadas por corrida, para que un job hablador no infle la fila.
MAX_LINEAS = 200


@dataclass
class CorridaBuffer:
    """Líneas y nivel máximo de la corrida en curso."""

    job_id: str
    lineas: list[dict] = field(default_factory=list)
    descartadas: int = 0
    # Arranca en INFO: una corrida sin líneas es `ok`, no `advertencia`.
    nivel_max: int = logging.INFO

    def agregar(self, record: logging.LogRecord) -> None:
        if record.levelno > self.nivel_max:
            self.nivel_max = record.levelno
        if len(self.lineas) >= MAX_LINEAS:
            self.descartadas += 1
            return
        try:
            mensaje = record.getMessage()
        except Exception:  # noqa: BLE001 — un %-format roto no puede tumbar el job
            mensaje = str(record.msg)
        self.lineas.append(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "nivel": record.levelname,
                "mensaje": mensaje,
            }
        )


_CORRIDA: ContextVar[CorridaBuffer | None] = ContextVar(
    "scheduler_job_corrida", default=None
)


def resultado_desde_nivel(nivel_max: int) -> str:
    if nivel_max >= logging.ERROR:
        return "error"
    if nivel_max >= logging.WARNING:
        return "advertencia"
    return "ok"


def resumen_desde_lineas(lineas: list[dict]) -> str | None:
    """Última línea INFO — por convención de estos jobs, la que trae los conteos."""
    for linea in reversed(lineas):
        if linea.get("nivel") == "INFO":
            return linea.get("mensaje")
    return lineas[0].get("mensaje") if lineas else None


def primer_error(lineas: list[dict]) -> str | None:
    for linea in lineas:
        if linea.get("nivel") in ("ERROR", "CRITICAL"):
            return linea.get("mensaje")
    return None


class CapturaCorridaHandler(logging.Handler):
    """Copia al buffer de la corrida activa. Sin corrida activa, no hace nada."""

    def emit(self, record: logging.LogRecord) -> None:
        buffer = _CORRIDA.get()
        if buffer is None:
            return
        try:
            buffer.agregar(record)
        except Exception:  # noqa: BLE001 — registrar nunca puede romper al que loguea
            pass


_handler_instalado: CapturaCorridaHandler | None = None


def instalar_captura_logs() -> None:
    """Engancha el handler al logger raíz. Idempotente: llamarlo dos veces no duplica."""
    global _handler_instalado
    if _handler_instalado is not None:
        return
    handler = CapturaCorridaHandler()
    handler.setLevel(logging.INFO)
    logging.getLogger().addHandler(handler)
    _handler_instalado = handler
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log_captura.py -q
```

Esperado: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add app/integrations/scheduler_job_log.py tests/test_scheduler_job_log_captura.py
git commit -m "feat(scheduler): capturar por corrida las lineas de log de cada job"
```

---

### Task 3: Persistencia y envoltorio `con_registro`

**Files:**
- Modify: `app/integrations/scheduler_job_log.py`
- Test: `tests/test_scheduler_job_log.py` (agregar al archivo de la Task 1)

**Interfaces:**
- Consumes: `CorridaBuffer`, `_CORRIDA`, `resultado_desde_nivel`, `resumen_desde_lineas`, `primer_error`, `MAX_LINEAS` (Task 2); `SchedulerJobLog` (Task 1).
- Produces: `con_registro(fn: Callable[[], Awaitable[None]], job_id: str) -> Callable[[], Awaitable[None]]`. La función devuelta expone `.job_id` para poder afirmar en tests que un job quedó envuelto.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/test_scheduler_job_log.py`:

```python
import logging

from sqlalchemy import select

from app.integrations.scheduler_job_log import con_registro


@pytest.mark.asyncio
async def test_corrida_sin_incidentes_queda_ok_con_duracion(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").info("Sync X job | insertados=3")

    await con_registro(job, "job_ok")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.job_id == "job_ok"
    assert fila.resultado == "ok"
    assert fila.resumen == "Sync X job | insertados=3"
    assert fila.fin_at is not None
    assert fila.duracion_ms is not None and fila.duracion_ms >= 0
    assert fila.error is None
    assert [linea["mensaje"] for linea in fila.lineas] == ["Sync X job | insertados=3"]


@pytest.mark.asyncio
async def test_job_que_loguea_error_sin_propagar_queda_como_error(db, monkeypatch):
    """El caso real: los 11 wrappers atrapan su excepcion y solo loguean ERROR."""
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").error("Error en sync de turnos: TRESS caido")

    await con_registro(job, "job_con_error")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "error"
    assert fila.error == "Error en sync de turnos: TRESS caido"


@pytest.mark.asyncio
async def test_job_que_loguea_warning_queda_como_advertencia(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        logging.getLogger("app.main").warning("omitido: ya hay una sincronizacion")

    await con_registro(job, "job_advertencia")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "advertencia"


@pytest.mark.asyncio
async def test_excepcion_queda_registrada_y_se_relanza(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)

    async def job():
        raise RuntimeError("boom")

    with pytest.raises(RuntimeError):
        await con_registro(job, "job_explota")()

    fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
    assert fila.resultado == "error"
    assert fila.error == "RuntimeError: boom"
    assert fila.fin_at is not None


@pytest.mark.asyncio
async def test_la_fila_existe_como_en_curso_mientras_el_job_corre(db, monkeypatch):
    _usar_sesion_de_test(monkeypatch, db)
    vistas = {}

    async def job():
        fila = (await db.execute(select(SchedulerJobLog))).scalar_one()
        vistas["resultado"] = fila.resultado
        vistas["fin_at"] = fila.fin_at

    await con_registro(job, "job_en_curso")()

    assert vistas == {"resultado": "en_curso", "fin_at": None}


@pytest.mark.asyncio
async def test_dos_jobs_solapados_no_mezclan_sus_lineas(db, monkeypatch):
    import asyncio

    _usar_sesion_de_test(monkeypatch, db)
    log = logging.getLogger("app.main")

    async def job_a():
        log.info("soy A")
        await asyncio.sleep(0.01)
        log.info("A termina")

    async def job_b():
        await asyncio.sleep(0.005)
        log.info("soy B")

    await asyncio.gather(con_registro(job_a, "job_a")(), con_registro(job_b, "job_b")())

    filas = (await db.execute(select(SchedulerJobLog))).scalars().all()
    por_job = {f.job_id: [linea["mensaje"] for linea in f.lineas] for f in filas}
    assert por_job["job_a"] == ["soy A", "A termina"]
    assert por_job["job_b"] == ["soy B"]


@pytest.mark.asyncio
async def test_si_el_registro_falla_el_job_corre_igual(db, monkeypatch):
    """La pagina es diagnostico: no puede volverse un punto de falla para nomina."""
    _usar_sesion_de_test(monkeypatch, db)
    monkeypatch.setattr(
        "app.integrations.scheduler_job_log._insertar_en_curso",
        _falla("insert caido"),
    )
    corrio = {"si": False}

    async def job():
        corrio["si"] = True

    await con_registro(job, "job_sin_registro")()

    assert corrio["si"] is True
```

Y los dos helpers, al inicio del archivo después de los imports:

```python
def _usar_sesion_de_test(monkeypatch, db):
    """`AsyncSessionLocal` del modulo apunta a la sesion del fixture.

    El envoltorio abre su propia sesion en produccion; en tests reusamos la del fixture
    para poder leer lo que escribio sin lidiar con dos conexiones.
    """
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _sesion():
        yield db

    monkeypatch.setattr(
        "app.integrations.scheduler_job_log.AsyncSessionLocal", _sesion
    )


def _falla(mensaje: str):
    async def _boom(*args, **kwargs):
        raise RuntimeError(mensaje)

    return _boom
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log.py -q
```

Esperado: FAIL con `ImportError: cannot import name 'con_registro'`.

- [ ] **Step 3: Implementar la persistencia y el envoltorio**

Agregar a `app/integrations/scheduler_job_log.py` (los imports nuevos van arriba):

```python
from typing import Awaitable, Callable

from sqlalchemy import update

from app.core.database import AsyncSessionLocal
from app.models.scheduler_job_log import SchedulerJobLog


async def _insertar_en_curso(job_id: str, inicio: datetime) -> int | None:
    """Devuelve el id de la fila, o `None` si no se pudo registrar."""
    async with AsyncSessionLocal() as db:
        fila = SchedulerJobLog(job_id=job_id, inicio_at=inicio, resultado="en_curso")
        db.add(fila)
        await db.commit()
        await db.refresh(fila)
        return fila.id


async def _cerrar_corrida(
    fila_id: int,
    *,
    fin: datetime,
    duracion_ms: int,
    buffer: CorridaBuffer,
    error_excepcion: str | None,
) -> None:
    resultado = resultado_desde_nivel(buffer.nivel_max)
    error = error_excepcion or primer_error(buffer.lineas)
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(SchedulerJobLog)
            .where(SchedulerJobLog.id == fila_id)
            .values(
                fin_at=fin,
                duracion_ms=duracion_ms,
                resultado=resultado,
                resumen=resumen_desde_lineas(buffer.lineas),
                lineas=buffer.lineas,
                lineas_descartadas=buffer.descartadas,
                error=error,
            )
        )
        await db.commit()


def con_registro(
    fn: Callable[[], Awaitable[None]], job_id: str
) -> Callable[[], Awaitable[None]]:
    """Envuelve un job para dejar una fila por corrida.

    No cambia la semántica del job: si `fn` propaga, se registra y se re-lanza. Lo que
    nunca propaga es un fallo del registro — la página es diagnóstico y no puede
    convertirse en un punto de falla nuevo para nómina.
    """

    async def _job_registrado() -> None:
        inicio = datetime.now(timezone.utc)
        try:
            fila_id = await _insertar_en_curso(job_id, inicio)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "No se pudo registrar el inicio del job %s: %s", job_id, exc
            )
            fila_id = None

        buffer = CorridaBuffer(job_id=job_id)
        token = _CORRIDA.set(buffer)
        error_excepcion: str | None = None
        try:
            await fn()
        except BaseException as exc:
            error_excepcion = f"{type(exc).__name__}: {exc}"
            buffer.nivel_max = max(buffer.nivel_max, logging.ERROR)
            raise
        finally:
            # Se resetea ANTES de escribir: si el cierre loguea un warning, ese warning
            # ya no pertenece a la corrida y no debe entrar a su propio buffer.
            _CORRIDA.reset(token)
            fin = datetime.now(timezone.utc)
            if fila_id is not None:
                try:
                    await _cerrar_corrida(
                        fila_id,
                        fin=fin,
                        duracion_ms=int((fin - inicio).total_seconds() * 1000),
                        buffer=buffer,
                        error_excepcion=error_excepcion,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "No se pudo cerrar el registro del job %s: %s", job_id, exc
                    )

    _job_registrado.job_id = job_id  # type: ignore[attr-defined]
    _job_registrado.__name__ = f"registrado__{job_id}"
    return _job_registrado
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log.py tests/test_scheduler_job_log_captura.py -q
```

Esperado: 17 passed. Si `test_dos_jobs_solapados...` falla mezclando líneas, el
`ContextVar` se está fijando fuera de la corrutina envuelta.

- [ ] **Step 5: Commit**

```bash
git add app/integrations/scheduler_job_log.py tests/test_scheduler_job_log.py
git commit -m "feat(scheduler): registrar cada corrida de job en levelup_scheduler_job_log"
```

---

### Task 4: Cablear los 11 jobs y encender la captura

**Files:**
- Modify: `app/main.py` (`registrar_jobs_programados` y `lifespan`)
- Test: `tests/test_scheduler_jobs_registrados.py`

**Interfaces:**
- Consumes: `con_registro`, `instalar_captura_logs` (Tasks 2-3).
- Produces: los 11 jobs registrados con la misma `id` y el mismo cron que hoy, pero con la función envuelta.

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/test_scheduler_jobs_registrados.py`:

```python
"""Los 11 jobs conservan id y cron, y todos pasan por el registro de corridas."""

from zoneinfo import ZoneInfo

import pytest
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.main import registrar_jobs_programados

# id -> (day_of_week, hour, minute). `*` = todos los días.
CRONS_ESPERADOS = {
    "eval360_recordatorios": ("*", "8", "0"),
    "encuestas_rh_recordatorios": ("*", "8", "0"),
    "metas_recordatorios": ("*", "8", "0"),
    "sync_vacaciones_disponibles": ("*", "6", "0"),
    "sync_homeoffice_tomados": ("*", "6", "0"),
    "sync_turnos_catalogo": ("*", "3", "40"),
    "sync_turnos_uso": ("*", "4", "0"),
    "sync_empleados_tress": ("*", "4", "10"),
    "sync_turnos_empleados": ("*", "4", "20"),
    "sync_ausencias_fi_re": ("wed", "8", "30"),
    "sync_incidencias_tress": ("wed", "10", "0"),
}


@pytest.fixture
def sched() -> AsyncIOScheduler:
    s = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    registrar_jobs_programados(s)
    return s


def test_estan_los_once_jobs_con_su_cron(sched):
    jobs = {j.id: j for j in sched.get_jobs()}
    assert set(jobs) == set(CRONS_ESPERADOS)

    for job_id, (dow, hora, minuto) in CRONS_ESPERADOS.items():
        campos = {f.name: str(f) for f in jobs[job_id].trigger.fields}
        assert campos["day_of_week"] == dow, job_id
        assert campos["hour"] == hora, job_id
        assert campos["minute"] == minuto, job_id


def test_todos_los_jobs_pasan_por_el_registro_de_corridas(sched):
    for job in sched.get_jobs():
        assert getattr(job.func, "job_id", None) == job.id, job.id


def test_el_scheduler_usa_la_zona_de_la_app(sched):
    assert settings.APP_TIMEZONE == "America/Mexico_City"
    for job in sched.get_jobs():
        assert str(job.trigger.timezone) == "America/Mexico_City", job.id
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
docker-compose run --rm test pytest tests/test_scheduler_jobs_registrados.py -q
```

Esperado: `test_estan_los_once_jobs_con_su_cron` pasa (ya es el estado actual) y
`test_todos_los_jobs_pasan_por_el_registro_de_corridas` FALLA con
`assert None == 'eval360_recordatorios'`.

- [ ] **Step 3: Agregar el helper de registro en `app/main.py`**

Justo antes de `def registrar_jobs_programados(...)`:

```python
def _add_job_registrado(sched: AsyncIOScheduler, fn, job_id: str, **cron) -> None:
    """Registra un job envuelto para que su corrida quede en la BD.

    El envoltorio vive en `app.integrations.scheduler_job_log`; el import es local para
    no arrastrar modelos ni sesión al importar `app.main`.
    """
    from app.integrations.scheduler_job_log import con_registro

    sched.add_job(con_registro(fn, job_id), "cron", id=job_id, **cron)
```

- [ ] **Step 4: Reescribir las 11 llamadas**

Sustituir cada `sched.add_job(...)` por `_add_job_registrado(...)`, **conservando
comentarios, horas y `max_instances`**. Los 11 quedan así:

```python
    _add_job_registrado(sched, _eval360_recordatorios_job, "eval360_recordatorios", hour=8, minute=0)
    _add_job_registrado(sched, _encuestas_rh_recordatorios_job, "encuestas_rh_recordatorios", hour=8, minute=0)
    _add_job_registrado(sched, _metas_recordatorios_job, "metas_recordatorios", hour=8, minute=0)
    _add_job_registrado(sched, _sync_vacaciones_disponibles_job, "sync_vacaciones_disponibles", hour=6, minute=0)
    _add_job_registrado(sched, _sync_homeoffice_tomados_job, "sync_homeoffice_tomados", hour=6, minute=0)
    _add_job_registrado(sched, _sync_turnos_catalogo_job, "sync_turnos_catalogo", hour=3, minute=40)
    _add_job_registrado(sched, _sync_turnos_uso_job, "sync_turnos_uso", hour=4, minute=0)
    _add_job_registrado(sched, _sync_empleados_tress_job, "sync_empleados_tress", hour=4, minute=10)
    _add_job_registrado(sched, _sync_turnos_empleados_job, "sync_turnos_empleados", hour=4, minute=20)
    _add_job_registrado(sched, _sync_ausencias_fi_re_job, "sync_ausencias_fi_re", day_of_week="wed", hour=8, minute=30, max_instances=1)
    _add_job_registrado(sched, _sync_incidencias_tress_job, "sync_incidencias_tress", day_of_week="wed", hour=10, minute=0)
```

**No borrar los comentarios que ya explican cada horario** — van encima de su llamada,
igual que ahora.

- [ ] **Step 5: Encender la captura en el arranque**

En `lifespan`, en el bloque `# 2. APScheduler`, **antes** de `registrar_jobs_programados`:

```python
    from app.integrations.scheduler_job_log import instalar_captura_logs

    instalar_captura_logs()
    registrar_jobs_programados(scheduler)
    scheduler.start()
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_jobs_registrados.py tests/test_sync_ausencias_fi.py -q
```

Esperado: todo en verde. `test_sync_ausencias_fi.py` entra porque ya afirma sobre el
registro del job de los miércoles: si esa reescritura rompió algo, se ve ahí.

- [ ] **Step 7: Commit**

```bash
git add app/main.py tests/test_scheduler_jobs_registrados.py
git commit -m "feat(scheduler): registrar la corrida de los once jobs programados"
```

---

### Task 5: Repositorio y schemas

**Files:**
- Create: `app/repositories/scheduler_job_log_repository.py`
- Create: `app/schemas/scheduler_logs.py`
- Test: `tests/test_scheduler_job_log_repository.py`

**Interfaces:**
- Consumes: `SchedulerJobLog` (Task 1).
- Produces:
  - `SchedulerJobLogRepository(db)` con `listar(*, job_id, resultado, desde, hasta, page, page_size) -> tuple[list[SchedulerJobLog], int]` y `obtener(id) -> SchedulerJobLog | None`
  - Schemas `SchedulerLogItem`, `SchedulerLogDetalle`, `SchedulerLogPage`, `SchedulerJobsResponse`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_scheduler_job_log_repository.py`:

```python
"""Consultas del historial de corridas."""

from datetime import datetime, timezone

import pytest

from app.models.scheduler_job_log import SchedulerJobLog
from app.repositories.scheduler_job_log_repository import SchedulerJobLogRepository


async def _sembrar(db):
    filas = [
        SchedulerJobLog(
            job_id="sync_turnos_uso",
            inicio_at=datetime(2026, 8, 10, 10, 0, tzinfo=timezone.utc),
            resultado="ok",
            resumen="insertados=3",
        ),
        SchedulerJobLog(
            job_id="sync_turnos_uso",
            inicio_at=datetime(2026, 8, 11, 10, 0, tzinfo=timezone.utc),
            resultado="error",
            resumen="TRESS caido",
            error="TRESS caido",
        ),
        SchedulerJobLog(
            job_id="sync_ausencias_fi_re",
            inicio_at=datetime(2026, 8, 12, 14, 30, tzinfo=timezone.utc),
            resultado="ok",
            resumen="insertados=1",
        ),
    ]
    for fila in filas:
        db.add(fila)
    await db.commit()


@pytest.mark.asyncio
async def test_listar_devuelve_lo_mas_reciente_primero(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(page=1, page_size=10)

    assert total == 3
    assert [i.job_id for i in items] == [
        "sync_ausencias_fi_re",
        "sync_turnos_uso",
        "sync_turnos_uso",
    ]


@pytest.mark.asyncio
async def test_listar_filtra_por_job_y_por_resultado(db):
    await _sembrar(db)
    repo = SchedulerJobLogRepository(db)

    items, total = await repo.listar(job_id="sync_turnos_uso", page=1, page_size=10)
    assert total == 2

    items, total = await repo.listar(resultado="error", page=1, page_size=10)
    assert total == 1
    assert items[0].error == "TRESS caido"


@pytest.mark.asyncio
async def test_listar_filtra_por_rango_de_fechas(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(
        desde=datetime(2026, 8, 11, 0, 0, tzinfo=timezone.utc),
        hasta=datetime(2026, 8, 11, 23, 59, tzinfo=timezone.utc),
        page=1,
        page_size=10,
    )

    assert total == 1
    assert items[0].resultado == "error"


@pytest.mark.asyncio
async def test_listar_pagina(db):
    await _sembrar(db)

    items, total = await SchedulerJobLogRepository(db).listar(page=2, page_size=2)

    assert total == 3
    assert len(items) == 1


@pytest.mark.asyncio
async def test_obtener_devuelve_none_si_no_existe(db):
    await _sembrar(db)
    repo = SchedulerJobLogRepository(db)

    assert await repo.obtener(99999) is None
    assert (await repo.obtener(1)).job_id == "sync_turnos_uso"
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log_repository.py -q
```

Esperado: FAIL con `ModuleNotFoundError`.

- [ ] **Step 3: Implementar el repositorio**

`app/repositories/scheduler_job_log_repository.py`:

```python
"""Lecturas del historial de corridas de los jobs."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scheduler_job_log import SchedulerJobLog


class SchedulerJobLogRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    def _filtrado(self, stmt, *, job_id, resultado, desde, hasta):
        if job_id:
            stmt = stmt.where(SchedulerJobLog.job_id == job_id)
        if resultado:
            stmt = stmt.where(SchedulerJobLog.resultado == resultado)
        if desde:
            stmt = stmt.where(SchedulerJobLog.inicio_at >= desde)
        if hasta:
            stmt = stmt.where(SchedulerJobLog.inicio_at <= hasta)
        return stmt

    async def listar(
        self,
        *,
        job_id: str | None = None,
        resultado: str | None = None,
        desde: datetime | None = None,
        hasta: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[SchedulerJobLog], int]:
        filtros = {
            "job_id": job_id,
            "resultado": resultado,
            "desde": desde,
            "hasta": hasta,
        }
        total = await self.db.scalar(
            self._filtrado(
                select(func.count()).select_from(SchedulerJobLog), **filtros
            )
        )
        stmt = self._filtrado(select(SchedulerJobLog), **filtros)
        stmt = (
            stmt.order_by(SchedulerJobLog.inicio_at.desc(), SchedulerJobLog.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        items = (await self.db.execute(stmt)).scalars().all()
        return list(items), int(total or 0)

    async def obtener(self, log_id: int) -> SchedulerJobLog | None:
        return await self.db.get(SchedulerJobLog, log_id)
```

- [ ] **Step 4: Crear los schemas**

`app/schemas/scheduler_logs.py`:

```python
"""Contratos de la página de logs del scheduler."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchedulerLogItem(BaseModel):
    """Fila del listado. Sin `lineas`: eso solo va en el detalle."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: str
    inicio_at: datetime
    fin_at: datetime | None = None
    duracion_ms: int | None = None
    resultado: str
    resumen: str | None = None
    error: str | None = None


class SchedulerLogLinea(BaseModel):
    ts: str
    nivel: str
    mensaje: str


class SchedulerLogDetalle(SchedulerLogItem):
    lineas: list[SchedulerLogLinea] = []
    lineas_descartadas: int = 0


class SchedulerLogPage(BaseModel):
    items: list[SchedulerLogItem]
    total: int
    page: int
    page_size: int


class SchedulerJobsResponse(BaseModel):
    """Ids registrados en el scheduler vivo, para poblar el filtro."""

    items: list[str]
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_job_log_repository.py -q
```

Esperado: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add app/repositories/scheduler_job_log_repository.py app/schemas/scheduler_logs.py \
        tests/test_scheduler_job_log_repository.py
git commit -m "feat(scheduler): repositorio y schemas del historial de corridas"
```

---

### Task 6: Router `/api/v1/scheduler-logs`

**Files:**
- Create: `app/api/v1/scheduler_logs/__init__.py` (vacío)
- Create: `app/api/v1/scheduler_logs/router.py`
- Modify: `app/main.py` (import + `include_router`)
- Modify: `app/core/vista_rol_registry.py` (`VISTA_ROL_EXEMPT_API_PREFIXES`)
- Modify: `openapi.yaml`
- Test: `tests/test_scheduler_logs_api.py`

**Interfaces:**
- Consumes: `SchedulerJobLogRepository`, los schemas (Task 5), `require_admin_user`.
- Produces: `GET /api/v1/scheduler-logs`, `GET /api/v1/scheduler-logs/jobs`, `GET /api/v1/scheduler-logs/{log_id}`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/test_scheduler_logs_api.py`:

```python
"""API del historial de corridas: solo admin, listado liviano y detalle completo."""

from datetime import datetime, timezone

import pytest

from app.models.scheduler_job_log import SchedulerJobLog
from tests.conftest import auth_headers, make_empleado


async def _corrida(db, **kwargs):
    fila = SchedulerJobLog(
        job_id=kwargs.pop("job_id", "sync_turnos_uso"),
        inicio_at=kwargs.pop("inicio_at", datetime(2026, 8, 11, 10, 0, tzinfo=timezone.utc)),
        resultado=kwargs.pop("resultado", "ok"),
        resumen=kwargs.pop("resumen", "insertados=3"),
        lineas=kwargs.pop("lineas", [{"ts": "t", "nivel": "INFO", "mensaje": "insertados=3"}]),
        **kwargs,
    )
    db.add(fila)
    await db.commit()
    await db.refresh(fila)
    return fila


@pytest.mark.asyncio
async def test_no_admin_recibe_403_en_los_tres_endpoints(client, db):
    rh = await make_empleado(db, rol="rh", nombre="RH Sin Admin", no_empleado=7001)
    headers = await auth_headers(client, rh)
    fila = await _corrida(db)

    for url in (
        "/api/v1/scheduler-logs",
        "/api/v1/scheduler-logs/jobs",
        f"/api/v1/scheduler-logs/{fila.id}",
    ):
        res = await client.get(url, headers=headers)
        assert res.status_code == 403, url


@pytest.mark.asyncio
async def test_sin_token_responde_401(client, db):
    res = await client.get("/api/v1/scheduler-logs")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_lista_las_corridas_sin_lineas(client, db):
    admin = await make_empleado(
        db,
        rol="rh",
        nombre="Admin Logs",
        no_empleado=7002,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    await _corrida(db)

    res = await client.get("/api/v1/scheduler-logs", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["page"] == 1
    assert body["items"][0]["resumen"] == "insertados=3"
    assert "lineas" not in body["items"][0]


@pytest.mark.asyncio
async def test_admin_filtra_por_job_y_resultado(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin F", no_empleado=7003,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    await _corrida(db, job_id="sync_turnos_uso", resultado="ok")
    await _corrida(db, job_id="sync_incidencias_tress", resultado="error")

    res = await client.get(
        "/api/v1/scheduler-logs?job_id=sync_incidencias_tress&resultado=error",
        headers=headers,
    )

    assert res.status_code == 200
    assert res.json()["total"] == 1


@pytest.mark.asyncio
async def test_detalle_trae_las_lineas(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin D", no_empleado=7004,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)
    fila = await _corrida(db)

    res = await client.get(f"/api/v1/scheduler-logs/{fila.id}", headers=headers)

    assert res.status_code == 200
    assert res.json()["lineas"] == [
        {"ts": "t", "nivel": "INFO", "mensaje": "insertados=3"}
    ]


@pytest.mark.asyncio
async def test_detalle_inexistente_responde_404(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin 404", no_empleado=7005,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)

    res = await client.get("/api/v1/scheduler-logs/99999", headers=headers)

    assert res.status_code == 404


@pytest.mark.asyncio
async def test_jobs_devuelve_los_ids_registrados(client, db):
    admin = await make_empleado(
        db, rol="rh", nombre="Admin J", no_empleado=7006,
        puede_administrar_permisos_rh=True,
    )
    headers = await auth_headers(client, admin)

    res = await client.get("/api/v1/scheduler-logs/jobs", headers=headers)

    assert res.status_code == 200
    items = res.json()["items"]
    assert "sync_ausencias_fi_re" in items
    assert len(items) == 11
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_logs_api.py -q
```

Esperado: 404 en todos (el router no existe).

- [ ] **Step 3: Implementar el router**

`app/api/v1/scheduler_logs/__init__.py` vacío, y `app/api/v1/scheduler_logs/router.py`:

```python
"""Historial de corridas del scheduler. Página oculta `#/ajustes/scheduler-logs`.

Solo admin (`require_admin_user`). No hay endpoint para ejecutar ni relanzar un job:
eso sigue siendo por CLI.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin_user
from app.models.empleados import Empleado
from app.repositories.scheduler_job_log_repository import SchedulerJobLogRepository
from app.schemas.scheduler_logs import (
    SchedulerJobsResponse,
    SchedulerLogDetalle,
    SchedulerLogPage,
)

router = APIRouter(prefix="/api/v1/scheduler-logs", tags=["Scheduler"])


@router.get("", response_model=SchedulerLogPage, summary="Historial de corridas")
async def listar_corridas(
    job_id: str | None = Query(None),
    resultado: str | None = Query(
        None, description="en_curso | ok | advertencia | error"
    ),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    items, total = await SchedulerJobLogRepository(db).listar(
        job_id=job_id,
        resultado=resultado,
        desde=desde,
        hasta=hasta,
        page=page,
        page_size=page_size,
    )
    return SchedulerLogPage(
        items=items, total=total, page=page, page_size=page_size
    )


@router.get(
    "/jobs",
    response_model=SchedulerJobsResponse,
    summary="Ids de los jobs registrados",
)
async def listar_jobs(
    current_user: Empleado = Depends(require_admin_user),
):
    """Ids que registra `registrar_jobs_programados`.

    Se calculan sobre un scheduler efímero en vez de leer el vivo: el listado no depende
    de que el scheduler esté corriendo (en tests no lo está) y da el mismo resultado. Un
    job recién agregado aparece en el filtro aunque todavía no haya corrido nunca.
    """
    _ = current_user
    from zoneinfo import ZoneInfo

    from apscheduler.schedulers.asyncio import AsyncIOScheduler

    from app.core.config import settings
    from app.main import registrar_jobs_programados

    temporal = AsyncIOScheduler(timezone=ZoneInfo(settings.APP_TIMEZONE))
    registrar_jobs_programados(temporal)
    return SchedulerJobsResponse(items=sorted(j.id for j in temporal.get_jobs()))


@router.get("/{log_id}", response_model=SchedulerLogDetalle, summary="Detalle")
async def obtener_corrida(
    log_id: int,
    current_user: Empleado = Depends(require_admin_user),
    db: AsyncSession = Depends(get_db),
):
    _ = current_user
    fila = await SchedulerJobLogRepository(db).obtener(log_id)
    if fila is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Corrida no encontrada."
        )
    return fila
```

**Ojo con el orden de las rutas:** `/jobs` va declarado **antes** que `/{log_id}`, o
FastAPI intentará convertir `"jobs"` a `int` y responderá 422.

- [ ] **Step 4: Montar el router**

En `app/main.py`, junto a los demás imports de routers:

```python
from app.api.v1.scheduler_logs.router import router as scheduler_logs_router
```

y junto a los `include_router`:

```python
app.include_router(scheduler_logs_router)
```

- [ ] **Step 5: Eximir el prefijo del gate de vistas por rol**

En `app/core/vista_rol_registry.py`, en `VISTA_ROL_EXEMPT_API_PREFIXES`:

```python
VISTA_ROL_EXEMPT_API_PREFIXES: tuple[str, ...] = RH_MODULE_EXEMPT_API_PREFIXES + (
    "/api/v1/vistas-rol",
    # Diagnóstico solo-admin: que nadie pueda apagar por accidente la única pantalla
    # que dice si los jobs corrieron.
    "/api/v1/scheduler-logs",
    "/api/v1/horas-extra",
)
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

```bash
docker-compose run --rm test pytest tests/test_scheduler_logs_api.py -q
```

Esperado: 7 passed.

- [ ] **Step 7: Actualizar `openapi.yaml`**

En `components.schemas`, agregar (respetando la indentación de cuatro espacios del archivo):

```yaml
    SchedulerLogItem:
      type: object
      required: [id, job_id, inicio_at, resultado]
      properties:
        id:
          type: integer
        job_id:
          type: string
        inicio_at:
          type: string
          format: date-time
        fin_at:
          type: [string, "null"]
          format: date-time
        duracion_ms:
          type: [integer, "null"]
        resultado:
          type: string
          enum: [en_curso, ok, advertencia, error]
        resumen:
          type: [string, "null"]
        error:
          type: [string, "null"]

    SchedulerLogLinea:
      type: object
      required: [ts, nivel, mensaje]
      properties:
        ts:
          type: string
        nivel:
          type: string
        mensaje:
          type: string

    SchedulerLogDetalle:
      allOf:
        - $ref: "#/components/schemas/SchedulerLogItem"
        - type: object
          properties:
            lineas:
              type: array
              items:
                $ref: "#/components/schemas/SchedulerLogLinea"
            lineas_descartadas:
              type: integer

    SchedulerLogPage:
      type: object
      required: [items, total, page, page_size]
      properties:
        items:
          type: array
          items:
            $ref: "#/components/schemas/SchedulerLogItem"
        total:
          type: integer
        page:
          type: integer
        page_size:
          type: integer

    SchedulerJobsResponse:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            type: string
```

Y en `paths`, al final del archivo (respetando la indentación de dos espacios):

```yaml
  # ── Scheduler (pagina oculta solo-admin) ───────────
  /api/v1/scheduler-logs:
    get:
      tags: [Scheduler]
      summary: Historial de corridas de los jobs
      description: >
        Una fila por ejecucion de job. Solo admin
        (`puede_administrar_permisos_rh`); el resto recibe 403.
        No devuelve las lineas: para eso esta el detalle.
      operationId: scheduler_logs_list
      security:
        - BearerAuth: []
      parameters:
        - name: job_id
          in: query
          schema:
            type: string
        - name: resultado
          in: query
          schema:
            type: string
            enum: [en_curso, ok, advertencia, error]
        - name: desde
          in: query
          schema:
            type: string
            format: date-time
        - name: hasta
          in: query
          schema:
            type: string
            format: date-time
        - name: page
          in: query
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: page_size
          in: query
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
      responses:
        "200":
          description: Pagina de corridas
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SchedulerLogPage"
        "403":
          description: No eres administrador

  /api/v1/scheduler-logs/jobs:
    get:
      tags: [Scheduler]
      summary: Ids de los jobs registrados
      operationId: scheduler_logs_jobs
      security:
        - BearerAuth: []
      responses:
        "200":
          description: Ids registrados en el scheduler
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SchedulerJobsResponse"
        "403":
          description: No eres administrador

  /api/v1/scheduler-logs/{log_id}:
    get:
      tags: [Scheduler]
      summary: Detalle de una corrida
      operationId: scheduler_logs_detail
      security:
        - BearerAuth: []
      parameters:
        - name: log_id
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Corrida con sus lineas de log
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SchedulerLogDetalle"
        "403":
          description: No eres administrador
        "404":
          description: Corrida no encontrada
```

Verificar que sigue siendo YAML válido:

```bash
python3 -c "import yaml; yaml.safe_load(open('openapi.yaml')); print('YAML OK')"
```

- [ ] **Step 8: Commit**

```bash
git add app/api/v1/scheduler_logs app/main.py app/core/vista_rol_registry.py \
        openapi.yaml tests/test_scheduler_logs_api.py
git commit -m "feat(scheduler): API solo-admin del historial de corridas"
```

---

### Task 7: Cliente HTTP del frontend

**Files:**
- Create: `frontend/src/api/schedulerLogs.ts`

**Interfaces:**
- Consumes: la API de la Task 6.
- Produces: `SchedulerLogItem`, `SchedulerLogDetalle`, `SchedulerLogPage`, `SchedulerLogFiltros`, `fetchSchedulerLogs`, `fetchSchedulerLogDetalle`, `fetchSchedulerJobIds`.

- [ ] **Step 1: Escribir el cliente**

`frontend/src/api/schedulerLogs.ts`:

```typescript
import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/scheduler-logs";

export type SchedulerLogResultado = "en_curso" | "ok" | "advertencia" | "error";

export type SchedulerLogItem = {
  id: number;
  job_id: string;
  inicio_at: string;
  fin_at: string | null;
  duracion_ms: number | null;
  resultado: SchedulerLogResultado;
  resumen: string | null;
  error: string | null;
};

export type SchedulerLogLinea = {
  ts: string;
  nivel: string;
  mensaje: string;
};

export type SchedulerLogDetalle = SchedulerLogItem & {
  lineas: SchedulerLogLinea[];
  lineas_descartadas: number;
};

export type SchedulerLogPage = {
  items: SchedulerLogItem[];
  total: number;
  page: number;
  page_size: number;
};

export type SchedulerLogFiltros = {
  job_id?: string;
  resultado?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  page_size?: number;
};

async function readErrorDetail(res: Response): Promise<string> {
  const err = (await res.json().catch(() => null)) as { detail?: string } | null;
  return err?.detail ?? `HTTP ${res.status}`;
}

export async function fetchSchedulerLogs(
  filtros: SchedulerLogFiltros = {},
): Promise<SchedulerLogPage> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== "") params.set(clave, String(valor));
  }
  const query = params.toString();
  const res = await fetchWithAuth(query ? `${BASE}?${query}` : BASE);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return (await res.json()) as SchedulerLogPage;
}

export async function fetchSchedulerLogDetalle(
  id: number,
): Promise<SchedulerLogDetalle> {
  const res = await fetchWithAuth(`${BASE}/${id}`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return (await res.json()) as SchedulerLogDetalle;
}

export async function fetchSchedulerJobIds(): Promise<string[]> {
  const res = await fetchWithAuth(`${BASE}/jobs`);
  if (!res.ok) throw { status: res.status, detail: await readErrorDetail(res) };
  return ((await res.json()) as { items: string[] }).items;
}
```

- [ ] **Step 2: Verificar que typechequea**

```bash
docker-compose exec -T frontend npm run typecheck 2>&1 | grep -c "error TS"
```

Esperado: **32** (los preexistentes de `main`). Si sube, el error es del archivo nuevo:

```bash
docker-compose exec -T frontend npm run typecheck 2>&1 | grep -i schedulerLogs
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/schedulerLogs.ts
git commit -m "feat(scheduler): cliente HTTP del historial de corridas"
```

---

### Task 8: La página

**Files:**
- Create: `frontend/src/pages/schedulerLogs.ts`
- Test: `frontend/src/pages/schedulerLogs.render.test.ts`

**Interfaces:**
- Consumes: el cliente de la Task 7, `canAccessRhPermisosAdmin`, `mountAppShell`, tokens de `uiTokens`.
- Produces: `mountSchedulerLogs(container: HTMLElement, signal?: AbortSignal): void` y, exportadas para test, `renderTablaCorridas(items: SchedulerLogItem[]): string` y `formatearDuracion(ms: number | null): string`.

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/pages/schedulerLogs.render.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { SchedulerLogItem } from "../api/schedulerLogs.ts";
import { formatearDuracion, renderTablaCorridas } from "./schedulerLogs.ts";

function item(overrides: Partial<SchedulerLogItem> = {}): SchedulerLogItem {
  return {
    id: 1,
    job_id: "sync_ausencias_fi_re",
    inicio_at: "2026-08-12T14:30:00+00:00",
    fin_at: "2026-08-12T14:30:12+00:00",
    duracion_ms: 12000,
    resultado: "ok",
    resumen: "leidos=10 insertados=2",
    error: null,
    ...overrides,
  };
}

describe("schedulerLogs — tabla", () => {
  it("pinta el job, el resumen y el resultado de cada corrida", () => {
    const html = renderTablaCorridas([item()]);
    expect(html).toContain("sync_ausencias_fi_re");
    expect(html).toContain("leidos=10 insertados=2");
    expect(html).toContain("Correcto");
  });

  it("escapa el contenido que viene del servidor", () => {
    const html = renderTablaCorridas([item({ resumen: "<img src=x onerror=1>" })]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("muestra un estado vacío cuando no hay corridas", () => {
    expect(renderTablaCorridas([])).toContain("Sin corridas registradas");
  });

  it("marca la corrida que sigue en curso", () => {
    const html = renderTablaCorridas([
      item({ resultado: "en_curso", fin_at: null, duracion_ms: null }),
    ]);
    expect(html).toContain("En curso");
  });
});

describe("schedulerLogs — duración", () => {
  it("usa milisegundos, segundos o minutos según la magnitud", () => {
    expect(formatearDuracion(850)).toBe("850 ms");
    expect(formatearDuracion(12000)).toBe("12.0 s");
    expect(formatearDuracion(185000)).toBe("3.1 min");
  });

  it("devuelve un guion cuando aún no hay duración", () => {
    expect(formatearDuracion(null)).toBe("—");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
docker-compose exec -T frontend npx vitest run src/pages/schedulerLogs.render.test.ts
```

Esperado: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar la página**

`frontend/src/pages/schedulerLogs.ts`:

```typescript
/**
 * Logs del scheduler (`#/ajustes/scheduler-logs`) — solo admin, oculta.
 *
 * No tiene entrada en el sidebar ni en el menú de usuario: se llega escribiendo la URL.
 * Solo lectura; relanzar un job es por CLI.
 */
import {
  fetchSchedulerJobIds,
  fetchSchedulerLogDetalle,
  fetchSchedulerLogs,
  type SchedulerLogDetalle,
  type SchedulerLogItem,
} from "../api/schedulerLogs.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const PAGE_SIZE = 20;

const ETIQUETA_RESULTADO: Record<string, string> = {
  en_curso: "En curso",
  ok: "Correcto",
  advertencia: "Advertencia",
  error: "Error",
};

const CLASE_RESULTADO: Record<string, string> = {
  en_curso: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  advertencia: "bg-amber-50 text-amber-700 ring-amber-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
};

export function formatearDuracion(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-MX");
}

function badge(resultado: string): string {
  const clase = CLASE_RESULTADO[resultado] ?? CLASE_RESULTADO.ok;
  const texto = ETIQUETA_RESULTADO[resultado] ?? resultado;
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${clase}">${escapeHtml(texto)}</span>`;
}

export function renderTablaCorridas(items: SchedulerLogItem[]): string {
  if (items.length === 0) {
    return `<p class="px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">Sin corridas registradas.</p>`;
  }
  const filas = items
    .map(
      (item) => `
      <tr class="cursor-pointer border-t border-[rgba(148,163,184,0.28)] hover:bg-slate-50" data-scheduler-log-id="${item.id}">
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.job_id)}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearFecha(item.inicio_at))}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearDuracion(item.duracion_ms))}</td>
        <td class="px-3 py-2">${badge(item.resultado)}</td>
        <td class="px-3 py-2 text-xs text-[color:var(--color-text-secondary)]">${escapeHtml(item.resumen ?? "")}</td>
      </tr>`,
    )
    .join("");
  return `
    <table class="w-full border-collapse text-left">
      <thead>
        <tr class="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          <th class="px-3 py-2">Job</th>
          <th class="px-3 py-2">Inicio</th>
          <th class="px-3 py-2">Duración</th>
          <th class="px-3 py-2">Resultado</th>
          <th class="px-3 py-2">Resumen</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

function renderDetalle(detalle: SchedulerLogDetalle): string {
  const lineas = detalle.lineas
    .map(
      (linea) =>
        `<div class="border-b border-[rgba(148,163,184,0.2)] px-3 py-1 font-mono text-xs"><span class="mr-2 font-semibold">${escapeHtml(linea.nivel)}</span>${escapeHtml(linea.mensaje)}</div>`,
    )
    .join("");
  const recortadas =
    detalle.lineas_descartadas > 0
      ? `<p class="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">${detalle.lineas_descartadas} líneas más no se guardaron.</p>`
      : "";
  return `
    <div class="${RH_LISTADO_SURFACE} mt-4">
      <h2 class="px-3 py-2 text-sm font-bold">${escapeHtml(detalle.job_id)} · ${escapeHtml(formatearFecha(detalle.inicio_at))}</h2>
      ${lineas || `<p class="px-3 py-2 text-xs">Sin líneas.</p>`}
      ${recortadas}
    </div>`;
}

export function mountSchedulerLogs(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessRhPermisosAdmin()) {
    mountAppShell(container, {
      pageTitle: "Logs del scheduler",
      activeNav: "dashboard",
      mainHtml: htmlAccessDenied({
        title: "Acceso no autorizado",
        description: "Esta pantalla es solo para administradores.",
      }),
    });
    return;
  }

  let page = 1;
  let filtroJob = "";
  let filtroResultado = "";

  mountAppShell(container, {
    pageTitle: "Logs del scheduler",
    activeNav: "dashboard",
    mainHtml: `<div id="scheduler-logs-page" class="${RH_LISTADO_PAGE_OUTER}">
      <div id="scheduler-logs-filtros" class="mb-4 flex flex-wrap gap-3"></div>
      <div id="scheduler-logs-tabla" class="${RH_LISTADO_SURFACE}"></div>
      <div id="scheduler-logs-paginacion" class="mt-3 flex items-center gap-2 text-sm"></div>
      <div id="scheduler-logs-detalle"></div>
    </div>`,
  });

  const root = container.querySelector("#scheduler-logs-page");
  const tabla = container.querySelector("#scheduler-logs-tabla");
  const paginacion = container.querySelector("#scheduler-logs-paginacion");
  const detalleHost = container.querySelector("#scheduler-logs-detalle");
  const filtros = container.querySelector("#scheduler-logs-filtros");

  async function pintarFiltros(): Promise<void> {
    if (!filtros) return;
    let jobs: string[] = [];
    try {
      jobs = await fetchSchedulerJobIds();
    } catch {
      jobs = [];
    }
    const opciones = jobs
      .map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`)
      .join("");
    filtros.innerHTML = `
      <label class="block"><span class="${RH_LISTADO_LABEL}">Job</span>
        <select id="scheduler-logs-filtro-job" class="rounded border px-2 py-1 text-sm"><option value="">Todos</option>${opciones}</select>
      </label>
      <label class="block"><span class="${RH_LISTADO_LABEL}">Resultado</span>
        <select id="scheduler-logs-filtro-resultado" class="rounded border px-2 py-1 text-sm">
          <option value="">Todos</option>
          <option value="ok">Correcto</option>
          <option value="advertencia">Advertencia</option>
          <option value="error">Error</option>
          <option value="en_curso">En curso</option>
        </select>
      </label>`;
  }

  async function cargar(): Promise<void> {
    if (!tabla) return;
    tabla.innerHTML = `<p class="px-4 py-8 text-center text-sm">Cargando…</p>`;
    try {
      const data = await fetchSchedulerLogs({
        job_id: filtroJob || undefined,
        resultado: filtroResultado || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      tabla.innerHTML = renderTablaCorridas(data.items);
      if (paginacion) {
        const paginas = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
        paginacion.innerHTML = `
          <button data-scheduler-logs-prev class="rounded border px-2 py-1" ${page <= 1 ? "disabled" : ""}>Anterior</button>
          <span>Página ${page} de ${paginas} · ${data.total} corridas</span>
          <button data-scheduler-logs-next class="rounded border px-2 py-1" ${page >= paginas ? "disabled" : ""}>Siguiente</button>`;
      }
    } catch (error: unknown) {
      const err = error as { detail?: string };
      tabla.innerHTML = `<p class="px-4 py-8 text-center text-sm text-red-600">${escapeHtml(err?.detail ?? "No se pudieron cargar las corridas.")}</p>`;
    }
  }

  root?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-scheduler-logs-prev]") && page > 1) {
        page -= 1;
        void cargar();
        return;
      }
      if (t.closest("[data-scheduler-logs-next]")) {
        page += 1;
        void cargar();
        return;
      }
      const fila = t.closest<HTMLElement>("[data-scheduler-log-id]");
      if (fila && detalleHost) {
        const id = Number.parseInt(fila.dataset.schedulerLogId ?? "", 10);
        if (Number.isFinite(id)) {
          void fetchSchedulerLogDetalle(id)
            .then((detalle) => {
              detalleHost.innerHTML = renderDetalle(detalle);
            })
            .catch(() => {
              detalleHost.innerHTML = `<p class="mt-4 text-sm text-red-600">No se pudo cargar el detalle.</p>`;
            });
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "scheduler-logs-filtro-job") {
        filtroJob = (t as HTMLSelectElement).value;
        page = 1;
        void cargar();
      }
      if (t.id === "scheduler-logs-filtro-resultado") {
        filtroResultado = (t as HTMLSelectElement).value;
        page = 1;
        void cargar();
      }
    },
    { signal },
  );

  void pintarFiltros();
  void cargar();
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

```bash
docker-compose exec -T frontend npx vitest run src/pages/schedulerLogs.render.test.ts
```

Esperado: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/schedulerLogs.ts frontend/src/pages/schedulerLogs.render.test.ts
git commit -m "feat(scheduler): pagina de historial de corridas"
```

---

### Task 9: Cablear la ruta y verificar que queda oculta

**Files:**
- Modify: `frontend/src/shellRouter.ts`
- Modify: `frontend/src/navigation/pageTitles.ts`
- Modify: `frontend/src/navigation/shellNavPolicy.ts` (4 lugares)
- Test: `frontend/src/navigation/shellNavPolicy.schedulerLogs.test.ts`
- Test: `frontend/src/layouts/appShell.schedulerLogsOculto.test.ts`

**Interfaces:**
- Consumes: `mountSchedulerLogs` (Task 8).
- Produces: la ruta `#/ajustes/scheduler-logs`, accesible solo para admin en modo RH.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `frontend/src/navigation/shellNavPolicy.schedulerLogs.test.ts`:

```typescript
/**
 * `#/ajustes/scheduler-logs` es una pantalla oculta solo-admin: se comporta igual que
 * `#/ajustes/vistas-rol` en todos los modos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

let esAdmin = false;
let modoOperativo = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "empleado",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => esAdmin,
  isNonRhRhMode: () => false,
  hasRhPermisosActivos: () => true,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => modoOperativo,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => esAdmin,
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => false,
  isModulosRhEnrolled: () => false,
}));

const HASH = "#/ajustes/scheduler-logs";

beforeEach(() => {
  esAdmin = false;
  modoOperativo = false;
});

describe("política de hash de los logs del scheduler", () => {
  it("un usuario no admin no puede entrar", async () => {
    const { modulosMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(HASH, "empleado")).toBe(false);
  });

  it("un admin en Modo RH sí puede", async () => {
    esAdmin = true;
    modoOperativo = true;
    const { modulosMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(HASH, "rh")).toBe(true);
  });

  it("un admin simulando otro rol no puede", async () => {
    esAdmin = true;
    const { rhEmpleadoMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(rhEmpleadoMayAccessHash(HASH)).toBe(false);
  });
});
```

Crear `frontend/src/layouts/appShell.schedulerLogsOculto.test.ts` completo:

```typescript
/**
 * La página de logs del scheduler no debe aparecer en ninguna parte de la navegación.
 *
 * Es un test de regresión: hoy pasa desde el primer momento. Su trabajo es fallar el día
 * que alguien "acomode" el menú de usuario y le agregue el enlace, que es exactamente lo
 * que la feature pide que no exista.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "rh",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => false,
  isHorasExtraRegistroAutorizado: () => false,
  canAccessEmpleadoPersonalDashboard: () => false,
  getUserDisplayNameFromAccessToken: () => "Admin Prueba",
  getUserInitialsFromAccessToken: () => "AP",
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => true,
  isNonRhRhMode: () => false,
  isNonRhPermisosUser: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => true,
  hasRhPermisosActivos: () => true,
  getRhUiModeLabel: () => "",
  isRhToggleOn: () => false,
  toggleNonRhRhMode: () => {},
  toggleRhUiMode: () => {},
  setAdminUser: () => {},
  setRhInPermisosList: () => {},
  setRhPermisosActivos: () => {},
  getRhUiModeHeaderValue: () => null,
}));

describe("appShell — la página de logs del scheduler está oculta", () => {
  it("no aparece en el menú de usuario ni en el sidebar, ni para un admin", async () => {
    const { mountAppShell } = await import("./appShell.ts");
    const host = document.createElement("div");

    mountAppShell(host, {
      pageTitle: "Dashboard",
      activeNav: "dashboard",
      mainHtml: "<div></div>",
    });

    expect(host.innerHTML).not.toContain("scheduler-logs");
    expect(host.innerHTML).not.toContain("Logs del scheduler");
  });
});
```

Si `mountAppShell` exige más mocks de los declarados (el archivo evoluciona), copiar los
que falten desde `frontend/src/layouts/appShell.rh.render.test.ts`, que monta el mismo
shell con el modo RH operativo encendido.

- [ ] **Step 2: Correr los tests y verificar que fallan**

```bash
docker-compose exec -T frontend npx vitest run src/navigation/shellNavPolicy.schedulerLogs.test.ts src/layouts/appShell.schedulerLogsOculto.test.ts
```

Esperado: el de la política falla (hoy `modulosMayAccessHash` devuelve `true` para un
hash desconocido); el del menú **pasa desde el primer momento** — es un test de
regresión, su trabajo es fallar el día que alguien agregue el enlace.

- [ ] **Step 3: Tratar el hash como `#/ajustes/vistas-rol` en la política**

En `frontend/src/navigation/shellNavPolicy.ts`, en los **cuatro** lugares donde aparece
`h.startsWith("#/ajustes/vistas-rol")`, agregar la condición del hash nuevo:

```typescript
// ~línea 494, dentro de modulosMayAccessHash
  if (
    h.startsWith("#/ajustes/permisos-rh")
    || h.startsWith("#/ajustes/vistas-rol")
    || h.startsWith("#/ajustes/scheduler-logs")
  ) {
    return isRhOperativoUiMode() && canAccessRhPermisosAdmin();
  }
```

```typescript
// ~línea 537, en rhEmpleadoMayAccessHash
  if (
    h.startsWith("#/ajustes/permisos-rh")
    || h.startsWith("#/ajustes/vistas-rol")
    || h.startsWith("#/ajustes/scheduler-logs")
  ) return false;
```

Y las dos listas dentro de `rhMayAccessHash` (modo gestor y modo director): agregar
`|| h.startsWith("#/ajustes/scheduler-logs")` a cada una.

- [ ] **Step 4: Registrar la ruta**

En `frontend/src/shellRouter.ts`, junto al bloque de `#/ajustes/vistas-rol`:

```typescript
    if (h.startsWith("#/ajustes/scheduler-logs")) {
      void import("./pages/schedulerLogs.ts")
        .then(({ mountSchedulerLogs }) => mountSchedulerLogs(container, signal))
        // `activeNav: "dashboard"` porque la página no está en ningún menú: no hay
        // ítem que resaltar. Es a propósito — se llega solo por URL.
        .catch((err) =>
          renderLazyPageImportError(container, "dashboard", "Logs del scheduler", err),
        );
      return;
    }
```

- [ ] **Step 5: Registrar el título**

En `frontend/src/navigation/pageTitles.ts`, junto a la regla de `vistas-rol`:

```typescript
  { match: (h) => h.startsWith("#/ajustes/scheduler-logs"), titulo: "Logs del scheduler" },
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

```bash
docker-compose exec -T frontend npx vitest run src/navigation src/layouts
docker-compose exec -T frontend npm run typecheck 2>&1 | grep -c "error TS"
```

Esperado: toda la carpeta `navigation` y `layouts` en verde, y el conteo de typecheck en **32**.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shellRouter.ts frontend/src/navigation/pageTitles.ts \
        frontend/src/navigation/shellNavPolicy.ts \
        frontend/src/navigation/shellNavPolicy.schedulerLogs.test.ts \
        frontend/src/layouts/appShell.schedulerLogsOculto.test.ts
git commit -m "feat(scheduler): ruta oculta solo-admin para los logs del scheduler"
```

---

### Task 10: Documentación y verificación final

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/DEPLOY.md`

- [ ] **Step 1: Documentar en `CLAUDE.md`**

En la viñeta de APScheduler (la que empieza con «APScheduler runs periodic jobs»), al final,
agregar:

```markdown
  Cada corrida de los 11 jobs queda en `levelup_scheduler_job_log` (inicio, fin, duración,
  resultado y las líneas que ese job emitió), y se consulta en la página **oculta**
  `#/ajustes/scheduler-logs`, solo-admin y sin entrada en ningún menú. El resultado se
  deduce del **nivel máximo de log** (`ok` / `advertencia` / `error`), no de una excepción:
  los wrappers de los jobs atrapan la suya, así que un listener de APScheduler los vería
  siempre como correctos. Una fila que se queda en `en_curso` significa que el proceso
  murió a media corrida; no hay barrendero que las cierre.
```

- [ ] **Step 2: Documentar en `docs/DEPLOY.md`**

Al final de la sección «Actualizar tras cambios», antes de las cargas iniciales:

```markdown
### Página de logs del scheduler

El release que introduce `levelup_scheduler_job_log` (revisión `s1c2h3e4d5j6`) crea la tabla
**vacía**: hasta que corra el primer job, `#/ajustes/scheduler-logs` se ve sin filas, y es
correcto. No hay carga inicial que hacer — el historial no existía antes.

Es una página **oculta**: no aparece en el sidebar ni en el menú de usuario. Se entra
escribiendo la URL y solo con un usuario admin (`puede_administrar_permisos_rh`); el resto
recibe 403.

Necesita `prod-migrate.sh` (crea la tabla) **y** `prod-build-frontend.sh` (la página es
frontend nuevo).
```

- [ ] **Step 3: Correr la suite completa del backend**

```bash
docker-compose run --rm test
```

Esperado: todo verde. La referencia antes de este trabajo era **1917 passed, 19 skipped**;
ahora deben ser esos más los ~40 nuevos.

- [ ] **Step 4: Correr la suite completa del frontend y el build**

```bash
docker-compose exec -T frontend npm run test
docker-compose exec -T frontend npm run build
docker-compose exec -T frontend npm run typecheck 2>&1 | grep -c "error TS"
```

Esperado: todos los tests en verde, build sin errores y **32** en el conteo de typecheck.

- [ ] **Step 5: Verificar la migración contra un Postgres desechable**

**Nunca** probar una migración nueva contra Bono. Levantar un Postgres vacío, aplicar la
migración ahí y comprobar el resultado:

```bash
docker run -d --name pg-migra-scheduler -e POSTGRES_PASSWORD=probar \
  -e POSTGRES_DB=probar -p 55432:5432 postgres:16

# Aplicar solo esta revisión sobre una BD vacía: stamp a la anterior y subir una.
docker-compose exec -T backend env \
  DATABASE_URL=postgresql+asyncpg://postgres:probar@host.docker.internal:55432/probar \
  alembic stamp g1e2m3p4t5r6
docker-compose exec -T backend env \
  DATABASE_URL=postgresql+asyncpg://postgres:probar@host.docker.internal:55432/probar \
  alembic upgrade s1c2h3e4d5j6

# La tabla y sus dos indices existen.
docker exec pg-migra-scheduler psql -U postgres -d probar \
  -c "\d levelup_scheduler_job_log"

# El downgrade la borra junto con el tipo enum.
docker-compose exec -T backend env \
  DATABASE_URL=postgresql+asyncpg://postgres:probar@host.docker.internal:55432/probar \
  alembic downgrade g1e2m3p4t5r6
docker exec pg-migra-scheduler psql -U postgres -d probar \
  -c "SELECT to_regclass('levelup_scheduler_job_log'),
             (SELECT count(*) FROM pg_type WHERE typname='scheduler_job_resultado_enum');"

docker rm -f pg-migra-scheduler
```

Esperado: el `\d` muestra la tabla con `ix_levelup_scheduler_job_log_job_id` y
`ix_levelup_scheduler_job_log_job_inicio`; tras el downgrade, `to_regclass` devuelve
`NULL` y el conteo de tipos es `0`. Si el enum sobrevive al downgrade, falta el
`sa.Enum(...).drop(...)` de la Task 1.

- [ ] **Step 6: Commit y PR**

```bash
git add CLAUDE.md docs/DEPLOY.md
git commit -m "docs(scheduler): documentar la pagina de logs y su despliegue"
git push -u origin feat/cm/pagina-logs-scheduler
gh pr create --base main --title "feat(scheduler): pagina oculta de logs del scheduler" --body "..."
```

El cuerpo del PR debe incluir: qué se registra y por qué el resultado sale del nivel de log,
que la página es oculta y solo-admin, la lista de archivos, los comandos de prueba, y la nota
de despliegue (migración + build de frontend).
