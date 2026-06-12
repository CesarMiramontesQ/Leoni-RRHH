# Ajustes de Cursos — Catálogos Administrables

## Resumen

Página de administración de catálogos para el módulo de Cursos. Permite gestionar desde la UI (CRUD completo) las entidades: Categorías, Tipos de curso, Clasificaciones, Instructores y Proveedores. Reemplaza los enums hardcodeados actuales por tablas dinámicas que RH puede modificar sin tocar código.

## Motivación

Actualmente los catálogos de cursos (categoría, tipo, clasificación) son enums fijos en el código Python y los campos instructor/proveedor son texto libre (varchar). Esto causa:
- RH no puede agregar nuevas categorías o tipos sin intervención de desarrollo.
- Los instructores y proveedores se escriben libre, generando duplicados e inconsistencias ("Juan Perez" vs "Juan Pérez" vs "JUAN PEREZ").
- No hay forma de desactivar opciones obsoletas.

Se necesita una página de "Ajustes" dentro del módulo de Cursos donde RH pueda administrar estos catálogos de forma autónoma.

## Entidades

### 1. CursoCategoría (nueva tabla)

Tabla: `curso_categoria`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(100) | NOT NULL, UNIQUE | Nombre de la categoría |
| descripcion | varchar(255) | nullable | Descripción opcional |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |

Reemplaza el enum `CategoriaCurso` (tecnico, calidad, seguridad, operativo, blanda).

### 2. CursoTipo (nueva tabla)

Tabla: `curso_tipo`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(100) | NOT NULL, UNIQUE | Nombre del tipo |
| descripcion | varchar(255) | nullable | Descripción opcional |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |

Reemplaza el enum `TipoCurso` (interno, externo).

### 3. CursoClasificacion (nueva tabla)

Tabla: `curso_clasificacion`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(100) | NOT NULL, UNIQUE | Nombre de la clasificación |
| descripcion | varchar(255) | nullable | Descripción opcional |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |

Reemplaza el enum `ClasificacionCurso` (adicional, contemplado).

### 4. CursoInstructor (nueva tabla)

Tabla: `curso_instructor`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(255) | NOT NULL | Nombre completo |
| especialidad | varchar(255) | nullable | Área de especialidad |
| empresa | varchar(255) | nullable | Empresa (si es externo) |
| es_interno | boolean | default true | Si es empleado de Leoni |
| empleado_id | FK empleados.id | nullable | Vínculo opcional con empleado |
| contacto | varchar(255) | nullable | Email o teléfono |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |

Reemplaza el campo varchar `instructor` en la tabla `cursos` y `curso_sesion`.

### 5. CursoProveedor (nueva tabla)

Tabla: `curso_proveedor`

| Campo | Tipo | Constraints | Notas |
|-------|------|-------------|-------|
| id | serial PK | — | — |
| nombre | varchar(255) | NOT NULL, UNIQUE | Razón social o nombre comercial |
| contacto | varchar(255) | nullable | Persona de contacto |
| telefono | varchar(50) | nullable | Teléfono |
| email | varchar(255) | nullable | Email de contacto |
| direccion | text | nullable | Dirección |
| activo | boolean | default true | Soft delete |
| created_at | timestamp | default now() | — |

Reemplaza el campo varchar `proveedor` en la tabla `cursos`.

### 6. Cambios a tabla `cursos` (existente)

| Campo actual | Cambio |
|--------------|--------|
| categoria (enum) | Cambiar a `categoria_id` FK → `curso_categoria.id`, nullable |
| tipo (enum) | Cambiar a `tipo_id` FK → `curso_tipo.id`, nullable |
| clasificacion (enum) | Cambiar a `clasificacion_id` FK → `curso_clasificacion.id`, nullable |
| instructor (varchar) | Cambiar a `instructor_id` FK → `curso_instructor.id`, nullable |
| proveedor (varchar) | Cambiar a `proveedor_id` FK → `curso_proveedor.id`, nullable |

### 7. Cambios a tabla `curso_sesion` (existente)

| Campo actual | Cambio |
|--------------|--------|
| instructor (varchar) | Cambiar a `instructor_id` FK → `curso_instructor.id`, nullable |

## Migración de datos

1. Crear las 5 tablas nuevas.
2. Poblar `curso_categoria` con los valores actuales del enum: tecnico, calidad, seguridad, operativo, blanda.
3. Poblar `curso_tipo` con: interno, externo.
4. Poblar `curso_clasificacion` con: adicional, contemplado.
5. Poblar `curso_instructor` extrayendo valores únicos del campo `cursos.instructor` y `curso_sesion.instructor`.
6. Poblar `curso_proveedor` extrayendo valores únicos del campo `cursos.proveedor`.
7. Agregar columnas FK nuevas (`categoria_id`, `tipo_id`, `clasificacion_id`, `instructor_id`, `proveedor_id`).
8. Actualizar las FK con los IDs correspondientes basándose en los valores actuales.
9. Eliminar las columnas enum/varchar antiguas.
10. Eliminar los tipos enum de PostgreSQL si ya no se usan.

## Endpoints API

