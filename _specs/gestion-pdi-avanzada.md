# Gestión PDI Avanzada

> Feature slug: `gestion-pdi-avanzada`
> Branch: `claude/feature/gestion-pdi-avanzada`
> Date: 2026-06-24
> Status: Draft

---

## Problem Statement

La vista de Gestión PDI actual (spec `gestion-pdi-vista-gerente`) ofrece un listado consolidado con filtros y KPIs básicos, pero el mockup de referencia incluye funcionalidades avanzadas que faltan: resumen visual del equipo con estatus por empleado y brechas críticas, card expandido con scores y análisis de brechas, mapa de calor competencias×empleados, wizard multi-step para asignar nuevas acciones, línea de tiempo, recomendaciones de IA, KPIs avanzados (cumplimiento plan, inversión formación, skill gap promedio) y exportación.

## Goals

- Tabla "Resumen del Equipo" con avatar, puesto, estatus PDI, brechas críticas (badges por competencia), última actualización y botón acciones
- Card expandido de empleado con foto, puesto, ID, score competencias (N/total), evaluación general, circle progress, y tags de especialidades
- Gráfico de Análisis de Brechas Competenciales: barras horizontales requerido vs actual con valor del gap
- Mapa de Calor: heatmap competencias×empleados con escala de color (verde/naranja/rojo)
- Wizard multi-step para asignar nuevas acciones de desarrollo (4 pasos: Tipo Acción → Detalles → Recursos → Confirmar)
- Línea de Tiempo de acciones próximas y vencimientos
- KPIs avanzados: Cumplimiento Plan %, Inversión Formación, Horas Training/Empleado, Promedio Skill Gap
- Recomendaciones Smart AI basadas en brechas del empleado
- Exportar a PDF y Excel
- Botón "Notificar a todo el Equipo"

## Non-Goals

- Edición de competencias o perfiles de puesto (se maneja en módulo aparte)
- Gestión de presupuesto real de formación (solo se muestra indicador informativo)
- Integración con LMS externos para tracking automático de horas
- Workflows de aprobación multi-nivel para acciones asignadas
- Configuración de alertas automáticas (iteración futura)

## User Stories

1. **Como gerente**, quiero ver una tabla resumen de mi equipo con estatus PDI y brechas críticas de cada colaborador para identificar rápidamente quién necesita atención.
2. **Como gerente/RH**, quiero expandir la card de un empleado para ver su score de competencias, evaluación general y análisis de brechas sin navegar a otra página.
3. **Como gerente/RH**, quiero ver un gráfico de barras horizontales comparando nivel requerido vs actual por competencia para entender las brechas con precisión.
4. **Como gerente/RH**, quiero ver un mapa de calor de competencias×empleados para visualizar de un vistazo las fortalezas y debilidades del equipo.
5. **Como gerente/RH**, quiero asignar nuevas acciones de desarrollo mediante un wizard guiado (categoría, fecha, nombre, prioridad, recursos) para crear planes de forma estructurada.
6. **Como gerente/RH**, quiero ver una línea de tiempo con próximas acciones y vencimientos para planificar el seguimiento del equipo.
7. **Como gerente/RH**, quiero ver KPIs avanzados (cumplimiento plan %, horas training/empleado, promedio skill gap) para evaluar la efectividad del desarrollo.
8. **Como gerente/RH**, quiero recibir recomendaciones inteligentes de acciones de desarrollo basadas en las brechas de cada empleado.
9. **Como RH**, quiero exportar la información a PDF o Excel para reportar a dirección.
10. **Como gerente**, quiero notificar a todo mi equipo sobre sus acciones pendientes con un solo clic.

## Data Model

### Tablas existentes a reutilizar

- `levelup_plan_desarrollo` — Acciones PDI por empleado (accion, tipo, estado, fechas, prioridad)
- `levelup_evaluaciones_competencia` — Nivel actual por empleado-competencia
- `levelup_competencia_requisitos` — Nivel requerido por puesto-competencia
- `levelup_perfil_funciones` — Asignación empleado ↔ puesto
- `levelup_competencias` — Catálogo de competencias
- `empleados` — Datos del empleado (nombre, área, puesto, foto_url, numero_empleado)
- `areas` / `puestos` — Catálogos legacy (read-only)

### Nuevo campo sugerido

- `levelup_plan_desarrollo.prioridad` — ENUM ('baja', 'media', 'alta'), default 'media'. Necesario para el wizard de asignación.
- `levelup_plan_desarrollo.categoria` — VARCHAR, categoría de la acción (Capacitación Técnica, Mentoring, Rotación, Certificación, etc.)
- `levelup_plan_desarrollo.recursos` — TEXT, recursos asignados (descripción libre)

