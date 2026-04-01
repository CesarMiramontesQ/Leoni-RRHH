# Modo Lectura de Usuarios + Edición Restringida RH — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la creación de usuarios desde el sistema y reemplazar el update completo por un PATCH restringido a supervisor_id y rol_id (solo RH).

**Architecture:** Backend-first con TDD: tests antes de implementación. Router `/api/v1/usuarios` pierde `POST /` y `PUT /{id}`; gana `PATCH /{id}` con schema `UsuarioAsignacionUpdate`. Frontend elimina los componentes de creación y agrega `editarAsignacionModal.ts` con solo 2 campos.

**Tech Stack:** FastAPI 0.115 · SQLAlchemy 2.x async · Pydantic v2 · pytest + pytest-asyncio + httpx + aiosqlite · Vanilla TypeScript + Vite

---

## File Map

### Backend — modificaciones
| Archivo | Acción |
|---|---|
| `app/schemas/usuarios.py` | Eliminar `UsuarioCreate`, `UsuarioUpdate`; agregar `UsuarioAsignacionUpdate` |
| `app/services/usuario_service.py` | Eliminar `crear_usuario()`, `actualizar_usuario()`; agregar `asignar_supervisor_y_rol()` |
| `app/api/v1/usuarios/router.py` | Eliminar `POST /`; reemplazar `PUT /{id}` → `PATCH /{id}` |
| `tests/test_usuarios.py` | Nuevo — suite TDD para el dominio usuarios |

### Frontend — modificaciones
| Archivo | Acción |
|---|---|
| `frontend/src/api/usuariosAdmin.ts` | Reescribir: quitar creación, agregar `patchUsuarioAsignacion()` |
| `frontend/src/components/empleados/nuevoEmpleadoButton.ts` | Eliminar |
| `frontend/src/components/empleados/nuevoEmpleadoModal.ts` | Eliminar |
| `frontend/src/components/empleados/editarAsignacionModal.ts` | Nuevo componente |
| `frontend/src/pages/empleados.ts` | Quitar creación; agregar edición de asignación |

---

## Task 1: Escribir tests backend (TDD — deben fallar)

**Files:**
- Create: `tests/test_usuarios.py`

- [ ] **Step 1: Crear el archivo de tests**

```python
# tests/test_usuarios.py
"""
Tests del dominio usuarios — modo lectura con edición restringida.

Cubre:
  - POST /api/v1/usuarios no existe (404 o 405)
  - PATCH /api/v1/usuarios/{id} — RH cambia supervisor_id y rol_id → 200
  - PATCH /api/v1/usuarios/{id} — rol != rh → 403
  - PATCH /api/v1/usuarios/{id} — empleado no encontrado → 404
  - PATCH /api/v1/usuarios/{id} — body vacío → 200 sin cambios
  - GET /api/v1/usuarios/{id} — RH puede ver un empleado → 200
  - GET /api/v1/usuarios/roles — RH puede listar roles → 200
"""

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, make_empleado


# ---------------------------------------------------------------------------
# TC-USR-001: POST /api/v1/usuarios no debe existir
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_crear_usuario_endpoint_eliminado(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_post@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.post(
        "/api/v1/usuarios",
        json={
            "num_empleado": "EMP-X",
            "nombre": "X",
            "apellido": "Y",
            "email": "x@leoni.test",
            "password": "Passw0rd!Seguro",
            "rol_id": 1,
        },
        headers=headers,
    )

    assert response.status_code in (404, 405)


# ---------------------------------------------------------------------------
# TC-USR-002: PATCH — RH actualiza supervisor_id → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_asignacion_supervisor_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_patch@leoni.test")
    supervisor = await make_empleado(db, rol="supervisor", email="sup_patch@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_patch@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"supervisor_id": supervisor.id},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["supervisor_id"] == supervisor.id
    assert body["id"] == empleado.id


# ---------------------------------------------------------------------------
# TC-USR-003: PATCH — RH actualiza rol_id → 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_asignacion_rol_rh_retorna_200(client: AsyncClient, db):
    from sqlalchemy import select
    from app.models.roles import Rol

    rh = await make_empleado(db, rol="rh", email="rh_rol@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_rol@leoni.test")
    headers = await auth_headers(client, rh)

    # Obtener id del rol supervisor
    result = await db.execute(select(Rol).where(Rol.nombre == "supervisor"))
    rol_supervisor = result.scalar_one_or_none()
    if not rol_supervisor:
        from app.models.roles import Rol as RolModel
        rol_supervisor = RolModel(nombre="supervisor", permisos={})
        db.add(rol_supervisor)
        await db.flush()
        await db.refresh(rol_supervisor)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"rol_id": rol_supervisor.id},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rol_id"] == rol_supervisor.id


# ---------------------------------------------------------------------------
# TC-USR-004: PATCH — rol gerente recibe 403
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_asignacion_gerente_retorna_403(client: AsyncClient, db):
    gerente = await make_empleado(db, rol="gerente", email="gerente_patch@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_403@leoni.test")
    headers = await auth_headers(client, gerente)

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={"supervisor_id": None},
        headers=headers,
    )

    assert response.status_code == 403


# ---------------------------------------------------------------------------
# TC-USR-005: PATCH — empleado no existe → 404
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_asignacion_empleado_inexistente_retorna_404(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_404@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.patch(
        "/api/v1/usuarios/999999",
        json={"supervisor_id": None},
        headers=headers,
    )

    assert response.status_code == 404


# ---------------------------------------------------------------------------
# TC-USR-006: PATCH — body vacío retorna 200 sin cambios
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_patch_asignacion_body_vacio_retorna_200_sin_cambios(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_empty@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_empty@leoni.test")
    headers = await auth_headers(client, rh)
    rol_id_original = empleado.rol_id

    response = await client.patch(
        f"/api/v1/usuarios/{empleado.id}",
        json={},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["rol_id"] == rol_id_original


# ---------------------------------------------------------------------------
# TC-USR-007: GET /{id} — RH puede ver un empleado
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_usuario_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_get@leoni.test")
    empleado = await make_empleado(db, rol="empleado", email="emp_get@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get(f"/api/v1/usuarios/{empleado.id}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == empleado.id


# ---------------------------------------------------------------------------
# TC-USR-008: GET /roles — RH puede listar roles
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_roles_rh_retorna_200(client: AsyncClient, db):
    rh = await make_empleado(db, rol="rh", email="rh_roles@leoni.test")
    headers = await auth_headers(client, rh)

    response = await client.get("/api/v1/usuarios/roles", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    assert "id" in body[0]
    assert "nombre" in body[0]
```

