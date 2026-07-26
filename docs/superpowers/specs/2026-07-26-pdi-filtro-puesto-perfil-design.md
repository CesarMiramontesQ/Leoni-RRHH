# Gestión PDI — filtro por perfil de puesto

**Fecha:** 2026-07-26  
**Estado:** aprobado  
**Alcance:** query `puesto_perfil_id` en endpoints PDI + select en filtros globales UI.

## Decisión

Filtrar por **perfil de puesto Talento** (`levelup_puestos_perfil`) vía asignación activa en `levelup_perfil_funciones` (`activo=true`). No usar `empleados.puesto_id` (Bono).

## Backend

- Param opcional `puesto_perfil_id` en: listado consolidado, progreso-equipo, equipo-resumen, heatmap, timeline, kpis-avanzados, export.
- Join empleado → PerfilFunciones activo → `puesto_perfil_id`.
- Endpoint u opciones para el select: perfiles activos (`id`, `nombre`), opcionalmente acotados por `area_id` del perfil.
- Rellenar `puesto_nombre` en `PDIGestionItem` desde el perfil asignado (hoy siempre null).

## Frontend

- Select **Puesto** junto a **Área** en filtros globales de `#/pdi-gestion`.
- Al cambiar área, invalidar puesto si no pertenece.
- Propagar `puesto_perfil_id` en las mismas llamadas que `area_id`.
- Actualizar `frontend/src/api/evaluaciones.ts` y `openapi.yaml`.

## Fuera de alcance

- Filtro por puesto nómina Bono.
- Wizard / deep-link por puesto.