### No se crean tablas nuevas

Las vistas de mapa de calor, brechas y KPIs son aggregaciones sobre datos existentes.

## Phases

### Fase 1 — Resumen del Equipo + Card Expandido + Brechas

**Backend:**
- Endpoint GET `/api/v1/evaluaciones/pdi/equipo-resumen` que retorna por empleado: nombre, puesto, foto_url, numero_empleado, estatus_pdi (estado general), brechas_criticas (competencias con gap >= 1.5), ultima_actualizacion, score_competencias (evaluadas/total), evaluacion_general_prom
- Endpoint GET `/api/v1/evaluaciones/pdi/empleado/{id}/brechas` que retorna: lista de competencias con nivel_requerido, nivel_actual, gap, nombre_competencia

**Frontend:**
- Sección "Resumen del Equipo" debajo de los KPI cards existentes: tabla con avatar, nombre+puesto, estatus PDI (badge), brechas críticas (badges de competencia), última actualización, botón ver detalle
- Card expandido inline al hacer clic en "ver detalle": muestra foto grande, scores, tags de especialidades, gráfico de barras de brechas
- Botón "Ver todos los detalles" que enlaza a la evaluación individual del empleado

### Fase 2 — Mapa de Calor + Línea de Tiempo

**Backend:**
- Endpoint GET `/api/v1/evaluaciones/pdi/mapa-calor` que retorna matriz: filas=competencias, columnas=empleados, valores=gap (o nivel). Filtrable por area_id.
- Endpoint GET `/api/v1/evaluaciones/pdi/timeline` que retorna acciones próximas (próximos 30 días) ordenadas por fecha, con empleado, acción, estado, fecha_fin

**Frontend:**
- Componente heatmap: grid con competencias en eje Y, empleados en eje X. Celdas coloreadas: verde (gap=0), naranja (gap 0.5-1.0), rojo (gap >1.0)
- Componente timeline: lista cronológica con indicador de color por urgencia, nombre empleado, descripción de acción, estado

### Fase 3 — Wizard Asignar Acciones + Prioridad

**Backend:**
- Migración Alembic: agregar campos `prioridad`, `categoria`, `recursos` a `levelup_plan_desarrollo`
- Actualizar schemas PDI (PDICreate, PDIUpdate) para incluir los nuevos campos
- El endpoint POST `/api/v1/evaluaciones/empleado/{id}/pdi` ya existe, solo se extiende con los nuevos campos

**Frontend:**
- Modal wizard 4 pasos:
  - Paso 1 (Tipo Acción): seleccionar categoría de desarrollo + fecha límite
  - Paso 2 (Detalles): nombre de la acción + prioridad (Baja/Media/Alta toggle)
  - Paso 3 (Recursos): asignar recursos, competencia vinculada, responsable
  - Paso 4 (Confirmar): resumen y enviar
- Botón "Asignar Acción" visible en la card expandida y en la tabla resumen

### Fase 4 — KPIs Avanzados + Recomendaciones AI + Export

**Backend:**
- Endpoint GET `/api/v1/evaluaciones/pdi/kpis-avanzados` que retorna: cumplimiento_plan_pct (completadas/total), horas_training_promedio (sum duracion_horas / count empleados), promedio_skill_gap (avg gap de brechas)
- Endpoint GET `/api/v1/evaluaciones/pdi/empleado/{id}/recomendaciones` que usa Ollama (integración existente) para generar 3 recomendaciones de desarrollo basadas en las brechas del empleado
- Endpoint GET `/api/v1/evaluaciones/pdi/export` con query param `format=pdf|excel` que genera reporte descargable
- Endpoint POST `/api/v1/evaluaciones/pdi/notificar-equipo` que envía notificación (via sistema de notificaciones existente) a todos los empleados con acciones pendientes

**Frontend:**
- Fila de 4 KPI cards avanzados: Cumplimiento Plan (% con tendencia), Inversión Formación, Horas Training/Empl, Promedio Skill Gap
- Panel "Recomendaciones Smart AI" en la card expandida del empleado
- Botones "Exportar PDF" y "Excel Data" en el footer de la página
- Botón "Notificar a todo el Equipo" con confirmación

## API Endpoints

### Fase 1

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi/equipo-resumen` | RH/gerente | Resumen del equipo con estatus y brechas |
| GET | `/api/v1/evaluaciones/pdi/empleado/{id}/brechas` | RH/gerente | Brechas competenciales de un empleado |

### Fase 2

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi/mapa-calor` | RH/gerente | Matriz competencias×empleados |
| GET | `/api/v1/evaluaciones/pdi/timeline` | RH/gerente | Línea de tiempo de acciones próximas |

