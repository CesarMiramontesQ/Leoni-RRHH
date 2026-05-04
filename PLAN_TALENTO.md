# Plan de Implementacion — Modulo de Gestion de Talento

Basado en las 15 pantallas del proyecto Stitch `1746412759455982581` que no existen en el codigo actual.

**Estado actual**: Todo el modulo operativo (solicitudes, incidencias, actas, comedor, empleados, organigrama, notificaciones) esta COMPLETO. Las 15 pantallas de Stitch son un modulo **nuevo** de Gestion de Talento y Desarrollo.

---

## Diagrama de dependencias

```
Fase 1a: Perfiles Puesto ─────────────────────────┐
Fase 1b: Matriz Competencias ──┐                   │
                               ├→ Fase 3: Evaluacion ──┐
Fase 2: Capacitaciones ────────┘                   │    │
  (paralela a Fase 1)                              │    ├→ Fase 4: PDI ──→ Fase 5a: Gestion PDI ──┐
                                                   │    │                                          │
                                                   └────┼→ Fase 5b: Vacantes ─────────────────────├→ Fase 6: Dashboard
                                                        │                                          │
                                                        └──────────────────────────────────────────┘
```

---

## Fase 1 — Configuracion base (0 dependencias)

Son catalogos de configuracion que otros modulos consumen. Solo dependen de `empleados` y `areas` que ya existen.

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Definicion de Perfiles de Puesto — Config con IA | `#/puestos` | D (Config/Form) | M |
| Matriz de Competencias — Configuracion por Area | `#/competencias` | D (Config/Form) | M |
| Matriz de Competencias — Configuracion Optimizada | `#/competencias` (variante) | D (Config/Form) | S |

### Backend

- Modelo `PuestosPerfil`: nombre, descripcion, area_id, nivel, requisitos (JSONB), competencias_requeridas
- Modelo `Competencia`: nombre, descripcion, area_id, nivel_esperado, categoria
- Modelo `CompetenciaMatriz`: competencia_id, puesto_perfil_id, nivel_requerido, peso
- Schemas Pydantic para CRUD
- Routers: `/api/v1/puestos-perfil/`, `/api/v1/competencias/`
- Services con logica de validacion
- Endpoint IA: `POST /api/v1/puestos-perfil/{id}/generar-descripcion` (Ollama)

### Frontend

- `frontend/src/pages/puestos.ts` — Lista + CRUD modal de perfiles
- `frontend/src/pages/competencias.ts` — Matriz configurable por area
- `frontend/src/api/puestos.ts` — API client
- `frontend/src/api/competencias.ts` — API client
- Reutilizar Layout D (stepper + form sections)
- Agregar rutas en `shellRouter.ts`
- Agregar items en `shellNavPolicy.ts` (acceso: `rh`)

### Criterios de aceptacion

- [ ] RH puede crear/editar perfiles de puesto con competencias asociadas
- [ ] RH puede configurar la matriz de competencias por area
- [ ] IA genera sugerencias de descripcion y requisitos para un puesto
- [ ] Filtros por area y busqueda por nombre funcionan
- [ ] Responsive: funciona en tablet y desktop

### Esfuerzo estimado: ~2 semanas

---

## Fase 2 — Catalogo de capacitaciones (paralela a Fase 1)

Completamente independiente. Solo necesita el directorio de empleados que ya existe.

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Capacitaciones — Gestion de Aprendizaje (Unificada) | `#/capacitaciones` | B (Admin List) | L |
| Catalogo de Capacitacion — Optimizado y Refinado (x3) | `#/capacitaciones/catalogo` | B (Admin List) | M |
| Catalogo de Capacitacion — Recomendaciones IA | `#/capacitaciones/catalogo?tab=ia` | B (Admin List) | M |

### Backend

- Modelo `Capacitacion`: nombre, descripcion, duracion_horas, modalidad (presencial/online/mixta), instructor, fecha_inicio, fecha_fin, cupo_maximo, area_id, competencias_asociadas (JSONB)
- Modelo `Inscripcion`: capacitacion_id, empleado_id, estado (inscrito/en_curso/completado/cancelado), calificacion, fecha_inscripcion, fecha_completado
- Schemas Pydantic para CRUD + filtros
- Routers: `/api/v1/capacitaciones/`, `/api/v1/capacitaciones/{id}/inscripciones/`
- Endpoint IA: `GET /api/v1/capacitaciones/recomendaciones?empleado_id={id}` (basado en puesto, area, competencias faltantes)

