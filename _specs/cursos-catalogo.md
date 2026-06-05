# Cursos — Catálogo Full Stack

## Resumen

Módulo completo de catálogo de cursos con CRUD, importación masiva, asignación a puestos, asignación individual a empleados, y vistas de detalle bidireccionales (curso→puestos/empleados, puesto→cursos, empleado→cursos).

## Motivación

La planta maneja ~1,971 cursos únicos con 64,000+ registros históricos de asistencia. Se necesita un catálogo real con asignaciones a puestos (aplica a todos los empleados del puesto) y asignaciones individuales (cursos extra por empleado).

## Entidades

### 1. Curso (catálogo)

Tabla: `cursos`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(300) | NOT NULL, UNIQUE | Nombre del curso |
| tipo | enum('interno','externo') | nullable | — |
| clasificacion | enum('adicional','contemplado') | nullable | — |
| obligatorio | boolean | default false | — |
| duracion_horas | float | nullable | Duración en horas (decimales) |
| cupo_max | int | nullable | Capacidad máxima |
| instructor | varchar(255) | nullable | Nombre del empleado instructor |
| categoria | enum('tecnico','calidad','seguridad','operativo','blanda') | nullable | — |
| modalidad | varchar(50) | nullable | Presencial, Virtual, Híbrido |
| sesiones_anio | int | nullable | Frecuencia anual |
| proveedor | varchar(255) | nullable | Empresa proveedora |
| descripcion | text | nullable | Descripción del curso |
| requisitos | text | nullable | Requisitos previos |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |
| updated_at | timestamp | on update | — |

### 2. CursoPuesto (asignación curso↔puesto)

Tabla: `curso_puesto`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| curso_id | FK cursos.id | ON DELETE CASCADE | — |
| puesto_perfil_id | FK puestos_perfil.id | ON DELETE CASCADE | — |
| obligatorio | boolean | default false | Si el curso es obligatorio para el puesto |
| created_at | timestamp | default now() | — |

UniqueConstraint: `(curso_id, puesto_perfil_id)`

Semántica: todos los empleados asignados al puesto heredan este curso.

### 3. CursoEmpleado (asignación individual)

Tabla: `curso_empleado`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| curso_id | FK cursos.id | ON DELETE CASCADE | — |
| empleado_id | FK empleados.id | ON DELETE CASCADE | — |
| fecha | date | nullable | Fecha de asignación/impartición |
| horas | float | nullable | Horas reales cursadas |
| centro_costo | int | nullable | Centro de costo al momento |
| tipo | varchar(20) | nullable | Tipo al momento de la asignación |
| clasificacion | varchar(20) | nullable | Clasificación al momento |
| obligatorio | boolean | nullable | — |
| puesto_al_momento | varchar(255) | nullable | Puesto que tenía el empleado |
| created_at | timestamp | default now() | — |

Indexes: `empleado_id`, `curso_id`

Semántica: curso asignado directamente a un empleado (extra, independiente del puesto).

## Endpoints API

### CRUD Catálogo de Cursos

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/cursos` | Listar con paginación y filtros | todos |
| GET | `/api/v1/level-up/cursos/{id}` | Detalle | todos |
| POST | `/api/v1/level-up/cursos` | Crear | rh |
| PUT | `/api/v1/level-up/cursos/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/cursos/{id}` | Soft delete | rh |

Filtros en GET: `busqueda`, `tipo`, `clasificacion`, `obligatorio`, `categoria`, `page`, `page_size`

### Asignaciones Curso↔Puesto

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/perfiles/{perfil_id}/cursos` | Cursos asignados al puesto | todos |
| POST | `/api/v1/perfiles/{perfil_id}/cursos` | Asignar curso al puesto | rh, supervisor |
| DELETE | `/api/v1/perfiles/{perfil_id}/cursos/{id}` | Quitar asignación | rh, supervisor |

### Cursos Extra por Empleado (via asignación)

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/perfiles/{perfil_id}/asignaciones/{asig_id}/cursos-extra` | Cursos extra del empleado | todos |
| POST | `/api/v1/perfiles/{perfil_id}/asignaciones/{asig_id}/cursos-extra` | Asignar curso extra | rh, supervisor |
| DELETE | `/api/v1/perfiles/{perfil_id}/asignaciones/{asig_id}/cursos-extra/{id}` | Quitar curso extra | rh, supervisor |

### Detalle de Curso — Relaciones

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/cursos/{id}/puestos` | Puestos asignados con lista de empleados | todos |
| GET | `/api/v1/level-up/cursos/{id}/empleados-extra` | Empleados con asignación individual | todos |