### Fase 3

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH | Crear acción (extendido con prioridad/categoría/recursos) |

### Fase 4

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi/kpis-avanzados` | RH/gerente | KPIs de cumplimiento, training, skill gap |
| GET | `/api/v1/evaluaciones/pdi/empleado/{id}/recomendaciones` | RH/gerente | Recomendaciones AI por empleado |
| GET | `/api/v1/evaluaciones/pdi/export` | RH | Exportar reporte PDF o Excel |
| POST | `/api/v1/evaluaciones/pdi/notificar-equipo` | RH/gerente | Notificar equipo completo |

## Decisions

1. **Mapa de calor calculado on-the-fly** — no se almacena pre-calculado; se genera con JOINs entre evaluaciones, requisitos y empleados.
2. **Recomendaciones AI usa Ollama** — la integración ya existe en `app/integrations/ollama.py`. Se pasan las brechas como contexto y se pide sugerir 3 acciones.
3. **Export PDF usa weasyprint** o similar server-side. Excel usa openpyxl.
4. **Prioridad como campo nuevo** — se agrega al modelo existente con migración. Default 'media' para datos existentes.
5. **Permisos**: RH ve todo, gerente solo su área. Mismo patrón que `_resolve_area_scope()` existente.
6. **Circle progress** en card = (acciones completadas / total acciones) × 100.
7. **Brechas críticas** = competencias donde gap >= 1.5 niveles.
8. **Timeline** muestra acciones con fecha_fin en los próximos 30 días o ya vencidas en últimos 7 días.
9. **Notificar equipo** usa el sistema de notificaciones existente (`levelup_notificaciones`), no email.

## Acceptance Criteria

### Fase 1
- [ ] Endpoint equipo-resumen retorna datos correctos por empleado
- [ ] Tabla "Resumen del Equipo" muestra avatar, puesto, estatus, brechas, fecha
- [ ] Click en "ver detalle" expande card inline con scores y gráfico de brechas
- [ ] Gráfico de barras muestra requerido vs actual por competencia con valor del gap
- [ ] Card muestra circle progress con porcentaje de completadas
- [ ] RH ve todos los empleados, gerente solo los de su área

### Fase 2
- [ ] Mapa de calor renderiza grid con colores correctos por nivel de gap
- [ ] Mapa de calor es filtrable por área
- [ ] Timeline muestra acciones ordenadas por fecha con indicador de urgencia
- [ ] Timeline distingue visualmente acciones próximas vs vencidas

### Fase 3
- [ ] Wizard de 4 pasos permite crear acción completa
- [ ] Campos prioridad, categoría y recursos se guardan correctamente
- [ ] Validación en cada paso antes de avanzar
- [ ] Paso "Confirmar" muestra resumen antes de enviar

### Fase 4
- [ ] KPIs avanzados calculan valores correctos
- [ ] Recomendaciones AI genera 3 sugerencias relevantes basadas en brechas
- [ ] Export PDF genera documento descargable con formato legible
- [ ] Export Excel genera .xlsx con datos tabulados
- [ ] "Notificar equipo" crea notificaciones para empleados con acciones pendientes
- [ ] Confirmación antes de notificar (modal o dialog)

## Files to Create/Modify

### Backend
- `app/api/v1/evaluaciones/router.py` — Nuevos endpoints
- `app/services/pdi_service.py` — Métodos para equipo-resumen, brechas, mapa-calor, timeline, kpis-avanzados, recomendaciones, export, notificar
- `app/repositories/pdi_repository.py` — Queries agregadas nuevas
- `app/schemas/pdi.py` — Schemas para las nuevas respuestas
- `app/models/talento.py` — Agregar campos prioridad, categoria, recursos al modelo PlanDesarrolloIndividual
- Migración Alembic — Agregar columnas a `levelup_plan_desarrollo`

### Frontend
- `frontend/src/pages/gestionPdi.ts` — Agregar secciones: resumen equipo, card expandido, mapa calor, timeline, KPIs avanzados, botones export/notificar
- `frontend/src/api/evaluaciones.ts` — Nuevas funciones API
- `frontend/src/components/heatmap.ts` — Componente mapa de calor reutilizable
- `frontend/src/components/wizardPdi.ts` — Wizard multi-step para asignar acciones
- `frontend/src/components/timeline.ts` — Componente línea de tiempo
