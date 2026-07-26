# Puente Cobertura → PDI (riesgo → acción)

**Fecha:** 2026-07-26  
**Estado:** implementado

## Comportamiento

Desde `#/operaciones` (habilidades en riesgo):

- **Asignar PDI** → `#/pdi-gestion?wizard=1&empleado_id&competencia_id&area_id&prioridad=alta&accion=…`
- **Ver evaluación** → `#/evaluaciones/empleado/{id}`
- Sin candidatos: enlace a Gestión PDI del área

En `#/pdi-gestion`, al montar con `wizard=1` + `empleado_id`, abre el modal precargado y limpia esos params del hash (conserva `area_id`).

## Archivos

- `frontend/src/pages/operaciones.ts`
- `frontend/src/pages/gestionPdi.ts`
- `frontend/src/utils/hashQuery.ts` (+ tests)
