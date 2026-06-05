# Curso Sessions — Programación de Sesiones por Curso

## Resumen

Agregar sesiones programadas a los cursos del catálogo. Las asignaciones de puestos y empleados se mueven de apuntar directamente al curso a apuntar a una sesión específica. Cada sesión tiene fecha, horario, y capacidad, permitiendo programar múltiples imparticiones del mismo curso.

## Motivación

Actualmente un curso se asigna directamente a un puesto o empleado sin fecha ni contexto temporal. En la realidad, un curso se imparte en sesiones específicas (fechas concretas) y los empleados se inscriben a una sesión, no al curso en abstracto. Esto permite:
- Programar cuándo se dará cada curso
- Controlar cupo por sesión
- Registrar asistencia por sesión
- Ver historial temporal de imparticiones
- Planificar capacitaciones futuras

## Entidades

### 1. CursoSesion (nueva)

Tabla: `curso_sesion`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| curso_id | FK cursos.id | NOT NULL, ON DELETE CASCADE | Curso al que pertenece |
| fecha_inicio | date | NOT NULL | Fecha de inicio de la sesión |
| fecha_fin | date | nullable | Fecha fin (si es multi-día) |
| hora_inicio | time | nullable | Hora de inicio |
| hora_fin | time | nullable | Hora de fin |
| ubicacion | varchar(255) | nullable | Lugar o sala |
| instructor | varchar(255) | nullable | Instructor de esta sesión (puede diferir del default del curso) |
| cupo_max | int | nullable | Cupo máximo para esta sesión (override del curso) |
| notas | text | nullable | Notas adicionales |
| estado | enum('programada','en_curso','completada','cancelada') | default 'programada' | Estado de la sesión |
| created_at | timestamp | default now() | — |
| updated_at | timestamp | on update | — |

### 2. Cambios a CursoPuesto (existente → CursoSesionPuesto)

Migrar la tabla `curso_puesto` para que apunte a una sesión en lugar del curso directamente:

| Campo | Cambio |
|-------|--------|
| curso_id | REMOVER |
| sesion_id | AGREGAR — FK curso_sesion.id |

O bien crear una nueva tabla `curso_sesion_puesto` y deprecar la anterior.

### 3. Cambios a CursoEmpleado (existente → CursoSesionEmpleado)

Migrar la tabla `curso_empleado` para que apunte a una sesión:

| Campo | Cambio |
|-------|--------|
| curso_id | REMOVER |
| sesion_id | AGREGAR — FK curso_sesion.id |
| asistio | AGREGAR — boolean, nullable, para registro de asistencia |

O bien crear una nueva tabla `curso_sesion_empleado` y deprecar la anterior.

## Endpoints API

### CRUD Sesiones

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/cursos/{curso_id}/sesiones` | Listar sesiones de un curso | todos |
| GET | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}` | Detalle de sesión | todos |
| POST | `/api/v1/level-up/cursos/{curso_id}/sesiones` | Crear sesión | rh |
| PUT | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}` | Editar sesión | rh |
| DELETE | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}` | Cancelar/eliminar sesión | rh |

### Asignaciones a Sesión (reemplazan asignaciones directas a curso)

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/puestos` | Puestos inscritos en la sesión | todos |
| POST | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/puestos` | Inscribir puesto a la sesión | rh, supervisor |
| DELETE | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/puestos/{id}` | Quitar puesto | rh, supervisor |
| GET | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/empleados` | Empleados inscritos | todos |
| POST | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/empleados` | Inscribir empleado | rh, supervisor |
| DELETE | `/api/v1/level-up/cursos/{curso_id}/sesiones/{sesion_id}/empleados/{id}` | Quitar empleado | rh, supervisor |

### Endpoints existentes a ajustar

| Ruta actual | Cambio |
|-------------|--------|
| `GET /api/v1/perfiles/{id}/cursos` | Devolver sesiones asignadas al puesto (con datos del curso) |
| `GET /api/v1/perfiles/{id}/asignaciones/{id}/cursos-extra` | Devolver sesiones del empleado |
| `GET /api/v1/level-up/cursos/{id}/puestos` | Agrupar por sesión |
| `GET /api/v1/level-up/cursos/{id}/empleados-extra` | Agrupar por sesión |

## Frontend

### Detalle del curso (`#/cursos` → ver detalle)

- Nueva sección "Sesiones" debajo de los datos del curso
- Tabla/lista de sesiones con: fecha, hora, estado, inscritos/cupo, instructor
- Botón "Crear sesión" (solo RH)
- Click en sesión expande o navega a detalle de sesión mostrando puestos y empleados inscritos

### Detalle de sesión

- Datos de la sesión (fecha, hora, ubicación, instructor, cupo, estado)
- Sección "Puestos inscritos" con lista de empleados por puesto
- Sección "Empleados extra" inscritos individualmente
- Botones para inscribir puesto o empleado (solo RH)

### Detalle del puesto (`#/puestos/{id}`)

- La sección "Cursos asignados" ahora muestra sesiones: nombre del curso + fecha de la sesión
- Modal de asignar ahora primero selecciona curso, luego selecciona sesión disponible

### Empleados del puesto (`#/puestos/{id}/empleados`)

- "Administrar cursos extra" ahora muestra sesiones asignadas
- Modal para agregar: primero busca curso, luego muestra sesiones disponibles
- Detalle del empleado muestra sesiones (del puesto y extra) con fechas

## Migración de datos

- Los registros existentes en `curso_puesto` y `curso_empleado` necesitan migrar a las nuevas tablas con sesión
- Opción: crear una sesión "legacy" por cada curso que tenga asignaciones existentes, con fecha NULL y estado "completada"
- Esto preserva los datos actuales sin perderlos

## Fuera de alcance

- Registro de asistencia/calificación post-sesión (se puede agregar después)
- Notificaciones de recordatorio de sesión
- Integración con calendario externo
- Sesiones recurrentes automáticas

## Dependencias

- Módulo de cursos existente (spec: `cursos-catalogo.md`)
- Modelos: `Curso`, `CursoPuesto`, `CursoEmpleado`, `PuestoPerfil`, `PerfilFunciones`, `Empleado`
