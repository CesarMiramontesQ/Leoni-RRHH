# Diseño: Empleados con tablas relacionadas (catálogos del cliente)

**Fecha:** 2026-04-01  
**Estado:** Aprobado  
**Autor:** Claude + Alex Miramontes

---

## Contexto

La BD del cliente (`IT_MIRROR_DB_URL`) tiene una tabla `empleados` que usa FKs a tablas de catálogo (`categorias`, `subareas`, `puestos`, `estados_empleados`, `areas`, `clasificacion_empleado`). El modelo local `Empleado` fue construido con campos de texto plano (`departamento`, `puesto`) que no reflejan esta estructura real. Este diseño reemplaza el modelo por uno fiel a la BD del cliente.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Fuente externa | `IT_MIRROR_DB_URL` es la BD del cliente | Ya confirmado — misma conexión |
| Estrategia de sync | Sincronizar catálogos localmente (Enfoque A) | Consultas locales sin depender de la BD del cliente en runtime |
| Estructura del modelo | Adoptar estructura real del cliente (Enfoque A) | Eliminar deuda técnica desde el inicio |
| Campo `activo` | Eliminado; reemplazado por `estado_id` (Opción C) | Fidelidad con la BD del cliente; evitar doble verdad |
| PK local | Mantener `id` autoincrement | No romper FKs existentes en `solicitudes`, `incidencias`, etc. |
| `email` | Nullable, campo app-only | Puede obtenerse de fuente externa futura |
| `password_hash`, `rol_id` | Campos app-only, no sincronizados | Auth y roles son responsabilidad de la plataforma RH |

---

## Modelo de datos

### Tablas de catálogo nuevas

Definidas en `app/models/catalogos.py`.

```
areas
  area_id         INTEGER PK
  descripcion     VARCHAR NOT NULL
  estatus_id      INTEGER NOT NULL

subareas
  subarea_id      INTEGER PK
  descripcion     VARCHAR NOT NULL
  area_id         INTEGER FK→areas.area_id
  estatus_id      INTEGER NOT NULL

categorias
  categoria_id    INTEGER PK
  nivel           VARCHAR
  bono_cat        NUMERIC nullable
  descripcion     VARCHAR NOT NULL
  estatus_id      INTEGER NOT NULL

puestos
  puesto_id       INTEGER PK
  descripcion     VARCHAR NOT NULL
  estatus_id      INTEGER NOT NULL
  area_id         INTEGER FK→areas.area_id nullable

estados_empleados
  estado_id       INTEGER PK
  descripcion     VARCHAR NOT NULL
  estatus_id      INTEGER NOT NULL

clasificacion_empleado
  clasificacion_id  INTEGER PK
  descripcion       VARCHAR NOT NULL
  estatus_id        INTEGER NOT NULL
  significado       VARCHAR nullable
```

### Tabla `empleados` (nueva estructura)

```
empleados
  id                        INTEGER PK autoincrement   ← PK app-local
  empleado_id               INTEGER UNIQUE NOT NULL    ← PK del cliente
  no_empleado               VARCHAR UNIQUE NOT NULL    ← clave de negocio
  no_sap                    VARCHAR nullable
  nombre                    VARCHAR NOT NULL           ← nombre completo
  email                     VARCHAR nullable UNIQUE    ← campo app, no sync
  usuario                   VARCHAR nullable
  password_hash             VARCHAR NOT NULL           ← campo app, no sync
  rol_id                    INTEGER FK→roles.id        ← campo app, no sync
  categoria_id              INTEGER FK→categorias nullable
  subarea_id                INTEGER FK→subareas nullable
  puesto_id                 INTEGER FK→puestos nullable
  estado_id                 INTEGER FK→estados_empleados nullable
  area_id                   INTEGER FK→areas nullable
  clasificacion_id          INTEGER FK→clasificacion_empleado nullable
  lider_id                  INTEGER FK→empleados.id nullable   ← auto-ref
  centrocosto_id            INTEGER nullable           ← sin tabla local
  foto                      VARCHAR nullable
  recibe_bono               BOOLEAN nullable
  brigada                   VARCHAR nullable
  registro                  DATE nullable              ← equivale a fecha_ingreso
  a_restringido             BOOLEAN nullable
  requiere_cambio_password  BOOLEAN nullable
  created_at                TIMESTAMP WITH TZ server_default=now()
```

