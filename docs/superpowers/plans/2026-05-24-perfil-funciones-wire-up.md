# Plan: Perfil de Funciones — Wire-up a datos reales

> Fecha: 2026-05-24
> Branch: `claude/feature/perfil-funciones`
> Objetivo: Eliminar todo hardcoded y conectar con API real

---

## Estado actual

- Backend 100% funcional (17 endpoints, 6 tablas, datos reales creados)
- Frontend `puestoEmpleados.ts` — conectado a API real ✓
- Frontend `perfilPuestoDetalle.ts` — **100% hardcoded** (datos fake)
- Frontend `puestos.ts` (tarjetas) — conectado a API real ✓

---

## Pasos (en orden de ejecución)

### 1. Enrich: nombre del empleado en asignaciones

**Problema:** `GET /api/v1/perfiles/{id}/asignaciones` devuelve solo `empleado_id`. La tabla muestra IDs numéricos sin contexto.

**Solución:**
- Modificar `PerfilFuncionesRepository.listar_por_perfil()` para hacer join con `empleados`
- Agregar `nombre_completo` (o `nombre` + `apellido_paterno`) al response schema
- Actualizar `PerfilFuncionesResponse` en `app/schemas/perfil_funciones.py`
- Actualizar `puestoEmpleados.ts` para mostrar el nombre

**Archivos:**
- `app/repositories/perfil_funciones_repository.py`
- `app/schemas/perfil_funciones.py`
- `frontend/src/pages/puestoEmpleados.ts`

---

### 2. Wire-up: `perfilPuestoDetalle.ts` a datos reales

**Problema:** Toda la página de detalle del puesto usa constantes hardcoded (`PERFIL`, `CAPACIDADES`, `HABILIDADES`, etc.)

**Solución:** Reemplazar con fetch a endpoints existentes:

| Sección | Endpoint | Datos |
|---------|----------|-------|
| Info general | `GET /api/v1/puestos/{id}` | nombre, area, division, reporta_a, etc. |
| Tareas | `GET /api/v1/perfiles/{id}/tareas` | lista ordenada de funciones |
| Cualificaciones | `GET /api/v1/perfiles/{id}/cualificaciones` | por tipo (estudios, experiencia...) |
| Competencias | `GET /api/v1/perfiles/{id}/competencias` | por categoría (informática, idiomas...) |
| Resumen empleados | `GET /api/v1/perfiles/{id}/asignaciones` | conteo + lista breve |

**Archivos:**
- `frontend/src/pages/perfilPuestoDetalle.ts` (rewrite completo)

**Notas:**
- Eliminar todas las constantes fake (PERFIL, CAPACIDADES, HABILIDADES, COMPETENCIAS, CURSOS, OPLS, EVIDENCIAS)
- Si un perfil no tiene datos en alguna sección, mostrar empty state (no ocultar)
- Mantener layout/diseño actual, solo cambiar la fuente de datos

---

### 3. Fix: validación en PUT evaluaciones

**Problema:** PUT `/api/v1/perfiles/{id}/asignaciones/{asig_id}` con `cualificacion_id` o `competencia_requerida_id` inexistente devuelve 500 (FK constraint violation).

**Solución:**
- En `PerfilFuncionesService.actualizar_evaluaciones()`, verificar que cada ID referenciado existe antes del upsert
- Retornar 422 con detalle de qué IDs son inválidos

**Archivos:**
- `app/services/perfil_funciones_service.py`

---

### 4. Migrar datos JSONB existentes

**Problema:** `puestos_perfil` tiene 3 campos JSONB con datos legacy:
- `competencias_tecnicas` (JSON array)
- `habilidades_blandas` (JSON array)
- `maquinas_herramientas` (JSON array)

**Solución:**
- Script de migración (Alembic data migration) que:
  1. Lee JSONB de cada `puestos_perfil` existente
  2. Crea registros en `perfil_competencias_requeridas` con categoría apropiada:
     - `competencias_tecnicas` → categoría `profesional`
     - `habilidades_blandas` → categoría `social`
     - `maquinas_herramientas` → categoría `profesional` (subcategoría equipos)
  3. Marca los registros migrados

**Archivos:**
- Nueva migración Alembic (data migration)

---

### 5. Eliminar campos JSONB

**Problema:** Una vez migrados los datos, los campos JSONB son redundantes y pueden causar confusión.

**Solución:**
- Nueva migración Alembic: `op.drop_column('puestos_perfil', 'competencias_tecnicas')` etc.
- Actualizar modelo `PuestoPerfil` en `app/models/talento.py` (quitar las 3 columnas)
- Verificar que ningún endpoint/service lee estos campos

**Archivos:**
- Nueva migración Alembic
- `app/models/talento.py`
- Verificar `app/schemas/` y `app/services/` que no referencien estos campos

**Prerequisito:** Paso 4 completado y validado.

---

## Criterios de éxito

- [ ] Tabla de empleados muestra nombre completo (no solo ID)
- [ ] Detalle del puesto carga datos desde API (zero hardcoded)
- [ ] PUT evaluaciones con IDs inválidos → 422 con mensaje claro
- [ ] Datos JSONB migrados a tablas normalizadas
- [ ] Campos JSONB eliminados del modelo
- [ ] Toda la UI funciona end-to-end con datos reales de los 3 perfiles creados (IDs 18, 19, 20)

---

## Estimación

| Paso | Esfuerzo |
|------|----------|
| 1. Enrich nombres | Pequeño (backend + frontend) |
| 2. Wire-up detalle | Grande (rewrite de página completa) |
| 3. Fix validación | Pequeño (service layer) |
| 4. Migrar JSONB | Medio (data migration + QA) |
| 5. Drop JSONB | Pequeño (migration + cleanup) |
