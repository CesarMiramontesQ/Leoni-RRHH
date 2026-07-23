# Motor de Evidencias de Capacitación + Firmas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activar el módulo huérfano de Evidencias de Capacitación: RH sube evidencias (link) y asigna firmantes; cada firmante firma/rechaza su fila (self-service); el estado de la evidencia se deriva de las firmas.

**Architecture:** Service + router nuevos sobre modelos ya migrados (`EvidenciaCapacitacion` + `EvidenciaFirma`). Sin migración. Regla de derivación pura y testeable; gestión RH-gated (módulo `evidencias`), firma self-service. Frontend de gestión + vista "mis firmas".

**Tech Stack:** FastAPI async, SQLAlchemy async, Pydantic v2, pytest (SQLite in-memory), Vite/TypeScript.

## Global Constraints

- Responder siempre en español; código y comentarios en español sin acentos en identificadores.
- NUNCA push directo a `main`; rama `feat/cm/evidencias-capacitacion`, PR a main.
- **Sin migración**: los modelos `EvidenciaCapacitacion`/`EvidenciaFirma` y sus tablas ya existen (`242b98b667ff`). No tocar el modelo ni la BD.
- No es self-service para RH: la gestión es RH-gated (`role_checker(["operativo"])`, módulo `evidencias`). La firma SÍ es self-service (el firmante usa `current_user.empleado_id`, nunca un id del body).
- Estados: evidencia `pendiente`/`validada`/`devuelta` (`EstadoEvidencia`); firma `pendiente`/`firmada`/`rechazada` (`EstadoFirma`); tipo `foto`/`documento`/`video`/`firma`.
- **Regla de derivación** (única fuente): alguna firma `rechazada` → `devuelta`; ≥1 firma y todas `firmada` → `validada`; si no → `pendiente`. El estado de la evidencia NO se setea a mano.
- Frontend: solo tokens de `frontend/src/ui/uiTokens.ts`; XSS con `escapeHtml` en notas/comentarios/nombres/link.
- Mantener `openapi.yaml` sincronizado.
- Commits Conventional Commits en español, sin iniciales, terminando con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

- `app/services/evidencia_capacitacion/estado.py` — función pura `derivar_estado_evidencia` (Task 1).
- `app/schemas/level_up.py` — schemas nuevos (Task 1).
- `app/services/evidencia_capacitacion_service.py` — service (Tasks 2-3).
- `app/api/v1/evidencias/{__init__.py,router.py}` — router (Task 4).
- `app/main.py`, `app/core/rh_module_registry.py`, `openapi.yaml` — registro (Task 4).
- `frontend/src/api/evidencias.ts`, `frontend/src/pages/evidencias.ts`, `frontend/src/pages/misFirmas.ts`, `frontend/src/shellRouter.ts` — frontend (Tasks 5-6).
- Tests: `tests/test_evidencias_capacitacion.py` (nuevo).

---

### Task 1: Función pura de derivación + schemas

**Files:**
- Create: `app/services/evidencia_capacitacion/__init__.py`, `app/services/evidencia_capacitacion/estado.py`
- Modify: `app/schemas/level_up.py`
- Test: `tests/test_evidencias_capacitacion.py`

**Interfaces:**
- Produces: `derivar_estado_evidencia(estados_firmas: list[str]) -> str`; schemas `EvidenciaFirmaItem`, `EvidenciaConFirmasResponse`, `FirmanteAsignar`, `EvidenciaCrearRequest`, `FirmarRequest`.

- [ ] **Step 1: Escribir los tests que fallan** (crea el archivo de tests)

En `tests/test_evidencias_capacitacion.py`:

```python
"""Tests del Motor de Evidencias de Capacitacion."""
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia
from app.schemas.level_up import (
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)


def test_derivar_sin_firmas_es_pendiente():
    assert derivar_estado_evidencia([]) == "pendiente"


def test_derivar_alguna_rechazada_es_devuelta():
    assert derivar_estado_evidencia(["firmada", "rechazada", "pendiente"]) == "devuelta"


def test_derivar_todas_firmadas_es_validada():
    assert derivar_estado_evidencia(["firmada", "firmada"]) == "validada"


def test_derivar_hay_pendientes_es_pendiente():
    assert derivar_estado_evidencia(["firmada", "pendiente"]) == "pendiente"


def test_schemas_existen():
    req = EvidenciaCrearRequest(tipo="documento", archivo_url="http://x/y.pdf", empleado_id=10)
    assert req.firmantes == []
    assert FirmarRequest(estado="firmada").comentario is None
    assert FirmanteAsignar(firmante_id=5, rol_firma="instructor").rol_firma == "instructor"
    assert "firmas" in EvidenciaConFirmasResponse.model_fields
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -v`
Expected: FAIL (`ImportError`).

