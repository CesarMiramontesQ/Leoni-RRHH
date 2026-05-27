# Tareas Extra por Empleado en Puesto

## Resumen

Permitir asignar tareas extra individuales a cada empleado desde la pantalla "Empleados del Puesto". Cada empleado asignado a un perfil de puesto hereda las tareas principales del perfil, pero adicionalmente puede tener tareas complementarias tomadas del mismo catálogo (`tareas_catalogo`). La gestión (agregar/quitar) se hace directamente desde la vista de empleados asignados.

## Motivación

- Las tareas principales del perfil son compartidas por todos los empleados asignados, pero en la práctica ciertos empleados tienen responsabilidades adicionales específicas a su rol o experiencia.
- Actualmente no hay forma de registrar estas tareas extra a nivel individual — solo existen tareas a nivel perfil.
- RH necesita documentar formalmente las tareas complementarias de cada empleado sin modificar el perfil base que afecta a todos.
- Esta información forma parte del Perfil de Funciones firmado por el empleado y su superior.

## Alcance

### 1. Nuevo modelo: `PerfilFuncionesTarea`

Nueva tabla `perfil_funciones_tareas` que vincula tareas extra del catálogo con la asignación individual (perfil_funciones):

| Campo | Tipo | Notas |
|-------|------|-------|
| id | int PK | autoincrement |
| perfil_funciones_id | int FK | referencia a `perfil_funciones.id`, NOT NULL, ON DELETE CASCADE |
| tarea_catalogo_id | int FK | referencia a `tareas_catalogo.id`, NOT NULL |
| orden | int | posición de la tarea extra (para ordenamiento) |
| created_at | datetime | server_default now() |

Constraints:
- Unique sobre `(perfil_funciones_id, tarea_catalogo_id)` — un empleado no puede tener la misma tarea extra duplicada
- Index sobre `perfil_funciones_id`

Relaciones:
- `PerfilFunciones.tareas_extra` → lista de `PerfilFuncionesTarea`
- `PerfilFuncionesTarea.tarea_catalogo` → `TareaCatalogo`

### 2. Endpoints para tareas extra del empleado

Router en el contexto de perfil_funciones:

| Método | Path | Descripción | Permisos |
|--------|------|-------------|----------|
| GET | `/api/v1/perfil-funciones/{pf_id}/tareas-extra` | Listar tareas extra asignadas al empleado | Autenticado |
| POST | `/api/v1/perfil-funciones/{pf_id}/tareas-extra` | Asignar una tarea del catálogo como extra | RH |
| DELETE | `/api/v1/perfil-funciones/{pf_id}/tareas-extra/{tarea_extra_id}` | Quitar una tarea extra | RH |
| PUT | `/api/v1/perfil-funciones/{pf_id}/tareas-extra/reorder` | Reordenar tareas extra | RH |

El POST recibe `{ tarea_catalogo_id: int }` y valida que:
- La tarea existe en el catálogo y está activa
- No está ya asignada como tarea extra a este empleado
- (Opcional) No es una de las tareas principales del perfil base — para evitar duplicación

### 3. Modificar la pantalla "Empleados del Puesto"

En la tabla de empleados asignados (Image #3), agregar funcionalidad para gestionar tareas extra:

- **Botón "Ver detalle"** (ya existe): al hacer click, mostrar un panel o modal con:
  - Sección "Tareas principales del puesto" (read-only, heredadas del perfil)
  - Sección "Tareas extra" (editable): lista de tareas adicionales asignadas a ese empleado específico
  - Botón "+ Agregar tarea extra" que abre un buscador del catálogo (mismo patrón que el modal de tareas principales: búsqueda con debounce, selección, agregar)
  - Cada tarea extra tiene botón de eliminar (con confirmación)

- **Buscador de catálogo**: filtra tareas del catálogo excluyendo:
  - Tareas ya asignadas como principales del perfil
  - Tareas ya asignadas como extra a este empleado

### 4. Incluir tareas extra en el Perfil de Funciones

Cuando se genera o consulta el perfil de funciones completo de un empleado:
- Mostrar primero las tareas principales (del perfil base)
- Luego mostrar las tareas extra (individuales), diferenciadas visualmente (badge "Extra" o separador)

### Fuera de alcance

- Editar las tareas principales del perfil desde la vista de empleados (eso se sigue haciendo desde el detalle del puesto)
- Asignar tareas extra masivamente a varios empleados a la vez
- Crear tareas nuevas en el catálogo desde este flujo (se usa solo el catálogo existente; crear nuevas se hace desde el admin de catálogo o desde el modal de tareas principales)
- Historial de cambios en tareas extra (audit log)
- Impacto en firmas — por ahora las tareas extra no invalidan firmas existentes

## Dependencias

- Modelo `TareaCatalogo` en `app/models/talento.py` — ya existe
- Modelo `PerfilFunciones` en `app/models/talento.py` — se agrega relationship
- Router `app/api/v1/perfil_funciones/router.py` — agregar endpoints de tareas extra
- Frontend `frontend/src/pages/puestos.ts` o componente de empleados del puesto — agregar UI de gestión
- Frontend `frontend/src/api/puestos.ts` — agregar funciones API para tareas extra
- Catálogo de tareas ya tiene endpoint GET para búsqueda (`/api/v1/tareas-catalogo`)

## Criterios de aceptación

- [ ] Tabla `perfil_funciones_tareas` creada con migración Alembic
- [ ] Endpoint GET lista tareas extra de un empleado específico
- [ ] Endpoint POST asigna una tarea del catálogo como extra (validando unicidad y existencia)
- [ ] Endpoint DELETE quita una tarea extra
- [ ] Desde "Empleados del Puesto" → "Ver detalle" se pueden ver y gestionar tareas extra
- [ ] El buscador excluye tareas principales del perfil y tareas ya asignadas como extra
- [ ] Las tareas extra se diferencian visualmente de las principales en la vista del perfil de funciones
- [ ] Solo rol RH puede agregar/quitar tareas extra
- [ ] Las tareas principales siguen siendo read-only en la vista de empleados (no se alteran desde aquí)
- [ ] Backwards compatible: empleados sin tareas extra simplemente no muestran la sección extra
