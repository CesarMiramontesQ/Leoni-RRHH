# Evaluación Individual vs Perfil Ideal

> Feature slug: `evaluacion-individual-vs-puesto`
> Branch: `claude/feature/evaluacion-individual-vs-puesto`
> Date: 2026-06-24
> Status: Draft

---

## Problem Statement

Actualmente la página de evaluación por empleado muestra una tabla simple de competencias con nivel actual vs requerido. El negocio necesita una vista integral tipo "Evaluación Individual vs Perfil Ideal" que muestre el análisis detallado de brechas, acciones recomendadas, plan de desarrollo individual (PDI) y proyección temporal de cierre de brechas. La información existe parcialmente en el backend pero no se presenta de forma accionable.

## Goals

- Mostrar una vista completa de evaluación individual vs perfil del puesto asignado (no por área general)
- Calcular y visualizar brechas con severidad (alineado, media, alta, crítica)
- Incluir acciones recomendadas por competencia basadas en reglas de negocio
- Implementar un modelo de Plan de Desarrollo Individual (PDI) con CRUD
- Visualizar proyección de cierre de brechas en timeline de 12 meses

## Non-Goals

- Recomendaciones generadas por IA/LLM (se usarán reglas estáticas de negocio)
- Integración con plataformas externas de e-learning
- Notificaciones automáticas de vencimiento de PDI
- Aprobaciones/workflow de PDI (primera versión es captura directa por RH)

## User Stories

1. **Como RH**, quiero ver el perfil completo de un empleado comparado contra su puesto asignado (vía PerfilFunciones) para identificar brechas con contexto completo (nombre puesto, nivel, depto, evaluador).
2. **Como RH**, quiero ver KPIs resumidos (competencias alineadas, brechas identificadas, brecha promedio, readiness score) para priorizar intervenciones.
3. **Como RH**, quiero una tabla comparativa unificada con nivel actual (gauge), nivel ideal, brecha % y acción recomendada por competencia.
4. **Como RH**, quiero una visualización de barras de brechas ordenadas de mayor a menor para identificar las más críticas.
5. **Como RH**, quiero registrar un Plan de Desarrollo Individual (PDI) por empleado con acciones, tipo, duración, fechas, responsable y estado.
6. **Como RH**, quiero ver una proyección tipo Gantt de cierre de brechas basada en las acciones del PDI para planificar recursos.
7. **Como supervisor**, quiero consultar el resumen de evaluación de mis empleados directos para dar seguimiento a su desarrollo.

## Data Model

### Tabla existente a reutilizar

- `levelup_evaluaciones_competencia` — nivel actual por empleado-competencia
- `levelup_competencia_requisitos` — nivel requerido por puesto-competencia
- `levelup_perfil_funciones` — asignación empleado ↔ puesto perfil
- `levelup_puestos_perfil` — datos del puesto (nombre, nivel, area)

### Nueva tabla: `levelup_plan_desarrollo` (PDI)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | |
| empleado_id | FK → empleados.empleado_id | Empleado objetivo |
| competencia_id | FK → levelup_competencias.id | Competencia a desarrollar |
| accion | varchar(300) | Descripción de la acción |
| tipo | varchar(50) | e-learning, presencial, mentoring, coaching, certificacion, rotacion |
| duracion_horas | smallint, nullable | Horas estimadas |
| fecha_inicio | date | Fecha de inicio |
| fecha_fin | date | Fecha fin estimada |
| responsable | varchar(200) | Área/persona responsable |
| estado | varchar(20) | pendiente, en_proceso, completado, cancelado |
| creado_por | FK → empleados.empleado_id | Quién registró |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Nueva tabla: `levelup_acciones_recomendadas` (catálogo)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | serial PK | |
| brecha_min | smallint | Brecha mínima % para activar |
| brecha_max | smallint | Brecha máxima % para activar |
| etiqueta | varchar(100) | Texto a mostrar (ej. "Mantener Nivel", "Capacitación Técnica") |
| color | varchar(20) | Color del badge (green, yellow, orange, red) |
| orden | smallint | Prioridad de display |

### Relaciones

```
empleado
├── perfil_funciones → puesto_perfil (puesto asignado)
│   └── competencia_requisitos[] (nivel ideal por competencia)
├── evaluaciones_competencia[] (nivel actual por competencia)
└── plan_desarrollo[] (acciones PDI)
```

## Phases

### Fase 1 — Vista enriquecida + KPIs + tabla comparativa + barras de brechas

**Backend:**
- Modificar `resumen_empleado` para resolver requisitos por puesto asignado (PerfilFunciones) en vez de por área
- Agregar al response: nombre_puesto, nivel_puesto, departamento, evaluador_nombre
- Agregar al response por competencia: brecha_pct, severidad (alineado/media/alta/critica), accion_recomendada
- Nuevo KPI: readiness_score (inverso de brecha promedio)
- Seed de catálogo `levelup_acciones_recomendadas`