### Categorías

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/catalogos/categorias` | Listar (con filtro activo/todos) | todos |
| POST | `/api/v1/level-up/catalogos/categorias` | Crear | rh |
| PUT | `/api/v1/level-up/catalogos/categorias/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/catalogos/categorias/{id}` | Desactivar (soft delete) | rh |

### Tipos de curso

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/catalogos/tipos` | Listar | todos |
| POST | `/api/v1/level-up/catalogos/tipos` | Crear | rh |
| PUT | `/api/v1/level-up/catalogos/tipos/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/catalogos/tipos/{id}` | Desactivar | rh |

### Clasificaciones

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/catalogos/clasificaciones` | Listar | todos |
| POST | `/api/v1/level-up/catalogos/clasificaciones` | Crear | rh |
| PUT | `/api/v1/level-up/catalogos/clasificaciones/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/catalogos/clasificaciones/{id}` | Desactivar | rh |

### Instructores

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/catalogos/instructores` | Listar con búsqueda | todos |
| POST | `/api/v1/level-up/catalogos/instructores` | Crear | rh |
| PUT | `/api/v1/level-up/catalogos/instructores/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/catalogos/instructores/{id}` | Desactivar | rh |

### Proveedores

| Método | Ruta | Descripción | Roles |
|--------|------|-------------|-------|
| GET | `/api/v1/level-up/catalogos/proveedores` | Listar con búsqueda | todos |
| POST | `/api/v1/level-up/catalogos/proveedores` | Crear | rh |
| PUT | `/api/v1/level-up/catalogos/proveedores/{id}` | Editar | rh |
| DELETE | `/api/v1/level-up/catalogos/proveedores/{id}` | Desactivar | rh |

### Parámetros comunes en GET

- `activo` (boolean, optional): filtrar solo activos (default true) o incluir inactivos
- `busqueda` (string, optional): búsqueda por nombre (solo en instructores y proveedores)

## Frontend

### Nueva página: `#/cursos/ajustes`

- Accesible desde el menú lateral del módulo de Cursos (solo rol RH)
- Layout con tabs horizontales: Categorías | Tipos | Clasificaciones | Instructores | Proveedores
- Cada tab muestra:
  - Tabla con columnas relevantes del catálogo
  - Botón "Agregar" que abre modal de creación
  - Acciones por fila: Editar (ícono lápiz), Desactivar/Activar (toggle o botón)
  - Toggle o filtro para mostrar/ocultar inactivos
  - Badge de estado (Activo verde / Inactivo gris)

### Tab Categorías

- Columnas: Nombre, Descripción, Estado, Acciones
- Modal crear/editar: nombre (requerido), descripción (opcional)

### Tab Tipos de curso

- Columnas: Nombre, Descripción, Estado, Acciones
- Modal crear/editar: nombre (requerido), descripción (opcional)

### Tab Clasificaciones

- Columnas: Nombre, Descripción, Estado, Acciones
- Modal crear/editar: nombre (requerido), descripción (opcional)

### Tab Instructores

- Columnas: Nombre, Especialidad, Empresa, Interno/Externo, Estado, Acciones
- Modal crear/editar: nombre (requerido), especialidad, empresa, es_interno (toggle), empleado (selector si es interno), contacto
- Búsqueda inline en la tabla

### Tab Proveedores

- Columnas: Nombre, Contacto, Teléfono, Email, Estado, Acciones
- Modal crear/editar: nombre (requerido), contacto, teléfono, email, dirección (textarea)
- Búsqueda inline en la tabla

### Cambios en formularios de Curso y Sesión existentes

- El campo "Categoría" pasa de ser un select con enum fijo a un select dinámico que consume `/catalogos/categorias`
- El campo "Tipo" pasa de enum fijo a select dinámico de `/catalogos/tipos`
- El campo "Clasificación" pasa de enum fijo a select dinámico de `/catalogos/clasificaciones`
- El campo "Instructor" pasa de texto libre a un select buscable de `/catalogos/instructores`
- El campo "Proveedor" pasa de texto libre a un select buscable de `/catalogos/proveedores`

### Navegación

- Agregar enlace "Ajustes" en la navegación del módulo de Cursos (solo visible para rol RH)
- Ícono de engranaje (⚙) junto al texto

## Reglas de negocio

1. No se puede eliminar físicamente un catálogo que tenga cursos asociados — solo desactivar.
2. Al desactivar un catálogo, los cursos que lo usan conservan la referencia pero ya no aparece como opción en los selectores de creación/edición.
3. Los selectores en formularios de cursos solo muestran opciones activas.
4. Nombre de catálogo debe ser único (case-insensitive) dentro de su tipo.
5. Solo el rol RH puede acceder a la página de Ajustes y realizar modificaciones.

## Fuera de alcance

- Importación masiva de catálogos desde Excel
- Auditoría/historial de cambios en catálogos
- Ordenamiento personalizado de opciones en selectores
- Catálogos jerárquicos (sub-categorías)

## Dependencias

- Módulo de cursos existente (spec: `cursos-catalogo.md`)
- Módulo de sesiones existente (spec: `curso-sessions.md`)
- Modelos: `Curso`, `CursoSesion`, `Empleado`
- Design system: `design.md` (tabs, tablas, modales, badges)
