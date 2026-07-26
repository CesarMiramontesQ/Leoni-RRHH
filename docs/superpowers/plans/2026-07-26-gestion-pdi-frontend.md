# Gestión PDI Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Alinear `#/pdi-gestion` al design system y pulir UX sin cambiar lógica de negocio.

**Architecture:** Refactor visual in-place en `frontend/src/pages/gestionPdi.ts` reusando `uiTokens` + `talento/pageKit`.

**Tech Stack:** TypeScript vanilla, Vite, tokens Tailwind del DS.

---

### Task 1: Shell, header, KPIs, tabs, acciones

**Files:** `frontend/src/pages/gestionPdi.ts`

- Importar tokens/kit, montar shell degradado, eyebrow + heading, KPIs kit, `renderTabNav`, botones DS.
- Adaptar handler de tabs a `data-tab`.

### Task 2: Filtros, tablas, estados loading/vacío

- Filtros con `FORM_*` / `SELECT_CHEVRON`.
- Tablas con `RH_LISTADO_SURFACE` + `RH_TABLE_HEAD`.
- Badges semánticos; `escapeHtml` en textos de datos.
- Skeleton / empty states.

### Task 3: Heatmap, timeline, equipo expandido, wizard

- Superficies y tipografía DS; modal `MODAL_*`.
- Feedback con `alertSuccess` / `alertError`.
- Verificar build frontend.
