/**
 * Modal para editar tareas de un perfil de puesto (solo RH).
 * Permite buscar y asignar tareas del catálogo, crear nuevas inline y eliminar.
 */

import {
  getPerfilTareas,
  getDedicacionPerfil,
  createPerfilTarea,
  updatePerfilTarea,
  deletePerfilTarea,
  type DedicacionAlcance,
  type FrecuenciaTarea,
  type PerfilTarea,
  type PrioridadTarea,
} from "../../api/puestos.ts";
import { getCategoriasTarea } from "../../api/categoriasTarea.ts";
import type { CategoriaTarea } from "../../dashboard/categoriasTarea/types.ts";
import {
  dedicacionResumen,
  FRECUENCIAS,
  PRIORIDADES,
} from "../../talento/tareaAtributosUi.ts";
import {
  getTareasCatalogo,
  createTareaCatalogo,
  updateTareaCatalogo,
  extractCategoriasFromCatalogo,
  isTareaCatalogoDuplicada,
  MSG_TAREA_DUPLICADA,
  type TareaCatalogo,
  type TareaCatalogoFetchError,
} from "../../api/tareasCatalogo.ts";
import { tareaTituloSubtitulo } from "./perfilTareaDisplay.ts";
import { compararCareerLevels } from "../../talento/clasificacionPuestoUi.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import {
  MODAL_OVERLAY,
  MODAL_PANEL,
  FIELD_INPUT,
  FIELD_FOCUS,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_FOCUS_RING,
  SELECT_CHEVRON,
} from "../../ui/uiTokens.ts";

export type EditarTareasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarTareasModalOptions = {
  perfilId: number;
  grados?: { id: number; nombre: string; orden: number | null }[];
  onSuccess: () => void;
};

type TipoFilter = "" | "principal" | "complemento";
/** "" = general (grado_id null); number as string = grado id */
type AlcanceValue = "" | string;

const SEARCH_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

// ── Iconos (Heroicons, currentColor) ─────────────────────────────────────────
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clip-rule="evenodd"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M2.695 14.763l-1.262 3.154a.75.75 0 0 0 .966.966l3.154-1.262a4.5 4.5 0 0 0 1.897-1.13L16.5 6.5a2.121 2.121 0 0 0-3-3L5.49 13.09a4.5 4.5 0 0 0-1.795 1.673ZM12.75 4.81l1.44 1.44-1.06 1.061-1.44-1.44 1.06-1.06Z"/></svg>`;

/** Chip de tipo unificado: Principal (blue) / Complementaria (amber). */
function tipoChip(esComplemento: boolean): string {
  if (esComplemento) {
    return `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>Complementaria</span>`;
  }
  return `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900"><span class="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>Principal</span>`;
}

function alcanceChip(tarea: PerfilTarea): string {
  if (tarea.es_general || tarea.grado_id == null) {
    return `<span class="inline-flex shrink-0 items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-800">General</span>`;
  }
  const nombre = (tarea.grado_nombre ?? "").trim() || `Grado #${tarea.grado_id}`;
  return `<span class="inline-flex max-w-[7rem] truncate shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700" title="${escapeHtml(nombre)}">${escapeHtml(nombre)}</span>`;
}

/** Chip neutral de categoría. */
function categoriaChip(categoria: string | undefined): string {
  if (!categoria?.trim()) return "";
  return `<span class="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600" title="${escapeHtml(categoria.trim())}">${escapeHtml(categoria.trim())}</span>`;
}

function mergeCategoria(opciones: string[], categoria: string | undefined): string[] {
  const label = categoria?.trim();
  if (!label) return opciones;
  const key = label.toLowerCase();
  if (opciones.some((c) => c.toLowerCase() === key)) return opciones;
  return [...opciones, label].sort((a, b) => a.localeCompare(b, "es"));
}