- [ ] **Step 3: Crear la función pura de derivación**

Crea `app/services/evidencia_capacitacion/__init__.py` (vacío) y `app/services/evidencia_capacitacion/estado.py`:

```python
"""Regla pura de derivacion del estado de una evidencia desde sus firmas."""
from __future__ import annotations


def derivar_estado_evidencia(estados_firmas: list[str]) -> str:
    """Estado de la evidencia segun los estados de sus firmas:
      - alguna 'rechazada' -> 'devuelta'
      - >=1 firma y todas 'firmada' -> 'validada'
      - en cualquier otro caso (hay 'pendiente' o no hay firmas) -> 'pendiente'."""
    if any(e == "rechazada" for e in estados_firmas):
        return "devuelta"
    if estados_firmas and all(e == "firmada" for e in estados_firmas):
        return "validada"
    return "pendiente"
```

- [ ] **Step 4: Añadir los schemas**

En `app/schemas/level_up.py`, en el bloque de EvidenciaCapacitacion (después de `EvidenciaFirmaResponse`), añade:

```python
class EvidenciaFirmaItem(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    firmante_id: int
    firmante_nombre: Optional[str] = None
    rol_firma: str
    estado: str
    fecha_firma: Optional[datetime] = None
    comentario: Optional[str] = None


class EvidenciaConFirmasResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: int
    tipo: str
    archivo_url: str
    capacitacion_id: Optional[int] = None
    capacitacion_nombre: Optional[str] = None
    empleado_id: int
    empleado_nombre: Optional[str] = None
    estado: str
    fecha_subida: datetime
    notas: Optional[str] = None
    firmas: list[EvidenciaFirmaItem] = Field(default_factory=list)
    firmas_total: int = 0
    firmas_firmadas: int = 0


class FirmanteAsignar(BaseModel):
    model_config = {"str_strip_whitespace": True}
    firmante_id: int
    rol_firma: str = Field(..., min_length=1, max_length=100)


class EvidenciaCrearRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    tipo: Literal["foto", "documento", "video", "firma"]
    archivo_url: str = Field(..., min_length=1, max_length=500)
    capacitacion_id: Optional[int] = None
    empleado_id: int
    notas: Optional[str] = None
    firmantes: list[FirmanteAsignar] = Field(default_factory=list)


class FirmarRequest(BaseModel):
    model_config = {"str_strip_whitespace": True}
    estado: Literal["firmada", "rechazada"]
    comentario: Optional[str] = None
```

(Verifica que `BaseModel`, `Field`, `Optional`, `Literal`, `datetime` estén importados — lo están.)

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/evidencia_capacitacion/ app/schemas/level_up.py tests/test_evidencias_capacitacion.py
git commit -m "feat(evidencias): regla de derivacion de estado + schemas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Service — gestión (RH) + `_recalcular_estado`

**Files:**
- Create: `app/services/evidencia_capacitacion_service.py`
- Test: `tests/test_evidencias_capacitacion.py`

**Interfaces:**
- Consumes: modelos `EvidenciaCapacitacion`/`EvidenciaFirma` (`app/models/level_up.py`), `Capacitacion` (`app/models/talento.py`), `Empleado`; `derivar_estado_evidencia` (Task 1); schemas (Task 1); `NotFoundError`/`ConflictError` (`app/core/exceptions`); `EmpleadoRepository.get_nombres_por_empleado_ids`.
- Produces: `EvidenciaCapacitacionService` con `listar`/`obtener`/`crear`/`actualizar`/`eliminar`/`agregar_firmante`/`quitar_firmante`/`_recalcular_estado`/`_to_response`.

- [ ] **Step 1: Escribir los tests de gestión que fallan**

Añade a `tests/test_evidencias_capacitacion.py`. Usa `make_empleado` de `conftest`; crea capacitaciones directo si hace falta (o deja `capacitacion_id=None`).

