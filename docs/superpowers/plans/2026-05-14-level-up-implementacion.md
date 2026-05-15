# Plan de implementación — Level Up

> Fecha: 2026-05-14
> Fuente de diseño: `/Users/albertoflores/Documents/GitHub/Level Up/` (Stitch export — 12 pantallas JSX + tokens CSS + spec funcional)
> Estrategia: **Demo-first** — páginas hardcodeadas con datos fake → funcionalidad real progresiva

---

## Estrategia de implementación

### Dos tracks paralelos

| Track | Objetivo | Entregable |
|---|---|---|
| **A — Demo** | Páginas visuales con datos fake para mostrar a clientes | HTML/TS completo con tablas, colores, KPIs hardcodeados |
| **B — Real** | Funcionalidad completa con backend, DB, lógica de negocio | API + frontend conectado a datos reales |

### Flujo por pantalla
```
Diseño (Stitch) → Demo hardcodeada (Track A) → Backend + modelos (Track B) → Frontend conectado (Track B)
```

### Reglas
- Track A NO depende de backend — usa datos inline/constantes
- Track A se implementa como páginas normales con rutas reales en el router
- Cuando Track B se completa, reemplaza los datos fake con llamadas API
- Los componentes visuales de Track A se reutilizan tal cual en Track B

---

## Estado por pantalla

| # | Pantalla | Ruta | Track A (Demo) | Track B (Real) |
|---|---|---|---|---|
| 1 | Dashboard Level Up | `#/level-up` | `pending` | `pending` |
| 2 | Matriz de capacidades (heatmap) | `#/capacidades` | `pending` | `pending` |
| 3 | Detalle colaborador (capacidades + plan) | `#/empleados/:id` tab | `pending` | `pending` |
| 4 | Matriz de habilidades | `#/habilidades` | `pending` | `pending` |
| 5 | Perfiles de puesto (tarjetas) | `#/puestos` toggle | `pending` | `pending` |
| 6 | Perfil de puesto (detalle) | `#/puestos/:id` | `pending` | `pending` |
| 7 | Capacitaciones (tabla asignaciones) | `#/capacitaciones` rediseño | `pending` | `pending` |
| 8 | Catálogo de cursos | `#/cursos` | `pending` | `pending` |
| 9 | OPLs (master-detail) | `#/opls` | `pending` | `pending` |
| 10 | Evidencias (bandeja validación) | `#/evidencias` | `pending` | `pending` |
| 11 | Motor de sugerencias | `#/sugerencias` | `pending` | `pending` |
| 12 | Encuestas post curso | `#/encuestas` | `pending` | `pending` |

**Estados posibles:**
- `pending` — no iniciada
- `in-progress` — en desarrollo
- `done` — completada
- `wired` — (solo Track B) conectada a datos reales, fake data eliminada

---

## Track A — Demo (páginas hardcodeadas)

### Sprint A1 — Navegación + Layout base

**Objetivo:** Sidebar extendida con todas las rutas Level Up, shell visual.

- [ ] Agregar sección "Formación" al nav: Capacitaciones (existente), Cursos, OPLs
- [ ] Agregar sección "Cumplimiento" al nav: Evidencias, Sugerencias, Encuestas
- [ ] Agregar ruta `#/capacidades` (separada de competencias)
- [ ] Agregar ruta `#/habilidades`
- [ ] Agregar ruta `#/level-up` (dashboard)
- [ ] Registrar todas las rutas nuevas en `shellRouter.ts`
- [ ] Cada ruta renderiza placeholder con título

### Sprint A2 — Pantallas core (5, 6, 7, 8)

**Objetivo:** Las pantallas que el cliente verá primero — perfiles y capacitación.

#### Pantalla 5 — Perfiles de puesto (tarjetas)
- [ ] Toggle vista tabla/tarjetas en página puestos existente
- [ ] Grid de tarjetas con: nombre puesto, personas vinculadas (N), cursos (N), OPLs (N), cumplimiento %, brechas, owner avatar
- [ ] Datos fake: 8-12 perfiles con métricas variadas
- [ ] Badge de cumplimiento con color semáforo

#### Pantalla 6 — Perfil de puesto (detalle)
- [ ] Ruta `#/puestos/:id` nueva página
- [ ] Secciones: capacidades requeridas (barras 1-5), habilidades (chips), cursos obligatorios/opcionales (tabla con vigencia), OPLs (estado), evidencias requeridas (tipo + firma)
- [ ] Datos fake: 1 perfil completo con todas las secciones populadas

