# Fix PUT Evaluaciones Validation

> Feature slug: `fix-put-evaluaciones-validation`
> Branch: `claude/feature/fix-put-evaluaciones-validation`
> Date: 2026-05-25
> Status: Pending

---

## Problem Statement

El endpoint `PUT /api/v1/perfiles/{perfil_id}/asignaciones/{asignacion_id}` (actualizar evaluaciones) devuelve un error 500 cuando se envían `cualificacion_id` o `competencia_requerida_id` que no existen en la base de datos. El error ocurre porque la FK constraint falla al momento del INSERT/UPDATE, pero no hay validación previa que atrape el problema y devuelva un 422 con un mensaje claro al usuario.

## Goals

- Validar que los IDs de `cualificacion_id` y `competencia_requerida_id` existan antes de intentar el upsert
- Devolver HTTP 422 con un mensaje descriptivo cuando se referencien entidades inexistentes
- Mantener el comportamiento actual (upsert) para IDs válidos sin regresiones

## Non-Goals

- Cambiar la lógica de upsert (create-or-update) existente
- Agregar validaciones a otros endpoints de perfil funciones
- Modificar los schemas de request/response

## User Stories

1. **Como RH**, quiero recibir un error claro (422) cuando intento evaluar a un empleado con un `cualificacion_id` que no pertenece al perfil, para poder corregir el error sin ver un "Internal Server Error".
2. **Como RH**, quiero recibir un error claro (422) cuando intento evaluar a un empleado con un `competencia_requerida_id` que no pertenece al perfil, para saber exactamente qué ID es inválido.
3. **Como desarrollador**, quiero que los 2 tests que actualmente fallan por el 500 pasen con un 422, completando la suite a 56/56.

## Acceptance Criteria

- [ ] PUT evaluaciones con `cualificacion_id` inexistente devuelve 422 con mensaje indicando el ID inválido
- [ ] PUT evaluaciones con `competencia_requerida_id` inexistente devuelve 422 con mensaje indicando el ID inválido
- [ ] PUT evaluaciones con IDs válidos sigue funcionando como antes (upsert exitoso)
- [ ] La validación verifica que los IDs pertenezcan al perfil del puesto (no solo que existan en la tabla)
- [ ] Tests existentes siguen pasando (sin regresiones)
- [ ] Los 2 tests previamente fallidos ahora pasan

## Decisions

1. La validación se hace en la capa de servicio (no en el router) para mantener la separación de responsabilidades.
2. Se valida que los IDs pertenezcan al `puesto_perfil_id` de la asignación, no solo que existan globalmente — un `cualificacion_id` de otro perfil también es inválido.
3. Se usa HTTP 422 (Unprocessable Entity) en vez de 400, ya que el formato del request es correcto pero los datos referenciados no son procesables.

## Scope

### Archivos a modificar

- `app/services/perfil_funciones_service.py` — Agregar validación de IDs antes del upsert
- `tests/` — Ajustar o agregar tests que verifiquen el 422

### Archivos de referencia (solo lectura)

- `app/api/v1/perfil_funciones/router.py` — Endpoint PUT evaluaciones
- `app/repositories/perfil_funciones_repository.py` — Queries existentes
- `app/schemas/perfil_funciones.py` — Schemas de request
- `app/models/talento.py` — Modelos y relaciones
