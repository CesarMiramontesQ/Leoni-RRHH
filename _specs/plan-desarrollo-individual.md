# Plan de Desarrollo Individual (PDI)

> Feature slug: `plan-desarrollo-individual`
> Branch: `claude/feature/plan-desarrollo-individual`
> Date: 2026-06-24
> Status: Draft

---

## Problem Statement

La vista de Evaluación Individual vs Perfil Ideal (Fase 1) identifica brechas entre el nivel actual del empleado y el requerido por su puesto, pero no existe un mecanismo para registrar, dar seguimiento ni cerrar esas brechas con acciones concretas. RH necesita un Plan de Desarrollo Individual (PDI) por empleado que vincule cada brecha con acciones de capacitación, mentoring o certificación, con fechas, responsables y estados de avance.

## Goals

- Permitir a RH registrar acciones de desarrollo por empleado vinculadas a competencias con brecha
- Dar seguimiento al estado de cada acción (pendiente, en proceso, completado, cancelado)
- Visualizar el PDI como tabla dentro de la página de evaluación del empleado
- Permitir CRUD completo de acciones PDI con validaciones de negocio
- Servir como base de datos para la proyección timeline (Fase 3)

## Non-Goals

- Workflow de aprobaciones para el PDI (primera versión es captura directa por RH)
- Notificaciones automáticas por vencimiento de acciones
- Integración con plataformas externas de e-learning o LMS
- Generación automática de acciones PDI (sin IA/reglas automáticas)
- Reportes agregados de PDI por área o departamento (futuro)

## User Stories

1. **Como RH**, quiero crear una acción de desarrollo para un empleado vinculada a una competencia específica, con tipo de acción, duración, fechas y responsable.
2. **Como RH**, quiero editar una acción PDI existente para ajustar fechas, responsable o descripción cuando cambian las circunstancias.
3. **Como RH**, quiero cambiar el estado de una acción (pendiente → en proceso → completado) conforme el empleado avanza.
4. **Como RH**, quiero cancelar una acción PDI que ya no aplica, manteniendo el registro histórico.
5. **Como RH**, quiero ver todas las acciones PDI de un empleado en una tabla dentro de su página de evaluación.
6. **Como supervisor**, quiero consultar el PDI de mis empleados directos para dar seguimiento a su desarrollo.
7. **Como empleado**, quiero ver mi propio PDI para saber qué acciones de desarrollo tengo asignadas.

## Data Model

### Nueva tabla: `levelup_plan_desarrollo`

| Campo | Tipo | Constraints | Descripción |
|-------|------|-------------|-------------|
| id | serial | PK | |
| empleado_id | int | FK → empleados.empleado_id, NOT NULL | Empleado objetivo |
| competencia_id | int | FK → levelup_competencias.id, NOT NULL | Competencia a desarrollar |
| accion | varchar(300) | NOT NULL | Descripción de la acción de desarrollo |
| tipo | varchar(50) | NOT NULL | e-learning, presencial, mentoring, coaching, certificacion, rotacion |
| duracion_horas | smallint | nullable | Horas estimadas de la acción |
| fecha_inicio | date | NOT NULL | Fecha de inicio planificada o real |
| fecha_fin | date | NOT NULL | Fecha fin estimada o real |
| responsable | varchar(200) | NOT NULL | Área o persona responsable de la acción |
| estado | varchar(20) | NOT NULL, default 'pendiente' | pendiente, en_proceso, completado, cancelado |
| creado_por | int | FK → empleados.empleado_id, NOT NULL | Quién registró la acción |
| created_at | timestamptz | server default now | |
| updated_at | timestamptz | server default now, on update | |

### Índices
- `ix_levelup_plan_desarrollo_empleado_id` en `empleado_id`
- `ix_levelup_plan_desarrollo_competencia_id` en `competencia_id`

### Relaciones
```
empleado
├── plan_desarrollo[] (1:N)
│   └── competencia (N:1 → levelup_competencias)
```

## API Endpoints

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH, supervisor (su área), empleado (self) | Listar acciones PDI con filtros opcionales |
| POST | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH | Crear nueva acción PDI |
| PUT | `/api/v1/evaluaciones/empleado/{id}/pdi/{pdi_id}` | RH | Actualizar acción (campos + estado) |
| DELETE | `/api/v1/evaluaciones/empleado/{id}/pdi/{pdi_id}` | RH | Eliminar acción |

### Query params (GET)
- `estado` — filtrar por estado (pendiente, en_proceso, completado, cancelado)
- `competencia_id` — filtrar por competencia específica

## Decisions

1. Un empleado puede tener múltiples acciones para la misma competencia (ej. un curso + mentoring para cerrar la misma brecha).
2. No hay límite de acciones PDI por empleado.
3. `fecha_inicio` y `fecha_fin` son obligatorias — son la base para el Gantt de Fase 3.
4. El estado sigue el flujo: pendiente → en_proceso → completado. Cancelado es terminal desde cualquier estado.
5. Solo RH puede crear/editar/eliminar. Supervisores y empleados son read-only.
6. Delete es hard delete (no soft delete) — el PDI no tiene requisito de auditoría.
7. `tipo` es un campo libre con sugerencias en frontend (no un enum en BD), para flexibilidad sin migraciones.

## Frontend

### Ubicación
Sección "Plan de Acción de Desarrollo (PDI)" debajo de las barras de brechas en `evaluacionEmpleado.ts`.

### Tabla
Columnas: Competencia | Acción | Tipo | Duración | Inicio/Fin | Responsable | Estado (badge)

### Interacciones
- Botón "Agregar acción" (solo visible para RH) abre modal/form inline
- Click en fila permite editar (solo RH)
- Badge de estado con colores: pendiente (amber), en_proceso (blue), completado (green), cancelado (slate)
- Filtro por estado encima de la tabla

## Acceptance Criteria

- [ ] Tabla `levelup_plan_desarrollo` creada con migración Alembic
- [ ] Modelo SQLAlchemy con relaciones a Empleado y Competencia
- [ ] Schemas Pydantic: Create, Update, Response, ListResponse
- [ ] Repository con filtros por empleado, competencia, estado
- [ ] Service con permisos: RH CRUD, supervisor/empleado read-only (misma lógica que evaluaciones)
- [ ] 4 endpoints CRUD funcionales
- [ ] Frontend muestra tabla PDI con datos reales
- [ ] Form para crear/editar acciones PDI (modal)
- [ ] Badges de estado con colores correctos
- [ ] Filtro por estado funcional
- [ ] Validación: fecha_fin >= fecha_inicio

## Files to Create/Modify

### Backend (nuevos)
- `alembic/versions/<rev>_plan_desarrollo.py` — Migración
- `app/repositories/pdi_repository.py` — Repository
- `app/services/pdi_service.py` — Service con permisos
- `app/schemas/pdi.py` — Schemas Pydantic

### Backend (modificar)
- `app/models/talento.py` — Agregar modelo PlanDesarrollo
- `app/models/__init__.py` — Registrar modelo
- `app/api/v1/evaluaciones/router.py` — Agregar 4 endpoints PDI

### Frontend (modificar)
- `frontend/src/pages/evaluacionEmpleado.ts` — Agregar sección PDI
- `frontend/src/api/evaluaciones.ts` — Agregar tipos e interfaces PDI + funciones fetch