---

## Task 2: Verificar que los tests fallan

**Files:** (ninguno — solo ejecución)

- [ ] **Step 1: Correr los tests nuevos**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
pytest tests/test_usuarios.py -v
```

Resultado esperado:
- `TC-USR-001` FALLA — el `POST` actualmente existe y retorna 201
- `TC-USR-002` FALLA — el endpoint es `PUT`, no `PATCH`
- `TC-USR-003` FALLA — el endpoint es `PUT`, no `PATCH`
- `TC-USR-004` FALLA — el endpoint es `PUT`, no `PATCH`
- `TC-USR-005` FALLA — el endpoint es `PUT`, no `PATCH`
- `TC-USR-006` FALLA — el endpoint es `PUT`, no `PATCH`
- `TC-USR-007` PASS — ya existe `GET /{id}` (este test puede pasar)
- `TC-USR-008` PASS — ya existe `GET /roles` (este test puede pasar)

---

## Task 3: Modificar schemas — eliminar UsuarioCreate/UsuarioUpdate, agregar UsuarioAsignacionUpdate

**Files:**
- Modify: `app/schemas/usuarios.py`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```python
# app/schemas/usuarios.py
"""
Schemas Pydantic v2 para el dominio usuarios/empleados.
Separados del schema de empleados para no contaminar el modulo ya existente.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class UsuarioAsignacionUpdate(BaseModel):
    """Solo RH puede usar este schema. Permite cambiar únicamente supervisor y rol."""

    model_config = {"str_strip_whitespace": True}

    supervisor_id: Optional[int] = None
    rol_id: Optional[int] = None


class RolBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str


class UsuarioResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    num_empleado: str
    nombre: str
    apellido: str
    email: str
    departamento: Optional[str] = None
    puesto: Optional[str] = None
    rol_id: int
    rol: Optional[RolBrief] = None
    supervisor_id: Optional[int] = None
    activo: bool
    fecha_ingreso: Optional[date] = None
    created_at: datetime


class UsuarioListItem(UsuarioResponse):
    """Fila de listado RH con nombre del supervisor resuelto."""

    supervisor_nombre: Optional[str] = None


class UsuarioPageResponse(BaseModel):
    items: list[UsuarioListItem]
    total: int
    page: int
    page_size: int


class UsuarioResumenResponse(BaseModel):
    total_plantilla: int
    activos: int
    capacitacion_pendiente: int
    practicantes: int
    porcentaje_operatividad: float


class CatalogoFiltrosResponse(BaseModel):
    departamentos: list[str]
    puestos: list[str]


class SolicitudBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    tipo: str
    estado: str
    fecha_inicio: date
    fecha_fin: date
    created_at: datetime


class IncidenciaBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    tipo: str
    estado: str
    created_at: datetime


class ActaBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    estado: str
    created_at: datetime


class UsuarioVista360Response(BaseModel):
    model_config = {"from_attributes": True}

    usuario: UsuarioResponse
    solicitudes_recientes: list[SolicitudBrief]
    incidencias_activas: list[IncidenciaBrief]
    actas_firmadas: list[ActaBrief]
    saldo_vacaciones: int


class MetricasUsuarioResponse(BaseModel):
    solicitudes_por_estado: dict[str, int]
    incidencias_por_tipo: dict[str, int]
    dias_antiguedad: int
    total_actas: int
```

---

## Task 4: Modificar el Service — quitar crear/actualizar, agregar asignar_supervisor_y_rol

**Files:**
- Modify: `app/services/usuario_service.py`

- [ ] **Step 1: Actualizar el bloque de imports del schema**

Localizar este bloque en `app/services/usuario_service.py`:

```python
from app.schemas.usuarios import (
    ActaBrief,
    CatalogoFiltrosResponse,
    IncidenciaBrief,
    MetricasUsuarioResponse,
    RolBrief,
    SolicitudBrief,
    UsuarioCreate,
    UsuarioListItem,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioResponse,
    UsuarioUpdate,
    UsuarioVista360Response,
)
```

Reemplazarlo por:

```python
from app.schemas.usuarios import (
    ActaBrief,
    CatalogoFiltrosResponse,
    IncidenciaBrief,
    MetricasUsuarioResponse,
    RolBrief,
    SolicitudBrief,
    UsuarioAsignacionUpdate,
    UsuarioListItem,
    UsuarioPageResponse,
    UsuarioResumenResponse,
    UsuarioResponse,
    UsuarioVista360Response,
)
```

- [ ] **Step 2: Eliminar el método `crear_usuario`**

Localizar y eliminar completamente este bloque (desde el comentario hasta el `return`):

```python
    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear_usuario(
        self,
        data: UsuarioCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede crear usuarios")

        # Verificar unicidad de email
        existente = await self.repo.get_by_email(data.email)
        if existente:
            raise ConflictError(detail=f"Ya existe un usuario con email '{data.email}'")

        # Verificar unicidad de num_empleado
        existente_num = await self.repo.get_by_num_empleado(data.num_empleado)
        if existente_num:
            raise ConflictError(
                detail=f"Ya existe un usuario con num_empleado '{data.num_empleado}'"
            )

        password_hash = get_password_hash(data.password)
        usuario = await self.repo.create({
            "num_empleado": data.num_empleado,
            "nombre": data.nombre,
            "apellido": data.apellido,
            "email": data.email,
            "password_hash": password_hash,
            "departamento": data.departamento,
            "puesto": data.puesto,
            "rol_id": data.rol_id,
            "supervisor_id": data.supervisor_id,
            "fecha_ingreso": data.fecha_ingreso,
            "activo": True,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_CREATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=usuario.id,
            datos_despues={
                "num_empleado": usuario.num_empleado,
                "email": usuario.email,
                "rol_id": usuario.rol_id,
            },
        )

        # Recargar con rol para la respuesta
        usuario = await self.repo.get_with_rol(usuario.id)
        return UsuarioResponse.model_validate(usuario)
```

- [ ] **Step 3: Eliminar el método `actualizar_usuario` y reemplazarlo por `asignar_supervisor_y_rol`**

Localizar y reemplazar este bloque:

```python
    # ── Actualizar ────────────────────────────────────────────────────────────

    async def actualizar_usuario(
        self,
        id: int,
        data: UsuarioUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        rol = self._get_rol(current_user)
        if rol != "rh":
            raise ForbiddenError(detail="Solo RH puede actualizar usuarios")

        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        datos_antes = {
            "nombre": usuario.nombre,
            "apellido": usuario.apellido,
            "departamento": usuario.departamento,
            "puesto": usuario.puesto,
            "rol_id": usuario.rol_id,
        }

        cambios = data.model_dump(exclude_none=True)
        if not cambios:
            return UsuarioResponse.model_validate(usuario)

        usuario = await self.repo.update(id, cambios)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_UPDATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues=cambios,
        )

        usuario = await self.repo.get_with_rol(id)
        return UsuarioResponse.model_validate(usuario)
```

Por:

```python
    # ── Asignar supervisor y rol (única edición permitida) ────────────────────

    async def asignar_supervisor_y_rol(
        self,
        id: int,
        data: UsuarioAsignacionUpdate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> UsuarioResponse:
        self._require_rh_only(current_user)

        usuario = await self.repo.get_with_rol(id)
        if not usuario:
            raise NotFoundError(entidad="Usuario", id=id)

        cambios = data.model_dump(exclude_none=True)
        if not cambios:
            return UsuarioResponse.model_validate(usuario)

        datos_antes = {k: getattr(usuario, k) for k in cambios}

        await self.repo.update(id, cambios)

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="USUARIO_ASIGNACION_UPDATED",
            modulo="usuarios",
            usuario_id=current_user.id,
            entidad_id=id,
            datos_antes=datos_antes,
            datos_despues=cambios,
        )

        usuario = await self.repo.get_with_rol(id)
        return UsuarioResponse.model_validate(usuario)
```

- [ ] **Step 4: Eliminar el import de `get_password_hash` si no tiene otro uso**

Verificar que `from app.core.security import hash_password as get_password_hash` no lo usa ningún otro método. Si solo lo usaba `crear_usuario`, eliminar esa línea.

---

## Task 5: Modificar el Router — eliminar POST, reemplazar PUT con PATCH

**Files:**
- Modify: `app/api/v1/usuarios/router.py`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```python
# app/api/v1/usuarios/router.py
"""
Directorio administrativo de usuarios — solo RH.