## Frontend

### Página `#/cursos`

- Vista tabla y tarjetas (toggle)
- Filtros: tipo, clasificación, obligatorio, categoría, búsqueda libre
- Botón "Limpiar filtros"
- Paginación
- Modal crear/editar con:
  - Todos los campos del modelo
  - Instructor como selector buscable de empleados (paginado, input + dropdown)
  - Descripción y requisitos como textarea
- Vista detalle del curso:
  - Datos del curso en grid
  - Sección "Puestos asignados" con empleados listados debajo de cada puesto
  - Sección "Empleados extra (individuales)"
  - Botones editar/eliminar (solo RH)

### Página `#/puestos/{id}` (detalle del puesto)

- Sección "Cursos asignados" en columna derecha
- Lista de cursos con badge "Obligatorio"
- Botón "Asignar curso" (RH) abre modal con buscador del catálogo
- Botón quitar (hover-reveal, RH)

### Página `#/puestos/{id}/empleados` (lista empleados del puesto)

- Menú Acciones → "Administrar cursos extra" (nuevo, junto a tareas extra)
- Modal similar a tareas extra: lista cursos individuales + buscador para agregar
- Vista detalle del empleado muestra:
  - "Cursos del puesto" (heredados del puesto)
  - "Cursos extra (individual)" (asignados directamente)

### Tarjetas de puestos (`#/puestos`)

- KPI "Cursos" muestra conteo real de `curso_puesto` por perfil

## Importación masiva

Script: `app/utils/seed_cursos_catalogo.py`

```bash
docker-compose exec backend python -m app.utils.seed_cursos_catalogo           # dry-run
docker-compose exec backend python -m app.utils.seed_cursos_catalogo --execute  # insert
```

Lógica:
1. Lee `Cursos - Masivo.xlsx`
2. Agrupa por nombre de curso (normalizado)
3. Calcula: horas=mediana, tipo/clasificación/obligatorio=moda
4. Upsert en `cursos` (match por nombre case-insensitive)

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `app/api/v1/level_up/router_cursos.py` | Router CRUD + detalle relaciones |
| `app/repositories/level_up_cursos.py` | Repository con filtros |
| `app/services/level_up_cursos.py` | Service layer |
| `app/utils/seed_cursos_catalogo.py` | Script importación Excel |
| `frontend/src/api/cursos.ts` | API module completo |
| `frontend/src/dashboard/cursos/types.ts` | TypeScript types |
| `frontend/src/components/puestos/cursosExtraModal.ts` | Modal cursos extra |
| `alembic/versions/add9d264f36d_*.py` | Migración: enums + columnas + tablas |
| `alembic/versions/2316721bbe51_*.py` | Migración: campo requisitos |

## Archivos modificados

| Archivo | Cambios |
|---------|---------|
| `app/models/level_up.py` | Enums TipoCurso/ClasificacionCurso, campos en Curso, modelos CursoPuesto/CursoEmpleado |
| `app/schemas/level_up.py` | CursoCreate/Update/Response con nuevos campos, CursoListResponse |
| `app/api/v1/perfil_funciones/router.py` | Endpoints cursos-puesto + cursos-extra-empleado |
| `app/repositories/puesto_perfil_repository.py` | Subquery cursos en resumen-tarjetas |
| `app/models/__init__.py` | Registrar CursoPuesto, CursoEmpleado |
| `app/main.py` | Registrar router_cursos |
| `frontend/src/pages/levelUp.ts` | Página completa de cursos (reemplazó datos fake) |
| `frontend/src/pages/perfilPuestoDetalle.ts` | Sección cursos asignados al puesto |
| `frontend/src/pages/puestoEmpleados.ts` | Acción cursos extra + vista en detalle |

## Dependencias

- `openpyxl` (ya en requirements.txt) para importación Excel
- Modelos existentes: `Empleado`, `PuestoPerfil`, `PerfilFunciones`