```python
import pytest

from app.core.exceptions import NotFoundError
from app.schemas.level_up import EvidenciaCrearRequest, FirmanteAsignar
from app.services.evidencia_capacitacion_service import EvidenciaCapacitacionService


@pytest.mark.asyncio
async def test_crear_evidencia_con_firmantes_pendiente(db):
    emp = await make_empleado(db)
    f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="documento", archivo_url="http://x/y.pdf", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="instructor")],
    ))
    assert ev.estado == "pendiente"
    assert ev.firmas_total == 1
    assert ev.firmas_firmadas == 0
    assert ev.firmas[0].rol_firma == "instructor"


@pytest.mark.asyncio
async def test_crear_empleado_inexistente_404(db):
    svc = EvidenciaCapacitacionService(db)
    with pytest.raises(NotFoundError):
        await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=999999))


@pytest.mark.asyncio
async def test_agregar_y_quitar_firmante(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    ev2 = await svc.agregar_firmante(ev.id, FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe"))
    assert ev2.firmas_total == 1
    ev3 = await svc.quitar_firmante(ev2.firmas[0].id)
    assert ev3.firmas_total == 0


@pytest.mark.asyncio
async def test_actualizar_no_cambia_estado_a_mano(db):
    emp = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id))
    from app.schemas.level_up import EvidenciaCapacitacionUpdate
    ev2 = await svc.actualizar(ev.id, EvidenciaCapacitacionUpdate(estado="validada", notas="corregido"))
    assert ev2.notas == "corregido"
    assert ev2.estado == "pendiente"  # el estado es derivado, no se setea a mano
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k "crear or firmante or actualizar" -v`
Expected: FAIL (service inexistente).

- [ ] **Step 3: Implementar el service de gestión**

Crea `app/services/evidencia_capacitacion_service.py`:

