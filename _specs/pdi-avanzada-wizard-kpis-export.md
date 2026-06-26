# PDI Avanzada — Wizard, KPIs, Export y Notificaciones

> Feature slug: `pdi-avanzada-wizard-kpis-export`
> Branch: `claude/feature/pdi-avanzada-wizard-kpis-export`
> Date: 2026-06-25
> Status: Planned
> Dependencia: Gestión PDI Avanzada Fases 1-2 (COMPLETADAS — resumen equipo, heatmap, timeline)

---

## Problem Statement

La vista de Gestión PDI ya implementa las Fases 1-2 (resumen del equipo con card expandido, mapa de calor competencias×empleados y línea de tiempo), pero faltan funcionalidades críticas del mockup de referencia:

1. No existe un wizard guiado para crear acciones de desarrollo — actualmente se usa un form simple sin campos de prioridad ni recursos.
2. No hay KPIs avanzados que midan la efectividad del plan de desarrollo (cumplimiento %, horas training, skill gap promedio).
3. No hay recomendaciones inteligentes basadas en las brechas del empleado.
4. No existe exportación a PDF/Excel para reportar a dirección.
5. No hay mecanismo para notificar al equipo completo sobre acciones pendientes.

## Goals

- Wizard multi-step (4 pasos) para asignar nuevas acciones de desarrollo de forma estructurada
- Agregar campos `prioridad` y `recursos` al modelo PDI para enriquecer la información de cada acción
- KPIs avanzados calculados: cumplimiento del plan %, horas training promedio por empleado, skill gap promedio
- Recomendaciones inteligentes por empleado usando Ollama (integración existente)
- Exportación de datos PDI a PDF y Excel
- Notificación masiva al equipo sobre acciones pendientes

## Non-Goals

- Gestión de presupuesto real de formación (solo indicador informativo)
- Integración con LMS externos para tracking automático de horas
- Workflows de aprobación multi-nivel para acciones asignadas
- Configuración de alertas automáticas individuales (iteración futura)
- Dashboard separado de analytics PDI (se integra en la vista existente)

## User Stories

1. **Como gerente/RH**, quiero asignar nuevas acciones de desarrollo mediante un wizard guiado de 4 pasos (categoría+fecha, nombre+prioridad, recursos+competencia+responsable, confirmar) para crear planes de forma estructurada y sin errores.
2. **Como gerente/RH**, quiero asignar prioridad (baja/media/alta) a cada acción para enfocar esfuerzos en las más urgentes.
3. **Como gerente/RH**, quiero documentar los recursos asignados a cada acción (presupuesto, materiales, herramientas) para planificación.
4. **Como gerente/RH**, quiero ver KPIs avanzados (cumplimiento plan %, horas training/empleado, promedio skill gap) para evaluar la efectividad del desarrollo del equipo.
5. **Como gerente/RH**, quiero recibir 3 recomendaciones inteligentes de acciones de desarrollo basadas en las brechas de cada empleado para tomar decisiones informadas.
6. **Como RH**, quiero exportar la información consolidada del PDI a PDF para reportar a dirección.
7. **Como RH**, quiero exportar los datos tabulados a Excel para análisis detallado.
8. **Como gerente**, quiero notificar a todo mi equipo sobre sus acciones pendientes con un solo clic para asegurar seguimiento.

## Data Model

### Cambios al modelo existente `PlanDesarrolloIndividual`

Agregar dos campos nuevos:

| Campo | Tipo | Constraints | Descripcion |
|-------|------|-------------|-------------|
| prioridad | varchar(10) | nullable, default 'media' | baja, media, alta |
| recursos | text | nullable | Descripcion libre de recursos asignados |

El campo `categoria` (varchar(50)) ya existe en el modelo.

### Tablas existentes a reutilizar

- `levelup_plan_desarrollo_individual` — acciones PDI (agregar campos)
- `levelup_evaluaciones_competencia` — nivel actual para calcular gaps
- `levelup_competencia_requisitos` — nivel requerido para calcular gaps
- `levelup_notificaciones` — sistema de notificaciones existente
- `empleados` — datos del empleado

### No se crean tablas nuevas

Los KPIs son agregaciones sobre datos existentes. Las recomendaciones se generan on-the-fly via Ollama.

## Phases

### Fase 3 — Wizard Asignar Acciones + Prioridad/Recursos

**Backend:**
- Migración Alembic: agregar campos `prioridad` y `recursos` a `levelup_plan_desarrollo_individual`
- Actualizar schemas PDI (PDICreate, PDIUpdate, PDIResponse) para incluir los nuevos campos
- El endpoint POST existente se extiende con los nuevos campos (no hay endpoint nuevo)

**Frontend:**
- Modal wizard 4 pasos en `gestionPdi.ts`:
  - Paso 1 (Tipo Accion): seleccionar categoría de desarrollo + fecha límite
  - Paso 2 (Detalles): nombre de la acción + prioridad (Baja/Media/Alta toggle)
  - Paso 3 (Recursos): asignar recursos (textarea), competencia vinculada (select), responsable
  - Paso 4 (Confirmar): resumen de todos los campos antes de enviar
- Boton "Asignar Accion" visible en la card expandida y en la tabla resumen del equipo
- Validación en cada paso antes de permitir avanzar

### Fase 4 — KPIs Avanzados + Recomendaciones AI + Export + Notificar

**Backend:**
- Endpoint GET `/api/v1/evaluaciones/pdi/kpis-avanzados` retorna:
  - cumplimiento_plan_pct: (acciones completadas / total acciones) × 100
  - horas_training_promedio: sum(duracion_horas) / count(empleados distintos)
  - promedio_skill_gap: avg(nivel_requerido - nivel_actual) de empleados con PDI