**Frontend:**
- Rediseñar página `evaluacionEmpleado.ts` con el layout del mockup
- Header: empleado seleccionado + información del puesto (nivel, depto, evaluador)
- KPIs cards: competencias alineadas (X/Y + %), brechas identificadas, brecha promedio + severidad, readiness score con barra
- Tabla comparativa: competencia | gauge nivel actual | gauge nivel ideal | brecha % con color/icono | acción recomendada badge
- Sección barras de brechas: horizontal bars ordenadas de mayor a menor, con escala 0%-100%

### Fase 2 — Plan de Desarrollo Individual (PDI)

**Backend:**
- Migración Alembic para `levelup_plan_desarrollo`
- Modelo SQLAlchemy
- Schemas Pydantic (Create, Update, Response, ListResponse)
- Repository con filtros (por empleado, por competencia, por estado)
- Service con permisos (RH CRUD completo, supervisor read-only de su área)
- Endpoints CRUD: GET/POST/PUT/DELETE en `/api/v1/evaluaciones/empleado/{id}/pdi`

**Frontend:**
- Sección "Plan de Acción de Desarrollo (PDI)" debajo de las barras de brechas
- Tabla: competencia | acción | tipo | duración | inicio/fin | responsable | estado (badge)
- Modal/form para crear/editar acciones PDI
- Filtros por estado

### Fase 3 — Proyección timeline (Gantt)

**Frontend:**
- Sección "Proyección de Cierre de Brechas (Próximos 12 meses)"
- Timeline horizontal con meses (ENE-DIC)
- Barras por competencia con brecha, coloreadas por estado (en progreso = verde, planificado = gris)
- Datos derivados del PDI (fecha_inicio → fecha_fin por competencia)

## API Endpoints

### Fase 1 — Evolución endpoint existente

| Method | Endpoint | Cambio |
|--------|----------|--------|
| GET | `/api/v1/evaluaciones/empleado/{id}/resumen` | Enriquecer response con datos de puesto, brecha %, severidad, acción |

### Fase 2 — PDI CRUD

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH/supervisor/self | Listar acciones PDI |
| POST | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH | Crear acción PDI |
| PUT | `/api/v1/evaluaciones/empleado/{id}/pdi/{pdi_id}` | RH | Actualizar acción |
| DELETE | `/api/v1/evaluaciones/empleado/{id}/pdi/{pdi_id}` | RH | Eliminar acción |

## Decisions

1. Resolver competencias requeridas por **puesto asignado** (PerfilFunciones), NO por área. Si el empleado no tiene puesto asignado, fallback al comportamiento actual (por área).
2. Brecha % = `max(0, (nivel_requerido - nivel_actual) / nivel_requerido * 100)`. Severidad: 0% = alineado (verde), 1-30% = media (amarillo), 31-50% = alta (naranja), >50% = crítica (rojo).
3. Acciones recomendadas vienen de un catálogo estático (`levelup_acciones_recomendadas`) mapeado por rango de brecha. No IA.
4. Readiness score = `100 - brecha_promedio`. Representa qué tan listo está el empleado para su puesto.
5. PDI es por empleado-competencia. Un empleado puede tener múltiples acciones para una misma competencia.
6. El timeline Gantt es solo visualización frontend derivada del PDI — no tiene modelo propio.

## Acceptance Criteria

### Fase 1
- [ ] El resumen de empleado resuelve por puesto asignado (PerfilFunciones) cuando existe
- [ ] Response incluye nombre_puesto, nivel_puesto, evaluador
- [ ] Cada competencia incluye brecha_pct, severidad, accion_recomendada
- [ ] KPIs correctos: alineadas/total, brechas, brecha promedio, readiness score
- [ ] Frontend muestra header con info completa del puesto
- [ ] Frontend muestra 4 KPI cards con los valores correctos
- [ ] Frontend muestra tabla con gauges circulares de nivel + brecha % + acción
- [ ] Frontend muestra barras de brechas ordenadas de mayor a menor
- [ ] Catálogo de acciones recomendadas seeded

### Fase 2
- [ ] Tabla `levelup_plan_desarrollo` creada con migración
- [ ] CRUD completo funcional con permisos
- [ ] Frontend muestra tabla PDI con datos reales
- [ ] Form para crear/editar acciones PDI
- [ ] Filtro por estado funcional

### Fase 3
- [ ] Timeline Gantt renderiza competencias con barras de fecha
- [ ] Barras coloreadas por estado (en_progreso vs planificado)
- [ ] Escala de 12 meses visible
- [ ] Se alimenta de datos PDI existentes

## Files to Create/Modify

### Backend
- `app/services/evaluacion_service.py` — Evolucionar `resumen_empleado`
- `app/schemas/evaluaciones.py` — Enriquecer response schemas
- `app/models/talento.py` — Nuevo modelo PlanDesarrollo, AccionRecomendada
- `app/repositories/pdi_repository.py` — Nuevo repo para PDI
- `app/services/pdi_service.py` — Nuevo servicio PDI
- `app/api/v1/evaluaciones/router.py` — Nuevos endpoints PDI
- `alembic/versions/xxx_plan_desarrollo.py` — Migración PDI
- `app/utils/seed.py` — Seed de acciones recomendadas

### Frontend
- `frontend/src/pages/evaluacionEmpleado.ts` — Rediseño completo
- `frontend/src/api/evaluaciones.ts` — Nuevos tipos e interfaces PDI