```python
"""Motor de Evidencias de Capacitacion: gestion (RH) + firma (self-service)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.empleados import Empleado
from app.models.level_up import EvidenciaCapacitacion, EvidenciaFirma
from app.models.talento import Capacitacion
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    EvidenciaFirmaItem,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion.estado import derivar_estado_evidencia


class EvidenciaCapacitacionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.empleado_repo = EmpleadoRepository(db)

    # ── helpers ──
    async def _get_o_404(self, evidencia_id: int) -> EvidenciaCapacitacion:
        stmt = (
            select(EvidenciaCapacitacion)
            .where(EvidenciaCapacitacion.id == evidencia_id)
            .options(selectinload(EvidenciaCapacitacion.firmas))
        )
        ev = (await self.db.execute(stmt)).scalar_one_or_none()
        if ev is None:
            raise NotFoundError("EvidenciaCapacitacion", evidencia_id)
        return ev

    async def _validar_empleado(self, empleado_id: int) -> None:
        if await self.empleado_repo.get_by_empleado_id(empleado_id) is None:
            raise NotFoundError("Empleado", empleado_id)

    async def _validar_capacitacion(self, capacitacion_id: Optional[int]) -> None:
        if capacitacion_id is None:
            return
        if await self.db.get(Capacitacion, capacitacion_id) is None:
            raise NotFoundError("Capacitacion", capacitacion_id)

    async def _recalcular_estado(self, ev: EvidenciaCapacitacion) -> None:
        estados = [f.estado.value if hasattr(f.estado, "value") else str(f.estado) for f in ev.firmas]
        ev.estado = derivar_estado_evidencia(estados)

    async def _to_response(self, ev: EvidenciaCapacitacion) -> EvidenciaConFirmasResponse:
        emp_ids = {ev.empleado_id} | {f.firmante_id for f in ev.firmas}
        nombres = await self.empleado_repo.get_nombres_por_empleado_ids(list(emp_ids))
        cap_nombre = None
        if ev.capacitacion_id is not None:
            cap = await self.db.get(Capacitacion, ev.capacitacion_id)
            cap_nombre = cap.nombre if cap is not None else None
        firmas = [
            EvidenciaFirmaItem(
                id=f.id, firmante_id=f.firmante_id,
                firmante_nombre=_nombre(nombres, f.firmante_id),
                rol_firma=f.rol_firma,
                estado=f.estado.value if hasattr(f.estado, "value") else str(f.estado),
                fecha_firma=f.fecha_firma, comentario=f.comentario,
            )
            for f in ev.firmas
        ]
        firmadas = sum(1 for f in firmas if f.estado == "firmada")
        return EvidenciaConFirmasResponse(
            id=ev.id,
            tipo=ev.tipo.value if hasattr(ev.tipo, "value") else str(ev.tipo),
            archivo_url=ev.archivo_url,
            capacitacion_id=ev.capacitacion_id, capacitacion_nombre=cap_nombre,
            empleado_id=ev.empleado_id, empleado_nombre=_nombre(nombres, ev.empleado_id),
            estado=ev.estado.value if hasattr(ev.estado, "value") else str(ev.estado),
            fecha_subida=ev.fecha_subida, notas=ev.notas,
            firmas=firmas, firmas_total=len(firmas), firmas_firmadas=firmadas,
        )

    # ── gestion (RH) ──
    async def listar(self, empleado_id=None, capacitacion_id=None, estado=None):
        stmt = select(EvidenciaCapacitacion).options(selectinload(EvidenciaCapacitacion.firmas))
        if empleado_id is not None:
            stmt = stmt.where(EvidenciaCapacitacion.empleado_id == empleado_id)
        if capacitacion_id is not None:
            stmt = stmt.where(EvidenciaCapacitacion.capacitacion_id == capacitacion_id)
        if estado is not None:
            stmt = stmt.where(EvidenciaCapacitacion.estado == estado)
        stmt = stmt.order_by(EvidenciaCapacitacion.fecha_subida.desc())
        evs = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(ev) for ev in evs]

    async def obtener(self, evidencia_id: int) -> EvidenciaConFirmasResponse:
        return await self._to_response(await self._get_o_404(evidencia_id))

    async def crear(self, data: EvidenciaCrearRequest) -> EvidenciaConFirmasResponse:
        await self._validar_empleado(data.empleado_id)
        await self._validar_capacitacion(data.capacitacion_id)
        ev = EvidenciaCapacitacion(
            tipo=data.tipo, archivo_url=data.archivo_url,
            capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id,
            notas=data.notas,
        )
        for fa in data.firmantes:
            await self._validar_empleado(fa.firmante_id)
            ev.firmas.append(EvidenciaFirma(firmante_id=fa.firmante_id, rol_firma=fa.rol_firma))
        await self._recalcular_estado(ev)
        self.db.add(ev)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def actualizar(self, evidencia_id: int, data: EvidenciaCapacitacionUpdate):
        ev = await self._get_o_404(evidencia_id)
        campos = data.model_dump(exclude_unset=True)
        # El estado es derivado: nunca se setea a mano.
        campos.pop("estado", None)
        for k, v in campos.items():
            setattr(ev, k, v)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def eliminar(self, evidencia_id: int) -> None:
        ev = await self._get_o_404(evidencia_id)
        await self.db.delete(ev)
        await self.db.flush()

    async def agregar_firmante(self, evidencia_id: int, data: FirmanteAsignar):
        ev = await self._get_o_404(evidencia_id)
        await self._validar_empleado(data.firmante_id)
        if any(f.firmante_id == data.firmante_id and f.rol_firma == data.rol_firma for f in ev.firmas):
            raise ConflictError("Ese firmante ya esta asignado con ese rol")
        ev.firmas.append(EvidenciaFirma(firmante_id=data.firmante_id, rol_firma=data.rol_firma))
        await self._recalcular_estado(ev)
        await self.db.flush()
        await self.db.refresh(ev, attribute_names=["firmas"])
        return await self._to_response(ev)

    async def quitar_firmante(self, firma_id: int) -> EvidenciaConFirmasResponse:
        firma = await self.db.get(EvidenciaFirma, firma_id)
        if firma is None:
            raise NotFoundError("EvidenciaFirma", firma_id)
        evidencia_id = firma.evidencia_id
        await self.db.delete(firma)
        await self.db.flush()
        ev = await self._get_o_404(evidencia_id)
        await self._recalcular_estado(ev)
        await self.db.flush()
        return await self._to_response(ev)


def _nombre(nombres: dict, empleado_id: int) -> Optional[str]:
    val = nombres.get(empleado_id)
    if val is None:
        return None
    # get_nombres_por_empleado_ids devuelve (no_empleado, nombre) o str segun repo;
    # normaliza a str legible.
    if isinstance(val, tuple):
        return val[1]
    return val
```