function overlayHtml(): string {
  return `
    <div
      id="editar-tareas-overlay"
      class="${MODAL_OVERLAY} hidden"
      role="presentation"
    >
      <div
        class="${MODAL_PANEL} max-w-lg flex max-h-[min(90vh,760px)] flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-tareas-title"
      >
        <header class="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 pb-4 pt-5">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Perfil de puesto</p>
            <h2 id="editar-tareas-title" class="mt-0.5 text-lg font-semibold text-text-primary">Editar tareas</h2>
            <p class="mt-1 text-sm text-text-muted">Asigna y clasifica las tareas del perfil.</p>
          </div>
          <button
            type="button"
            data-close-tareas-modal
            class="-mr-1.5 shrink-0 rounded-lg p-1.5 text-text-muted transition hover:bg-slate-100 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
            aria-label="Cerrar"
          >
            ${ICON_CLOSE}
          </button>
        </header>
        <div id="editar-tareas-body" class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderTareasList(tareas: PerfilTarea[], editingId: number | null): string {
  const header = `
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Tareas del perfil</p>
      <span class="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">${tareas.length}</span>
    </div>`;

  if (tareas.length === 0) {
    return `
    <section class="space-y-2">
      ${header}
      <div class="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center">
        <p class="text-sm font-semibold text-text-primary">Sin tareas asignadas</p>
        <p class="mx-auto mt-1 max-w-xs text-xs text-text-muted">Busca en el catálogo o crea una nueva tarea para agregarla a este perfil.</p>
      </div>
    </section>`;
  }

  return `
    <section class="space-y-2">
      ${header}
      <div id="tareas-list" class="max-h-64 space-y-1 overflow-y-auto pr-0.5">
        ${tareas.map((t, i) => {
          if (editingId === t.id) {
            const catalogLinked = t.tarea_catalogo_id != null;
            const nombreVal = catalogLinked ? (t.tarea_catalogo_nombre ?? t.descripcion) : "";
            return `
          <div class="rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3 space-y-3" data-edit-panel="${t.id}">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Editar tarea</p>
            <div id="tarea-edit-error-${t.id}" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert"></div>
            ${catalogLinked ? `
            <div>
              <label for="tarea-edit-nombre-${t.id}" class="${RH_LISTADO_LABEL}">Nombre</label>
              <input id="tarea-edit-nombre-${t.id}" type="text" required value="${escapeHtml(nombreVal)}"
                class="${FIELD_INPUT}" placeholder="Nombre corto" />
            </div>` : ""}
            <div>
              <label for="tarea-edit-desc-${t.id}" class="${RH_LISTADO_LABEL}">Descripción</label>
              <textarea id="tarea-edit-desc-${t.id}" required rows="3"
                class="${FIELD_INPUT} min-h-[4.5rem] resize-y"
                placeholder="Descripción de la tarea">${escapeHtml(t.descripcion)}</textarea>
            </div>
            ${catalogLinked ? `<p class="text-xs text-text-muted">Los cambios se aplican al catálogo y a todos los perfiles que usan esta tarea.</p>` : ""}
            <div class="flex justify-end gap-2">
              <button type="button" data-cancel-edit="${t.id}" class="${RH_LISTADO_BTN_GHOST} text-xs">Cancelar</button>
              <button type="button" data-save-edit="${t.id}" class="${RH_LISTADO_BTN_PRIMARY} text-xs">Guardar</button>
            </div>
          </div>`;
          }

          const { titulo, subtitulo } = tareaTituloSubtitulo(t);
          const subtituloHtml = subtitulo
            ? `<span class="block truncate text-[11px] text-text-muted" title="${escapeHtml(subtitulo)}">${escapeHtml(subtitulo)}</span>`
            : "";

          return `
          <div class="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-active-tint"
               data-tarea-id="${t.id}">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 font-mono text-[10px] font-bold tabular-nums text-leoni-blue" data-orden-badge>${i + 1}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-text-primary" title="${escapeHtml(titulo)}">${escapeHtml(titulo)}</span>
              ${subtituloHtml}
            </span>
            ${tipoChip(t.es_complemento)}
            ${alcanceChip(t)}
            <button type="button" data-edit-tarea="${t.id}" class="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-leoni-blue focus-visible:opacity-100 group-hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40" title="Editar" aria-label="Editar tarea">
              ${ICON_EDIT}
            </button>
            <button type="button" data-delete-tarea="${t.id}" class="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40" title="Eliminar" aria-label="Eliminar tarea">
              ${ICON_TRASH}
            </button>
          </div>`;
        }).join("")}
      </div>
    </section>`;
}

function renderAddForm(
  showCreateNew: boolean,
  filterTipo: TipoFilter,
  filterCategoria: string,
  categorias: string[],
  grados: { id: number; nombre: string; orden: number | null }[],
  alcance: AlcanceValue,
  categoriasCatalogo: CategoriaTarea[] = [],
  resumenDedicacionHtml = "",
): string {
  const catOpts = categorias
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${filterCategoria.toLowerCase() === c.toLowerCase() ? "selected" : ""}>${escapeHtml(c)}</option>`,
    )
    .join("");
  const gradoOpts = [...grados]
    .sort(compararCareerLevels)
    .map(
      (g) =>
        `<option value="${g.id}" ${alcance === String(g.id) ? "selected" : ""}>${escapeHtml(g.nombre)}</option>`,
    )
    .join("");

  return `
    <section class="space-y-3 border-t border-slate-100 pt-5">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Agregar del catálogo</p>

      <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <div>
          <label for="tarea-alcance" class="${RH_LISTADO_LABEL}">Alcance <span class="text-red-600">*</span></label>
          <div class="grid grid-cols-1">
            <select id="tarea-alcance" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" aria-label="Alcance de la tarea">
              <option value="" ${alcance === "" ? "selected" : ""}>General</option>
              ${gradoOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
          <p class="mt-1 text-xs text-text-muted">General aplica a todo el perfil; o elige un grado concreto.</p>
        </div>

        <!-- Combobox búsqueda catálogo -->
        <div>
          <label for="tarea-search" class="${RH_LISTADO_LABEL}">Buscar en catálogo</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input
              id="tarea-search"
              type="search"
              autocomplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="false"
              aria-controls="tarea-search-listbox"
              class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}"
              placeholder="Escribe para buscar en el catálogo…"
            />
          </div>
          <p class="mt-1 text-xs text-text-muted">Escribe el nombre; si existe, selecciónala de la lista.</p>
          <div
            id="tarea-search-listbox"
            role="listbox"
            class="mt-1.5 hidden max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-[0_4px_12px_rgba(10,22,40,0.08)]"
          ></div>
        </div>

        <!-- Filtros -->
        <div class="grid grid-cols-2 gap-2">
          <div class="min-w-0">
            <label for="tarea-filter-tipo" class="${RH_LISTADO_LABEL}">Tipo</label>
            <div class="grid grid-cols-1">
              <select id="tarea-filter-tipo" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" aria-label="Filtrar por tipo">
                <option value="" ${filterTipo === "" ? "selected" : ""}>Todos</option>
                <option value="principal" ${filterTipo === "principal" ? "selected" : ""}>Principal</option>
                <option value="complemento" ${filterTipo === "complemento" ? "selected" : ""}>Complementaria</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="min-w-0">
            <label for="tarea-filter-categoria" class="${RH_LISTADO_LABEL}">Categoría</label>
            <div class="grid grid-cols-1">
              <select id="tarea-filter-categoria" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" aria-label="Filtrar por categoría">
                <option value="" ${filterCategoria === "" ? "selected" : ""}>Todas</option>
                ${catOpts}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
        </div>
      </div>

      <!-- Selected + agregar -->
      <div id="tarea-selected-row" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
        <div id="tarea-selected-info" class="flex items-center justify-between gap-2"></div>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div class="min-w-0">
            <label for="tarea-atrib-prioridad" class="${RH_LISTADO_LABEL}">Prioridad</label>
            <div class="grid grid-cols-1">
              <select id="tarea-atrib-prioridad" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                <option value="">Sin definir</option>
                ${PRIORIDADES.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="min-w-0">
            <label for="tarea-atrib-frecuencia" class="${RH_LISTADO_LABEL}">Frecuencia</label>
            <div class="grid grid-cols-1">
              <select id="tarea-atrib-frecuencia" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                <option value="">Sin definir</option>
                ${FRECUENCIAS.map((o) => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="min-w-0">
            <label for="tarea-atrib-porcentaje" class="${RH_LISTADO_LABEL}">% dedicación</label>
            <input id="tarea-atrib-porcentaje" type="number" min="0" max="100" inputmode="numeric"
              class="${FIELD_INPUT}" placeholder="Opcional" />
          </div>
        </div>
        <div class="mt-3 flex justify-end">
          <button type="button" id="tarea-submit-assign" class="${RH_LISTADO_BTN_PRIMARY} text-sm">${ICON_PLUS}<span>Agregar al perfil</span></button>
        </div>
      </div>
      ${resumenDedicacionHtml}

      <!-- Create new toggle -->
      <div>
        <button type="button" id="tarea-toggle-create" class="${RH_LISTADO_BTN_GHOST} text-xs">
          ${showCreateNew ? "Cerrar" : "＋ Crear nueva tarea"}
        </button>
      </div>

      ${showCreateNew ? `
      <div id="tarea-create-form" class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Nueva tarea en catálogo</p>
        <div id="tarea-create-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert"></div>
        <div>
          <label for="tarea-new-nombre" class="${RH_LISTADO_LABEL}">Nombre</label>
          <input id="tarea-new-nombre" type="text" required
            class="${FIELD_INPUT}"
            placeholder="Nombre corto para búsqueda" />
        </div>
        <div>
          <label for="tarea-new-descripcion" class="${RH_LISTADO_LABEL}">Descripción</label>
          <textarea id="tarea-new-descripcion" required rows="3"
            class="${FIELD_INPUT} min-h-[4.5rem] resize-y"
            placeholder="Describe la tarea con el detalle del perfil"></textarea>
        </div>
        <div>
          <label for="tarea-new-categoria" class="${RH_LISTADO_LABEL}">Categoría <span class="font-normal normal-case tracking-normal text-text-muted">(opcional)</span></label>
          <div class="grid grid-cols-1">
            <select id="tarea-new-categoria" class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
              <option value="">Sin categoría</option>
              ${categoriasCatalogo.map((c) => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
          <p class="mt-1 text-xs text-text-muted">Se administran en <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes → Tareas</a>.</p>
        </div>
        <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <input id="tarea-new-complemento" type="checkbox"
            class="mt-0.5 size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
          <span>
            <span class="block text-sm font-medium text-text-primary">Tarea complementaria</span>
            <span class="mt-0.5 block text-xs text-text-muted">Las principales definen el núcleo del perfil; las complementarias amplían funciones.</span>
          </span>
        </label>
        <div class="flex justify-end">
          <button type="button" id="tarea-create-submit" class="${RH_LISTADO_BTN_PRIMARY} text-sm">Crear y agregar</button>
        </div>
      </div>` : ""}
    </section>`;
}

export function mountEditarTareasModal(
  host: HTMLElement,
  options: EditarTareasModalOptions,
): EditarTareasModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-tareas-overlay") as HTMLElement;
  const body = host.querySelector("#editar-tareas-body") as HTMLElement;

  let loading = false;
  let showCreateNew = false;
  let selectedCatalogo: TareaCatalogo | null = null;
  let filterTipo: TipoFilter = "";
  let filterCategoria = "";
  let alcance: AlcanceValue = "";
  const gradosPerfil = [...(options.grados ?? [])].sort(compararCareerLevels);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let categoriasOpciones: string[] = [];
  let categoriasCatalogo: CategoriaTarea[] = [];
  let dedicacion: DedicacionAlcance[] = [];
  let searchResults: TareaCatalogo[] = [];
  let searchLoading = false;
  let searchError = "";
  let highlightedIndex = -1;
  let searchAbort: AbortController | null = null;
  let comboboxOpen = false;
  let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
  let assignedCatalogoIds: Set<number> = new Set();
  let tareas: PerfilTarea[] = [];
  let editingTareaId: number | null = null;

  /**
   * Resumen de carga del alcance seleccionado.
   *
   * Se muestra el del alcance en el que RH está trabajando: si eligió un global
   * level, el total de ese nivel (que incluye las generales); si no, el general.
   */
  function resumenDedicacionActual(): string {
    if (!dedicacion.length) return "";
    const gradoId = alcance ? Number(alcance) : null;
    const item = gradoId
      ? dedicacion.find((d) => d.grado_id === gradoId)
      : dedicacion.find((d) => d.es_general);
    if (!item) return "";
    const nombre = item.grado_nombre ?? undefined;
    return dedicacionResumen({
      total: item.total_porcentaje,
      sinPorcentaje: item.tareas_sin_porcentaje,
      alcance: item.es_general ? undefined : nombre,
    });
  }

  /** Atributos capturados en el bloque de asignación. */
  function leerAtributos(): {
    prioridad?: PrioridadTarea | null;
    frecuencia?: FrecuenciaTarea | null;
    porcentaje_dedicacion?: number | null;
  } {
    const sel = (id: string) =>
      (body.querySelector(`#${id}`) as HTMLSelectElement | null)?.value ?? "";
    const porcentajeRaw =
      (body.querySelector("#tarea-atrib-porcentaje") as HTMLInputElement | null)?.value ?? "";
    const porcentaje = porcentajeRaw.trim() === "" ? null : Number(porcentajeRaw);
    return {
      prioridad: (sel("tarea-atrib-prioridad") || null) as PrioridadTarea | null,
      frecuencia: (sel("tarea-atrib-frecuencia") || null) as FrecuenciaTarea | null,
      porcentaje_dedicacion:
        porcentaje != null && Number.isFinite(porcentaje) ? porcentaje : null,
    };
  }

  function close(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    searchAbort?.abort();
    searchAbort = null;
    detachClickOutside();
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function refreshList(): Promise<void> {
    try {
      searchAbort?.abort();
      searchAbort = null;
      detachClickOutside();
      comboboxOpen = false;
      searchResults = [];
      searchLoading = false;
      searchError = "";
      highlightedIndex = -1;

      // El resumen de carga y el catálogo de categorías se recargan con la lista:
      // agregar o quitar una tarea cambia el total.
      const [tareasList, dedicacionList, categoriasList] = await Promise.all([
        getPerfilTareas(options.perfilId),
        getDedicacionPerfil(options.perfilId).catch(() => [] as DedicacionAlcance[]),
        categoriasCatalogo.length
          ? Promise.resolve(categoriasCatalogo)
          : getCategoriasTarea().catch(() => [] as CategoriaTarea[]),
      ]);
      tareas = tareasList;
      dedicacion = dedicacionList;
      categoriasCatalogo = categoriasList;
      assignedCatalogoIds = new Set(
        tareas.filter(t => t.tarea_catalogo_id).map(t => t.tarea_catalogo_id as number),
      );
      selectedCatalogo = null;
      body.innerHTML =
        renderTareasList(tareas, editingTareaId) +
        renderAddForm(
          showCreateNew,
          filterTipo,
          filterCategoria,
          categoriasOpciones,
          gradosPerfil,
          alcance,
          categoriasCatalogo,
          resumenDedicacionActual(),
        );
      bindDeleteButtons();
      bindEditButtons();
      bindInteractions();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar tareas.</p>`;
    }
  }

  function bindEditButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-edit-tarea]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingTareaId = Number(btn.dataset.editTarea);
        void refreshList();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-cancel-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingTareaId = null;
        void refreshList();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-save-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tareaId = Number(btn.dataset.saveEdit);
        if (loading) return;
        const tarea = tareas.find((t) => t.id === tareaId);
        if (!tarea) return;

        const errorEl = body.querySelector(`#tarea-edit-error-${tareaId}`) as HTMLElement | null;
        const showError = (message: string) => {
          if (!errorEl) return;
          errorEl.textContent = message;
          errorEl.classList.remove("hidden");
        };

        const descripcion = (
          body.querySelector(`#tarea-edit-desc-${tareaId}`) as HTMLTextAreaElement
        )?.value.trim();
        if (!descripcion) {
          showError("Indica la descripción de la tarea.");
          return;
        }

        let nombre: string | undefined;
        if (tarea.tarea_catalogo_id) {
          nombre = (
            body.querySelector(`#tarea-edit-nombre-${tareaId}`) as HTMLInputElement
          )?.value.trim();
          if (!nombre) {
            showError("Indica el nombre de la tarea.");
            return;
          }
        }

        loading = true;
        btn.disabled = true;
        btn.textContent = "Guardando…";

        try {
          if (tarea.tarea_catalogo_id && nombre) {
            await updateTareaCatalogo(tarea.tarea_catalogo_id, { nombre, descripcion });
          } else {
            await updatePerfilTarea(options.perfilId, tareaId, { descripcion });
          }
          editingTareaId = null;
          options.onSuccess();
          await refreshList();
        } catch (err: unknown) {
          const detail = (err as TareaCatalogoFetchError)?.detail ?? "No se pudo guardar la tarea.";
          showError(detail);
        } finally {
          loading = false;
          btn.disabled = false;
          btn.textContent = "Guardar";
        }
      });
    });
  }

  function nextOrden(): number {
    return tareas.reduce((max, t) => Math.max(max, t.orden), 0) + 1;
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-tarea]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const tareaId = Number(btn.dataset.deleteTarea);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilTarea(options.perfilId, tareaId);
          options.onSuccess();
          await refreshList();
        } catch {
          // silently fail
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindInteractions(): void {
    bindSearch();
    bindAssignButton();
    bindCreateToggle();
    bindCreateSubmit();
    bindAlcanceSelect();
  }

  function resolveGradoId(): number | null {
    if (!alcance) return null;
    const id = Number(alcance);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  function bindAlcanceSelect(): void {
    const sel = body.querySelector("#tarea-alcance") as HTMLSelectElement | null;
    sel?.addEventListener("change", () => {
      alcance = sel.value as AlcanceValue;
    });
  }

  function getSearchInput(): HTMLInputElement | null {
    return body.querySelector("#tarea-search");
  }

  function getSearchListbox(): HTMLElement | null {
    return body.querySelector("#tarea-search-listbox");
  }

  function detachClickOutside(): void {
    if (clickOutsideHandler) {
      document.removeEventListener("mousedown", clickOutsideHandler);
      clickOutsideHandler = null;
    }
  }

  function setComboboxExpanded(expanded: boolean): void {
    comboboxOpen = expanded;
    const input = getSearchInput();
    if (input) input.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function hideSearchDropdown(): void {
    const listbox = getSearchListbox();
    listbox?.classList.add("hidden");
    highlightedIndex = -1;
    setComboboxExpanded(false);
    detachClickOutside();
  }

  function applyTipoFilter(items: TareaCatalogo[]): TareaCatalogo[] {
    return items.filter((t) => {
      if (assignedCatalogoIds.has(t.id)) return false;
      if (filterTipo === "principal" && t.es_complemento) return false;
      if (filterTipo === "complemento" && !t.es_complemento) return false;
      return true;
    });
  }

  function renderSearchDropdown(): void {
    const listbox = getSearchListbox();
    if (!listbox) return;

    if (searchLoading) {
      listbox.innerHTML = `<p class="px-2 py-3 text-center text-xs text-text-muted">Buscando…</p>`;
      listbox.classList.remove("hidden");
      setComboboxExpanded(true);
      return;
    }

    if (searchError) {
      listbox.innerHTML = `<p class="px-2 py-3 text-center text-xs text-red-600">${escapeHtml(searchError)}</p>`;
      listbox.classList.remove("hidden");
      setComboboxExpanded(true);
      return;
    }

    const filtered = applyTipoFilter(searchResults);
    if (filtered.length === 0) {
      listbox.innerHTML = `<p class="px-2 py-3 text-center text-xs text-text-muted">No hay tareas que coincidan</p>`;
    } else {
      listbox.innerHTML = filtered
        .map((t, i) => {
          const active = i === highlightedIndex;
          return `
        <button
          type="button"
          role="option"
          aria-selected="${active ? "true" : "false"}"
          data-select-tarea="${t.id}"
          data-option-index="${i}"
          class="flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-active-tint focus:bg-active-tint focus:outline-none${active ? " bg-active-tint" : ""}"
        >
          <span class="min-w-0 truncate text-sm font-medium text-text-primary" title="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</span>
          ${t.descripcion?.trim() ? `<span class="min-w-0 truncate text-xs text-text-muted" title="${escapeHtml(t.descripcion)}">${escapeHtml(t.descripcion)}</span>` : ""}
          <span class="flex flex-wrap items-center gap-1.5 pt-0.5">
          ${categoriaChip(t.categoria)}
          ${tipoChip(t.es_complemento)}
          </span>
        </button>`;
        })
        .join("");
    }
    listbox.classList.remove("hidden");
    setComboboxExpanded(true);

    if (!clickOutsideHandler) {
      clickOutsideHandler = (e: MouseEvent) => {
        const target = e.target as Node;
        const input = getSearchInput();
        const box = getSearchListbox();
        if (input?.contains(target) || box?.contains(target)) return;
        hideSearchDropdown();
      };
      document.addEventListener("mousedown", clickOutsideHandler);
    }
  }

  async function doSearch(q: string): Promise<void> {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      searchAbort?.abort();
      searchAbort = null;
      searchResults = [];
      searchLoading = false;
      searchError = "";
      hideSearchDropdown();
      return;
    }

    searchAbort?.abort();
    const controller = new AbortController();
    searchAbort = controller;

    searchLoading = true;
    searchError = "";
    highlightedIndex = -1;
    renderSearchDropdown();

    try {
      const items = await getTareasCatalogo({
        busqueda: trimmed,
        categoria: filterCategoria || undefined,
        page_size: SEARCH_PAGE_SIZE,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      searchResults = items;
      searchLoading = false;
      renderSearchDropdown();
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      searchLoading = false;
      searchResults = [];
      const detail = (err as TareaCatalogoFetchError)?.detail;
      searchError = detail?.trim() || "No se pudo buscar en el catálogo.";
      renderSearchDropdown();
    }
  }

  function scheduleSearch(q: string): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void doSearch(q);
    }, SEARCH_DEBOUNCE_MS);
  }

  function bindSearch(): void {
    const searchInput = getSearchInput();
    const listbox = getSearchListbox();
    if (!searchInput || !listbox) return;

    searchInput.addEventListener("input", () => {
      scheduleSearch(searchInput.value);
    });

    searchInput.addEventListener("keydown", (e) => {
      const filtered = applyTipoFilter(searchResults);
      if (e.key === "ArrowDown") {
        if (!comboboxOpen && searchInput.value.trim().length >= 1) {
          void doSearch(searchInput.value);
          return;
        }
        if (filtered.length === 0) return;
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filtered.length - 1);
        renderSearchDropdown();
        const active = listbox.querySelector(`[data-option-index="${highlightedIndex}"]`);
        active?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        if (filtered.length === 0) return;
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        renderSearchDropdown();
        const active = listbox.querySelector(`[data-option-index="${highlightedIndex}"]`);
        active?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        if (!comboboxOpen || highlightedIndex < 0 || highlightedIndex >= filtered.length) return;
        e.preventDefault();
        selectTarea(filtered[highlightedIndex]);
      } else if (e.key === "Escape") {
        if (comboboxOpen) {
          e.preventDefault();
          e.stopPropagation();
          hideSearchDropdown();
        }
      }
    });

    const tipoSelect = body.querySelector("#tarea-filter-tipo") as HTMLSelectElement | null;
    tipoSelect?.addEventListener("change", () => {
      filterTipo = tipoSelect.value as TipoFilter;
      if (searchInput.value.trim().length >= 1) {
        if (searchResults.length > 0) {
          highlightedIndex = -1;
          renderSearchDropdown();
        } else {
          scheduleSearch(searchInput.value);
        }
      }
    });

    const catSelect = body.querySelector("#tarea-filter-categoria") as HTMLSelectElement | null;
    catSelect?.addEventListener("change", () => {
      filterCategoria = catSelect.value;
      if (searchInput.value.trim().length >= 1) {
        scheduleSearch(searchInput.value);
      }
    });

    listbox.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-select-tarea]");
      if (!btn) return;
      const id = Number(btn.dataset.selectTarea);
      const item = searchResults.find((t) => t.id === id);
      if (item) selectTarea(item);
    });
  }

  function selectTarea(item: TareaCatalogo): void {
    selectedCatalogo = item;
    const listbox = getSearchListbox();
    const selectedRow = body.querySelector("#tarea-selected-row") as HTMLElement;
    const selectedInfo = body.querySelector("#tarea-selected-info") as HTMLElement;
    const searchInput = getSearchInput();

    hideSearchDropdown();
    searchResults = [];
    searchError = "";
    selectedRow.classList.remove("hidden");
    if (searchInput) searchInput.value = "";

    selectedInfo.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="min-w-0 truncate text-sm font-medium text-text-primary" title="${escapeHtml(item.nombre)}">${escapeHtml(item.nombre)}</span>
          ${categoriaChip(item.categoria)}
          ${tipoChip(item.es_complemento)}
        </div>
        ${item.descripcion?.trim() ? `<p class="mt-1 line-clamp-2 text-xs text-text-muted" title="${escapeHtml(item.descripcion)}">${escapeHtml(item.descripcion)}</p>` : ""}
      </div>
      <button type="button" id="tarea-deselect" class="shrink-0 text-xs font-medium text-red-600 hover:underline">Quitar</button>`;

    selectedInfo.querySelector("#tarea-deselect")?.addEventListener("click", () => {
      selectedCatalogo = null;
      selectedRow.classList.add("hidden");
    });
  }

  function bindAssignButton(): void {
    const btn = body.querySelector("#tarea-submit-assign") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!selectedCatalogo || loading) return;
      loading = true;
      btn.disabled = true;
      btn.textContent = "Agregando…";

      try {
        const orden = nextOrden();
        await createPerfilTarea(options.perfilId, {
          orden,
          tarea_catalogo_id: selectedCatalogo.id,
          grado_id: resolveGradoId(),
          ...leerAtributos(),
        });
        options.onSuccess();
        await refreshList();
      } catch {
        // keep state
      } finally {
        loading = false;
        btn.disabled = false;
        btn.innerHTML = `${ICON_PLUS}<span>Agregar al perfil</span>`;
      }
    });
  }

  function bindCreateToggle(): void {
    const btn = body.querySelector("#tarea-toggle-create") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", () => {
      showCreateNew = !showCreateNew;
      refreshList();
    });
  }

  function bindCreateSubmit(): void {
    const btn = body.querySelector("#tarea-create-submit") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (loading) return;

      const errorEl = body.querySelector("#tarea-create-error") as HTMLElement | null;
      const showError = (message: string) => {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
      };
      const clearError = () => {
        if (!errorEl) return;
        errorEl.textContent = "";
        errorEl.classList.add("hidden");
      };

      clearError();

      const nombre = (body.querySelector("#tarea-new-nombre") as HTMLInputElement)?.value.trim();
      const descripcion = (body.querySelector("#tarea-new-descripcion") as HTMLTextAreaElement)?.value.trim();
      const categoriaRaw =
        (body.querySelector("#tarea-new-categoria") as HTMLSelectElement | null)?.value ?? "";
      const categoriaTareaId = categoriaRaw ? Number(categoriaRaw) : null;
      const es_complemento = (body.querySelector("#tarea-new-complemento") as HTMLInputElement)?.checked ?? false;

      if (!nombre) {
        showError("Indica el nombre de la tarea.");
        return;
      }
      if (!descripcion) {
        showError("Indica la descripción de la tarea.");
        return;
      }

      loading = true;
      btn.disabled = true;
      btn.textContent = "Creando...";

      try {
        const created = await createTareaCatalogo({
          nombre,
          descripcion,
          categoria_tarea_id: categoriaTareaId,
          es_complemento,
        });
        categoriasOpciones = mergeCategoria(categoriasOpciones, created.categoria);

        const orden = nextOrden();
        await createPerfilTarea(options.perfilId, {
          orden,
          tarea_catalogo_id: created.id,
          grado_id: resolveGradoId(),
          categoria_tarea_id: categoriaTareaId,
          ...leerAtributos(),
        });

        showCreateNew = false;
        options.onSuccess();
        await refreshList();
      } catch (err: unknown) {
        if (isTareaCatalogoDuplicada(err)) {
          showError(MSG_TAREA_DUPLICADA);
        } else {
          const detail = (err as TareaCatalogoFetchError)?.detail ?? "No se pudo crear la tarea.";
          showError(detail);
        }
      } finally {
        loading = false;
        btn.disabled = false;
        btn.textContent = "Crear y agregar";
      }
    });
  }

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-tareas-modal]")) close();
  });

  function escHandler(e: KeyboardEvent): void {
    if (e.key !== "Escape" || overlay.classList.contains("hidden")) return;
    if (comboboxOpen) {
      e.preventDefault();
      hideSearchDropdown();
      return;
    }
    e.preventDefault();
    close();
  }

  async function loadCategoriasOpciones(): Promise<void> {
    try {
      const sample = await getTareasCatalogo({ page_size: 200 });
      categoriasOpciones = extractCategoriasFromCatalogo(sample);
    } catch {
      categoriasOpciones = [];
    }
  }

  return {
    open: () => {
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", escHandler);
      showCreateNew = false;
      selectedCatalogo = null;
      editingTareaId = null;
      filterTipo = "";
      filterCategoria = "";
      alcance = "";
      searchResults = [];
      searchLoading = false;
      searchError = "";
      highlightedIndex = -1;
      comboboxOpen = false;
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      void loadCategoriasOpciones().finally(() => {
        void refreshList();
      });
    },
    close,
  };
}