Operaciones disponibles:
  - GET /roles           — catálogo de roles
  - GET /{id}            — detalle de un empleado
  - PATCH /{id}          — editar solo supervisor_id y rol_id
  - DELETE /{id}         — desactivar empleado (soft delete)

Creación de empleados: no disponible — los empleados se sincronizan desde IT Mirror/TRESS.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.usuarios import (
    RolBrief,
    UsuarioAsignacionUpdate,
    UsuarioResponse,
)
from app.services.usuario_service import UsuarioService

router = APIRouter(prefix="/api/v1/usuarios", tags=["Usuarios"])

_RH = ["rh"]


def _svc(db: AsyncSession = Depends(get_db)) -> UsuarioService:
    return UsuarioService(db)


@router.get("/roles", response_model=list[RolBrief])
async def list_roles(
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Catálogo de roles para formularios de asignación (solo RH)."""
    return await svc.list_roles_rh(current_user=current_user)


@router.get("/{id}", response_model=UsuarioResponse)
async def get_usuario(
    id: int,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    return await svc.get_usuario(id=id, current_user=current_user)


@router.patch("/{id}", response_model=UsuarioResponse)
async def asignar_supervisor_y_rol(
    id: int,
    body: UsuarioAsignacionUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    """Edición restringida: solo supervisor_id y rol_id. Cualquier otro campo es ignorado por el schema."""
    return await svc.asignar_supervisor_y_rol(
        id=id,
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def desactivar_usuario(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(_RH)),
    svc: UsuarioService = Depends(_svc),
):
    await svc.desactivar_usuario(
        id=id,
        current_user=current_user,
        background_tasks=background_tasks,
    )
```

---

## Task 6: Verificar que los tests pasan

**Files:** (ninguno — solo ejecución)

- [ ] **Step 1: Correr la suite completa de usuarios**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
pytest tests/test_usuarios.py -v
```

Resultado esperado: todos los tests PASS.

- [ ] **Step 2: Correr la suite completa para detectar regresiones**

```bash
pytest --tb=short -q
```

Resultado esperado: todos los tests existentes siguen pasando. No debe haber ningún `FAILED`.

---

## Task 7: Commit de cambios backend

- [ ] **Step 1: Commit**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
git add tests/test_usuarios.py \
        app/schemas/usuarios.py \
        app/services/usuario_service.py \
        app/api/v1/usuarios/router.py
git commit -m "feat: replace full user CRUD with read-only + restricted RH assignment patch

- Remove POST /api/v1/usuarios (user creation)
- Remove PUT /api/v1/usuarios/{id} (full update)
- Add PATCH /api/v1/usuarios/{id} accepting only supervisor_id and rol_id
- Add UsuarioAsignacionUpdate schema replacing UsuarioCreate/UsuarioUpdate
- Add asignar_supervisor_y_rol() service method with USUARIO_ASIGNACION_UPDATED audit
- Add test suite tests/test_usuarios.py (8 cases)"
```

---

## Task 8: Reescribir frontend/src/api/usuariosAdmin.ts

**Files:**
- Modify: `frontend/src/api/usuariosAdmin.ts`

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

```typescript
// frontend/src/api/usuariosAdmin.ts
/**
 * Cliente API para operaciones de RH sobre /api/v1/usuarios.
 *
 * Operaciones disponibles:
 *   - fetchUsuariosRoles()       GET /api/v1/usuarios/roles
 *   - patchUsuarioAsignacion()   PATCH /api/v1/usuarios/{id}  (solo supervisor_id y rol_id)
 */

import { fetchWithAuth } from "./http.ts";
import type { RolBrief, UsuarioListItem, UsuariosFetchError } from "./usuarios.ts";

export type { UsuariosFetchError };

export type UsuarioAsignacionPayload = {
  supervisor_id?: number | null;
  rol_id?: number | null;
};

function throwIfNotOk(res: Response, detail: string): never {
  const err: UsuariosFetchError = { status: res.status, detail };
  throw err;
}

async function readErrorDetail(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const j = JSON.parse(raw) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      const parts = j.detail.map((item: unknown) => {
        if (typeof item === "object" && item !== null && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      });
      return parts.join(" · ");
    }
  } catch {
    /* ignore */
  }
  return raw || res.statusText || "Error";
}

export async function fetchUsuariosRoles(): Promise<RolBrief[]> {
  const res = await fetchWithAuth("/api/v1/usuarios/roles");
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as RolBrief[];
}

export async function patchUsuarioAsignacion(
  id: number,
  body: UsuarioAsignacionPayload,
): Promise<UsuarioListItem> {
  const res = await fetchWithAuth(`/api/v1/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throwIfNotOk(res, await readErrorDetail(res));
  return (await res.json()) as UsuarioListItem;
}
```

---

## Task 9: Eliminar componentes de creación de usuarios

**Files:**
- Delete: `frontend/src/components/empleados/nuevoEmpleadoButton.ts`
- Delete: `frontend/src/components/empleados/nuevoEmpleadoModal.ts`

- [ ] **Step 1: Eliminar ambos archivos**

```bash
rm "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH/frontend/src/components/empleados/nuevoEmpleadoButton.ts"
rm "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH/frontend/src/components/empleados/nuevoEmpleadoModal.ts"
```

---

## Task 10: Crear editarAsignacionModal.ts

**Files:**
- Create: `frontend/src/components/empleados/editarAsignacionModal.ts`

- [ ] **Step 1: Crear el archivo completo**

```typescript
// frontend/src/components/empleados/editarAsignacionModal.ts
/**
 * Modal de edición de asignación (solo RH).
 * Permite cambiar únicamente: supervisor y rol del sistema.
 */

import { getEmpleadosPage } from "../../api/empleados.ts";
import { fetchUsuariosRoles, patchUsuarioAsignacion } from "../../api/usuariosAdmin.ts";
import type { RolBrief, UsuarioListItem } from "../../api/usuarios.ts";
import { isUsuariosFetchError } from "../../api/usuarios.ts";
import { showEmpleadosToast } from "./toast.ts";

async function fetchEmpleadosActivosParaSupervisor(): Promise<UsuarioListItem[]> {
  const page_size = 100;
  const acc: UsuarioListItem[] = [];
  let page = 1;
  for (;;) {
    const pg = await getEmpleadosPage({ page, page_size, activo: true });
    acc.push(...pg.items);
    if (pg.items.length < page_size || acc.length >= pg.total) break;
    page += 1;
  }
  return acc;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shellHtml(): string {
  return `
    <div
      id="editar-asignacion-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
    >
      <div
        class="w-full max-w-md rounded-xl border border-border bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-asignacion-title"
      >
        <div class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="editar-asignacion-title" class="text-lg font-semibold text-text-primary">Editar asignación</h2>
            <p class="mt-0.5 text-xs text-text-muted">Solo se pueden cambiar el supervisor y el rol del sistema.</p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            data-close-modal
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-asignacion-modal-body" class="px-5 py-4"></div>
      </div>
    </div>`;
}

function loadingBodyHtml(): string {
  return `
    <div class="flex items-center gap-3 py-6 text-sm text-text-muted">
      <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Cargando…
    </div>`;
}

function formBodyHtml(
  empleado: UsuarioListItem,
  roles: RolBrief[],
  supervisores: UsuarioListItem[],
): string {
  const roleOpts = roles
    .map(
      (r) =>
        `<option value="${r.id}" ${r.id === empleado.rol_id ? "selected" : ""}>${escapeHtml(r.nombre)}</option>`,
    )
    .join("");

  const supOpts = supervisores
    .filter((u) => u.id !== empleado.id)
    .map((u) => {
      const label = `${u.nombre} ${u.apellido}`.trim() || u.email;
      const sel = u.id === empleado.supervisor_id ? "selected" : "";
      return `<option value="${u.id}" ${sel}>${escapeHtml(label)} · #${escapeHtml(u.num_empleado)}</option>`;
    })
    .join("");

  const name = `${empleado.nombre} ${empleado.apellido}`.trim();

  return `
    <p class="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-text-muted">
      Empleado: <span class="font-semibold text-text-primary">${escapeHtml(name)}</span>
      <span class="ml-1 text-xs">· #${escapeHtml(empleado.num_empleado)}</span>
    </p>
    <p id="editar-asignacion-error" class="mb-4 hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></p>
    <form id="form-editar-asignacion" class="space-y-4">
      <div>
        <label for="ea-rol_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          Rol del sistema
        </label>
        <select id="ea-rol_id" name="rol_id" required
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
          ${roleOpts}
        </select>
      </div>
      <div>
        <label for="ea-supervisor_id" class="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted">
          Supervisor
        </label>
        <select id="ea-supervisor_id" name="supervisor_id"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary focus:border-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue">
          <option value="" ${!empleado.supervisor_id ? "selected" : ""}>Sin supervisor</option>
          ${supOpts}
        </select>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <button type="button" data-close-modal
          class="rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface">
          Cancelar
        </button>
        <button type="submit" id="ea-submit"
          class="rounded-lg bg-leoni-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-leoni-blue-light focus:outline-none focus:ring-2 focus:ring-leoni-blue focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          Guardar cambios
        </button>
      </div>
    </form>`;
}

export type EditarAsignacionModalOptions = {
  onSuccess: () => void | Promise<void>;
  onSessionExpired: () => void;
  toastContainer: HTMLElement;
  signal: AbortSignal;
};

export type EditarAsignacionModalHandle = {
  open: (empleado: UsuarioListItem) => Promise<void>;
  close: () => void;
  destroy: () => void;
};

export function mountEditarAsignacionModal(
  host: HTMLElement,
  options: EditarAsignacionModalOptions,
): EditarAsignacionModalHandle {
  host.innerHTML = shellHtml();

  const overlay = host.querySelector("#editar-asignacion-overlay") as HTMLElement | null;
  const body = host.querySelector("#editar-asignacion-modal-body") as HTMLElement | null;

  if (!overlay || !body) {
    return {
      open: async () => {},
      close: () => {},
      destroy: () => { host.innerHTML = ""; },
    };
  }

  // Catálogos cacheados entre aperturas para evitar llamadas repetidas
  let rolesCache: RolBrief[] | null = null;
  let supervisoresCache: UsuarioListItem[] | null = null;

  function showError(msg: string): void {
    const el = host.querySelector("#editar-asignacion-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideError(): void {
    const el = host.querySelector("#editar-asignacion-error") as HTMLElement | null;
    if (!el) return;
    el.textContent = "";
    el.classList.add("hidden");
  }

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function bindFormSubmit(empleado: UsuarioListItem): void {
    const form = host.querySelector("#form-editar-asignacion") as HTMLFormElement | null;
    if (!form) return;

    form.addEventListener(
      "submit",
      async (ev) => {
        ev.preventDefault();
        hideError();

        const fd = new FormData(form);

        const rolRaw = String(fd.get("rol_id") ?? "");
        const rol_id = Number.parseInt(rolRaw, 10);
        if (Number.isNaN(rol_id)) {
          showError("Selecciona un rol.");
          return;
        }

        const supRaw = String(fd.get("supervisor_id") ?? "").trim();
        const supervisor_id = supRaw === "" ? null : Number.parseInt(supRaw, 10);

        const submitBtn = host.querySelector("#ea-submit") as HTMLButtonElement | null;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Guardando…";
        }

        try {
          await patchUsuarioAsignacion(empleado.id, { rol_id, supervisor_id });
          showEmpleadosToast(options.toastContainer, "Asignación actualizada correctamente.", "success");
          close();
          await options.onSuccess();
        } catch (e: unknown) {
          if (isUsuariosFetchError(e) && e.status === 401) {
            options.onSessionExpired();
            close();
            return;
          }
          const msg = isUsuariosFetchError(e) ? e.detail : "Error al guardar.";
          showError(msg);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Guardar cambios";
          }
        }
      },
      { signal: options.signal },
    );
  }

  overlay.addEventListener(
    "click",
    (e) => {
      if (e.target === overlay) close();
    },
    { signal: options.signal },
  );

  host.addEventListener(
    "click",
    (e) => {
      const t = (e.target as HTMLElement).closest("[data-close-modal]");
      if (t) close();
    },
    { signal: options.signal },
  );

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
        e.preventDefault();
        close();
      }
    },
    { signal: options.signal },
  );

  return {
    open: async (empleado: UsuarioListItem) => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      body.innerHTML = loadingBodyHtml();

      try {
        if (!rolesCache || !supervisoresCache) {
          const [roles, sups] = await Promise.all([
            fetchUsuariosRoles(),
            fetchEmpleadosActivosParaSupervisor(),
          ]);
          rolesCache = roles;
          supervisoresCache = sups;
        }
        body.innerHTML = formBodyHtml(empleado, rolesCache, supervisoresCache);
        bindFormSubmit(empleado);
        const firstInput = host.querySelector<HTMLElement>("#editar-asignacion-modal-body select");
        firstInput?.focus();
      } catch (e: unknown) {
        if (isUsuariosFetchError(e) && e.status === 401) {
          options.onSessionExpired();
          close();
          return;
        }
        const msg = isUsuariosFetchError(e) ? e.detail : "No se pudo cargar el formulario.";
        body.innerHTML = `<p class="text-sm text-red-700">${escapeHtml(msg)}</p>
          <button type="button" data-close-modal
            class="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Cerrar</button>`;
      }
    },
    close,
    destroy: () => {
      host.innerHTML = "";
      document.body.style.overflow = "";
    },
  };
}
```

---

## Task 11: Modificar frontend/src/pages/empleados.ts

**Files:**
- Modify: `frontend/src/pages/empleados.ts`

Hacer los siguientes 5 cambios en orden. Cada uno muestra el texto exacto a buscar y su reemplazo.

- [ ] **Step 1: Actualizar imports — quitar modal de creación, agregar modal de edición**

Localizar:
```typescript
import { renderNuevoEmpleadoButton } from "../components/empleados/nuevoEmpleadoButton.ts";
import { mountNuevoEmpleadoModal } from "../components/empleados/nuevoEmpleadoModal.ts";
```

Reemplazar por:
```typescript
import { mountEditarAsignacionModal } from "../components/empleados/editarAsignacionModal.ts";
import type { EditarAsignacionModalHandle } from "../components/empleados/editarAsignacionModal.ts";
```

- [ ] **Step 2: Agregar variable de estado para items actuales**

Localizar esta declaración de `state` en `mountEmpleados`:
```typescript
  const state: State = {
    page: 1,
    page_size: 10,
    q: "",
    departamento: "",
    puesto: "",
    activo: "",
  };
```

Reemplazar por:
```typescript
  const state: State = {
    page: 1,
    page_size: 10,
    q: "",
    departamento: "",
    puesto: "",
    activo: "",
  };

  let currentPageItems: UsuarioListItem[] = [];
```

- [ ] **Step 3: Modificar `rowHtml` para agregar columna de edición**

Localizar la firma y el `return` de `rowHtml`:
```typescript
function rowHtml(u: UsuarioListItem): string {
  const name = `${u.nombre} ${u.apellido}`.trim();
  const ini = initials(u.nombre, u.apellido);
  const sup = u.supervisor_nombre?.trim() || "—";
  const area = u.departamento?.trim() || "—";
  const puesto = u.puesto?.trim() || "—";
  return `
    <tr class="border-b border-slate-100 last:border-0 transition-colors hover:bg-surface">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>
          <div>
            <p class="text-sm font-semibold text-text-primary">${escapeHtml(name)}</p>
            <p class="text-xs text-text-muted">${escapeHtml(u.email)}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-text-muted">#${escapeHtml(u.num_empleado)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(area)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(puesto)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(sup)}</td>
      <td class="px-4 py-3">${statusPill(u.activo)}</td>
    </tr>`;
}
```

Reemplazar por:
```typescript
function rowHtml(u: UsuarioListItem, isRh: boolean): string {
  const name = `${u.nombre} ${u.apellido}`.trim();
  const ini = initials(u.nombre, u.apellido);
  const sup = u.supervisor_nombre?.trim() || "—";
  const area = u.departamento?.trim() || "—";
  const puesto = u.puesto?.trim() || "—";
  return `
    <tr class="border-b border-slate-100 last:border-0 transition-colors hover:bg-surface">
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>
          <div>
            <p class="text-sm font-semibold text-text-primary">${escapeHtml(name)}</p>
            <p class="text-xs text-text-muted">${escapeHtml(u.email)}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm text-text-muted">#${escapeHtml(u.num_empleado)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(area)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(puesto)}</td>
      <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(sup)}</td>
      <td class="px-4 py-3">${statusPill(u.activo)}</td>
      ${isRh ? `<td class="px-4 py-3">
        <button
          type="button"
          data-edit-empleado-id="${u.id}"
          class="rounded-lg p-1.5 text-text-muted hover:bg-surface hover:text-leoni-blue focus:outline-none focus:ring-1 focus:ring-leoni-blue"
          aria-label="Editar asignación de ${escapeHtml(name)}"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
          </svg>
        </button>
      </td>` : ""}
    </tr>`;
}
```

- [ ] **Step 4: Actualizar `renderPanel` — nuevo header y llamada a `rowHtml` con `isRh`**

Localizar dentro de `renderPanel` el bloque del thead y la variable `rows`:
```typescript
  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-text-muted">No hay empleados con los filtros actuales.</td></tr>`
      : pg.items.map(rowHtml).join("");
```

Reemplazar por:
```typescript
  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="${isRh ? 7 : 6}" class="px-4 py-10 text-center text-sm text-text-muted">No hay empleados con los filtros actuales.</td></tr>`
      : pg.items.map((u) => rowHtml(u, isRh)).join("");
```

Localizar el thead dentro de `renderPanel`:
```typescript
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Empleado</th>
              <th class="px-4 py-3">Número</th>
              <th class="px-4 py-3">Área</th>
              <th class="px-4 py-3">Puesto</th>
              <th class="px-4 py-3">Supervisor</th>
              <th class="px-4 py-3">Estatus</th>
            </tr>
          </thead>
```

Reemplazar por:
```typescript
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Empleado</th>
              <th class="px-4 py-3">Número</th>
              <th class="px-4 py-3">Área</th>
              <th class="px-4 py-3">Puesto</th>
              <th class="px-4 py-3">Supervisor</th>
              <th class="px-4 py-3">Estatus</th>
              ${isRh ? `<th class="px-4 py-3"><span class="sr-only">Acciones</span></th>` : ""}
            </tr>
          </thead>
```

- [ ] **Step 5: Modificar `mountEmpleados` — quitar creación, agregar modal de edición**

Localizar el `mainHtml` que incluye el botón y el modal host:
```typescript
    mainHtml: `
      <div id="empleados-root" class="space-y-6">
        <div class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 class="text-2xl font-bold tracking-tight text-slate-800">Empleados</h1>
          ${isRh ? renderNuevoEmpleadoButton() : ""}
        </div>
```

Reemplazar por:
```typescript
    mainHtml: `
      <div id="empleados-root" class="space-y-6">
        <div class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 class="text-2xl font-bold tracking-tight text-slate-800">Empleados</h1>
        </div>
```

Localizar al final del `mainHtml` y después, el bloque de montaje del modal de creación:
```typescript
      ${isRh ? `<div id="nuevo-empleado-modal-host"></div>` : ""}`,
  });

  const empleadosRoot = container.querySelector("#empleados-root") as HTMLElement | null;
  const modalHost = container.querySelector("#nuevo-empleado-modal-host") as HTMLElement | null;
  if (isRh && empleadosRoot && modalHost) {
    const modal = mountNuevoEmpleadoModal(modalHost, {
      getCatalogo: () => catalogo,
      onSuccess: () => void init(),
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      toastContainer: empleadosRoot,
      signal,
    });
    container.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("#btn-nuevo-empleado")) void modal.open();
      },
      { signal },
    );
  }
```

Reemplazar por:
```typescript
      ${isRh ? `<div id="editar-asignacion-modal-host"></div>` : ""}`,
  });

  const empleadosRoot = container.querySelector("#empleados-root") as HTMLElement | null;
  const editModalHost = container.querySelector("#editar-asignacion-modal-host") as HTMLElement | null;

  let editModal: EditarAsignacionModalHandle | null = null;
  if (isRh && empleadosRoot && editModalHost) {
    editModal = mountEditarAsignacionModal(editModalHost, {
      onSuccess: () => void init(),
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      toastContainer: empleadosRoot,
      signal,
    });
  }

  container.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest<HTMLButtonElement>("[data-edit-empleado-id]");
      if (!btn || !isRh || !editModal) return;
      const id = Number.parseInt(btn.getAttribute("data-edit-empleado-id") ?? "", 10);
      const empleado = currentPageItems.find((u) => u.id === id);
      if (!empleado) return;
      void editModal.open(empleado);
    },
    { signal },
  );
```

- [ ] **Step 6: Actualizar `loadPage` para guardar items en `currentPageItems`**

Localizar dentro de `loadPage`:
```typescript
      const pg = await getEmpleadosPage({
        page: state.page,
        page_size: state.page_size,
        q: state.q,
        departamento: state.departamento || undefined,
        puesto: state.puesto || undefined,
        activo: isRh ? parseActivo(state.activo) : undefined,
      });
      panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
```

Reemplazar por:
```typescript
      const pg = await getEmpleadosPage({
        page: state.page,
        page_size: state.page_size,
        q: state.q,
        departamento: state.departamento || undefined,
        puesto: state.puesto || undefined,
        activo: isRh ? parseActivo(state.activo) : undefined,
      });
      currentPageItems = pg.items;
      panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
```

- [ ] **Step 7: Actualizar `init` para guardar items en `currentPageItems`**

Localizar dentro de `init`:
```typescript
      if (kpis) kpis.innerHTML = renderKpis(res, isRh);
      const panel = panelEl();
      if (panel) panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
```

Reemplazar por:
```typescript
      if (kpis) kpis.innerHTML = renderKpis(res, isRh);
      currentPageItems = pg.items;
      const panel = panelEl();
      if (panel) panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
```

---

## Task 12: Verificar que el frontend compila sin errores

**Files:** (ninguno — solo ejecución)

- [ ] **Step 1: Build de producción**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH/frontend"
npm run build
```

Resultado esperado: build finaliza sin errores TypeScript ni de módulos faltantes. Puede haber warnings de Vite/Rollup sobre chunks, esos son normales.

- [ ] **Step 2: Si el build falla por referencias a archivos eliminados, buscar importaciones residuales**

```bash
grep -r "nuevoEmpleadoButton\|nuevoEmpleadoModal\|renderNuevoEmpleadoButton\|mountNuevoEmpleadoModal\|createUsuario\|UsuarioCreatePayload\|btn-nuevo-empleado" \
  "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH/frontend/src"
```

Resultado esperado: sin coincidencias. Si hay alguna, editar el archivo que la contiene y eliminar la referencia.

---

## Task 13: Commit de cambios frontend

- [ ] **Step 1: Commit**

```bash
cd "/Users/alexmiramontes/Foundation/FastAPI Apps/Leoni RRHH"
git add frontend/src/api/usuariosAdmin.ts \
        frontend/src/components/empleados/editarAsignacionModal.ts \
        frontend/src/pages/empleados.ts
git rm frontend/src/components/empleados/nuevoEmpleadoButton.ts \
      frontend/src/components/empleados/nuevoEmpleadoModal.ts
git commit -m "feat(frontend): replace user creation with restricted assignment editor

- Remove nuevoEmpleadoButton.ts and nuevoEmpleadoModal.ts
- Rewrite usuariosAdmin.ts: drop createUsuario, add patchUsuarioAsignacion (PATCH)
- Add editarAsignacionModal.ts: 2-field form (supervisor + rol) for RH only
- Update empleados.ts: pencil icon per row (RH only), currentPageItems tracking"
```