> Nota de implementación: verifica el shape exacto de
> `EmpleadoRepository.get_nombres_por_empleado_ids` (¿`dict[int, str]` o
> `dict[int, tuple[no, nombre]]`?) y ajusta `_nombre` en consecuencia; el helper
> ya contempla ambos.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k "crear or firmante or actualizar" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/services/evidencia_capacitacion_service.py tests/test_evidencias_capacitacion.py
git commit -m "feat(evidencias): service de gestion (CRUD + firmantes) con estado derivado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Service — firma (self-service) + derivación al firmar

**Files:**
- Modify: `app/services/evidencia_capacitacion_service.py`
- Test: `tests/test_evidencias_capacitacion.py`

**Interfaces:**
- Consumes: lo de Task 2.
- Produces: `mis_firmas_pendientes(firmante_id) -> list[EvidenciaConFirmasResponse]`, `firmar(firma_id, firmante_id, data: FirmarRequest) -> EvidenciaConFirmasResponse`.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `tests/test_evidencias_capacitacion.py`:

```python
from app.core.exceptions import ConflictError, ForbiddenError
from app.schemas.level_up import FirmarRequest


@pytest.mark.asyncio
async def test_firmar_todas_valida_evidencia(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    firma_id = ev.firmas[0].id
    out = await svc.firmar(firma_id, f1.empleado_id, FirmarRequest(estado="firmada"))
    assert out.estado == "validada"
    assert out.firmas_firmadas == 1


@pytest.mark.asyncio
async def test_firmar_rechazo_devuelve_evidencia(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    out = await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="rechazada", comentario="ilegible"))
    assert out.estado == "devuelta"


@pytest.mark.asyncio
async def test_firmar_firma_ajena_403(db):
    emp = await make_empleado(db); f1 = await make_empleado(db); otro = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    with pytest.raises(ForbiddenError):
        await svc.firmar(ev.firmas[0].id, otro.empleado_id, FirmarRequest(estado="firmada"))


@pytest.mark.asyncio
async def test_firmar_ya_firmada_409(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    ev = await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="firmada"))
    with pytest.raises(ConflictError):
        await svc.firmar(ev.firmas[0].id, f1.empleado_id, FirmarRequest(estado="firmada"))


@pytest.mark.asyncio
async def test_mis_firmas_pendientes_solo_del_token(db):
    emp = await make_empleado(db); f1 = await make_empleado(db)
    svc = EvidenciaCapacitacionService(db)
    await svc.crear(EvidenciaCrearRequest(
        tipo="foto", archivo_url="http://x", empleado_id=emp.empleado_id,
        firmantes=[FirmanteAsignar(firmante_id=f1.empleado_id, rol_firma="jefe")],
    ))
    mias = await svc.mis_firmas_pendientes(f1.empleado_id)
    ajenas = await svc.mis_firmas_pendientes(emp.empleado_id)
    assert len(mias) == 1
    assert len(ajenas) == 0
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k "firmar or mis_firmas" -v`
Expected: FAIL (métodos inexistentes).

- [ ] **Step 3: Implementar la firma self-service**

Añade a `EvidenciaCapacitacionService`:

```python
    async def mis_firmas_pendientes(self, firmante_id: int):
        stmt = (
            select(EvidenciaCapacitacion)
            .join(EvidenciaFirma, EvidenciaFirma.evidencia_id == EvidenciaCapacitacion.id)
            .where(EvidenciaFirma.firmante_id == firmante_id, EvidenciaFirma.estado == "pendiente")
            .options(selectinload(EvidenciaCapacitacion.firmas))
            .distinct()
            .order_by(EvidenciaCapacitacion.fecha_subida.desc())
        )
        evs = (await self.db.execute(stmt)).scalars().all()
        return [await self._to_response(ev) for ev in evs]

    async def firmar(self, firma_id: int, firmante_id: int, data: FirmarRequest):
        firma = await self.db.get(EvidenciaFirma, firma_id)
        if firma is None:
            raise NotFoundError("EvidenciaFirma", firma_id)
        if firma.firmante_id != firmante_id:
            raise ForbiddenError("No puedes firmar una fila que no es tuya")
        estado_actual = firma.estado.value if hasattr(firma.estado, "value") else str(firma.estado)
        if estado_actual != "pendiente":
            raise ConflictError("Esta firma ya fue resuelta")
        firma.estado = data.estado
        firma.fecha_firma = datetime.now(timezone.utc)
        firma.comentario = data.comentario
        await self.db.flush()
        ev = await self._get_o_404(firma.evidencia_id)
        await self._recalcular_estado(ev)
        await self.db.flush()
        return await self._to_response(ev)
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k "firmar or mis_firmas" -v`
Expected: PASS

