# Catálogo de Tareas y Asignación a Perfiles de Puesto

## Resumen

Las tareas principales en los perfiles de puesto deben provenir de un catálogo centralizado (`tabla tareas_catalogo`), en lugar de ser texto libre por perfil. Se debe poder crear nuevas tareas desde una pantalla dedicada de administración del catálogo y también inline desde el detalle del perfil de puesto — siguiendo el mismo patrón implementado para Competencias Requeridas.

## Motivación

Actualmente `PerfilTarea` almacena `descripcion` como texto libre sin normalización. Esto causa:
- Duplicación de tareas idénticas entre perfiles (ej. "Supervisar entregas de material" escrito 20 veces con variaciones)
- Imposibilidad de cruzar datos entre perfiles que comparten tareas
- No hay forma de filtrar "¿qué puestos comparten esta tarea?"
- Inconsistencia en redacción entre perfiles

Unificar el origen en un catálogo permite:
- Consistencia en la redacción de tareas
- Reportes cruzados (perfiles que comparten funciones similares)
- Una sola fuente de verdad para la definición de cada tarea
- Reutilización: al crear un perfil nuevo, buscar tareas existentes en lugar de reescribir

## Alcance

### 1. Modelo de catálogo: `TareaCatalogo`

Nueva tabla `tareas_catalogo` con:

| Campo | Tipo | Notas |
|-------|------|-------|
| id | int PK | autoincrement |
| nombre | str(500) | not null, descripción de la tarea |
| categoria | str(50) | nullable — agrupación opcional (ej. "logística", "calidad", "seguridad") |
| es_complemento | bool | default False — indica si es tarea complementaria vs principal |
| activo | bool | default True, soft delete |
| created_at | datetime | server_default now() |
| updated_at | datetime | onupdate now() |

Constraints:
- Unique sobre `nombre` (evitar duplicados)

Relaciones:
- `tareas_asignadas` → lista de `PerfilTarea` que usan esta tarea

### 2. Modificar `PerfilTarea` para vincular al catálogo

- Agregar campo `tarea_catalogo_id` (FK a `tareas_catalogo.id`, nullable para backwards compat)
- Mantener campo `descripcion` existente — si `tarea_catalogo_id` está poblado, la descripción se toma del catálogo; si es null, se usa `descripcion` (legacy)
- Migración que intenta vincular registros existentes por coincidencia de texto (best-effort match)

### 3. Endpoints CRUD del catálogo

Router en `app/api/v1/tareas_catalogo/router.py`:

| Método | Path | Descripción | Permisos |
|--------|------|-------------|----------|
| GET | `/api/v1/tareas-catalogo` | Listar con paginación, filtro por categoría, búsqueda por nombre | Autenticado |
| GET | `/api/v1/tareas-catalogo/{id}` | Detalle incluyendo count de perfiles que la usan | Autenticado |
| POST | `/api/v1/tareas-catalogo` | Crear nueva tarea en catálogo | RH |
| PATCH | `/api/v1/tareas-catalogo/{id}` | Actualizar nombre/categoría | RH |
| DELETE | `/api/v1/tareas-catalogo/{id}` | Soft delete (activo=False) | RH |

### 4. Modificar endpoints de tareas del perfil

- `POST /api/v1/perfiles/{perfil_id}/tareas` — debe aceptar `tarea_catalogo_id` (opcional, alternativo a `descripcion`)
  - Si se envía `tarea_catalogo_id`: se resuelve nombre del catálogo como descripción
  - Si se envía `descripcion` sin `tarea_catalogo_id`: sigue funcionando como texto libre (legacy)
- El response `PerfilTareaResponse` incluye `tarea_catalogo_id` y `tarea_catalogo_nombre` opcionales

### 5. Refactorizar modal de tareas en frontend (patrón competencias)

Transformar `editarTareasModal.ts` de un formulario de texto libre a:
- **Lista existente**: mostrar tareas actuales del perfil (como ya funciona, con drag & drop y eliminar)
- **Buscador de catálogo**: input de búsqueda que filtra tareas existentes en el catálogo, excluyendo las ya asignadas al perfil
- **Selección + agregar**: seleccionar una tarea del catálogo y agregarla al perfil con un click
- **Crear nueva**: botón "Crear nueva tarea" que despliega mini-form inline (nombre, categoría, es_complemento), crea en catálogo y asigna al perfil inmediatamente

Seguir el mismo patrón visual y de interacción que `editarCompetenciasModal.ts`:
- Search con debounce → resultados en dropdown → selección → botón agregar
- Sección colapsable de "Crear nueva"
- Cache del catálogo al abrir el modal

### 6. (Opcional) Pantalla de administración del catálogo de tareas

Página `#/tareas-catalogo` con:
- Tabla paginada con búsqueda y filtro por categoría
- Columna "Usada en X perfiles"
- Acciones: crear, editar, desactivar
- Solo visible para rol RH

### Fuera de alcance

- Migración masiva obligatoria de datos legacy (se hace best-effort o manual posterior)
- Categorización jerárquica de tareas (por ahora solo un nivel: categoría flat)
- Peso/importancia de la tarea en el perfil (campo futuro, no ahora)
- Cambios en el módulo de Perfil de Funciones individual (asignaciones por empleado) — esa vista ya consume las tareas del perfil

## Dependencias

- Modelo `PerfilTarea` en `app/models/talento.py` — requiere alteración (agregar FK)
- Schema `PerfilTareaCreate` en `app/schemas/perfil_funciones.py` — requiere agregar campo opcional
- Router `app/api/v1/perfil_funciones/router.py` — endpoints existentes de tareas
- Frontend `frontend/src/components/puestos/editarTareasModal.ts` — requiere refactor completo
- Frontend `frontend/src/api/puestos.ts` — agregar funciones API para catálogo
- Patrón de referencia: `editarCompetenciasModal.ts` + `api/competencias.ts`

## Criterios de aceptación

- [ ] Tabla `tareas_catalogo` creada con migración Alembic
- [ ] `PerfilTarea` tiene campo `tarea_catalogo_id` (FK, nullable)
- [ ] Endpoints CRUD del catálogo funcionan (`/api/v1/tareas-catalogo`)
- [ ] Endpoint POST de tareas del perfil acepta `tarea_catalogo_id` y resuelve nombre
- [ ] Modal de editar tareas muestra buscador del catálogo (no solo texto libre)
- [ ] Desde el modal se puede crear una nueva tarea al catálogo sin salir del flujo
- [ ] Tareas existentes sin `tarea_catalogo_id` siguen mostrándose (backwards compatible)
- [ ] Drag & drop y reordenamiento siguen funcionando
- [ ] Solo rol RH puede crear/editar tareas en el catálogo
- [ ] La tarjeta de "Tareas principales" en detalle del perfil muestra correctamente tareas del catálogo