### Frontend

- `frontend/src/pages/capacitaciones.ts` — Vista unificada con tabs (Mi Aprendizaje / Catalogo / Recomendaciones IA)
- `frontend/src/api/capacitaciones.ts` — API client
- `frontend/src/components/capacitaciones/` — Cards de curso, filtros, modal de inscripcion
- Las 3 variantes del catalogo son tabs/filtros de la misma pagina
- Vista por rol:
  - `empleado`: catalogo + mis inscripciones + recomendaciones IA
  - `supervisor/gerente`: equipo + inscripciones del equipo
  - `rh`: admin completo (crear/editar cursos, gestionar inscripciones)

### Criterios de aceptacion

- [ ] RH puede crear/editar capacitaciones con competencias asociadas
- [ ] Empleados pueden ver catalogo y sus inscripciones
- [ ] IA recomienda cursos basados en perfil del empleado
- [ ] Filtros: modalidad, area, estado, busqueda
- [ ] Inscripcion via modal con confirmacion
- [ ] Vista de equipo para supervisores/gerentes

### Esfuerzo estimado: ~2 semanas

---

## Fase 3 — Evaluacion y feedback (depende de Fase 1)

Necesita la matriz de competencias para saber contra que evaluar.

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Evaluacion y Feedback — Gestion de Talento | `#/evaluaciones` | B + C (List + Detail) | L |

### Backend

- Modelo `Evaluacion`: empleado_id, evaluador_id, periodo, estado (borrador/enviado/revisado/cerrado), tipo (autoevaluacion/supervisor/360)
- Modelo `EvaluacionCompetencia`: evaluacion_id, competencia_id, nivel_demostrado, comentario
- Modelo `Feedback`: evaluacion_id, autor_id, contenido, fecha
- Schemas Pydantic
- Router: `/api/v1/evaluaciones/`
- Flujo de aprobacion similar a solicitudes (draft → submit → review → close)

### Frontend

- `frontend/src/pages/evaluaciones.ts` — Lista con filtros (periodo, estado, area)
- `frontend/src/components/evaluaciones/` — Form de evaluacion por competencia (progress bars editables), modal de feedback
- Vista por rol:
  - `empleado`: autoevaluacion
  - `supervisor/gerente`: evaluar equipo + ver autoevaluaciones
  - `rh`: admin (periodos, reportes, cierre masivo)

### Criterios de aceptacion

- [ ] Supervisores pueden evaluar a su equipo contra competencias del puesto
- [ ] Empleados pueden hacer autoevaluacion
- [ ] Flujo: borrador → enviar → revisar → cerrar
- [ ] Feedback bidireccional (texto libre + calificacion por competencia)
- [ ] Historico de evaluaciones por empleado

### Esfuerzo estimado: ~1.5 semanas

---

## Fase 4 — PDI del empleado (depende de Fases 1, 2, 3)

El Plan de Desarrollo Individual jala de competencias (gaps), capacitaciones (acciones), y evaluaciones (resultados).

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Mi Desarrollo (PDI) — LEONI LCS | `#/mi-desarrollo` | C (Detail/Profile) | L |
| Detalle de Desarrollo y Plan de Carrera — Vista Gerente | `#/empleados/{id}/desarrollo` | C (Detail) | M |

### Backend

- Modelo `PlanDesarrollo`: empleado_id, periodo, estado (activo/completado/cancelado), objetivo_general, fecha_inicio, fecha_revision
- Modelo `AccionDesarrollo`: plan_id, tipo (capacitacion/proyecto/mentoria/lectura), descripcion, competencia_id, fecha_limite, estado (pendiente/en_curso/completado), capacitacion_id (nullable FK)
- Modelo `ObjetivoCarrera`: empleado_id, puesto_destino_id (FK a PuestosPerfil), plazo_meses, notas
- Schemas Pydantic
- Router: `/api/v1/planes-desarrollo/`, `/api/v1/objetivos-carrera/`
- Endpoint: `GET /api/v1/planes-desarrollo/{id}/progreso` (calcula % basado en acciones completadas)
- Endpoint: `GET /api/v1/empleados/{id}/gaps-competencias` (compara evaluacion vs requerido)

### Frontend