- [ ] **Step 5: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/services/evidencia_capacitacion_service.py tests/test_evidencias_capacitacion.py
git commit -m "feat(evidencias): firma self-service con derivacion de estado

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Router + registro + openapi

**Files:**
- Create: `app/api/v1/evidencias/__init__.py`, `app/api/v1/evidencias/router.py`
- Modify: `app/main.py`, `app/core/rh_module_registry.py`, `openapi.yaml`
- Test: `tests/test_evidencias_capacitacion.py`

**Interfaces:**
- Consumes: `EvidenciaCapacitacionService` (Tasks 2-3); schemas; `role_checker`, `get_current_user` (`app/core/dependencies`).
- Produces: los endpoints RH + self-service del prefijo `/api/v1/level-up/evidencias`.

- [ ] **Step 1: Escribir los tests de API que fallan**

Añade a `tests/test_evidencias_capacitacion.py`. Reproduce el andamiaje de auth de un test de módulo RH-operativo con self-service (mira `tests/test_encuestas_rh_api.py` o el de sugerencias: `make_empleado(rol="rh", modulos_rh=..., inscrito_modulos_rh=True)` para RH; `rol="empleado"` para 403; y un empleado firmante para self-service). Nombres y asserts concretos:

```python
@pytest.mark.asyncio
async def test_api_listar_rh_200(client, db, ...): ...           # 200 RH
@pytest.mark.asyncio
async def test_api_gestion_sin_modulo_403(client, db, ...): ...  # 403 sin modulo
@pytest.mark.asyncio
async def test_api_mis_firmas_self_service(client, db, ...): ... # el firmante ve/firmar su fila
@pytest.mark.asyncio
async def test_api_firmar_ajena_403(client, db, ...): ...        # firmar fila de otro -> 403
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k api -v`
Expected: FAIL (404 rutas inexistentes).

- [ ] **Step 3: Crear el router**

Crea `app/api/v1/evidencias/__init__.py`:

```python
from app.api.v1.evidencias.router import router

__all__ = ["router"]
```

Crea `app/api/v1/evidencias/router.py`:

```python
"""Router del Motor de Evidencias de Capacitacion.

Gestion RH-gated (modulo 'evidencias', role_checker(["operativo"])). La firma es
self-service: /mis-firmas y /firmas/{id}/firmar usan current_user.empleado_id
(nunca un id del body); sus prefijos estan en RH_SELF_SERVICE_API_PREFIXES.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.level_up import (
    EvidenciaCapacitacionUpdate,
    EvidenciaConFirmasResponse,
    EvidenciaCrearRequest,
    FirmanteAsignar,
    FirmarRequest,
)
from app.services.evidencia_capacitacion_service import EvidenciaCapacitacionService

router = APIRouter(prefix="/api/v1/level-up/evidencias", tags=["Level Up - Evidencias"])


def _svc(db: AsyncSession = Depends(get_db)) -> EvidenciaCapacitacionService:
    return EvidenciaCapacitacionService(db)


# ── Self-service (firmante) — antes de /{id} para no colisionar ──
@router.get("/mis-firmas", response_model=list[EvidenciaConFirmasResponse])
async def mis_firmas(
    current_user: Empleado = Depends(get_current_user),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.mis_firmas_pendientes(current_user.empleado_id)


@router.post("/firmas/{firma_id}/firmar", response_model=EvidenciaConFirmasResponse)
async def firmar(
    firma_id: int, data: FirmarRequest,
    current_user: Empleado = Depends(get_current_user),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.firmar(firma_id, current_user.empleado_id, data)


# ── Gestion (RH) ──
@router.get("", response_model=list[EvidenciaConFirmasResponse])
async def listar(
    empleado_id: Optional[int] = Query(None),
    capacitacion_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.listar(empleado_id=empleado_id, capacitacion_id=capacitacion_id, estado=estado)


@router.post("", response_model=EvidenciaConFirmasResponse, status_code=status.HTTP_201_CREATED)
async def crear(
    data: EvidenciaCrearRequest,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.crear(data)


@router.get("/{evidencia_id}", response_model=EvidenciaConFirmasResponse)
async def obtener(
    evidencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.obtener(evidencia_id)


@router.put("/{evidencia_id}", response_model=EvidenciaConFirmasResponse)
async def actualizar(
    evidencia_id: int, data: EvidenciaCapacitacionUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.actualizar(evidencia_id, data)


@router.delete("/{evidencia_id}", status_code=status.HTTP_204_NO_CONTENT)
async def eliminar(
    evidencia_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    await svc.eliminar(evidencia_id)


@router.post("/{evidencia_id}/firmantes", response_model=EvidenciaConFirmasResponse)
async def agregar_firmante(
    evidencia_id: int, data: FirmanteAsignar,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.agregar_firmante(evidencia_id, data)


@router.delete("/firmantes/{firma_id}", response_model=EvidenciaConFirmasResponse)
async def quitar_firmante(
    firma_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: EvidenciaCapacitacionService = Depends(_svc),
):
    return await svc.quitar_firmante(firma_id)
```