#### Pantalla 7 — Capacitaciones (tabla asignaciones)
- [ ] Nueva vista tabla en página capacitaciones (agregar tab o toggle)
- [ ] Columnas: ID, Capacitación, Colaborador, Área, Modalidad, Fecha, Evidencias (n/m), Score, Estado badge
- [ ] Pestañas: Todas / Pendientes / En curso / Completadas / Vencidas
- [ ] Datos fake: 20-30 filas con estados variados
- [ ] Mantener vista actual de cards accesible

#### Pantalla 8 — Catálogo de cursos
- [ ] Nueva ruta `#/cursos`
- [ ] KPIs top: catálogo activo, sesiones programadas, score promedio, cursos críticos
- [ ] Tabs por categoría: Técnico / Calidad / Seguridad / Operativo / Blanda
- [ ] Cards: nombre, proveedor, duración, cupo, instructor, sesiones/año, asignados, score estrellitas
- [ ] Datos fake: 12-15 cursos con variedad de categorías

### Sprint A3 — Matrices (2, 4, 3)

**Objetivo:** Heatmaps y vistas de evaluación individual.

#### Pantalla 2 — Matriz de capacidades (heatmap)
- [ ] Nueva ruta `#/capacidades`
- [ ] Heatmap: eje Y = colaboradores, eje X = capacidades
- [ ] Escala 1-5 con colores navy (tokens `--hm-lv-1` a `--hm-lv-5`)
- [ ] Borde rojo en celdas con brecha (nivel < requerido)
- [ ] Score % por colaborador en última columna
- [ ] Filtros: área, línea
- [ ] Leyenda visual + footer con resumen brechas
- [ ] Datos fake: 10-12 colaboradores × 8-10 capacidades

#### Pantalla 4 — Matriz de habilidades
- [ ] Nueva ruta `#/habilidades`
- [ ] Cards por tipo: Técnicas, Blandas, Operativas, Críticas
- [ ] Tabs: Por colaborador / Por habilidad / Por área / Críticas
- [ ] Grid con barras de 4 niveles discretos
- [ ] Promedio por persona
- [ ] Datos fake: 10 colaboradores × 8-9 habilidades

#### Pantalla 3 — Detalle colaborador (capacidades + plan)
- [ ] Nuevos tabs en `empleadoVista360.ts`: "Capacidades" y "Plan de desarrollo"
- [ ] Tab Capacidades: tabla nivel actual vs requerido por capacidad, badge gap
- [ ] Tab Plan: timeline con etapas (completadas, en curso, pendientes)
- [ ] Datos fake: 1 colaborador con 8 capacidades y plan de 4 etapas

### Sprint A4 — Módulos nuevos (9, 10, 11, 12)

**Objetivo:** Pantallas completamente nuevas sin equivalente actual.

#### Pantalla 9 — OPLs
- [ ] Nueva ruta `#/opls`
- [ ] Layout master-detail: tabla izquierda + detalle derecha
- [ ] Tabla: ID, proceso/máquina, versión actual, afectados, estado aprobación
- [ ] Detalle: preview documento, timeline de versiones, personal impactado con badges
- [ ] Banner alerta para reentrenamiento pendiente
- [ ] Datos fake: 8-10 OPLs con historial de 2-3 versiones

#### Pantalla 10 — Evidencias
- [ ] Nueva ruta `#/evidencias`
- [ ] Layout cola + detalle (split view)
- [ ] Cola: tabs (Pendientes/Mías/Devueltas/Histórico), iconos por tipo
- [ ] Detalle: preview archivo (placeholder img), checklist validación, firmas requeridas con estados, timeline actividad
- [ ] Acciones: Devolver / Solicitar info / Validar y firmar (botones disabled en demo)
- [ ] Datos fake: 12-15 evidencias con estados variados

#### Pantalla 11 — Motor de sugerencias
- [ ] Nueva ruta `#/sugerencias`
- [ ] KPIs: activas, impacto alto, inversión sugerida, personas alcanzables
- [ ] Cards horizontales: justificación dual (brecha % + adopción sector %), benchmark barra, capacidades afectadas, áreas, personas, duración, inversión, proveedor
- [ ] Prioridad con estrellas
- [ ] Acciones: Aprobar y programar / Posponer / Descartar (botones disabled)
- [ ] Datos fake: 6-8 sugerencias con prioridades variadas

