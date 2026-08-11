# Ajustes Comedor UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear la UI de Ajustes Comedor al design system Industrial Precision (shell, section cards, tokens, modales) sin cambiar lógica de negocio ni API.

**Architecture:** Render puro en `comedorAjustesView.ts`; montaje/listeners en `pages/comedorAjustes.ts`; modales creados/editar con tokens `MODAL_*`/`FIELD_*`/`BTN_*`. Reutilizar `ajustesSectionCard` / helpers de `puestos/ajustes/ajustesSectionUi.ts`.

**Tech Stack:** TypeScript vanilla (HTML strings) · Vite · Vitest · Tailwind · tokens en `uiTokens.ts`.

**Spec:** `docs/superpowers/specs/2026-08-11-comedor-ajustes-ui-design.md`

## Global Constraints

- Rama: `feat/cm/comedor-ajustes-ui`. Nunca commit a `main`.
- Sin cambios de backend, OpenAPI, permisos ni sync TRESS.
- Conservar `data-*`, borradores, guardado por fila (§8.18) y ventanas que cruzan medianoche.
- Reusar tokens/helpers existentes; no inventar kit genérico nuevo de Ajustes.
- Commits solo si el usuario lo pide. Tests: `docker-compose exec frontend npm run test -- comedorAjustes`.

## File map

| File | Role |
|------|------|
| `frontend/src/pages/comedorAjustes.ts` | Shell + gradient wrapper |
| `frontend/src/components/comedor/comedorAjustesView.ts` | Page/tabs/panels markup |
| `frontend/src/components/comedor/comedorCrearComedorModal.ts` | Modal alta |
| `frontend/src/components/comedor/comedorEditarComedorModal.ts` | Modal edición |
| `frontend/src/components/comedor/comedorAjustesView.test.ts` | Asserts de markup |

---

### Task 1: Shell de página

**Files:**
- Modify: `frontend/src/pages/comedorAjustes.ts` (`mountAppShell` / `mainHtml`)

- [ ] **Step 1:** Envolver `mainHtml` con `RH_DASHBOARD_PAGE_SHELL` y contenido en `RH_LISTADO_PAGE_OUTER_GRADIENT`; conservar back bar y hosts de modales.

- [ ] **Step 2:** Verificar a ojo / grep que imports de tokens están presentes.

---

### Task 2: View — page header, Comedores, Horarios, Validación

**Files:**
- Modify: `frontend/src/components/comedor/comedorAjustesView.ts`
- Modify: `frontend/src/components/comedor/comedorAjustesView.test.ts`

- [ ] **Step 1:** Ampliar tests: section cards (`aria-labelledby` / títulos), empty de validación, badge en card de jornadas si aplica.

- [ ] **Step 2:** Implementar:
  - Imports de `ajustesSectionCard`, `ajustesCountBadge`, `ajustesEmptyState`, `AJUSTES_TABLE_*` (si aplica), `pageHeading`, `FIELD_INPUT`, `FORM_LABEL`.
  - Iconos locales SVG para comedores / jornadas / turnos / validación.
  - Comedores: stats + section card con CTA + tabla.
  - Horarios: stats + filtros + dos section cards (jornadas editable, turnos lectura).
  - Validación: section card form + resultado / empty state.
  - Tokens en TH/TD/inputs/stat cards (focus accent).

- [ ] **Step 3:** `docker-compose exec frontend npm run test -- comedorAjustes` → PASS.

---

### Task 3: Modales crear / editar

**Files:**
- Modify: `frontend/src/components/comedor/comedorCrearComedorModal.ts`
- Modify: `frontend/src/components/comedor/comedorEditarComedorModal.ts`

- [ ] **Step 1:** Sustituir clases ad-hoc por `MODAL_OVERLAY` (con `hidden`/`z-[90]` al abrir como hoy), `MODAL_PANEL max-w-md`, `FORM_LABEL`, `FIELD_INPUT`, `BTN_GHOST`/`BTN_PRIMARY`. Conservar ids y `data-*`.

- [ ] **Step 2:** Smoke: open/close sigue toggling `hidden`/`flex`.

---

### Task 4: Verificación final

- [ ] **Step 1:** Tests `comedorAjustes` en verde.
- [ ] **Step 2:** Resumen de archivos tocados y cómo validar en UI (`#/comedor/ajustes`).