(Nota: `/mis-firmas` y `/firmas/{id}/firmar` se declaran antes que `/{evidencia_id}` para que FastAPI no interprete `mis-firmas` como un id. Verifica el orden.)

- [ ] **Step 4: Registrar router + `api_prefixes` + self-service prefix**

En `app/main.py`: `from app.api.v1.evidencias import router as evidencias_router` + `app.include_router(evidencias_router)`.

En `app/core/rh_module_registry.py`, `RhModuleDef["evidencias"]`: `api_prefixes=("/api/v1/level-up/evidencias",)`. Y en `RH_SELF_SERVICE_API_PREFIXES` añade `"/api/v1/level-up/evidencias/mis-firmas"` y `"/api/v1/level-up/evidencias/firmas"`.

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -k api -v`
Expected: PASS

- [ ] **Step 6: Actualizar `openapi.yaml`**

Añade los paths bajo `/api/v1/level-up/evidencias` (gestión + `/mis-firmas` + `/firmas/{id}/firmar`) y los schemas `EvidenciaConFirmasResponse`, `EvidenciaFirmaItem`, `FirmanteAsignar`, `EvidenciaCrearRequest`, `FirmarRequest`. Sigue el estilo de los paths de level-up.

- [ ] **Step 7: Correr la suite del módulo (sin regresiones)**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add app/api/v1/evidencias/ app/main.py app/core/rh_module_registry.py openapi.yaml tests/test_evidencias_capacitacion.py
git commit -m "feat(evidencias): router, registro de modulo y openapi

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — gestión RH

**Files:**
- Create: `frontend/src/api/evidencias.ts`, `frontend/src/pages/evidencias.ts`
- Modify: `frontend/src/shellRouter.ts` (+ nav si aplica)
- Verify: `docker-compose exec -T frontend npm run build` + `npm run test`

**Interfaces:**
- Consumes: los endpoints de gestión (Task 4); selectores de empleados/capacitaciones existentes; tokens de `uiTokens.ts`.

- [ ] **Step 1: Leer patrones**

Lee `design.md`. Estudia una página de gestión RH role-adaptive con modal (p. ej. `frontend/src/pages/sugerencias`… — vive en `levelUp.ts`; o `cicloDesempeno.ts` para el modal). Estudia `frontend/src/api/sugerencias.ts` (mecanismo fetch) y cómo se registra una ruta en `shellRouter.ts` con `.catch` (ver el patrón de metas/historial-objetivo). Localiza los selectores de empleados y de capacitaciones existentes (`getCursos`/empleados options).

- [ ] **Step 2: Api client**

Crea `frontend/src/api/evidencias.ts` con tipos espejo (`EvidenciaResponse` con `firmas`, `firmas_total`, `firmas_firmadas`; `FirmaItem`) y funciones: `listarEvidencias({empleado_id?,capacitacion_id?,estado?})`, `crearEvidencia(payload)`, `obtenerEvidencia(id)`, `actualizarEvidencia(id,payload)`, `eliminarEvidencia(id)`, `agregarFirmante(id,{firmante_id,rol_firma})`, `quitarFirmante(firmaId)`. Usa el mecanismo de fetch existente.

- [ ] **Step 3: Página de gestión**

Crea `frontend/src/pages/evidencias.ts` (`mountEvidencias(container, signal)`): lista de evidencias (empleado, capacitación, tipo, link abrible, estado con badge, progreso `firmas_firmadas/firmas_total`); modal de crear (tipo, `archivo_url`, empleado [selector], capacitación [selector opcional], notas, firmantes [empleado + rol, agregar varios]); detalle con las firmas (rol, firmante, estado, comentario) y agregar/quitar firmante; editar link/notas; eliminar con confirmación. Estados carga/vacío/error con tokens. `escapeHtml` en todo string. Ruta en `shellRouter.ts` (`#/evidencias`) con `.catch` que renderice el error. Añade el ítem de nav si el grupo "Cumplimiento" lo requiere (el `nav_item_ids=("evidencias",)` ya existe en el registro; verifica el nav frontend).