#### Pantalla 12 — Encuestas post curso
- [ ] Nueva ruta `#/encuestas`
- [ ] KPIs: encuestas recibidas, score medio, NPS interno, cursos en alerta, mejor proveedor
- [ ] Tabla scores por curso con barras horizontales + tendencia (sparkline fake o flecha)
- [ ] Tabs: Curso / Instructor / Proveedor
- [ ] Panel lateral: distribución 1-5 (barras) + comentarios destacados
- [ ] Datos fake: 10-12 cursos con scores y 5-6 comentarios

### Sprint A5 — Dashboard Level Up (1)

**Objetivo:** Vista consolidada que requiere que todas las demás existan para tener contexto.

#### Pantalla 1 — Dashboard Level Up
- [ ] Nueva ruta `#/level-up`
- [ ] 4 KPI cards con sparkline (fake SVG): cumplimiento global %, brechas críticas, capacitaciones activas, score medio
- [ ] Cumplimiento por área: barras horizontales + semáforo (verde/amarillo/rojo)
- [ ] Próximas capacitaciones: mini calendario semanal con 4-5 items
- [ ] Evidencias pendientes: tabla mini (5 filas)
- [ ] Sugerencias del motor: 2-3 cards compactas
- [ ] Datos fake: todos los KPIs con números realistas para Leoni

---

## Track B — Funcionalidad real

### Fase B0 — Modelado de datos

> Prerrequisito para todo Track B

| Entidad | Escala/Tipo | Relación |
|---|---|---|
| `Capacidad` | 1-5 | Complementa `Competencia` |
| `Habilidad` | 1-4, tipos: técnica/blanda/operativa | Nueva |
| `EvaluacionCapacidad` | empleado × capacidad → nivel | Extiende evaluaciones |
| `EvaluacionHabilidad` | empleado × habilidad → nivel | Nueva |
| `Curso` | Catálogo maestro | `Capacitacion` se liga via FK |
| `OPL` | Con versiones, proceso, máquina, aprobador | Nueva |
| `OPLVersion` | Historial por OPL | Nueva |
| `Evidencia` | Archivo + tipo + validación + firmas | Nueva |
| `EvidenciaFirma` | Multifirma por rol | Nueva |
| `EncuestaPostCurso` | Scores + comentarios | Nueva |
| `SugerenciaCapacitacion` | Fuente, justificación, estado | Nueva |
| `PlanDesarrollo` / `PlanEtapa` | Etapas por colaborador | Nueva |

**Entregables:**
- [ ] Migraciones Alembic
- [ ] Modelos SQLAlchemy
- [ ] Seed de datos de prueba

### Fase B1 — Perfiles de puesto (pantallas 5, 6)

**Backend:**
- [ ] Extender `PerfilPuesto` con relaciones: capacidades requeridas (con nivel), habilidades, cursos obligatorios/opcionales, OPLs, evidencias requeridas
- [ ] Endpoint `GET /perfiles/:id/summary`

**Frontend (wire up):**
- [ ] Reemplazar datos fake de pantalla 5 con API call
- [ ] Reemplazar datos fake de pantalla 6 con API call
- [ ] Marcar pantallas 5, 6 como `wired`

### Fase B2 — Matrices (pantallas 2, 3, 4)

**Backend:**
- [ ] `GET /capacidades/matriz?area=&linea=`
- [ ] `GET /habilidades/matriz?area=&tipo=`
- [ ] `GET /empleados/:id/capacidades`
- [ ] `POST /evaluaciones-capacidad` (CRUD evaluaciones individuales)

**Frontend (wire up):**
- [ ] Heatmap → API real
- [ ] Habilidades → API real
- [ ] Vista360 tabs → API real
- [ ] Marcar pantallas 2, 3, 4 como `wired`

### Fase B3 — Cursos y capacitaciones (pantallas 7, 8)

**Backend:**
- [ ] Modelo `Curso` separado
- [ ] Refactor: `Capacitacion.curso_id` FK
- [ ] CRUD cursos + estadísticas
- [ ] Endpoint tabla asignaciones con filtros/paginación

**Frontend (wire up):**
- [ ] Catálogo cursos → API real
- [ ] Tabla capacitaciones → API real
- [ ] Marcar pantallas 7, 8 como `wired`

### Fase B4 — OPLs (pantalla 9)

**Backend:**
- [ ] CRUD OPL con versionado
- [ ] Lógica: nueva versión → reentrenamiento automático
- [ ] `GET /opls` + `GET /opls/:id` con historial

