# Perfil de Funciones — CRUD y Modelo de Datos

> Feature slug: `perfil-funciones`
> Branch: `claude/feature/perfil-funciones`
> Date: 2026-05-24
> Status: Draft

---

## Problem Statement

Leoni usa un formulario corporativo estandarizado (Form-Nr 1178 KM) en papel/PDF para documentar el "Perfil de Funciones" de cada puesto y evaluar a cada empleado contra ese perfil. Actualmente no hay forma digital de capturar, consultar ni analizar esta información. Se necesita un modelo de datos completo y un CRUD para gestionar estos perfiles desde la plataforma.

## Goals

- Digitalizar el formulario "Perfil de Funciones" con todas sus secciones
- Separar el template del puesto (situación deseada) de la evaluación individual (situación actual)
- Permitir gap analysis entre lo que requiere el puesto y lo que tiene el empleado
- Migrar los campos JSONB actuales a tablas normalizadas para reporting

## Non-Goals

- Integración con firmas digitales externas (AD/Okta)
- Versionado histórico del template de puesto
- Generación automática de PDFs con el formato corporativo (futura fase)
- Importación masiva de PDFs existentes (futura fase)

## User Stories

1. **Como RH**, quiero definir las tareas principales de un puesto para que los empleados y supervisores sepan qué se espera de la posición.
2. **Como RH**, quiero registrar las cualificaciones requeridas (estudios, experiencia) para cada puesto para poder evaluar candidatos y detectar brechas.
3. **Como RH**, quiero listar las competencias deseadas por categoría (informática, idiomas, profesional, social, personal, métodos) para tener un perfil completo.
4. **Como supervisor**, quiero evaluar a un empleado contra el perfil de su puesto registrando su "situación actual" por cada cualificación y competencia.
5. **Como RH**, quiero ver el gap entre lo deseado y lo actual de un empleado para priorizar capacitación.
6. **Como RH**, quiero registrar las firmas (superior + empleado) con fecha para cumplir con el proceso de validación.

## Data Model

### Extensión de `puestos_perfil` (existente)

Nuevos campos:
- `division` — enum('holding','wsd','wcs')
- `centro_leoni` — varchar(200)
- `form_version` — varchar(20)
- `reporta_a` — varchar(200)
- `ordenes_funcional_de` — varchar(200)
- `responsable_de` — text
- `sustituye_a` — varchar(200), nullable
- `sustituido_por` — varchar(200), nullable
- `obligaciones_empresariales` — boolean
- `obligacion_confidencialidad` — boolean
- `poderes_legales` — text, nullable
- `complemento_poderes` — text, nullable

### Nuevas tablas

#### `perfil_tareas` (1:N desde puestos_perfil)
- `id`, `puesto_perfil_id` (FK), `orden` (smallint), `descripcion` (text), `es_complemento` (boolean)

#### `perfil_cualificaciones` (1:N desde puestos_perfil)
- `id`, `puesto_perfil_id` (FK), `tipo` (enum: estudios_finalizados, formacion_profesional, ampliacion_formacion, estudios_universitarios, experiencia_profesional, experiencia_direccion, complementos), `situacion_deseada` (text), `comentarios` (text, nullable)

#### `perfil_competencias_requeridas` (1:N desde puestos_perfil)
- `id`, `puesto_perfil_id` (FK), `categoria` (enum: informatica, idiomas, profesional, social, personal, metodos, complementos), `descripcion` (text), `orden` (smallint)

#### `perfil_funciones` (asignación individual empleado ↔ puesto)
- `id`, `puesto_perfil_id` (FK), `empleado_id` (FK), `departamento` (varchar, snapshot), `fecha_firma_superior` (date), `fecha_firma_empleado` (date), `firma_superior_id` (varchar(50)), `firma_empleado_id` (varchar(50)), `activo` (boolean), timestamps

#### `perfil_funciones_cualificacion` (evaluación individual)
- `id`, `perfil_funciones_id` (FK), `cualificacion_id` (FK), `situacion_actual` (text), `comentarios` (text, nullable)

#### `perfil_funciones_competencia` (evaluación individual)
- `id`, `perfil_funciones_id` (FK), `competencia_requerida_id` (FK), `situacion_actual` (text), `comentarios` (text, nullable)

### Relaciones

```
puestos_perfil (template)
├── perfil_tareas[]
├── perfil_cualificaciones[]
├── perfil_competencias_requeridas[]
└── perfil_funciones[] (asignación por empleado)
    ├── perfil_funciones_cualificacion[]
    └── perfil_funciones_competencia[]
```

## Decisions

1. Migrar JSONB (`competencias_tecnicas`, `habilidades_blandas`, `maquinas_herramientas`) a tablas normalizadas. Dos pasos: crear tablas → poblar → eliminar JSONB.
2. `numero_personal` no se duplica — ya existe como `empleados.no_empleado`.
3. Firmas como texto simple sin validación externa.
4. Sin versionado de template — se sobreescribe directamente.

## API Endpoints

- `GET /api/v1/perfiles/:id/tareas` — Listar tareas del puesto
- `POST /api/v1/perfiles/:id/tareas` — Crear tarea
- `PUT /api/v1/perfiles/:id/tareas/:tarea_id` — Editar tarea
- `DELETE /api/v1/perfiles/:id/tareas/:tarea_id` — Eliminar tarea
- `GET /api/v1/perfiles/:id/cualificaciones` — Listar cualificaciones requeridas
- `POST /api/v1/perfiles/:id/cualificaciones` — Crear cualificación
- `GET /api/v1/perfiles/:id/competencias` — Listar competencias requeridas
- `POST /api/v1/perfiles/:id/competencias` — Crear competencia
- `GET /api/v1/perfiles/:id/asignaciones` — Listar empleados asignados a este perfil
- `POST /api/v1/perfiles/:id/asignaciones` — Asignar empleado al perfil
- `GET /api/v1/perfiles/:id/asignaciones/:asig_id` — Detalle de asignación con gaps
- `PUT /api/v1/perfiles/:id/asignaciones/:asig_id` — Actualizar evaluación individual
- `POST /api/v1/perfiles/:id/asignaciones/:asig_id/firmar` — Registrar firma

## Implementation Order

1. Migración Alembic: agregar columnas a `puestos_perfil` + crear 6 tablas nuevas
2. Modelos SQLAlchemy
3. Schemas Pydantic (request/response)
4. Repositories (data access)
5. Services (business logic)
6. Routers (API endpoints)
7. Migrar datos JSONB existentes a nuevas tablas
8. Frontend: extender detalle de puesto con nuevas secciones
9. Eliminar campos JSONB de `puestos_perfil`

## Acceptance Criteria

- [ ] Las 6 tablas nuevas existen en la DB con constraints y FKs correctos
- [ ] CRUD completo de tareas, cualificaciones y competencias por perfil
- [ ] Se puede asignar un empleado a un perfil y registrar su "situación actual"
- [ ] El endpoint de detalle muestra el gap (deseada vs actual) por cualificación y competencia
- [ ] Las firmas se registran con fecha e ID
- [ ] Los datos JSONB existentes se migraron a las nuevas tablas
- [ ] Tests e2e para los endpoints principales