**Eliminado:** `apellido`, `departamento`, `puesto` (texto), `activo`, `fecha_ingreso`, `supervisor_id` (renombrado a `lider_id`).

### Relaciones FK externas (sin tabla local)

`centrocosto_id` se mapea como entero plano. Si en el futuro se agrega tabla `centros_costo`, solo se agrega FK sin cambiar la columna.

---

## Migración Alembic

Una nueva migración (`alembic revision`) que ejecuta en orden:

1. Drop FKs de tablas dependientes que apuntan a `empleados.id` (solicitudes, incidencias, actas, comedor_registros, evidencias, notificaciones, audit_log, solicitud_aprobaciones, acta_aprobaciones, menu_semanal)
2. Drop tabla `empleados`
3. Create tablas de catálogo (en orden: `areas` → `categorias` → `subareas` → `puestos` → `estados_empleados` → `clasificacion_empleado`)
4. Create nueva tabla `empleados`
5. Recrear FKs de tablas dependientes

El `downgrade` revierte en orden inverso.

---

## IT Mirror Sync — cambios

### Orden de sync

```
1. areas
2. categorias
3. subareas          (depende de areas)
4. puestos           (depende de areas)
5. estados_empleados
6. clasificacion_empleado
7. empleados
```

### Estrategia de sync para catálogos

Upsert por PK del cliente. Nunca se borran registros locales; si el cliente elimina un registro, solo cambia `estatus_id`.

### Mapeo columnas cliente → modelo local

| Columna cliente | Campo local | Notas |
|---|---|---|
| `empleado_id` | `empleado_id` | |
| `no_empleado` | `no_empleado` | |
| `no_sap` | `no_sap` | |
| `nombre` | `nombre` | |
| `usuario` | `usuario` | |
| `categoria_id` | `categoria_id` | FK resuelta tras sync catálogos |
| `subarea_id` | `subarea_id` | |
| `puesto_id` | `puesto_id` | |
| `estado_id` | `estado_id` | |
| `area_id` | `area_id` | |
| `clasificacion_id` | `clasificacion_id` | |
| `lider_id` | `lider_id` | int del cliente → resuelto a `id` local via lookup por `empleado_id` |
| `centrocosto_id` | `centrocosto_id` | int plano |
| `foto` | `foto` | |
| `recibe_bono` | `recibe_bono` | |
| `brigada` | `brigada` | |
| `registro` | `registro` | |
| `a_restringido` | `a_restringido` | |
| `requiere_cambio_password` | `requiere_cambio_password` | |

**Campos NO sincronizados:** `id`, `password_hash`, `rol_id`, `email`, `created_at`.

### Resolución de `lider_id`

El cliente almacena `lider_id` como `empleado_id` del líder (PK del cliente). El sync resuelve esto con un lookup `empleado_id → id` local antes de asignar la FK.

### Trigger de desactivación

Reemplaza la lógica de `era_activo and not emp.activo`. La condición es:

```python
era_activo = empleado_local.estado_id in settings.ESTADOS_ACTIVOS_IDS
ahora_activo = nuevo_estado_id in settings.ESTADOS_ACTIVOS_IDS
if era_activo and not ahora_activo:
    # cancelar solicitudes pending + notificar
```

---

## Capas de la aplicación afectadas

### `app/models/catalogos.py` — nuevo archivo

6 modelos SQLAlchemy: `Area`, `Subarea`, `Categoria`, `Puesto`, `EstadoEmpleado`, `ClasificacionEmpleado`.

### `app/models/empleados.py`

Reemplazar completamente el modelo `Empleado` con la nueva estructura.

### `app/schemas/empleados.py`

