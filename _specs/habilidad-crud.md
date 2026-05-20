# Habilidad CRUD

## Resumen

Crear el modelo, schema, repositorio, servicio y endpoints CRUD para la entidad **Habilidad** dentro del módulo Level Up. Las habilidades representan competencias blandas/transversales que se evalúan por empleado (ej. liderazgo, comunicación, trabajo en equipo).

## Motivación

El módulo Level Up necesita un catálogo de habilidades separado de competencias técnicas. Las competencias técnicas ya existen en `app/models/talento.py` como `Competencia` (con `categoria='tecnica'|'blanda'`), pero el diseño de Level Up requiere una entidad propia `Habilidad` con campos específicos (tipo, niveles descriptivos) y endpoints dedicados para gestión independiente.

## Alcance

### Modelo SQLAlchemy

Crear `Habilidad` en `app/models/level_up.py` (archivo nuevo):

| Campo | Tipo | Notas |
|-------|------|-------|
| id | int PK | autoincrement |
| nombre | str(255) | not null |
| descripcion | text | nullable |
| tipo | str(30) | 'blanda' \| 'liderazgo' \| 'comunicacion' \| 'tecnica_transversal' |
| niveles_descripcion | JSONB | Descripción por nivel: {1: "Básico", 2: "Intermedio", ...} |
| activo | bool | default True, soft delete |
| created_at | datetime | server_default now() |
| updated_at | datetime | onupdate now() |

### Schema Pydantic

En `app/schemas/level_up.py` (archivo nuevo):

- `HabilidadCreate` — nombre, descripcion?, tipo, niveles_descripcion?
- `HabilidadUpdate` — todos opcionales (partial update)
- `HabilidadResponse` — todos los campos incluido id, timestamps
- `HabilidadListResponse` — lista paginada con total

### Repositorio

En `app/repositories/level_up_habilidades.py`:

- `get_all(skip, limit, tipo?, activo?)` — listado con filtros
- `get_by_id(id)` — detalle
- `create(data)` — crear
- `update(id, data)` — actualizar parcial
- `soft_delete(id)` — marcar activo=False

### Servicio

En `app/services/level_up_habilidades.py`:

- Lógica de negocio mínima: validar tipo permitido, verificar existencia en update/delete
- Raise 404 si no existe, 400 si tipo inválido

### Endpoints

Router en `app/api/v1/level_up/router_habilidades.py`:

| Método | Path | Descripción | Permisos |
|--------|------|-------------|----------|
| GET | `/api/v1/level-up/habilidades` | Listar con paginación y filtro por tipo | Autenticado |
| GET | `/api/v1/level-up/habilidades/{id}` | Detalle | Autenticado |
| POST | `/api/v1/level-up/habilidades` | Crear | RH |
| PATCH | `/api/v1/level-up/habilidades/{id}` | Actualizar | RH |
| DELETE | `/api/v1/level-up/habilidades/{id}` | Soft delete | RH |

### Tests

En `tests/test_level_up_habilidades.py`:

- Test CRUD completo (create, list, get, update, delete)
- Test filtro por tipo
- Test soft delete (no aparece en listado)
- Test permisos (empleado no puede crear/editar)

## Estructura de archivos

```
app/models/level_up.py              (nuevo)
app/schemas/level_up.py             (nuevo)
app/repositories/level_up_habilidades.py  (nuevo)
app/services/level_up_habilidades.py      (nuevo)
app/api/v1/level_up/__init__.py           (nuevo)
app/api/v1/level_up/router_habilidades.py (nuevo)
tests/test_level_up_habilidades.py        (nuevo)
```

## Patrones a seguir

- Async everywhere (asyncpg, async sessions)
- Soft delete con campo `activo`
- Paginación con `skip` y `limit` (default 0, 50)
- Permisos: RH puede crear/editar, cualquier autenticado puede leer
- Router prefix: `/api/v1/level-up/habilidades`
- Tag OpenAPI: `Level Up - Habilidades`
- Seguir layered architecture: router → service → repository → model

## Dependencias

- `app/core/database.py` — Base, async session
- `app/core/security.py` — get_current_user, role checks
- Alembic migration para tabla `habilidades`

## Fuera de alcance

- EvaluacionHabilidad (será spec separado)
- Vinculación habilidad → puesto (será spec separado)
- Frontend (será otra fase)
- Las otras 13 entidades de Level Up