**Frontend (wire up):**
- [ ] Master-detail → API real
- [ ] Marcar pantalla 9 como `wired`

### Fase B5 — Evidencias (pantalla 10)

**Backend:**
- [ ] CRUD Evidencia + upload archivos
- [ ] Modelo firmas multi-rol
- [ ] `GET /evidencias/bandeja` + `POST /evidencias/:id/validar`

**Frontend (wire up):**
- [ ] Bandeja + acciones → API real
- [ ] Habilitar botones (Devolver/Validar/Firmar)
- [ ] Marcar pantalla 10 como `wired`

### Fase B6 — Sugerencias (pantalla 11)

**Backend:**
- [ ] Algoritmo brechas × catálogo
- [ ] Modelo `SugerenciaCapacitacion`
- [ ] Endpoints CRUD + acciones (aprobar/posponer/descartar)

**Frontend (wire up):**
- [ ] Cards → API real
- [ ] Habilitar acciones
- [ ] Marcar pantalla 11 como `wired`

### Fase B7 — Encuestas (pantalla 12)

**Backend:**
- [ ] Modelo `EncuestaPostCurso`
- [ ] Disparo automático al completar capacitación
- [ ] Endpoints agregaciones

**Frontend (wire up):**
- [ ] Tabla + panel → API real
- [ ] Marcar pantalla 12 como `wired`

### Fase B8 — Dashboard (pantalla 1)

**Backend:**
- [ ] `GET /level-up/dashboard` endpoint consolidado

**Frontend (wire up):**
- [ ] KPIs + widgets → API real
- [ ] Marcar pantalla 1 como `wired`

---

## Dependencias Track B

```
B0  ─────────────────────────────────────┐
                                          │
B1  (Perfiles) ◄──────────────────────────┤
                                          │
B2  (Matrices) ◄── B1 ───────────────────┤
                                          │
B3  (Cursos + Capacitaciones) ◄───────────┤
     │                                    │
     ├── B4  (OPLs) ◄── B1 ──────────────┤
     │                                    │
     ├── B5  (Evidencias) ◄── B4 ────────┤
     │                                    │
     ├── B6  (Sugerencias) ◄── B2 ───────┤
     │                                    │
     └── B7  (Encuestas) ◄── B3 ─────────┤
                                          │
B8  (Dashboard) ◄── Todas ────────────────┘
```

**Track A no tiene dependencias entre sprints** — se puede hacer en cualquier orden. El orden sugerido (A1→A5) es por impacto visual para el cliente.

---

## Orden de ejecución recomendado

```
Semana 1-2:  A1 + A2  (nav + pantallas core)
Semana 3:    A3       (matrices)
Semana 4:    A4 + A5  (módulos nuevos + dashboard)
─── Demo completa para cliente ───
Semana 5:    B0       (modelos + migraciones)
Semana 6-7:  B1 + B3  (perfiles + cursos — independientes)
Semana 8:    B2       (matrices — depende de B1)
Semana 9:    B4       (OPLs)
Semana 10:   B5 + B7  (evidencias + encuestas — paralelas)
Semana 11:   B6       (sugerencias)
Semana 12:   B8       (dashboard consolidado)
```

---

## Design system

El Track A usa los tokens actuales del sistema (`design.md` secciones 12-16) adaptados al estilo Level Up. Decisión tomada: **adaptar al sistema actual** (Inter + Tailwind + `uiTokens.ts`) incorporando los tokens extendidos (heatmap, skill bars, etc.) ya documentados en `design.md`.

---

## Archivos de referencia

- Spec funcional: `/Users/albertoflores/Documents/GitHub/Level Up/uploads/Leoni - Level Up.md`
- Tokens CSS: `/Users/albertoflores/Documents/GitHub/Level Up/tokens.css`
- Screens 1 (Dashboard, Matrices, Detalle): `/Users/albertoflores/Documents/GitHub/Level Up/screens-1.jsx`
- Screens 2 (Perfiles, Capacitaciones, Cursos, OPLs): `/Users/albertoflores/Documents/GitHub/Level Up/screens-2.jsx`
- Screens 3 (Evidencias, Sugerencias, Encuestas): `/Users/albertoflores/Documents/GitHub/Level Up/screens-3.jsx`
- Shared (Shell, componentes, data): `/Users/albertoflores/Documents/GitHub/Level Up/shared.jsx`
- Design system actualizado: `design.md` (secciones 12-16)
- Plan original: este archivo