- [ ] **Step 4: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build` → limpio.
Run: `docker-compose exec -T frontend npm run test` → verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/evidencias.ts frontend/src/pages/evidencias.ts frontend/src/shellRouter.ts
git commit -m "feat(evidencias): pagina de gestion RH de evidencias

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — self-service "Mis firmas"

**Files:**
- Modify: `frontend/src/api/evidencias.ts` (`getMisFirmas`, `firmar`)
- Create: `frontend/src/pages/misFirmas.ts`
- Modify: `frontend/src/shellRouter.ts` (+ nav del empleado)
- Verify: build + tests

**Interfaces:**
- Consumes: `GET /mis-firmas`, `POST /firmas/{id}/firmar` (Task 4).

- [ ] **Step 1: Api client self-service**

En `frontend/src/api/evidencias.ts` añade `getMisFirmas()` y `firmar(firmaId, {estado, comentario})`. Nota: la firma que le toca al usuario está dentro de `evidencia.firmas` con `firmante_id == yo`; el endpoint de listado devuelve las evidencias pendientes del token, y para firmar se usa el `id` de la fila de firma propia.

- [ ] **Step 2: Página self-service**

Crea `frontend/src/pages/misFirmas.ts` (`mountMisFirmas(container, signal)`): lista de evidencias que el usuario debe firmar (contexto: empleado evaluado, capacitación, notas, link abrible); por cada una, botones **Firmar** y **Rechazar** (con campo comentario) que llaman `firmar(miFirmaId, {estado})` → recargar. Estados carga/vacío ("No tienes firmas pendientes")/error. `escapeHtml`. Ruta `#/mis-firmas` en `shellRouter.ts` con `.catch`, visible en el menú del empleado (patrón self-service, como `mis-encuestas`/`mis-metas`).

- [ ] **Step 3: Verificar build y tests**

Run: `docker-compose exec -T frontend npm run build` → limpio + `npm run test` verde.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/evidencias.ts frontend/src/pages/misFirmas.ts frontend/src/shellRouter.ts
git commit -m "feat(evidencias): vista self-service de mis firmas pendientes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Cierre de huecos de cobertura

**Files:**
- Modify: `tests/test_evidencias_capacitacion.py`

- [ ] **Step 1: Añadir tests de huecos** (declara con el nombre del test existente si ya está cubierto)

1. **Derivación tras quitar firma rechazada**: evidencia con 2 firmas (1 firmada, 1 rechazada → `devuelta`); quitar la rechazada → si la restante está firmada → `validada`.
2. **Firmante duplicado (unique)**: `agregar_firmante` con el mismo (firmante, rol) ya asignado → `ConflictError`.
3. **Firmar firma inexistente** → `NotFoundError` (404).
4. **Eliminar evidencia borra sus firmas** (cascade): tras `eliminar`, las firmas no existen.
5. **API `/mis-firmas`**: un firmante que ya firmó no ve la evidencia en pendientes.

- [ ] **Step 2: Correr la suite del módulo**

Run: `docker-compose run --rm test pytest tests/test_evidencias_capacitacion.py -q`
Expected: PASS

- [ ] **Step 3: Correr la suite completa (sin regresiones)**

Run: `docker-compose run --rm test pytest -q`
Expected: sin fallos nuevos vs. baseline.

- [ ] **Step 4: Commit**

```bash
git add tests/test_evidencias_capacitacion.py
git commit -m "test(evidencias): cerrar huecos de cobertura

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verificación final

- `docker-compose run --rm test pytest -q` verde sin regresiones.
- `docker-compose exec frontend npm run build` limpio + `npm run test` verde.
- Manual: como RH, `#/evidencias` → crear evidencia (link + empleado + firmantes); como cada firmante, `#/mis-firmas` → firmar/rechazar; verificar que la evidencia pasa a `validada` (todas firman) o `devuelta` (un rechazo).
- Activa el segundo placeholder de Aprendizaje (Evidencias). Follow-up: OPLs; modo "RH registra la firma" para operadores sin cuenta.
