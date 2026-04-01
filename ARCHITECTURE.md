# Plataforma RH — Leoni Cable
## Arquitectura Técnica Interna — Documento Constitutivo

**Version:** 1.0  
**Fecha:** 2026-03-30  
**Stack:** FastAPI 0.111+ · Python 3.11+ · SQLAlchemy 2.x async · Pydantic v2 · PostgreSQL  
**Patron:** Monolito Modular con Domain-Driven Design (DDD)

> Este documento es la referencia normativa para el agente `fastapi-backend-architect` y cualquier
> desarrollador que implemente módulos de dominio. Ninguna decisión de implementación debe contradecir
> este documento sin aprobación explicita del arquitecto del sistema.

---

## Tabla de Contenido

1. [Contratos Entre Capas](#1-contratos-entre-capas)
2. [Patrón de Excepción de Dominio](#2-patron-de-excepcion-de-dominio)
3. [Patrón role_checker con Permisos JSONB](#3-patron-role_checker-con-permisos-jsonb)
4. [Patrón de Paginación Cursor-Based](#4-patron-de-paginacion-cursor-based)
5. [Patrón de Audit Logger](#5-patron-de-audit-logger)
6. [Estrategia de Notificaciones](#6-estrategia-de-notificaciones)
7. [Manejo de Archivos — Evidencias](#7-manejo-de-archivos-evidencias)
8. [Integración TRESS — Fire-and-Forget](#8-integracion-tress-fire-and-forget)
9. [Convenciones de Nomenclatura](#9-convenciones-de-nomenclatura)
10. [Template de Módulo Completo — solicitudes](#10-template-de-modulo-completo)
11. [Seed de Base de Datos](#11-seed-de-base-de-datos)

---

## 1. Contratos Entre Capas

### Descripcion del patron

El sistema usa una arquitectura en cuatro capas verticales. Cada capa tiene responsabilidades
exclusivas y restricciones de dependencia estrictas. Violar estas fronteras es el error de
arquitectura más grave que puede ocurrir en este proyecto.

```
HTTP Request
     │
     ▼
┌─────────────┐   Validates HTTP, delegates, returns HTTP
│   Router    │   app/api/v1/{dominio}/router.py
└──────┬──────┘
       │ calls
       ▼
┌─────────────┐   Business rules, workflows, orchestration
│   Service   │   app/services/{dominio}_service.py
└──────┬──────┘
       │ calls
  ┌────┴────┐
  ▼         ▼
┌────┐   ┌──────────────┐
│Repo│   │ Integration  │   Queries only   /   External adapters
└────┘   └──────────────┘   app/repositories/   app/integrations/
```

### 1.1 Router — app/api/v1/{dominio}/router.py

**Responsabilidades:**
- Declarar el endpoint (metodo HTTP, path, tags, response_model, status_code)
- Inyectar dependencias via `Depends` (sesion DB, usuario actual, role_checker, require_huella_ip)
- Recibir y validar el body con schemas Pydantic (FastAPI lo hace automaticamente)
- Llamar al Service y retornar la respuesta
- Pasar `BackgroundTasks` al Service cuando se requieran notificaciones o audit async
- Capturar `LeoniException` SOLO si se necesita informacion del request (IP) para enriquecer el error — en el caso general el handler global en `main.py` lo captura

**Lo que NUNCA debe hacer un Router:**
- Importar `sqlalchemy` ni construir queries
- Contener logica de negocio (validaciones de estado, reglas de flujo, calculos)
- Llamar directamente a un Repository
- Llamar directamente a una Integration
- Llamar a `audit_logger.log_action()` directamente — el Service lo hace
- Hacer multiples llamadas al Service dentro de un mismo endpoint

**Estructura canonica de un endpoint:**

```python
# app/api/v1/solicitudes/router.py

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    SolicitudAprobacionCreate,
    SolicitudCreate,
    SolicitudResponse,
)
from app.services.solicitud_service import SolicitudService

router = APIRouter(prefix="/api/v1/solicitudes", tags=["Solicitudes"])


@router.get("", response_model=PaginatedResponse[SolicitudResponse])
async def list_solicitudes(
    cursor: int | None = Query(None, description="ID del ultimo item recibido"),
    limit: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.list_solicitudes(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
    )


@router.post("", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
async def create_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor", "gerente"])),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.crear_solicitud(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )
```

**Errores comunes a evitar:**
- No poner `try/except` en el router — el handler global en `main.py` captura `LeoniException`
- No acceder a `body.dict()` manualmente — pasar el schema directamente al Service
- No construir el `response_model` a mano — el Service retorna el ORM object y Pydantic lo convierte

---

### 1.2 Service — app/services/{dominio}_service.py

**Responsabilidades:**
- Contener TODA la logica de negocio del dominio
- Orquestar multiples Repository calls dentro de la misma transaccion de `db`
- Llamar a Integrations como adaptadores externos
- Llamar a `audit_logger.log_action()` en cada mutacion
- Llamar a `NotificacionService` para disparar notificaciones
- Lanzar excepciones de dominio (`NotFoundError`, `ConflictError`, etc.)
- Retornar el ORM model o un schema segun el contrato

**Lo que NUNCA debe hacer un Service:**
- Importar `sqlalchemy`, `select`, `func`, ni ninguna primitiva de SQLAlchemy
- Importar `HTTPException` — usar excepciones de dominio propias (`app/core/exceptions.py`)
- Conocer detalles HTTP (status codes, headers, request objects)
- Acceder a `settings` directamente salvo para flags de feature — la logica de config va en el constructor
- Hacer commits (`db.commit()`) — la sesion la gestiona `get_db` en `database.py`

**Patron de instanciacion:**

```python
# app/services/solicitud_service.py

class SolicitudService:
    def __init__(self, db: AsyncSession):
        # Instanciar repositorios aqui — unica dependencia permitida de SQLAlchemy
        self.repo = SolicitudRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db  # solo para pasar a audit_logger y encolar TRESS
```

**Patron de manejo de errores de dominio:**

```python
    async def aprobar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede aprobar una solicitud en estado '{solicitud.estado}'"
            )

        if solicitud.empleado.supervisor_id != current_user.id:
            if current_user.rol.nombre not in ("gerente", "director", "rh"):
                raise ForbiddenError(
                    detail="Solo el supervisor directo o superior puede aprobar esta solicitud"
                )
        # ... resto de la logica
```

**Errores comunes a evitar:**
- No crear dos instancias del mismo repositorio — instanciar una vez en `__init__`
- No mezclar logica de dos dominios distintos dentro de un Service — usar el otro Service como colaborador
- No hacer llamadas await dentro de un `if` sin manejar el None — siempre verificar la entidad antes de usarla

---

### 1.3 Repository — app/repositories/{dominio}_repository.py

**Responsabilidades:**
- Extender `BaseRepository[ModelType]`
- Implementar queries especificas del dominio con SQLAlchemy 2.x
- Usar `selectinload` para cargar relaciones necesarias
- Construir filtros dinamicos como listas de condiciones SQLAlchemy

**Lo que NUNCA debe hacer un Repository:**
- Contener logica de negocio (validaciones de estado, calculos, reglas)
- Lanzar `HTTPException`
- Llamar a otro Repository (el Service orquesta, no el Repository)
- Hacer `db.commit()` — solo `db.flush()` para obtener el ID generado

**Patron de extension de BaseRepository:**

```python
# app/repositories/solicitud_repository.py

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.repositories.base import BaseRepository


class SolicitudRepository(BaseRepository[Solicitud]):
    def __init__(self, db: AsyncSession):
        super().__init__(Solicitud, db)

    async def get_with_empleado(self, solicitud_id: int) -> Solicitud | None:
        result = await self.db.execute(
            select(Solicitud)
            .options(
                selectinload(Solicitud.empleado),
                selectinload(Solicitud.aprobaciones),
            )
            .where(Solicitud.id == solicitud_id)
        )
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def list_by_supervisor(
        self,
        subordinado_ids: list[int],
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id.in_(subordinado_ids)]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)
```

**Patron de selectinload — regla de oro:**

Cargar relaciones en el Repository, no en el Service. El Service no debe hacer `await db.refresh()`.
Cada metodo de query debe cargar las relaciones que el Service necesitara para ejecutar su logica.

**Errores comunes a evitar:**
- No usar `lazy loading` (acceder a `solicitud.empleado` sin haber usado `selectinload`) — con sesiones
  async esto lanza `MissingGreenlet`
- No pasar la sesion de un Repository a otro — la sesion es compartida via `self.db`

---

### 1.4 Integration — app/integrations/{sistema}.py

**Responsabilidades:**
- Ser el unico punto de contacto con sistemas externos (Ollama, TRESS, SMTP, IT Mirror)
- Retornar un resultado tipado o un valor de fallback
- Capturar todas las excepciones del sistema externo y relanzar solo `ServiceUnavailableError`
- Nunca bloquear indefinidamente — usar timeouts explicitos

**Lo que NUNCA debe hacer una Integration:**
- Contener logica de negocio
- Acceder directamente a la DB — si necesita persistir algo, el Service lo hace despues
- Lanzar excepciones no controladas hacia el Service

**Patron de fallback:**

```python
# app/integrations/ollama.py

import httpx
from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError


async def generar_texto_acta(contexto: str) -> str:
    """Llama a Ollama para generar contenido de acta. Retorna string vacio si no disponible."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": contexto,
                    "stream": False,
                    "options": {"temperature": settings.OLLAMA_TEMPERATURE},
                },
            )
            response.raise_for_status()
            return response.json().get("response", "")
    except (httpx.ConnectError, httpx.TimeoutException):
        # Fallback graceful — el acta se crea sin contenido IA
        return ""
    except httpx.HTTPStatusError as e:
        raise ServiceUnavailableError(
            detail=f"Ollama retorno status {e.response.status_code}"
        )
```

**Errores comunes a evitar:**
- No importar `httpx` fuera de `integrations/` — todo cliente HTTP va aqui
- No usar timeouts por defecto de httpx (infinito) — siempre especificar `timeout=N`

---

## 2. Patron de Excepcion de Dominio

### Descripcion del patron

Las capas internas (Service, Repository, Integration) nunca deben lanzar `HTTPException`.
En cambio, lanzan excepciones de dominio propias que el handler global en `main.py` convierte
a `JSONResponse` con el status HTTP correcto. Esto mantiene al Service desacoplado de FastAPI.

### Jerarquia de excepciones

**Archivo:** `app/core/exceptions.py`

```python
# app/core/exceptions.py

from __future__ import annotations


class LeoniException(Exception):
    """Clase base para todas las excepciones de dominio del sistema."""

    def __init__(self, detail: str, code: str | None = None):
        self.detail = detail
        self.code = code or self.__class__.__name__
        super().__init__(detail)


class NotFoundError(LeoniException):
    """Entidad no encontrada. → HTTP 404"""

    def __init__(self, entidad: str, id: int | str | None = None):
        detail = f"{entidad} no encontrado" if id is None else f"{entidad} con id={id} no encontrado"
        super().__init__(detail=detail, code="NOT_FOUND")


class ConflictError(LeoniException):
    """Estado de entidad en conflicto con la operacion solicitada. → HTTP 409"""

    def __init__(self, detail: str):
        super().__init__(detail=detail, code="CONFLICT")


class ForbiddenError(LeoniException):
    """El usuario no tiene permiso para esta operacion especifica. → HTTP 403"""

    def __init__(self, detail: str = "Permiso denegado"):
        super().__init__(detail=detail, code="FORBIDDEN")


class DomainValidationError(LeoniException):
    """Datos de negocio invalidos que Pydantic no puede detectar. → HTTP 422"""

    def __init__(self, detail: str, field: str | None = None):
        self.field = field
        super().__init__(detail=detail, code="VALIDATION_ERROR")


class ServiceUnavailableError(LeoniException):
    """Integracion externa no disponible. → HTTP 503"""

    def __init__(self, detail: str = "Servicio externo no disponible"):
        super().__init__(detail=detail, code="SERVICE_UNAVAILABLE")


# Mapa de excepcion → status HTTP (usado por el handler global)
EXCEPTION_STATUS_MAP: dict[type[LeoniException], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    ForbiddenError: 403,
    DomainValidationError: 422,
    ServiceUnavailableError: 503,
}
```

### Handler global en main.py

Agregar este bloque en `main.py` ANTES del handler generico de `Exception`:

```python
# main.py — agregar despues del handler de RequestValidationError

from app.core.exceptions import LeoniException, EXCEPTION_STATUS_MAP

@app.exception_handler(LeoniException)
async def leoni_exception_handler(request: Request, exc: LeoniException):
    status_code = EXCEPTION_STATUS_MAP.get(type(exc), 400)
    return JSONResponse(
        status_code=status_code,
        content={
            "code": exc.code,
            "detail": exc.detail,
        },
    )
```

### Reglas de uso

| Situacion | Excepcion a lanzar |
|---|---|
| `await repo.get(id)` retorna `None` | `NotFoundError(entidad="Solicitud", id=id)` |
| Solicitud ya aprobada, se intenta aprobar de nuevo | `ConflictError(...)` |
| Empleado intenta ver solicitud de otro sin permiso | `ForbiddenError(...)` |
| Fecha de inicio > fecha de fin | `DomainValidationError(field="fecha_fin", ...)` |
| Ollama no responde (critico) | `ServiceUnavailableError(...)` |
| Duplicado de clave unica en DB | Capturar `IntegrityError` en el Service, lanzar `ConflictError` |

**Errores comunes a evitar:**
- No importar `LeoniException` en el Router — solo en el Service
- No crear excepciones ad-hoc con mensajes inconsistentes — siempre usar la clase correcta
- No capturar `LeoniException` en el Service para relanzar como otra cosa — dejar que suba al handler

---

## 3. Patron role_checker con Permisos JSONB

### Descripcion del patron

El campo `roles.permisos` almacena un JSONB que define capacidades granulares por modulo.
Esto permite dos niveles de autorizacion:

1. **Verificacion por rol** (ya implementada): `role_checker(["supervisor", "rh"])` — verifica que
   el nombre del rol este en la lista. Suficiente para la mayoria de endpoints.

2. **Verificacion por permiso especifico**: `permission_checker("solicitudes.aprobar")` — evalua
   el JSONB para capacidades granulares. Usar cuando dos roles distintos tienen acceso parcial
   al mismo recurso.

### Estructura del JSON de permisos

El JSONB sigue este schema fijo. Todas las claves son obligatorias en el seed:

```json
{
  "solicitudes": {
    "crear": true,
    "ver_propias": true,
    "ver_equipo": false,
    "ver_todas": false,
    "aprobar": false,
    "override": false
  },
  "incidencias": {
    "crear": true,
    "ver_propias": true,
    "ver_todas": false,
    "resolver": false
  },
  "actas": {
    "generar": false,
    "firmar": false,
    "ver": false
  },
  "comedor": {
    "registrar_huella": false,
    "ver_menu": true,
    "administrar": false
  },
  "reportes": {
    "ver_propios": true,
    "ver_todos": false,
    "exportar": false
  },
  "empleados": {
    "ver": false,
    "editar": false,
    "crear": false
  },
  "auditoria": {
    "ver": false
  }
}
```

### permission_checker — factory dependency

```python
# app/core/dependencies.py — agregar a continuacion del role_checker existente

def permission_checker(permiso: str):
    """
    Factory que retorna una dependency para verificar un permiso especifico del JSONB.
    permiso: string en formato 'modulo.accion', ejemplo: 'solicitudes.aprobar'

    Uso:
        current_user: Empleado = Depends(permission_checker("solicitudes.aprobar"))
    """
    modulo, accion = permiso.split(".", 1)

    async def check_permission(
        current_user: Empleado = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> Empleado:
        if not current_user.rol:
            result = await db.execute(
                select(Empleado)
                .options(selectinload(Empleado.rol))
                .where(Empleado.id == current_user.id)
            )
            current_user = result.scalar_one()

        permisos = current_user.rol.permisos if current_user.rol else {}
        tiene_permiso = permisos.get(modulo, {}).get(accion, False)

        if not tiene_permiso:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Sin permiso: {permiso}",
            )
        return current_user

    return check_permission
```

### Diferencia entre role_checker y permission_checker

| Criterio | role_checker | permission_checker |
|---|---|---|
| Cuando usar | Acceso por categoria de usuario | Capacidad especifica dentro de un rol |
| Ejemplo | Solo RH puede ver auditoria | Solo quien tiene `solicitudes.aprobar=true` puede aprobar |
| Costo | O(1) — comparacion de string | O(1) — lookup de dict anidado |
| Recomendacion | Preferir este en el 80% de casos | Solo cuando dos roles tienen acceso parcial distinto |

### Seed SQL — 5 roles con permisos iniciales

```sql
-- app/utils/seed.sql — referencia; el script Python lo ejecuta via ORM
-- Ver seccion 11 para el script Python completo

INSERT INTO roles (nombre, permisos) VALUES
(
  'empleado',
  '{
    "solicitudes": {"crear": true, "ver_propias": true, "ver_equipo": false, "ver_todas": false, "aprobar": false, "override": false},
    "incidencias": {"crear": false, "ver_propias": true, "ver_todas": false, "resolver": false},
    "actas": {"generar": false, "firmar": true, "ver": false},
    "comedor": {"registrar_huella": false, "ver_menu": true, "administrar": false},
    "reportes": {"ver_propios": true, "ver_todos": false, "exportar": false},
    "empleados": {"ver": false, "editar": false, "crear": false},
    "auditoria": {"ver": false}
  }'
),
(
  'supervisor',
  '{
    "solicitudes": {"crear": true, "ver_propias": true, "ver_equipo": true, "ver_todas": false, "aprobar": true, "override": false},
    "incidencias": {"crear": true, "ver_propias": true, "ver_todas": false, "resolver": false},
    "actas": {"generar": false, "firmar": true, "ver": true},
    "comedor": {"registrar_huella": false, "ver_menu": true, "administrar": false},
    "reportes": {"ver_propios": true, "ver_todos": false, "exportar": false},
    "empleados": {"ver": true, "editar": false, "crear": false},
    "auditoria": {"ver": false}
  }'
),
(
  'gerente',
  '{
    "solicitudes": {"crear": true, "ver_propias": true, "ver_equipo": true, "ver_todas": false, "aprobar": true, "override": false},
    "incidencias": {"crear": true, "ver_propias": true, "ver_todas": true, "resolver": true},
    "actas": {"generar": true, "firmar": true, "ver": true},
    "comedor": {"registrar_huella": false, "ver_menu": true, "administrar": false},
    "reportes": {"ver_propios": true, "ver_todos": true, "exportar": true},
    "empleados": {"ver": true, "editar": false, "crear": false},
    "auditoria": {"ver": false}
  }'
),
(
  'director',
  '{
    "solicitudes": {"crear": true, "ver_propias": true, "ver_equipo": true, "ver_todas": true, "aprobar": true, "override": true},
    "incidencias": {"crear": true, "ver_propias": true, "ver_todas": true, "resolver": true},
    "actas": {"generar": true, "firmar": true, "ver": true},
    "comedor": {"registrar_huella": false, "ver_menu": true, "administrar": false},
    "reportes": {"ver_propios": true, "ver_todos": true, "exportar": true},
    "empleados": {"ver": true, "editar": true, "crear": false},
    "auditoria": {"ver": true}
  }'
),
(
  'rh',
  '{
    "solicitudes": {"crear": true, "ver_propias": true, "ver_equipo": true, "ver_todas": true, "aprobar": true, "override": true},
    "incidencias": {"crear": true, "ver_propias": true, "ver_todas": true, "resolver": true},
    "actas": {"generar": true, "firmar": true, "ver": true},
    "comedor": {"registrar_huella": false, "ver_menu": true, "administrar": true},
    "reportes": {"ver_propios": true, "ver_todos": true, "exportar": true},
    "empleados": {"ver": true, "editar": true, "crear": true},
    "auditoria": {"ver": true}
  }'
)
ON CONFLICT (nombre) DO NOTHING;
```

---

## 4. Patron de Paginacion Cursor-Based

### Descripcion del patron

Todos los endpoints de listado usan cursor-based pagination, nunca `OFFSET`. Razon: OFFSET en
PostgreSQL hace un full-scan hasta la pagina N, lo que degrada con tablas grandes. El cursor es
el `id` del ultimo item recibido — la query solo lee registros con `id > cursor`.

`PaginatedResponse` ya existe en `app/schemas/__init__.py`. Nunca crear otro mecanismo de
paginacion en este proyecto.

### Contrato end-to-end

**Router — recibe parametros de paginacion:**

```python
@router.get("", response_model=PaginatedResponse[SolicitudResponse])
async def list_solicitudes(
    cursor: int | None = Query(None, description="ID del ultimo item recibido. Omitir para primera pagina."),
    limit: int = Query(20, ge=1, le=100, description="Items por pagina. Max 100."),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.list_solicitudes(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
    )
```

**Service — arma el PaginatedResponse:**

```python
# app/services/solicitud_service.py

async def list_solicitudes(
    self,
    current_user: Empleado,
    cursor: int | None,
    limit: int,
) -> PaginatedResponse[SolicitudResponse]:
    rol = current_user.rol.nombre if current_user.rol else "empleado"

    if rol in ("director", "rh"):
        items, next_cursor = await self.repo.list_paginated(
            cursor=cursor, limit=limit
        )
        total = await self.repo.count()
    elif rol in ("supervisor", "gerente"):
        subordinados = await self.empleado_repo.get_subordinados(current_user.id)
        ids = [e.id for e in subordinados] + [current_user.id]
        filters = [Solicitud.empleado_id.in_(ids)]  # <-- NO, esto esta en el repo
        # Correcto: llamar a metodo del repo que acepta la lista
        items, next_cursor = await self.repo.list_by_supervisor(
            subordinado_ids=ids, cursor=cursor, limit=limit
        )
        total = await self.repo.count(
            filters=[self.repo.model.empleado_id.in_(ids)]
        )
    else:
        items, next_cursor = await self.repo.list_by_empleado(
            empleado_id=current_user.id, cursor=cursor, limit=limit
        )
        total = await self.repo.count(
            filters=[self.repo.model.empleado_id == current_user.id]
        )

    return PaginatedResponse(
        items=[SolicitudResponse.model_validate(item) for item in items],
        next_cursor=next_cursor,
        total=total,
    )
```

**Repository — ejecuta la query cursor-based:**

`BaseRepository.list_paginated` ya implementa el patron correctamente:
- Si `cursor is not None`: `WHERE id > cursor ORDER BY id LIMIT limit+1`
- Si `len(items) > limit`: hay pagina siguiente, `next_cursor = items[-1].id`

Para queries con filtros adicionales, pasar la lista `filters`:

```python
async def list_by_empleado(
    self,
    empleado_id: int,
    cursor: int | None,
    limit: int,
) -> tuple[list[Solicitud], int | None]:
    filters = [Solicitud.empleado_id == empleado_id]
    return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)
```

### Respuesta JSON al cliente

```json
{
  "items": [...],
  "next_cursor": 47,
  "total": 150
}
```

El cliente guarda `next_cursor` y lo envia como `?cursor=47` en la siguiente peticion.
Cuando `next_cursor` es `null`, no hay mas paginas.

**Errores comunes a evitar:**
- No usar `skip`/`offset` en ninguna query — siempre cursor-based
- No retornar `items` como lista plana — siempre `PaginatedResponse`
- El `total` es el conteo con los mismos filtros aplicados, no el conteo global

---

## 5. Patron de Audit Logger

### Descripcion del patron

Toda mutacion (create, update, delete/soft_delete, approve, reject, sign, etc.) debe quedar
registrada en `audit_log`. Hay dos variantes de llamada con distintas garantias:

| Funcion | Cuándo usar | Garantia |
|---|---|---|
| `await log_action(...)` | Mutaciones criticas de seguridad (login, logout, revocacion de token, cambio de password) | Sincrona — el registro existe antes de retornar la respuesta |
| `audit_background(background_tasks, ...)` | Mutaciones de negocio ordinarias (crear solicitud, aprobar, etc.) | Asincrona — no bloquea la respuesta HTTP al cliente |

### Regla de decision

- **Sincrono (`log_action`):** cuando el audit trail es parte de la invariante de seguridad.
  Si el log falla, la operacion falla. Usar en: auth, cambios de rol, revocacion de acceso.

- **Asincrono (`audit_background`):** cuando el audit trail es observabilidad, no seguridad.
  Si el log falla en background, la operacion ya retorno exito al cliente — es aceptable.
  Usar en: CRUD de solicitudes, incidencias, actas, comedor, etc.

### Patron de llamada en el Service

```python
# Mutacion critica — sincrona
async def logout(self, jti: str, expires_at: datetime, current_user: Empleado) -> None:
    await revoke_token(jti, expires_at, self.db)
    await log_action(
        db=self.db,
        accion="LOGOUT",
        modulo="auth",
        usuario_id=current_user.id,
        entidad_id=current_user.id,
    )

# Mutacion de negocio — asincrona
async def crear_solicitud(
    self,
    data: SolicitudCreate,
    current_user: Empleado,
    background_tasks: BackgroundTasks,
) -> Solicitud:
    solicitud = await self.repo.create(data.model_dump())
    audit_background(
        background_tasks=background_tasks,
        db=self.db,
        accion="SOLICITUD_CREATED",
        modulo="solicitudes",
        usuario_id=current_user.id,
        entidad_id=solicitud.id,
        datos_despues={"tipo": solicitud.tipo, "estado": solicitud.estado},
    )
    return solicitud
```

### Cuando incluir datos_antes y datos_despues

| Accion | datos_antes | datos_despues |
|---|---|---|
| CREATE | `None` | Campos relevantes del objeto creado |
| UPDATE de estado | Estado anterior | Estado nuevo + quien lo cambio |
| SOFT_DELETE | `{"activo": True}` | `{"activo": False}` |
| APPROVE/REJECT | Estado anterior de la solicitud | Estado nuevo + comentario |
| LOGIN exitoso | `None` | `None` (la accion ya documenta el evento) |
| LOGOUT | `None` | `None` |

**Regla:** incluir solo los campos que un auditor necesitaria para reconstruir que cambio y por que.
No serializar objetos ORM completos — seleccionar campos.

**Errores comunes a evitar:**
- No llamar `audit_background` sin pasar `background_tasks` al Service — el Router debe pasarlo
- No serializar el objeto ORM completo en `datos_despues` — incluir solo campos relevantes
- No omitir el audit en operaciones de DELETE — es la accion mas critica de auditar

---

## 6. Estrategia de Notificaciones

### Descripcion del patron

El modulo `notificaciones` es un servicio de infraestructura que otros Services de dominio
consumen. Nunca se llama directamente desde el Router. Siempre se dispara como
`BackgroundTask` para no bloquear la respuesta HTTP.

### Interfaz del NotificacionService

```python
# app/services/notificacion_service.py

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.notificaciones import Notificacion
from app.repositories.notificacion_repository import NotificacionRepository

logger = logging.getLogger(__name__)


class NotificacionService:
    def __init__(self, db: AsyncSession):
        self.repo = NotificacionRepository(db)
        self.db = db

    async def enviar(
        self,
        destinatario_id: int,
        asunto: str,
        cuerpo: str,
        canal: str = "in_app",  # "email" | "in_app" | "ambos"
        email_destino: str | None = None,
    ) -> None:
        """
        Punto de entrada unico para todas las notificaciones.
        canal="ambos" persiste en DB Y envia email.
        """
        if canal in ("in_app", "ambos"):
            await self.repo.create({
                "destinatario_id": destinatario_id,
                "tipo": "in_app",
                "asunto": asunto,
                "cuerpo": cuerpo,
                "leida": False,
                "enviada": True,
            })

        if canal in ("email", "ambos") and email_destino:
            await self._enviar_email(
                destino=email_destino,
                asunto=asunto,
                cuerpo=cuerpo,
                destinatario_id=destinatario_id,
            )

    async def _enviar_email(
        self,
        destino: str,
        asunto: str,
        cuerpo: str,
        destinatario_id: int,
    ) -> None:
        """Envia email via SMTP. Registra en DB independientemente del resultado."""
        notificacion = await self.repo.create({
            "destinatario_id": destinatario_id,
            "tipo": "email",
            "asunto": asunto,
            "cuerpo": cuerpo,
            "leida": False,
            "enviada": False,
        })

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = asunto
            msg["From"] = settings.SMTP_USER
            msg["To"] = destino
            msg.attach(MIMEText(cuerpo, "html", "utf-8"))

            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                start_tls=True,
                timeout=10,
            )
            await self.repo.update(notificacion.id, {"enviada": True})
        except Exception as e:
            logger.error(
                "Error enviando email a %s: %s", destino, str(e), exc_info=True
            )
            # No relanzar — el fallo de email no debe fallar la operacion de negocio
```

### Mapping de eventos a canal

| Evento | Canal | Destinatario |
|---|---|---|
| Solicitud creada | in_app | Supervisor directo |
| Solicitud aprobada/rechazada | ambos | Empleado solicitante |
| Incidencia abierta contra empleado | in_app | Empleado + RH |
| Acta lista para firma | email | Firmantes |
| Acta firmada | in_app | Generador del acta |
| Notificacion general de RH | ambos | Destinatario especifico |

### Patron fire-and-forget en el Service de dominio

```python
# En cualquier Service de dominio que necesite notificar:

from fastapi import BackgroundTasks
from app.services.notificacion_service import NotificacionService


class SolicitudService:
    async def crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> Solicitud:
        solicitud = await self.repo.create(data.model_dump())

        # Audit async
        audit_background(background_tasks, self.db, "SOLICITUD_CREATED", "solicitudes",
                         usuario_id=current_user.id, entidad_id=solicitud.id,
                         datos_despues={"tipo": solicitud.tipo})

        # Notificacion async — fire-and-forget
        if current_user.supervisor_id:
            async def _notify():
                notif_service = NotificacionService(self.db)
                await notif_service.enviar(
                    destinatario_id=current_user.supervisor_id,
                    asunto=f"Nueva solicitud de {current_user.nombre}",
                    cuerpo=f"Se ha creado una solicitud de {solicitud.tipo} para revision.",
                    canal="in_app",
                )
            background_tasks.add_task(_notify)

        return solicitud
```

### Como el Router pasa BackgroundTasks al Service

```python
# Router pasa background_tasks como argumento al Service — el Service nunca lo importa directamente

@router.post("", response_model=SolicitudResponse, status_code=201)
async def create_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,          # FastAPI inyecta esto automaticamente
    current_user: Empleado = Depends(role_checker(["empleado"])),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.crear_solicitud(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,      # pasa al service
    )
```

**Errores comunes a evitar:**
- No importar `BackgroundTasks` en el Service — recibirlo como argumento de metodo
- No hacer `await` en la funcion de notificacion dentro de `background_tasks.add_task` si es un
  coroutine — pasar el coroutine directamente o usar una funcion wrapper asincrona
- No asumir que el email se entrego — siempre registrar en DB primero

---

## 7. Manejo de Archivos — Evidencias

### Descripcion del patron

Las evidencias son archivos binarios (PDFs, imagenes) asociados polimorficamente a entidades
de dominio. La tabla `evidencias` usa `entidad_tipo` + `entidad_id` para vincular archivos
a incidencias o actas sin foreign keys rigidas.

### Path de almacenamiento

```
/data/evidencias/{entidad_tipo}/{year}/{month}/{uuid}.{ext}

Ejemplos:
  /data/evidencias/incidencia/2026/03/f47ac10b-58cc-4372-a567-0e02b2c3d479.pdf
  /data/evidencias/acta/2026/03/550e8400-e29b-41d4-a716-446655440000.jpg
```

La variable de entorno `EVIDENCIAS_BASE_PATH` define el directorio raiz.
Agregar a `config.py`:
```python
EVIDENCIAS_BASE_PATH: str = "/data/evidencias"
```

### Tipos permitidos y validacion MIME

```python
# app/utils/file_validator.py

import magic  # python-magic
from app.core.exceptions import DomainValidationError

ALLOWED_MIME_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def validar_archivo(content: bytes, filename: str) -> str:
    """
    Valida el archivo y retorna la extension correcta.
    Lanza DomainValidationError si el archivo no es valido.
    """
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise DomainValidationError(
            detail=f"El archivo excede el limite de {MAX_FILE_SIZE_MB}MB",
            field="archivo",
        )

    # Validar MIME real (no la extension declarada por el cliente)
    mime = magic.from_buffer(content[:2048], mime=True)
    if mime not in ALLOWED_MIME_TYPES:
        raise DomainValidationError(
            detail=f"Tipo de archivo no permitido: {mime}. Permitidos: PDF, JPEG, PNG, WEBP",
            field="archivo",
        )

    return ALLOWED_MIME_TYPES[mime]
```

### Endpoint de subida

```python
# app/api/v1/incidencias/router.py

from fastapi import UploadFile, File
from fastapi.responses import StreamingResponse

@router.post("/{incidencia_id}/evidencias", status_code=201)
async def subir_evidencia(
    incidencia_id: int,
    archivo: UploadFile = File(...),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await archivo.read()
    service = IncidenciaService(db)
    return await service.subir_evidencia(
        entidad_tipo="incidencia",
        entidad_id=incidencia_id,
        content=content,
        nombre_original=archivo.filename or "archivo",
        subido_por=current_user.id,
    )
```

### Endpoint de descarga — Streaming Response

```python
@router.get("/evidencias/{evidencia_id}/descargar")
async def descargar_evidencia(
    evidencia_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = IncidenciaService(db)
    evidencia, ruta = await service.get_evidencia_path(evidencia_id, current_user)

    import aiofiles

    async def iterfile():
        async with aiofiles.open(ruta, "rb") as f:
            while chunk := await f.read(65536):  # 64KB chunks
                yield chunk

    return StreamingResponse(
        iterfile(),
        media_type=evidencia.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{evidencia.nombre_original}"'
        },
    )
```

### Relacion polimorfica — como funciona

La tabla `evidencias` NO tiene foreign keys a `incidencias` ni a `actas_administrativas`.
En cambio usa:
- `entidad_tipo`: valor del Enum `"incidencia"` o `"acta"`
- `entidad_id`: el PK de la entidad correspondiente

Para leer las evidencias de una incidencia:

```python
# app/repositories/evidencia_repository.py

async def list_by_entidad(
    self,
    entidad_tipo: str,
    entidad_id: int,
) -> list[Evidencia]:
    result = await self.db.execute(
        select(Evidencia)
        .where(
            Evidencia.entidad_tipo == entidad_tipo,
            Evidencia.entidad_id == entidad_id,
            Evidencia.activo == True,
        )
        .order_by(Evidencia.id)
    )
    return list(result.scalars().all())
```

**Errores comunes a evitar:**
- No guardar el archivo antes de crear el registro en DB — si el registro falla, el archivo queda huerfano
- No confiar en la extension del nombre de archivo — siempre validar MIME real con `python-magic`
- No usar `StreamingResponse` para archivos < 1MB si el cliente necesita `Content-Length` — usar `FileResponse`

---

## 8. Integracion TRESS — Fire-and-Forget

### Descripcion del patron

TRESS es un sistema RPA (Robotic Process Automation) que corre en Windows y procesa
incidencias de nomina. La integracion es asincrona por diseno: el Service inserta en
`tress_robot_queue` y retorna inmediatamente. El scheduler APScheduler procesa la cola
cada 5 minutos independientemente del ciclo de vida del request HTTP.

### Invariante de consistencia eventual

> Una solicitud/incidencia aprobada tiene estado `approved` en la plataforma RH
> inmediatamente. El reflejo en TRESS puede tardar hasta 5 minutos.
> Si TRESS falla, la solicitud sigue `approved` — TRESS reintentara automaticamente.
> El estado de TRESS NO es bloqueante para el flujo de aprobacion.

### Funcion encolar_tress

```python
# app/integrations/tress/queue.py

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tress import TressRobotQueue


async def encolar_tress(
    db: AsyncSession,
    accion: str,
    payload: dict,
) -> TressRobotQueue:
    """
    Inserta una tarea en la cola TRESS y retorna inmediatamente.
    El scheduler la procesa independientemente.

    Acciones validas:
      - "REGISTRAR_VACACIONES"    payload: {empleado_num, fecha_inicio, fecha_fin, dias}
      - "REGISTRAR_HOME_OFFICE"   payload: {empleado_num, fecha_inicio, fecha_fin}
      - "REGISTRAR_INCIDENCIA"    payload: {empleado_num, tipo, descripcion, fecha}
      - "CANCELAR_SOLICITUD"      payload: {empleado_num, tipo, referencia_id}
    """
    entrada = TressRobotQueue(
        accion=accion,
        payload=payload,
        estado="pending",
        intentos=0,
        created_at=datetime.now(timezone.utc),
    )
    db.add(entrada)
    await db.flush()
    return entrada
```

### Como el Service usa encolar_tress

```python
# app/services/solicitud_service.py

from app.integrations.tress.queue import encolar_tress


async def aprobar_solicitud(
    self,
    solicitud_id: int,
    aprobacion: SolicitudAprobacionCreate,
    current_user: Empleado,
    background_tasks: BackgroundTasks,
) -> Solicitud:
    solicitud = await self.repo.get_with_empleado(solicitud_id)
    if not solicitud:
        raise NotFoundError(entidad="Solicitud", id=solicitud_id)

    if solicitud.estado != "pending":
        raise ConflictError(detail=f"Solicitud ya en estado '{solicitud.estado}'")

    # Aprobar en el sistema RH
    solicitud = await self.repo.update(solicitud_id, {"estado": "approved"})

    # Registrar aprobacion
    await self.aprobacion_repo.create({
        "solicitud_id": solicitud_id,
        "aprobador_id": current_user.id,
        "accion": "approve",
        "nivel": aprobacion.nivel,
        "comentario": aprobacion.comentario,
    })

    # Encolar en TRESS — fire-and-forget sincrono dentro de la misma transaccion
    # Si encolar_tress falla, el rollback revierte tambien la aprobacion
    await encolar_tress(
        db=self.db,
        accion="REGISTRAR_VACACIONES" if solicitud.tipo == "vacaciones" else "REGISTRAR_HOME_OFFICE",
        payload={
            "empleado_num": solicitud.empleado.num_empleado,
            "fecha_inicio": str(solicitud.fecha_inicio),
            "fecha_fin": str(solicitud.fecha_fin),
            "referencia_id": solicitud.id,
        },
    )

    # Audit y notificacion async
    audit_background(background_tasks, self.db, "SOLICITUD_APPROVED", "solicitudes",
                     usuario_id=current_user.id, entidad_id=solicitud_id,
                     datos_antes={"estado": "pending"}, datos_despues={"estado": "approved"})

    return solicitud
```

### Scheduler — procesamiento de la cola

El scheduler en `main.py` (`_tress_scheduler_job`) debe implementarse en la fase de
integraciones. El contrato esperado:

```python
# main.py — _tress_scheduler_job (implementacion futura)

def _tress_scheduler_job():
    """
    Corre cada 5 minutos via APScheduler (BackgroundScheduler — thread sincronico).
    1. Lee hasta 10 items con estado="pending" o estado="retrying" con intentos < 3
    2. Para cada item, llama al robot TRESS via pyodbc/ODBC
    3. Si exito: actualiza estado="done", processed_at=now()
    4. Si error: incrementa intentos, si intentos >= 3: estado="error"
    """
    pass  # Implementar en fase integraciones
```

### Que pasa si TRESS falla repetidamente

| Estado TRESS | Estado Solicitud RH | Accion requerida |
|---|---|---|
| `pending` | `approved` | Scheduler reintentara en proximo ciclo |
| `retrying` (intentos 1-2) | `approved` | Scheduler reintenta automaticamente |
| `error` (intentos >= 3) | `approved` | Alerta a RH — intervencion manual |

El endpoint `GET /api/v1/auditoria/tress-queue` permite a RH ver items con `estado="error"`
para intervencion manual.

**Errores comunes a evitar:**
- No hacer el `encolar_tress` en un `background_task` — debe ir dentro de la transaccion de DB
  para que si falla, el rollback revierte tambien la aprobacion
- No bloquear el request esperando que TRESS procese — la cola es el mecanismo de desacoplamiento

---

## 9. Convenciones de Nomenclatura

### Archivos Python

| Componente | Convencion | Ejemplo |
|---|---|---|
| Modulos | `snake_case` | `solicitud_service.py` |
| Clases | `PascalCase` | `SolicitudService`, `SolicitudRepository` |
| Funciones / metodos | `snake_case` | `crear_solicitud`, `get_with_empleado` |
| Variables y parametros | `snake_case` | `current_user`, `solicitud_id` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE_BYTES`, `ALLOWED_MIME_TYPES` |
| Variables privadas | `_snake_case` | `_notify`, `_it_mirror_sync_job` |
| Type variables | `PascalCase` | `ModelType`, `T` |

### Endpoints — prefijos, nombres y metodos HTTP

| Accion | Metodo | Path | Ejemplo |
|---|---|---|---|
| Listar (paginado) | GET | `/api/v1/{dominio}` | `GET /api/v1/solicitudes` |
| Obtener uno | GET | `/api/v1/{dominio}/{id}` | `GET /api/v1/solicitudes/42` |
| Crear | POST | `/api/v1/{dominio}` | `POST /api/v1/solicitudes` |
| Actualizar parcial | PATCH | `/api/v1/{dominio}/{id}` | `PATCH /api/v1/solicitudes/42` |
| Actualizar completo | PUT | `/api/v1/{dominio}/{id}` | raro — preferir PATCH |
| Eliminar (soft) | DELETE | `/api/v1/{dominio}/{id}` | `DELETE /api/v1/incidencias/5` |
| Accion de negocio | POST/PUT | `/api/v1/{dominio}/{id}/{accion}` | `PUT /api/v1/solicitudes/42/approve` |
| Subir archivo | POST | `/api/v1/{dominio}/{id}/evidencias` | `POST /api/v1/incidencias/5/evidencias` |
| Descargar archivo | GET | `/api/v1/{dominio}/evidencias/{id}/descargar` | |
| Validar huella | POST | `/api/v1/comedor/huella/validar` | solo este endpoint |

**Regla de acciones de negocio:** usar verbos en ingles para acciones (`approve`, `reject`,
`override`, `cancel`, `sign`, `archive`). El path describe la accion, no el estado resultante.

### Schemas Pydantic

```
{Entidad}Create     — datos de entrada para POST (nunca incluye id, created_at)
{Entidad}Update     — datos de entrada para PATCH (todos los campos Optional)
{Entidad}Response   — datos de salida (incluye id, timestamps)
{Entidad}Base       — campos comunes — usar solo si reduce duplicacion real

Aprobacion:
{Entidad}AprobacionCreate
{Entidad}AprobacionResponse
```

Regla `model_config`:
- `model_config = {"from_attributes": True}` OBLIGATORIO en todos los schemas `Response`
- Nunca usar `class Config:` (Pydantic v1 — prohibido)
- `model_config = {"str_strip_whitespace": True}` en schemas Create/Update cuando el campo
  es texto libre

### Orden de imports

```python
# 1. stdlib
from datetime import date, datetime
from typing import Optional
from uuid import uuid4

# 2. third-party (una linea en blanco de separacion)
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

# 3. local (una linea en blanco de separacion)
from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.core.exceptions import ConflictError, NotFoundError
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud
from app.repositories.solicitud_repository import SolicitudRepository
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import SolicitudCreate, SolicitudResponse
from app.utils.audit_logger import audit_background, log_action
```

### Comentarios

```python
# Usar comentarios de una linea para:
# - Explicar el "por que", no el "que"
# - Marcar decisiones no obvias

# NO hacer esto:
solicitud = await self.repo.get(id)  # obtener la solicitud  ← inutil

# SI hacer esto:
# TRESS requiere num_empleado, no el id interno — usar el campo del modelo Empleado
payload = {"empleado_num": solicitud.empleado.num_empleado}

# Usar TODO solo con formato estandar:
# TODO(seccion): descripcion — fecha/responsable
# TODO(auth): Agregar verificacion de 2FA — pendiente decision de arquitectura 2026-04

# Docstrings en servicios para metodos publicos no obvios:
async def list_solicitudes(self, ...) -> PaginatedResponse[SolicitudResponse]:
    """
    Lista solicitudes filtradas por rol del usuario:
    - empleado: solo las propias
    - supervisor/gerente: las propias + las de su equipo
    - director/rh: todas
    """
```

---

## 10. Template de Modulo Completo — solicitudes

A continuacion el codigo completo de todos los archivos del modulo `solicitudes`.
Este es el modulo de referencia — cada nuevo modulo debe seguir exactamente esta estructura.

### 10.1 app/core/exceptions.py

Ver seccion 2. Este archivo es compartido por todos los modulos.

### 10.2 app/schemas/solicitudes.py

```python
# app/schemas/solicitudes.py

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_config


SOLICITUD_TIPOS_VALIDOS = {"vacaciones", "home_office"}
SOLICITUD_ESTADOS_VALIDOS = {"pending", "approved", "rejected", "cancelled", "overridden"}
APROBACION_ACCIONES_VALIDAS = {"approve", "reject", "override"}


class SolicitudCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    tipo: str
    fecha_inicio: date
    fecha_fin: date
    comentarios: Optional[str] = None

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in SOLICITUD_TIPOS_VALIDOS:
            raise ValueError(f"tipo debe ser uno de: {SOLICITUD_TIPOS_VALIDOS}")
        return v

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas(cls, v: date, info) -> date:
        fecha_inicio = info.data.get("fecha_inicio")
        if fecha_inicio and v < fecha_inicio:
            raise ValueError("fecha_fin debe ser mayor o igual a fecha_inicio")
        return v


class SolicitudUpdate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    estado: Optional[str] = None
    comentarios: Optional[str] = None
    nivel_actual: Optional[int] = None

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in SOLICITUD_ESTADOS_VALIDOS:
            raise ValueError(f"estado debe ser uno de: {SOLICITUD_ESTADOS_VALIDOS}")
        return v


class SolicitudResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    empleado_id: int
    tipo: str
    fecha_inicio: date
    fecha_fin: date
    estado: str
    nivel_actual: int
    comentarios: Optional[str]
    created_at: datetime


class SolicitudAprobacionCreate(BaseModel):
    model_config = {"str_strip_whitespace": True}

    accion: str
    nivel: int
    comentario: Optional[str] = None

    @field_validator("accion")
    @classmethod
    def validar_accion(cls, v: str) -> str:
        if v not in APROBACION_ACCIONES_VALIDAS:
            raise ValueError(f"accion debe ser una de: {APROBACION_ACCIONES_VALIDAS}")
        return v


class SolicitudAprobacionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    solicitud_id: int
    aprobador_id: int
    accion: str
    nivel: int
    comentario: Optional[str]
    timestamp: datetime
```

### 10.3 app/repositories/solicitud_repository.py

```python
# app/repositories/solicitud_repository.py

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.repositories.base import BaseRepository


class SolicitudRepository(BaseRepository[Solicitud]):
    def __init__(self, db: AsyncSession):
        super().__init__(Solicitud, db)

    async def get_with_empleado(self, solicitud_id: int) -> Solicitud | None:
        result = await self.db.execute(
            select(Solicitud)
            .options(
                selectinload(Solicitud.empleado),
                selectinload(Solicitud.aprobaciones),
            )
            .where(Solicitud.id == solicitud_id)
        )
        return result.scalar_one_or_none()

    async def list_by_empleado(
        self,
        empleado_id: int,
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id == empleado_id]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)

    async def list_by_equipo(
        self,
        empleado_ids: list[int],
        cursor: int | None,
        limit: int,
    ) -> tuple[list[Solicitud], int | None]:
        filters = [Solicitud.empleado_id.in_(empleado_ids)]
        return await self.list_paginated(cursor=cursor, limit=limit, filters=filters)


class SolicitudAprobacionRepository(BaseRepository[SolicitudAprobacion]):
    def __init__(self, db: AsyncSession):
        super().__init__(SolicitudAprobacion, db)

    async def list_by_solicitud(self, solicitud_id: int) -> list[SolicitudAprobacion]:
        result = await self.db.execute(
            select(SolicitudAprobacion)
            .where(SolicitudAprobacion.solicitud_id == solicitud_id)
            .order_by(SolicitudAprobacion.timestamp)
        )
        return list(result.scalars().all())
```

### 10.4 app/services/solicitud_service.py

```python
# app/services/solicitud_service.py

import logging
from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.integrations.tress.queue import encolar_tress
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud
from app.repositories.empleado_repository import EmpleadoRepository
from app.repositories.solicitud_repository import SolicitudAprobacionRepository, SolicitudRepository
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudResponse,
)
from app.utils.audit_logger import audit_background

logger = logging.getLogger(__name__)


class SolicitudService:
    def __init__(self, db: AsyncSession):
        self.repo = SolicitudRepository(db)
        self.aprobacion_repo = SolicitudAprobacionRepository(db)
        self.empleado_repo = EmpleadoRepository(db)
        self.db = db

    # ── Listado ──────────────────────────────────────────────────────────────

    async def list_solicitudes(
        self,
        current_user: Empleado,
        cursor: int | None,
        limit: int,
    ) -> PaginatedResponse[SolicitudResponse]:
        """
        Lista solicitudes filtradas por rol:
        - empleado: solo las propias
        - supervisor/gerente: propias + equipo
        - director/rh: todas
        """
        rol = current_user.rol.nombre if current_user.rol else "empleado"

        if rol in ("director", "rh"):
            items, next_cursor = await self.repo.list_paginated(cursor=cursor, limit=limit)
            total = await self.repo.count()

        elif rol in ("supervisor", "gerente"):
            subordinados = await self.empleado_repo.get_subordinados(current_user.id)
            ids = [e.id for e in subordinados] + [current_user.id]
            items, next_cursor = await self.repo.list_by_equipo(
                empleado_ids=ids, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id.in_(ids)]
            )

        else:
            items, next_cursor = await self.repo.list_by_empleado(
                empleado_id=current_user.id, cursor=cursor, limit=limit
            )
            total = await self.repo.count(
                filters=[Solicitud.empleado_id == current_user.id]
            )

        return PaginatedResponse(
            items=[SolicitudResponse.model_validate(item) for item in items],
            next_cursor=next_cursor,
            total=total,
        )

    # ── Obtener uno ──────────────────────────────────────────────────────────

    async def get_solicitud(
        self,
        solicitud_id: int,
        current_user: Empleado,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        # Verificar acceso
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol not in ("director", "rh"):
            if solicitud.empleado_id != current_user.id:
                if rol in ("supervisor", "gerente"):
                    subordinados = await self.empleado_repo.get_subordinados(current_user.id)
                    ids = {e.id for e in subordinados}
                    if solicitud.empleado_id not in ids:
                        raise ForbiddenError(
                            detail="No tienes acceso a esta solicitud"
                        )
                else:
                    raise ForbiddenError(detail="No tienes acceso a esta solicitud")

        return SolicitudResponse.model_validate(solicitud)

    # ── Crear ────────────────────────────────────────────────────────────────

    async def crear_solicitud(
        self,
        data: SolicitudCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        # Validacion de negocio: no crear si ya hay una solicitud pending del mismo tipo
        filters = [
            Solicitud.empleado_id == current_user.id,
            Solicitud.tipo == data.tipo,
            Solicitud.estado == "pending",
        ]
        total_pendientes = await self.repo.count(filters=filters)
        if total_pendientes > 0:
            raise ConflictError(
                detail=f"Ya tienes una solicitud de '{data.tipo}' pendiente de aprobacion"
            )

        solicitud = await self.repo.create({
            "empleado_id": current_user.id,
            "tipo": data.tipo,
            "fecha_inicio": data.fecha_inicio,
            "fecha_fin": data.fecha_fin,
            "estado": "pending",
            "nivel_actual": 1,
            "comentarios": data.comentarios,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CREATED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud.id,
            datos_despues={"tipo": solicitud.tipo, "estado": solicitud.estado},
        )

        # Notificar al supervisor si existe
        if current_user.supervisor_id:
            async def _notify_supervisor():
                from app.services.notificacion_service import NotificacionService
                svc = NotificacionService(self.db)
                await svc.enviar(
                    destinatario_id=current_user.supervisor_id,
                    asunto=f"Nueva solicitud de {current_user.nombre} {current_user.apellido}",
                    cuerpo=(
                        f"Se ha generado una solicitud de {data.tipo} "
                        f"del {data.fecha_inicio} al {data.fecha_fin}. "
                        "Por favor revísala en la plataforma."
                    ),
                    canal="in_app",
                )
            background_tasks.add_task(_notify_supervisor)

        return SolicitudResponse.model_validate(solicitud)

    # ── Aprobar ──────────────────────────────────────────────────────────────

    async def aprobar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede aprobar una solicitud en estado '{solicitud.estado}'"
            )

        # Verificar que el aprobador tiene relacion con el solicitante
        rol = current_user.rol.nombre if current_user.rol else "empleado"
        if rol not in ("director", "rh"):
            if solicitud.empleado.supervisor_id != current_user.id:
                raise ForbiddenError(
                    detail="Solo el supervisor directo puede aprobar en este nivel"
                )

        datos_antes = {"estado": solicitud.estado, "nivel_actual": solicitud.nivel_actual}

        solicitud = await self.repo.update(solicitud_id, {"estado": "approved"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "approve",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        # Encolar en TRESS — dentro de la transaccion
        accion_tress = (
            "REGISTRAR_VACACIONES"
            if solicitud.tipo == "vacaciones"
            else "REGISTRAR_HOME_OFFICE"
        )
        await encolar_tress(
            db=self.db,
            accion=accion_tress,
            payload={
                "empleado_num": solicitud.empleado.num_empleado,
                "fecha_inicio": str(solicitud.fecha_inicio),
                "fecha_fin": str(solicitud.fecha_fin),
                "referencia_id": solicitud.id,
            },
        )

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_APPROVED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "approved"},
        )

        return SolicitudResponse.model_validate(solicitud)

    # ── Rechazar ─────────────────────────────────────────────────────────────

    async def rechazar_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado != "pending":
            raise ConflictError(
                detail=f"No se puede rechazar una solicitud en estado '{solicitud.estado}'"
            )

        datos_antes = {"estado": solicitud.estado}
        solicitud = await self.repo.update(solicitud_id, {"estado": "rejected"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "reject",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_REJECTED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "rejected"},
        )

        return SolicitudResponse.model_validate(solicitud)

    # ── Override ─────────────────────────────────────────────────────────────

    async def override_solicitud(
        self,
        solicitud_id: int,
        aprobacion: SolicitudAprobacionCreate,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get_with_empleado(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.estado not in ("pending", "rejected"):
            raise ConflictError(
                detail=f"No se puede hacer override de una solicitud en estado '{solicitud.estado}'"
            )

        datos_antes = {"estado": solicitud.estado}
        solicitud = await self.repo.update(solicitud_id, {"estado": "overridden"})
        await self.aprobacion_repo.create({
            "solicitud_id": solicitud_id,
            "aprobador_id": current_user.id,
            "accion": "override",
            "nivel": aprobacion.nivel,
            "comentario": aprobacion.comentario,
        })

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_OVERRIDDEN",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "overridden"},
        )

        return SolicitudResponse.model_validate(solicitud)

    # ── Cancelar ─────────────────────────────────────────────────────────────

    async def cancelar_solicitud(
        self,
        solicitud_id: int,
        current_user: Empleado,
        background_tasks: BackgroundTasks,
    ) -> SolicitudResponse:
        solicitud = await self.repo.get(solicitud_id)
        if not solicitud:
            raise NotFoundError(entidad="Solicitud", id=solicitud_id)

        if solicitud.empleado_id != current_user.id:
            raise ForbiddenError(detail="Solo puedes cancelar tus propias solicitudes")

        if solicitud.estado not in ("pending",):
            raise ConflictError(
                detail=f"No se puede cancelar una solicitud en estado '{solicitud.estado}'"
            )

        datos_antes = {"estado": solicitud.estado}
        solicitud = await self.repo.update(solicitud_id, {"estado": "cancelled"})

        audit_background(
            background_tasks=background_tasks,
            db=self.db,
            accion="SOLICITUD_CANCELLED",
            modulo="solicitudes",
            usuario_id=current_user.id,
            entidad_id=solicitud_id,
            datos_antes=datos_antes,
            datos_despues={"estado": "cancelled"},
        )

        return SolicitudResponse.model_validate(solicitud)
```

### 10.5 app/api/v1/solicitudes/router.py

```python
# app/api/v1/solicitudes/router.py

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas import PaginatedResponse
from app.schemas.solicitudes import (
    SolicitudAprobacionCreate,
    SolicitudAprobacionResponse,
    SolicitudCreate,
    SolicitudResponse,
)
from app.services.solicitud_service import SolicitudService

router = APIRouter(prefix="/api/v1/solicitudes", tags=["Solicitudes"])


@router.get("", response_model=PaginatedResponse[SolicitudResponse])
async def list_solicitudes(
    cursor: int | None = Query(None, description="ID del ultimo item recibido"),
    limit: int = Query(20, ge=1, le=100),
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.list_solicitudes(
        current_user=current_user,
        cursor=cursor,
        limit=limit,
    )


@router.post("", response_model=SolicitudResponse, status_code=status.HTTP_201_CREATED)
async def create_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["empleado", "supervisor", "gerente", "director", "rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.crear_solicitud(
        data=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.get("/{solicitud_id}", response_model=SolicitudResponse)
async def get_solicitud(
    solicitud_id: int,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.get_solicitud(
        solicitud_id=solicitud_id,
        current_user=current_user,
    )


@router.put("/{solicitud_id}/approve", response_model=SolicitudResponse)
async def approve_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.aprobar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/reject", response_model=SolicitudResponse)
async def reject_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(
        role_checker(["supervisor", "gerente", "director", "rh"])
    ),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.rechazar_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/override", response_model=SolicitudResponse)
async def override_solicitud(
    solicitud_id: int,
    body: SolicitudAprobacionCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["director", "rh"])),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.override_solicitud(
        solicitud_id=solicitud_id,
        aprobacion=body,
        current_user=current_user,
        background_tasks=background_tasks,
    )


@router.put("/{solicitud_id}/cancel", response_model=SolicitudResponse)
async def cancel_solicitud(
    solicitud_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SolicitudService(db)
    return await service.cancelar_solicitud(
        solicitud_id=solicitud_id,
        current_user=current_user,
        background_tasks=background_tasks,
    )
```

### Estructura de directorios del modulo completo

```
app/
├── api/
│   └── v1/
│       └── solicitudes/
│           ├── __init__.py          (vacio)
│           └── router.py            (endpoints)
├── models/
│   └── solicitudes.py              (ORM — YA EXISTE)
├── schemas/
│   └── solicitudes.py              (Create/Update/Response)
├── services/
│   └── solicitud_service.py        (logica de negocio)
└── repositories/
    └── solicitud_repository.py     (queries SQLAlchemy)
```

---

## 11. Seed de Base de Datos

### app/utils/seed.py

```python
# app/utils/seed.py
"""
Script de seed idempotente para la base de datos de Plataforma RH Leoni.

Uso:
    python -m app.utils.seed

Crea:
  - 5 roles con permisos JSONB
  - 1 usuario RH admin inicial

Es seguro ejecutar multiples veces — no duplica datos.
"""

import asyncio
import logging

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.empleados import Empleado
from app.models.roles import Rol

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


ROLES_SEED = [
    {
        "nombre": "empleado",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": False,
                "ver_todas": False,
                "aprobar": False,
                "override": False,
            },
            "incidencias": {
                "crear": False,
                "ver_propias": True,
                "ver_todas": False,
                "resolver": False,
            },
            "actas": {"generar": False, "firmar": True, "ver": False},
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {"ver_propios": True, "ver_todos": False, "exportar": False},
            "empleados": {"ver": False, "editar": False, "crear": False},
            "auditoria": {"ver": False},
        },
    },
    {
        "nombre": "supervisor",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": False,
                "aprobar": True,
                "override": False,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": False,
                "resolver": False,
            },
            "actas": {"generar": False, "firmar": True, "ver": True},
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {"ver_propios": True, "ver_todos": False, "exportar": False},
            "empleados": {"ver": True, "editar": False, "crear": False},
            "auditoria": {"ver": False},
        },
    },
    {
        "nombre": "gerente",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": False,
                "aprobar": True,
                "override": False,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {"generar": True, "firmar": True, "ver": True},
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {"ver_propios": True, "ver_todos": True, "exportar": True},
            "empleados": {"ver": True, "editar": False, "crear": False},
            "auditoria": {"ver": False},
        },
    },
    {
        "nombre": "director",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": True,
                "aprobar": True,
                "override": True,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {"generar": True, "firmar": True, "ver": True},
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": False,
            },
            "reportes": {"ver_propios": True, "ver_todos": True, "exportar": True},
            "empleados": {"ver": True, "editar": True, "crear": False},
            "auditoria": {"ver": True},
        },
    },
    {
        "nombre": "rh",
        "permisos": {
            "solicitudes": {
                "crear": True,
                "ver_propias": True,
                "ver_equipo": True,
                "ver_todas": True,
                "aprobar": True,
                "override": True,
            },
            "incidencias": {
                "crear": True,
                "ver_propias": True,
                "ver_todas": True,
                "resolver": True,
            },
            "actas": {"generar": True, "firmar": True, "ver": True},
            "comedor": {
                "registrar_huella": False,
                "ver_menu": True,
                "administrar": True,
            },
            "reportes": {"ver_propios": True, "ver_todos": True, "exportar": True},
            "empleados": {"ver": True, "editar": True, "crear": True},
            "auditoria": {"ver": True},
        },
    },
]

ADMIN_RH = {
    "num_empleado": "RH-0001",
    "nombre": "Admin",
    "apellido": "RH",
    "email": "admin.rh@leoni.com",
    "password": "Leoni2026!RH",  # cambiar en primer login
    "departamento": "Recursos Humanos",
    "puesto": "Administrador del Sistema",
    "activo": True,
}


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        try:
            # ── Seed Roles ────────────────────────────────────────────────
            logger.info("Seeding roles...")
            created_roles: dict[str, int] = {}

            for rol_data in ROLES_SEED:
                result = await db.execute(
                    select(Rol).where(Rol.nombre == rol_data["nombre"])
                )
                existing = result.scalar_one_or_none()

                if existing:
                    logger.info("  Rol '%s' ya existe — actualizando permisos", rol_data["nombre"])
                    existing.permisos = rol_data["permisos"]
                    created_roles[rol_data["nombre"]] = existing.id
                else:
                    rol = Rol(nombre=rol_data["nombre"], permisos=rol_data["permisos"])
                    db.add(rol)
                    await db.flush()
                    created_roles[rol_data["nombre"]] = rol.id
                    logger.info("  Rol '%s' creado con id=%d", rol_data["nombre"], rol.id)

            # ── Seed Admin RH ─────────────────────────────────────────────
            logger.info("Seeding usuario admin RH...")
            result = await db.execute(
                select(Empleado).where(Empleado.email == ADMIN_RH["email"])
            )
            existing_admin = result.scalar_one_or_none()

            if existing_admin:
                logger.info(
                    "  Admin RH ya existe (id=%d) — no se modifica", existing_admin.id
                )
            else:
                rol_rh_id = created_roles.get("rh")
                if not rol_rh_id:
                    raise RuntimeError("Rol 'rh' no fue creado correctamente")

                admin = Empleado(
                    num_empleado=ADMIN_RH["num_empleado"],
                    nombre=ADMIN_RH["nombre"],
                    apellido=ADMIN_RH["apellido"],
                    email=ADMIN_RH["email"],
                    password_hash=hash_password(ADMIN_RH["password"]),
                    departamento=ADMIN_RH["departamento"],
                    puesto=ADMIN_RH["puesto"],
                    rol_id=rol_rh_id,
                    activo=True,
                )
                db.add(admin)
                await db.flush()
                logger.info("  Admin RH creado con id=%d", admin.id)

            await db.commit()
            logger.info("Seed completado exitosamente.")

        except Exception:
            await db.rollback()
            logger.exception("Error durante el seed — rollback ejecutado")
            raise


if __name__ == "__main__":
    asyncio.run(seed())
```

---

## Apendice — Checklist de Implementacion por Modulo

Usar esta lista al implementar cada nuevo modulo de dominio:

```
Schemas:
  [ ] {Entidad}Create — con field_validators para enums y reglas de negocio simples
  [ ] {Entidad}Update — todos los campos Optional
  [ ] {Entidad}Response — con model_config = {"from_attributes": True}
  [ ] Sub-schemas si aplica (Aprobacion, etc.)

Repository:
  [ ] Hereda de BaseRepository[ModelType]
  [ ] get_with_relaciones() — carga relaciones via selectinload
  [ ] list_by_{criterio}() — delegando a list_paginated con filters
  [ ] No contiene logica de negocio

Service:
  [ ] __init__ instancia todos los repositories necesarios
  [ ] Cada metodo publico verifica existencia antes de operar
  [ ] Lanza LeoniException apropiada, nunca HTTPException
  [ ] Llama audit_background (o log_action si es critico de seguridad)
  [ ] Llama NotificacionService via background_tasks donde aplique
  [ ] Llama encolar_tress si la operacion debe reflejarse en nomina

Router:
  [ ] Todos los endpoints tienen response_model y status_code explicito
  [ ] Todos los endpoints tienen Depends(get_current_user) o Depends(role_checker([...]))
  [ ] BackgroundTasks inyectado en endpoints que mutan estado
  [ ] Ningun endpoint contiene logica — solo delega al Service
  [ ] Prefijo: /api/v1/{dominio}

Audit:
  [ ] CREATE: audit con datos_despues
  [ ] UPDATE de estado: audit con datos_antes y datos_despues
  [ ] DELETE/soft_delete: audit con datos_antes

Paginacion:
  [ ] Endpoints de listado usan cursor + limit como Query params
  [ ] Retornan PaginatedResponse[{Entidad}Response]
  [ ] Repository delega a list_paginated del BaseRepository
```

---

*Documento generado el 2026-03-30. Proxima revision: al agregar un nuevo dominio o integration.*
