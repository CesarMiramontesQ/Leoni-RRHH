# Gestión PDI Vista Gerente/RH

> Feature slug: `gestion-pdi-vista-gerente`
> Branch: `claude/feature/gestion-pdi-vista-gerente`
> Date: 2026-06-24
> Status: Draft

---

## Problem Statement

El sistema ya cuenta con un PDI (Plan de Desarrollo Individual) a nivel de empleado individual (ver spec `evaluacion-individual-vs-puesto`), pero los gerentes y RH no tienen una vista consolidada para gestionar todos los PDIs de su equipo o área. Necesitan un dashboard centralizado donde puedan ver el estado global de los planes, identificar empleados con acciones vencidas o sin avance, y dar seguimiento sin tener que navegar empleado por empleado.

## Goals

- Proveer una vista de gestión de PDIs consolidada para roles gerente y RH
- Permitir filtrar PDIs por área, departamento, estado y periodo
- Mostrar KPIs agregados (total acciones, completadas, en proceso, vencidas)
- Facilitar el seguimiento con indicadores de progreso por empleado
- Permitir acciones rápidas (cambiar estado, reasignar) desde la vista consolidada

## Non-Goals

- Crear nuevos PDIs desde esta vista (se crean desde la evaluación individual)
- Notificaciones automáticas o alertas por email
- Reportes exportables a Excel/PDF (se puede agregar en iteración futura)
- Aprobaciones o workflows multi-nivel
- Vista del empleado sobre su propio PDI (ya cubierta en evaluación individual)

## User Stories

1. **Como gerente**, quiero ver un listado de todos los PDIs de mis colaboradores directos para dar seguimiento a su desarrollo sin entrar empleado por empleado.
2. **Como RH**, quiero ver todos los PDIs de la organización con filtros por área/departamento para identificar dónde hay más brechas abiertas.
3. **Como gerente/RH**, quiero ver KPIs globales (total acciones, completadas %, en proceso, vencidas) para entender el estado general del desarrollo del equipo.
4. **Como gerente/RH**, quiero filtrar PDIs por estado (pendiente, en_proceso, completado, cancelado) para enfocarme en las acciones que requieren atención.
5. **Como gerente/RH**, quiero ver el progreso de cada empleado (acciones completadas vs totales) como una barra o porcentaje en el listado.
6. **Como RH**, quiero poder cambiar el estado de una acción PDI directamente desde esta vista sin navegar al detalle del empleado.
7. **Como gerente/RH**, quiero filtrar por rango de fechas para ver las acciones planificadas en un periodo específico.
8. **Como gerente/RH**, quiero hacer clic en un empleado para navegar a su evaluación individual completa.

## Data Model

### Tablas existentes a reutilizar

- `levelup_plan_desarrollo` — Acciones PDI por empleado (creada en spec anterior)
- `levelup_evaluaciones_competencia` — Nivel actual por empleado-competencia
- `levelup_competencia_requisitos` — Nivel requerido por puesto-competencia
- `levelup_perfil_funciones` — Asignación empleado ↔ puesto
- `levelup_competencias` — Catálogo de competencias
- `empleados` — Datos del empleado (nombre, área, depto, supervisor)
- `areas` / `puestos` — Catálogos legacy (read-only)

### No se crean tablas nuevas

Esta vista consume datos existentes de `levelup_plan_desarrollo` con agregaciones. No requiere modelo adicional.

## Phases

### Fase 1 — Endpoint de listado consolidado + KPIs

**Backend:**
- Nuevo endpoint GET `/api/v1/evaluaciones/pdi` con filtros: area_id, departamento, estado, fecha_inicio, fecha_fin, empleado_nombre (búsqueda parcial)
- Response incluye listado paginado con: empleado (id, nombre, numero_empleado, puesto, area), competencia, accion, tipo, duracion_horas, fecha_inicio, fecha_fin, responsable, estado
- Endpoint de KPIs GET `/api/v1/evaluaciones/pdi/resumen` con totales: total_acciones, completadas, en_proceso, pendientes, vencidas (fecha_fin < hoy y estado != completado/cancelado)
- Permisos: RH ve todo, gerente ve solo su área/reportes directos
- Paginación con limit/offset

**Frontend:**
- Nueva página `gestionPdi.ts` accesible desde el menú de Evaluaciones (solo gerente/RH)
- Header con título "Gestión de Planes de Desarrollo"
- 4 KPI cards: Total Acciones, Completadas (%), En Proceso, Vencidas (con alerta visual)
- Barra de filtros: selector área, selector estado, búsqueda por nombre, rango de fechas
- Tabla principal: Empleado | Puesto | Competencia | Acción | Tipo | Periodo | Responsable | Estado (badge)
- Paginación en tabla

