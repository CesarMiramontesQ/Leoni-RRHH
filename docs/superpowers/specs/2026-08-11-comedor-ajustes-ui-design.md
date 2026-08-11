# Diseño: UI Ajustes Comedor (alineación Industrial Precision)

**Fecha:** 2026-08-11  
**Rama:** `feat/cm/comedor-ajustes-ui`  
**Estado:** implementado en `feat/cm/comedor-ajustes-ui`

## 1. Objetivo

Rediseñar el frontend de **Ajustes Comedor** (`#/comedor/ajustes`) para alinearlo con el design system de la plataforma (Industrial Precision / `design.md`) y con el lenguaje visual de otras pantallas de Ajustes (Nóminas, Puestos), **sin cambiar lógica de negocio ni contratos de API**.

## 2. Decisiones de producto

| Tema | Decisión |
|------|----------|
| Alcance | Rediseño de layout interno (opción C → B) |
| Navegación | Mantener **3 tabs**: Comedores / Horarios de comida / Validación |
| Modales | Incluidos (crear + editar comedor) |
| Enfoque | Alineación “Industrial Precision” (enfoque 1) |
| Backend / OpenAPI / permisos / sync TRESS | Fuera de alcance |

## 3. Arquitectura de UI (sin cambio de capas)

Sigue el patrón actual:

- `pages/comedorAjustes.ts` — estado, listeners, carga API, guardado por fila.
- `components/comedor/comedorAjustesView.ts` — render puro.
- `components/comedor/comedorCrearComedorModal.ts` / `comedorEditarComedorModal.ts` — modales.
- Tokens: `ui/uiTokens.ts` + helpers de `components/puestos/ajustes/ajustesSectionUi.ts` (reutilizar, no duplicar).

**No** se extrae un kit genérico nuevo de Ajustes en este trabajo (YAGNI; enfoque 3 descartado).

## 4. Envoltorio de página

- Montaje con `RH_DASHBOARD_PAGE_SHELL` + contenido en `RH_LISTADO_PAGE_OUTER_GRADIENT`.
- Conservar `renderComedorBackBar()`.
- Header de página: título **Ajustes Comedor** + subtítulo corto (mismo mensaje funcional que hoy).
- Tabs vía `renderTabNav` con badges actuales:
  - Comedores → conteo de items.
  - Horarios → “N sin configurar” o conteo de jornadas.
  - Validación → sin badge.
- Sin KPI globales fuera de las tabs.
- Sin cambios de rutas (`#/comedor/ajustes`), `activeNav`, ni compuertas de acceso.

## 5. Pestaña Comedores

1. **Stat-filters** (variante C §8.6): Total / Activos / Inactivos — siguen siendo el filtro activo (`aria-pressed`). Estilos con tokens de borde/focus del design system (evitar hex sueltos cuando exista token).
2. **Section card** (`ajustesSectionCard`):
   - Icono de dominio (comedor / building).
   - Título “Comedores”, descripción corta, badge de conteo.
   - CTA primary **Agregar comedor** (`data-comedor-agregar`).
3. **Cuerpo de la card**: filter bar (búsqueda) + data grid en `RH_LISTADO_SURFACE` / headers sticky con tokens de grid (`AJUSTES_TABLE_TH` o equivalentes ya usados en Ajustes).
4. Filas: nombre, ubicación, capacidad, badge Activo/Inactivo, acción **Editar** con `BTN_SECONDARY` compacto (texto, no solo icono — mismo affordance que hoy).
5. Estados: loading skeleton, `errorState` con retry, empty state con helper de Ajustes.

**Contratos que no cambian:** `data-comedor-*`, filtros cliente, recarga tras crear/editar.

## 6. Pestaña Horarios de comida

Orden vertical:

1. Stat-filters: Jornadas / Con horario / Sin horario.
2. Filter bar: búsqueda + checkboxes “Ver catálogo completo” e “Mostrar turnos inactivos”.
3. **Section card A — Horario de comida por jornada** (bloque principal, editable):
   - Icono + título + descripción (jornada compartida por varios turnos).
   - Badge opcional con “N sin configurar”.
   - Tabla editable fila a fila (§8.18): inputs time, duración en vivo, “Sin guardar”, Guardar por fila.