- `frontend/src/pages/miDesarrollo.ts` — Vista del empleado: objetivo de carrera, plan actual, progreso, acciones
- Integracion en Vista 360: tab "Desarrollo" con detalle del PDI
- Componentes: timeline de acciones, progress por competencia, card de objetivo de carrera
- Vista del gerente: mismo layout pero con acciones de aprobacion/edicion

### Criterios de aceptacion

- [ ] Empleado ve su PDI con progreso visual por competencia
- [ ] Acciones vinculadas a capacitaciones (link directo a inscripcion)
- [ ] Gaps de competencias calculados automaticamente (evaluacion vs requerido)
- [ ] Objetivo de carrera con puesto destino y timeline
- [ ] Gerente puede ver/editar PDI de su equipo

### Esfuerzo estimado: ~2 semanas

---

## Fase 5 — Gestion PDI + Vacantes (depende de Fases 1, 4)

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Gestion de PDI — Vista del Gerente | `#/gestion-pdi` | B (Admin List) | M |
| Oportunidades de Crecimiento — Vacantes Internas | `#/vacantes` | B (Admin List) | M |

### 5a. Gestion de PDI

Vista administrativa para gerentes/RH: lista de todos los PDIs, filtros por area/estado/empleado, aprobacion masiva, seguimiento.

**Backend**: Endpoints de lista paginada + filtros + acciones masivas (aprobar, cerrar periodo).

**Frontend**: `frontend/src/pages/gestionPdi.ts` — Layout B con tabla, stat cards (PDIs activos, % completados, vencidos), filtros.

### 5b. Vacantes Internas

Publicacion de vacantes basadas en perfiles de puesto. Empleados pueden postularse.

**Backend**:
- Modelo `VacanteInterna`: puesto_perfil_id, area_id, descripcion, requisitos_extra, estado (abierta/cerrada/en_proceso), fecha_cierre
- Modelo `Postulacion`: vacante_id, empleado_id, estado (postulado/en_revision/aceptado/rechazado), carta_motivacion, fecha
- Router: `/api/v1/vacantes/`, `/api/v1/vacantes/{id}/postulaciones/`

**Frontend**: `frontend/src/pages/vacantes.ts` — Catalogo de vacantes con cards, filtros por area/nivel, boton de postulacion con modal.

### Criterios de aceptacion

- [ ] Gerentes ven lista de PDIs de su equipo con estado y progreso
- [ ] RH puede gestionar PDIs de toda la organizacion
- [ ] Vacantes publicadas con requisitos del perfil de puesto
- [ ] Empleados pueden postularse (modal con carta de motivacion)
- [ ] Match score: % de competencias del empleado vs requeridas por la vacante

### Esfuerzo estimado: ~1.5 semanas

---

## Fase 6 — Dashboard de Talento (depende de TODO)

Vista de agregacion con KPIs de todo el modulo de talento.

### Pantallas Stitch

| Pantalla | Ruta sugerida | Layout | Esfuerzo |
|---|---|---|---|
| Dashboard Profesional — Gestion de Talento (Refinado) | `#/talento` | A (Dashboard) | M |
| Panel de Gestion de Talento — Vista de Supervisor | `#/talento` (rol supervisor) | A (Dashboard) | M |
| Panel de Gestion de Talento — Optimizado con IA | `#/talento` (rol rh) | A (Dashboard) | M |

### Backend

- Endpoint: `GET /api/v1/talento/dashboard` con KPIs:
  - Total competencias evaluadas / gaps criticos
  - PDIs activos / % completados / vencidos
  - Capacitaciones en curso / completadas este periodo
  - Evaluaciones pendientes / cerradas
  - Vacantes abiertas / postulaciones recibidas
  - Recomendaciones IA (top acciones sugeridas)
- Vista por rol: supervisor (solo equipo), gerente (area), rh (global)

### Frontend

- `frontend/src/pages/talento.ts` — Dashboard Layout A con KPI cards, graficas, listas de acciones pendientes
- 3 variantes por rol (misma pagina, datos filtrados):
  - `empleado`: No accede (redirect a `#/mi-desarrollo`)
  - `supervisor`: KPIs del equipo + evaluaciones pendientes + PDIs
  - `gerente/rh`: KPIs del area/global + insights IA + acciones sugeridas

### Criterios de aceptacion