- `EmpleadoResponse`: campos nuevos con objetos de catálogo anidados (no solo IDs).
- `EmpleadoCreate` / `EmpleadoUpdate`: solo campos modificables por la plataforma RH (no los sincronizados).
- Nuevos schemas: `CatalogoResponse`, `EstadoEmpleadoResponse`, `ClasificacionResponse`.

### `app/repositories/empleado_repository.py`

| Cambio | Detalle |
|---|---|
| `get_by_num_empleado` → `get_by_no_empleado` | Campo renombrado |
| `get_subordinados` | Filtro `activo==True` → `estado_id.in_(settings.ESTADOS_ACTIVOS_IDS)` |
| Nuevo: `get_by_empleado_id` | Para resolución de `lider_id` en sync |
| `selectinload` | Cargar catálogos según necesidad del endpoint, no eager-load global |

### `app/services/auth_service.py`

Verificación de empleado activo: `estado_id in settings.ESTADOS_ACTIVOS_IDS`.

### `app/services/usuario_service.py`

Campos renombrados. Lógica de desactivación actualizada.

### `app/services/solicitud_service.py`

Filtros de empleado activo actualizados.

### `app/integrations/it_mirror.py`

Extendido con sync de catálogos y nuevo mapeo de columnas.

### `app/utils/seed.py`

Extendido con datos de prueba para catálogos y empleados de prueba. Admin RH actualizado a nuevo schema.

---

## Configuración por entorno

### Nueva variable en `config.py`

```python
ESTADOS_ACTIVOS_IDS: List[int] = [1]
# IDs de estados_empleados que se consideran "activo"
# Ajustar en producción según los IDs reales del cliente
```

### Flujo por entorno

| Acción | Development | Production |
|---|---|---|
| Levantar BD | `docker-compose up -d` | BD cliente existente |
| Migrar schema local | `alembic upgrade head` | `alembic upgrade head` |
| Poblar datos | `python -m app.utils.seed` | Sync automático APScheduler |
| Sync empleados | Skipped (sin `IT_MIRROR_DB_URL`) | Cada `IT_SYNC_INTERVAL_MINUTES` |
| BD cliente | No se toca | Solo lectura via `IT_MIRROR_DB_URL` |

### Datos de prueba en development (seed extendido)

- 1 `Area`: "Producción" (area_id=1)
- 1 `Subarea`: "Línea A" (subarea_id=1, area_id=1)
- 1 `Categoria`: "Operativo" (categoria_id=1)
- 1 `Puesto`: "Operador" (puesto_id=1, area_id=1)
- 2 `EstadoEmpleado`: "Activo" (estado_id=1), "Baja" (estado_id=2)
- 1 `ClasificacionEmpleado`: "Directo" (clasificacion_id=1)
- 4 empleados: activo sin líder, activo con líder, baja, restringido

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `app/models/catalogos.py` | Crear |
| `app/models/empleados.py` | Reemplazar |
| `app/models/__init__.py` | Actualizar imports |
| `app/schemas/empleados.py` | Reemplazar |
| `app/repositories/empleado_repository.py` | Actualizar |
| `app/services/auth_service.py` | Actualizar verificación activo |
| `app/services/usuario_service.py` | Actualizar campos |
| `app/services/solicitud_service.py` | Actualizar filtros |
| `app/integrations/it_mirror.py` | Extender con catálogos |
| `app/core/config.py` | Agregar `ESTADOS_ACTIVOS_IDS` |
| `app/utils/seed.py` | Extender con catálogos y empleados prueba |
| `alembic/versions/xxxx_empleados_catalogos.py` | Crear migración |

---

## Campos mapeados sin uso actual

Los siguientes campos se mapean y persisten pero no tienen lógica de negocio activa en la plataforma RH en este momento:

- `no_sap`: identificador SAP, disponible para reportes futuros
- `centrocosto_id`: sin tabla local, disponible como entero para reportes
- `foto`: path de foto, disponible para UI
- `brigada`: grupo de emergencias, disponible para reportes
- `a_restringido`: acceso restringido, puede usarse en lógica de comedor/acceso
- `requiere_cambio_password`: flag para forzar cambio en primer login (puede conectarse al auth_service)