4. **Section card B — Turnos y su ciclo** (bloque secundario, solo lectura):
   - Misma card pattern; expandir ciclo / link “Configurar” que hace scroll+focus a la fila de jornada.

**Reglas de comportamiento obligatorias (no tocar):**

1. Borradores en `state.turnos.borradores`.
2. Guardar actualiza solo la fila (no repinta toda la tabla).
3. Marca “Sin guardar” en el handler de `input`.
4. Ventanas que cruzan medianoche siguen siendo válidas (`inicio === fin` es el único rechazo de duración).

## 7. Pestaña Validación

1. Section card **Consultar ventana**: empleado + fecha + botón Consultar (`FIELD_*`, `BTN_PRIMARY`).
2. Card de resultado aparte:
   - Hero: rango de comida o badges Descanso / Sin ventana.
   - Grid de metadatos (empleado, fecha, turno, posición ciclo, jornada).
   - `alertWarning` / `alertInfo` / nota de sync vigentes.
3. Estado idle: empty state de Ajustes (no párrafo suelto).
4. Loading / error: skeleton y `errorState` con reintento vía `data-validacion-consultar`.

Sin cambios al endpoint `getComedorVentanaComida` ni al mapeo de `motivo_sin_ventana`.

## 8. Modales crear / editar comedor

- Misma API y mismos campos (nombre, ubicación, capacidad, activo).
- UI alineada a tokens:
  - `MODAL_OVERLAY` + `MODAL_PANEL` (o aliases `AJUSTES_MODAL_*`).
  - Labels / `FIELD_INPUT` / checkbox con focus ring de accent.
  - Footer: cancelar (`BTN_GHOST` o secondary) + submit (`BTN_PRIMARY`).
- Conservar ids/`data-*` de cerrar, cancelar y submit para no romper listeners.
- Toasts y callbacks `onCreated` / `onUpdated` sin cambio.

## 9. Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `frontend/src/pages/comedorAjustes.ts` | Shell/gradiente en `mainHtml`; mínimos ajustes de clases dinámicas si hace falta |
| `frontend/src/components/comedor/comedorAjustesView.ts` | Render: section cards, tokens, empty states, jerarquía Horarios |
| `frontend/src/components/comedor/comedorCrearComedorModal.ts` | Tokens de modal/campos/botones |
| `frontend/src/components/comedor/comedorEditarComedorModal.ts` | Igual que crear |
| `frontend/src/components/comedor/comedorAjustesView.test.ts` | Actualizar asserts de markup si cambian clases/estructura |
| Tests de modales (si existen) | Actualizar selectores solo si el markup de tokens lo exige |

Posible reuso (import, sin mover archivos): `ajustesSectionCard`, `ajustesCountBadge`, `ajustesEmptyState`, `AJUSTES_TABLE_*` desde `puestos/ajustes/ajustesSectionUi.ts`.

## 10. Fuera de alcance

- Backend, migraciones, OpenAPI.
- Cambiar tabs por secciones apiladas o hub.
- Extraer kit compartido de Ajustes a un módulo genérico.
- Cambiar lógica de filtrado, sync, o resolución de ventana de comida.
- Redesign del hub de comedor u otras pantallas del módulo.

## 11. Criterios de éxito

- La pantalla se percibe del mismo “idioma” que Ajustes Nóminas/Puestos (shell, cards, tablas, modales).
- Las 3 tabs y flujos CRUD/consulta siguen funcionando igual.
- Editar jornadas: borradores, “Sin guardar” y guardado por fila no regresionan.
- Tests unitarios del view (y modales si aplica) en verde.
- Sin hex/clases ad-hoc nuevas cuando ya exista token en `uiTokens` / `ajustesSectionUi`.

## 12. Verificación sugerida

```bash
docker-compose exec frontend npm run test -- comedorAjustes
# o el patrón de test que cubra comedorAjustesView + modales
```

Manual: abrir `#/comedor/ajustes`, recorrer las 3 tabs, crear/editar comedor, guardar una jornada, expandir un turno y consultar validación.