### Fase 2 — Progreso por empleado + acciones rápidas

**Backend:**
- Nuevo endpoint GET `/api/v1/evaluaciones/pdi/progreso-equipo` que retorna por empleado: nombre, total_acciones, completadas, en_proceso, pendientes, vencidas, progreso_pct
- Endpoint PATCH `/api/v1/evaluaciones/pdi/{pdi_id}/estado` para cambio rápido de estado

**Frontend:**
- Vista alternativa "Por Empleado": tarjetas o filas con nombre del empleado + barra de progreso (completadas/total)
- Toggle entre vista "Todas las acciones" y "Por empleado"
- Acción rápida en tabla: dropdown para cambiar estado directamente en la fila
- Click en empleado navega a `/evaluaciones/empleado/{id}` (evaluación individual)
- Indicador visual de acciones vencidas (badge rojo, ícono de alerta)

## API Endpoints

### Fase 1

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi` | RH/gerente | Listado paginado de todas las acciones PDI con filtros |
| GET | `/api/v1/evaluaciones/pdi/resumen` | RH/gerente | KPIs agregados del estado global de PDIs |

### Fase 2

| Method | Endpoint | Role | Purpose |
|--------|----------|------|---------|
| GET | `/api/v1/evaluaciones/pdi/progreso-equipo` | RH/gerente | Progreso resumido por empleado |
| PATCH | `/api/v1/evaluaciones/pdi/{pdi_id}/estado` | RH | Cambio rápido de estado de una acción |

## Decisions

1. **No crear tablas nuevas** — esta vista es puramente de consulta sobre `levelup_plan_desarrollo` existente.
2. **Permisos por rol**: RH ve toda la organización, gerente ve solo empleados de su área (determinado por `empleados.area`). Supervisor ve solo sus reportes directos.
3. **Vencidas** = acciones con `fecha_fin < date.today()` y estado NOT IN ('completado', 'cancelado').
4. **Paginación** con `limit` (default 20) y `offset` para el listado principal.
5. **Vista dual** en frontend: tabla plana de todas las acciones vs agrupación por empleado con barra de progreso.
6. **Navegación**: click en empleado lleva a la evaluación individual existente (no abre modal).
7. **Dependencia**: requiere que Fase 2 del spec `evaluacion-individual-vs-puesto` (CRUD de PDI) esté implementada. Sin datos en `levelup_plan_desarrollo`, la vista estará vacía.

## Acceptance Criteria

### Fase 1
- [ ] Endpoint `/api/v1/evaluaciones/pdi` retorna listado paginado con filtros funcionales
- [ ] Filtro por area_id funciona correctamente
- [ ] Filtro por estado funciona correctamente
- [ ] Filtro por rango de fechas funciona correctamente
- [ ] Búsqueda parcial por nombre de empleado funciona
- [ ] Endpoint `/api/v1/evaluaciones/pdi/resumen` retorna KPIs correctos
- [ ] Acciones vencidas se calculan correctamente (fecha_fin pasada + estado activo)
- [ ] RH ve todos los PDIs, gerente solo los de su área
- [ ] Frontend muestra 4 KPI cards con datos reales
- [ ] Frontend muestra tabla con columnas correctas y datos
- [ ] Filtros en frontend disparan re-fetch con parámetros correctos
- [ ] Paginación funcional en frontend

### Fase 2
- [ ] Endpoint de progreso-equipo retorna datos correctos por empleado
- [ ] Barra de progreso muestra porcentaje correcto (completadas/total)
- [ ] Toggle entre vista "acciones" y "por empleado" funciona
- [ ] Cambio rápido de estado funciona (PATCH)
- [ ] Acciones vencidas tienen indicador visual diferenciado
- [ ] Click en empleado navega a la evaluación individual

## Files to Create/Modify

### Backend
- `app/api/v1/evaluaciones/router.py` — Nuevos endpoints PDI consolidados
- `app/services/pdi_service.py` — Métodos para listado, resumen, progreso-equipo
- `app/repositories/pdi_repository.py` — Queries con filtros, agregaciones
- `app/schemas/evaluaciones.py` — Schemas para listado PDI consolidado, KPIs, progreso

### Frontend
- `frontend/src/pages/gestionPdi.ts` — Nueva página completa
- `frontend/src/api/evaluaciones.ts` — Nuevas funciones API para endpoints consolidados
- `frontend/src/shellRouter.ts` — Registrar nueva ruta