- [ ] KPIs en tiempo real de todo el modulo de talento
- [ ] Vista por rol con datos filtrados
- [ ] Insights IA: sugerencias de acciones (ej: "5 empleados con competencias criticas sin PDI")
- [ ] Navegacion a cada seccion desde el dashboard (click en KPI → lista filtrada)
- [ ] Skeleton loading + error handling

### Esfuerzo estimado: ~1.5 semanas

---

## Resumen de esfuerzo

| Fase | Screens | Esfuerzo | Paralela con | Acumulado |
|---|---|---|---|---|
| 1 | 3 | ~2 semanas | Fase 2 | 2 sem |
| 2 | 4 | ~2 semanas | Fase 1 | 2 sem |
| 3 | 1 | ~1.5 semanas | — | 3.5 sem |
| 4 | 2 | ~2 semanas | — | 5.5 sem |
| 5 | 2 | ~1.5 semanas | — | 7 sem |
| 6 | 3 | ~1.5 semanas | — | 8.5 sem |
| **Total** | **15** | **~8.5 semanas** | | **~7 sem si F1+F2 paralelas** |

---

## Notas de implementacion

### Rutas nuevas para `shellRouter.ts`

```typescript
#/puestos                    → mountPuestos()
#/competencias               → mountCompetencias()
#/capacitaciones             → mountCapacitaciones()
#/capacitaciones/catalogo    → mountCapacitaciones() (sub-route)
#/evaluaciones               → mountEvaluaciones()
#/mi-desarrollo              → mountMiDesarrollo()
#/empleados/{id}/desarrollo  → mountEmployeeVista360() (tab desarrollo)
#/gestion-pdi                → mountGestionPdi()
#/vacantes                   → mountVacantes()
#/talento                    → mountTalento()
```

### Nav items nuevos para `shellNavPolicy.ts`

```
Seccion "Talento" (nuevo grupo en sidebar):
- Talento (dashboard)      → rh, gerente, supervisor
- Mi Desarrollo            → todos
- Capacitaciones           → todos
- Evaluaciones             → rh, gerente, supervisor
- Vacantes                 → todos

Seccion "Configuracion" (footer de sidebar):
- Competencias             → rh
- Perfiles de Puesto       → rh
- Gestion PDI              → rh, gerente
```

### Migraciones Alembic necesarias

```
Fase 1: puestos_perfil, competencia, competencia_matriz
Fase 2: capacitacion, inscripcion
Fase 3: evaluacion, evaluacion_competencia, feedback
Fase 4: plan_desarrollo, accion_desarrollo, objetivo_carrera
Fase 5: vacante_interna, postulacion
```

### Referencia Stitch

Para obtener el HTML/screenshot de cualquier pantalla:
```
mcp__stitch__get_screen(
  name: "projects/1746412759455982581/screens/{screen_id}",
  projectId: "1746412759455982581",
  screenId: "{screen_id}"
)
```

Screen IDs clave:
- Competencias Config: `48f2e7620d5544ec8722dbf08fa414db`
- Competencias Optimizada: `28d85e857024400c97b2ba10d03adc68`
- Capacitaciones Unificada: `a5e494fc094648f0ac4821e70271b882`
- Catalogo Capacitacion: `1aa5c7cfc5ce4d7cb06b9e4688ba1068`, `3c0c894519a440e581affdcd77b37935`, `8654bea35b53416db371e758e44a2a9b`
- Catalogo IA: `56deea02c87342b5858bb13c9b134363`
- Evaluacion: `5b4aaec17cdd4bd8b5f6402766aadf6b`
- Mi Desarrollo PDI: `99bcef48632a462a84c8fcb2991d25f4`
- Detalle Carrera Gerente: `b2dd748bf11146fe8d116bc7c8cfaf70`
- Gestion PDI Gerente: `cd6b7d6ea5ad43148fb7f98d619a1f32`
- Vacantes: `ec8aae4c521a4a8cb67094deed5adcd4`
- Perfiles Puesto: `ba31d174770b47e3b74905938a0a98e3`
- Dashboard Talento: `06b7cff377ea4b14886698096c049664`
- Panel Supervisor: `7dc63a8f93ca4a17aa62e15d09d676f6`
- Panel IA: `b45473725fe6497989c67b6659c0db91`
- Vista Supervisor: `ebe21b32febd4b7d8c227e54688fd934`