- Endpoint GET `/api/v1/evaluaciones/pdi/empleado/{id}/recomendaciones` que usa Ollama para generar 3 recomendaciones de desarrollo basadas en las brechas del empleado
- Endpoint GET `/api/v1/evaluaciones/pdi/export?format=pdf|excel`:
  - PDF generado server-side (weasyprint o similar)
  - Excel generado con openpyxl
  - Retorna archivo descargable
- Endpoint POST `/api/v1/evaluaciones/pdi/notificar-equipo`:
  - Crea una notificación en `levelup_notificaciones` para cada empleado con acciones pendientes
  - Filtrado por area del usuario que invoca (gerente ve su area, RH ve todo)

**Frontend:**
- Fila de 4 KPI cards avanzados encima de la tabla: Cumplimiento Plan %, Inversión Formación (sum horas), Horas Training/Empl, Promedio Skill Gap
- Panel "Recomendaciones Smart AI" en la card expandida del empleado: muestra 3 sugerencias con botón de agregar directamente al PDI
- Botones "Exportar PDF" y "Excel" en el footer/header de la pagina
- Boton "Notificar a todo el Equipo" con modal de confirmación antes de enviar

## API Endpoints

### Fase 3

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| POST | `/api/v1/evaluaciones/empleado/{id}/pdi` | RH | Crear acción (extendido con prioridad/recursos) |

### Fase 4

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi/kpis-avanzados` | RH/gerente | KPIs de cumplimiento, training, skill gap |
| GET | `/api/v1/evaluaciones/pdi/empleado/{id}/recomendaciones` | RH/gerente | 3 recomendaciones AI por empleado |
| GET | `/api/v1/evaluaciones/pdi/export` | RH | Exportar reporte PDF o Excel |
| POST | `/api/v1/evaluaciones/pdi/notificar-equipo` | RH/gerente | Notificar equipo completo |

## Decisions

1. **Prioridad como campo libre (no enum BD)** — se valida a nivel schema con Literal['baja', 'media', 'alta']. Default 'media' para datos existentes.
2. **Recursos como texto libre** — no se estructura en sub-campos; la flexibilidad es más importante en esta iteración.
3. **Recomendaciones AI usa Ollama** — la integración ya existe en `app/integrations/ollama.py`. Se pasan las brechas como contexto y se pide sugerir 3 acciones concretas. Si Ollama no está disponible, retorna lista vacía (graceful degradation).
4. **Export PDF usa weasyprint** server-side con template HTML. Excel usa openpyxl con formato tabular.
5. **Notificar equipo** usa el sistema de notificaciones existente (`levelup_notificaciones`), no email externo.
6. **Permisos**: RH ve todo, gerente solo su area. Mismo patron que `_resolve_area_scope()` existente en `pdi_service.py`.
7. **Wizard no crea endpoint nuevo** — reutiliza POST existente. La diferencia es solo UX frontend (multi-step vs form simple).
8. **KPIs se calculan on-the-fly** — no se almacenan pre-calculados; el volumen de datos no justifica materialización.

## Acceptance Criteria

### Fase 3
- [ ] Migración Alembic agrega campos `prioridad` y `recursos` a `levelup_plan_desarrollo_individual`
- [ ] Schemas PDI aceptan y retornan los nuevos campos
- [ ] Wizard de 4 pasos permite crear acción completa con todos los campos
- [ ] Validación en cada paso antes de avanzar (campos requeridos marcados)
- [ ] Paso "Confirmar" muestra resumen legible antes de enviar
- [ ] Wizard accesible desde card expandida y tabla resumen del equipo
- [ ] Prioridad se muestra como badge en tabla de acciones (baja=gris, media=amber, alta=red)
- [ ] Datos existentes sin prioridad se muestran como "media" por default

### Fase 4
- [ ] Endpoint kpis-avanzados calcula valores correctos
- [ ] KPI cards se muestran en la página de gestión PDI
- [ ] Endpoint recomendaciones genera 3 sugerencias relevantes basadas en brechas del empleado
- [ ] Si Ollama no disponible, retorna lista vacía sin error 500
- [ ] Panel de recomendaciones visible en card expandida con botón "Agregar al PDI"
- [ ] Export PDF genera documento descargable con formato legible (header, tabla, fecha)
- [ ] Export Excel genera .xlsx con datos tabulados (una fila por acción PDI)
- [ ] "Notificar equipo" crea notificaciones para empleados con acciones pendientes
- [ ] Modal de confirmación antes de notificar (muestra cantidad de empleados afectados)
- [ ] Permisos respetados: gerente solo su área, RH todo

## Files to Create/Modify

### Backend (modificar)
- `app/models/talento.py` — Agregar campos `prioridad` y `recursos` al modelo `PlanDesarrolloIndividual`
- `app/schemas/pdi.py` — Agregar campos a PDICreate, PDIUpdate, PDIResponse
- `app/services/pdi_service.py` — Nuevos metodos: kpis_avanzados, recomendaciones, export_pdf, export_excel, notificar_equipo
- `app/api/v1/evaluaciones/router.py` — 4 nuevos endpoints (kpis-avanzados, recomendaciones, export, notificar-equipo)

### Backend (crear)
- `alembic/versions/<rev>_pdi_prioridad_recursos.py` — Migración para nuevos campos

### Frontend (modificar)
- `frontend/src/pages/gestionPdi.ts` — Wizard modal, KPI cards avanzados, botones export/notificar, panel recomendaciones en card expandida
- `frontend/src/api/evaluaciones.ts` — Nuevas funciones: getPDIKpisAvanzados, getPDIRecomendaciones, exportPDI, notificarEquipoPDI
