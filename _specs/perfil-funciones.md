# Perfil de Funciones — CRUD y Modelo de Datos

> Feature slug: `perfil-funciones`
> Branch: `claude/feature/perfil-funciones`
> Date: 2026-05-24
> Status: In Progress

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
7. **Como RH**, quiero ver los empleados asignados a un perfil de puesto desde la UI de tarjetas.

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
5. "Ver empleados" usa asignaciones (`perfil_funciones`) — no fallback por área TRESS.

## API Endpoints (17 rutas — todas implementadas)

### Tareas
- `GET /api/v1/perfiles/:id/tareas` — Listar tareas del puesto
- `POST /api/v1/perfiles/:id/tareas` — Crear tarea
- `PUT /api/v1/perfiles/:id/tareas/:tarea_id` — Editar tarea
- `DELETE /api/v1/perfiles/:id/tareas/:tarea_id` — Eliminar tarea

### Cualificaciones
- `GET /api/v1/perfiles/:id/cualificaciones` — Listar cualificaciones requeridas
- `POST /api/v1/perfiles/:id/cualificaciones` — Crear cualificación
- `PUT /api/v1/perfiles/:id/cualificaciones/:id` — Editar cualificación
- `DELETE /api/v1/perfiles/:id/cualificaciones/:id` — Eliminar cualificación

### Competencias requeridas
- `GET /api/v1/perfiles/:id/competencias` — Listar competencias requeridas
- `POST /api/v1/perfiles/:id/competencias` — Crear competencia
- `PUT /api/v1/perfiles/:id/competencias/:id` — Editar competencia
- `DELETE /api/v1/perfiles/:id/competencias/:id` — Eliminar competencia

### Asignaciones
- `GET /api/v1/perfiles/:id/asignaciones` — Listar empleados asignados a este perfil
- `POST /api/v1/perfiles/:id/asignaciones` — Asignar empleado al perfil
- `GET /api/v1/perfiles/:id/asignaciones/:asig_id` — Detalle con gap analysis
- `PUT /api/v1/perfiles/:id/asignaciones/:asig_id` — Upsert evaluaciones individuales

### Firmas
- `POST /api/v1/perfiles/:id/asignaciones/:asig_id/firmar` — Registrar firma

## Implementation Status

### Completado

| # | Item | Estado |
|---|------|--------|
| 1 | Migración Alembic (12 columnas + 6 tablas) | Done |
| 2 | Modelos SQLAlchemy (6 modelos + extensión PuestoPerfil) | Done |
| 3 | Schemas Pydantic v2 (Create/Update/Response por entidad) | Done |
| 4 | Repositories (6 repos con queries especializadas) | Done |
| 5 | Service (lógica de negocio + gap analysis) | Done |
| 6 | Router (17 endpoints registrados en app) | Done |
| 7 | Validación empleado existe al crear asignación (404 vs 500) | Done |
| 8 | Frontend: tarjeta de puesto actualizada (sin OPLs, sin owner, dos botones) | Done |
| 9 | Frontend: ruta `#/puestos/:id/empleados` con tabla de asignaciones | Done |
| 10 | Frontend: shellRouter separando detalle vs empleados | Done |
| 11 | QA: 54/56 tests CRUD pasados (96%) | Done |
| 12 | QA: datos reales creados (3 perfiles, 15 empleados asignados) | Done |
| 13 | QA: gap analysis validado con evaluaciones parciales/completas | Done |

### Pendiente

| # | Item | Estado |
|---|------|--------|
| 14 | Fix: 500 en PUT evaluaciones con cualificacion_id/competencia_id inválido | Pending |
| 15 | Migrar datos JSONB existentes a nuevas tablas | Done |
| 16 | Eliminar campos JSONB de `puestos_perfil` | Pending |
| 17 | Conectar detalle de puesto (`perfilPuestoDetalle.ts`) a datos reales (wire-up) | Pending |
| 18 | Mostrar nombre del empleado en tabla de asignaciones (hoy solo muestra ID) | Pending |

## Acceptance Criteria

- [x] Las 6 tablas nuevas existen en la DB con constraints y FKs correctos
- [x] CRUD completo de tareas, cualificaciones y competencias por perfil
- [x] Se puede asignar un empleado a un perfil y registrar su "situación actual"
- [x] El endpoint de detalle muestra el gap (deseada vs actual) por cualificación y competencia
- [x] Las firmas se registran con fecha e ID
- [x] Los datos JSONB existentes se migraron a las nuevas tablas
- [x] Tests e2e para los endpoints principales
- [x] Frontend: vista de empleados asignados funcional con datos reales

## QA Results

### Round 1 — CRUD endpoints (54/56 passed)
- Tareas: 11/11
- Cualificaciones: 11/11
- Competencias: 13/13
- Asignaciones: 10/10
- Firmas + auth + edge cases: 9/11

### Round 2 — Datos reales + frontend (71/73 passed)
- Crear perfil Calidad + 5 empleados: 24/24
- Crear perfil Mantenimiento + 5 empleados: 16/16
- Crear perfil Almacén + 5 empleados: 19/19
- Frontend renders correctamente: 5/5
- Gap analysis con evaluaciones: 7/9

### Known Bugs
1. PUT evaluaciones con `cualificacion_id` inexistente → 500 (debería ser 400/422)
2. PUT evaluaciones con `competencia_requerida_id` inexistente → 500 (debería ser 400/422)

### Schema Discrepancy
- Spec decía `nombre_puesto` + `area` (string) pero implementación usa `nombre` + `area_id` (int). El `codigo` se auto-genera.

## Files Created/Modified

### Backend
- `app/models/talento.py` — 6 modelos nuevos + 12 columnas en PuestoPerfil
- `app/models/__init__.py` — Registros de modelos
- `app/schemas/perfil_funciones.py` — Schemas Pydantic v2
- `app/repositories/perfil_funciones_repository.py` — 6 repositorios
- `app/services/perfil_funciones_service.py` — Lógica + gap analysis
- `app/api/v1/perfil_funciones/router.py` — 17 endpoints
- `app/api/v1/perfil_funciones/__init__.py` — Package init
- `app/main.py` — Router registration
- `alembic/versions/w6x7y8z9a0b1_perfil_funciones.py` — Migración

### Frontend
- `frontend/src/pages/puestos.ts` — Tarjeta actualizada (sin OPLs, sin owner, dos botones)
- `frontend/src/pages/puestoEmpleados.ts` — Nueva página de empleados por perfil
- `frontend/src/shellRouter.ts` — Nueva ruta `#/puestos/:id/empleados`

### Docs
- `_specs/perfil-funciones.md` — Este archivo
- `docs/superpowers/specs/2026-05-24-perfil-funciones-modelo.md` — Spec del modelo de datos
- `docs/superpowers/plans/2026-05-14-level-up-implementacion.md` — Plan actualizado
