# Enrich: Nombre del Empleado en Asignaciones

> Feature slug: `enrich-employee-names`
> Branch: `claude/feature/enrich-employee-names`
> Date: 2026-05-24
> Status: Not Started

---

## Problem Statement

La tabla de empleados asignados a un perfil de puesto (`puestoEmpleados.ts`) actualmente muestra solo el `empleado_id` numérico. Esto es inútil para el usuario final — no sabe quién es el empleado 4523. Necesita ver el nombre completo para que la vista tenga valor operativo.

## Goals

- Mostrar nombre completo del empleado en la tabla de asignaciones
- Enriquecer el response del endpoint `GET /api/v1/perfiles/{id}/asignaciones` con datos del empleado
- Mantener backwards compatibility del endpoint (agregar campos, no romper existentes)

## Non-Goals

- Cambiar el diseño o layout de la tabla de empleados
- Agregar búsqueda o filtrado de empleados (futura fase)
- Mostrar foto o datos adicionales del empleado (futura fase)
- Modificar el endpoint de detalle individual de asignación

## User Stories

1. **Como RH**, quiero ver el nombre completo del empleado en la tabla de asignaciones para identificar rápidamente a cada persona sin tener que buscar por número.
2. **Como supervisor**, quiero ver el número de empleado junto al nombre para poder referenciarlo en sistemas internos.

## Decisions

1. El JOIN se hace en el repository, no en el service — es una consulta de lectura simple.
2. Se agrega `nombre_completo` como campo calculado (`nombre` + `apellido_paterno`) al response schema.
3. Se mantiene `empleado_id` en el response (no se elimina).
4. Si el empleado no existe en la tabla `empleados` (dato huérfano), se muestra el ID con indicador de "no encontrado".

## Acceptance Criteria

- [ ] `GET /api/v1/perfiles/{id}/asignaciones` incluye `nombre_completo` y `no_empleado` en cada item
- [ ] La tabla en `puestoEmpleados.ts` muestra nombre completo en lugar de solo el ID
- [ ] Si un empleado referenciado no existe, la fila muestra el ID con fallback graceful
- [ ] Los 15 empleados asignados existentes (perfiles 18, 19, 20) muestran nombre correctamente

## Scope

### Backend

- `app/repositories/perfil_funciones_repository.py` — Modificar `listar_por_perfil()` para JOIN con tabla `empleados`
- `app/schemas/perfil_funciones.py` — Agregar `nombre_completo` y `no_empleado` al schema de response de asignaciones

### Frontend

- `frontend/src/pages/puestoEmpleados.ts` — Mostrar nombre completo en la columna del empleado
