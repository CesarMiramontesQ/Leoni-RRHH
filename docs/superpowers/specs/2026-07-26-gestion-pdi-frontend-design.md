# Gestión PDI — mejora frontend (opción B)

**Fecha:** 2026-07-26  
**Estado:** aprobado  
**Alcance:** UI/UX de `#/pdi-gestion` sin cambios de API ni flujos de negocio.

## Objetivo

Alinear Gestión PDI al design system (Industrial Precision) y al patrón visual del hub Talento / Evaluación 360, puliendo tabs, estados vacíos/loading, filtros y wizard.

## Decisiones

- Shell: `RH_DASHBOARD_PAGE_SHELL` + `RH_LISTADO_PAGE_OUTER_GRADIENT`, `mainClass: py-0`.
- Header: eyebrow `Desarrollo` + `pageHeading`; sin breadcrumb a Evaluaciones.
- KPIs filtrables (fila 1) y métricas avanzadas (fila 2) con `rh-dash-kpi-card` / `talentoKpi*`.
- Acciones: `BTN_PRIMARY` / `BTN_SECONDARY`.
- Vistas: `renderTabNav` (Acciones, Por empleado, Resumen equipo, Mapa de calor, Timeline).
- Tablas: `RH_LISTADO_SURFACE` + `RH_TABLE_HEAD` (sin thead navy).
- Filtros/wizard: tokens `FORM_*`, `FIELD_*`, `SELECT_CHEVRON`, `MODAL_*`.
- Loading/vacío/error: `skeletonBlock` / empty inline / `errorState` si aplica.
- Feedback: banners `alertSuccess` / `alertError` en lugar de `alert()` nativo donde sea práctico.

## Fuera de alcance

- Cambios de backend, permisos o endpoints.
- Reordenar/eliminar pestañas o rediseñar detalle `#/evaluaciones/empleado/...`.
- Extraer submódulos de archivo (refactor estructural).

## Criterio de éxito

La página se ve y se siente como Metas / Operaciones / Evaluación 360; mismos flujos (filtros KPI, cambio de estado, wizard, export, notificar, expandir equipo).
