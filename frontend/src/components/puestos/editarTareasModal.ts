/**
 * Modal para editar tareas de un perfil de puesto (solo RH).
 * Permite buscar y asignar tareas del catálogo, crear nuevas inline,
 * eliminar y reordenar con drag & drop.
 */

import {
  getPerfilTareas,
  createPerfilTarea,
  deletePerfilTarea,
  reorderPerfilTareas,
  type PerfilTarea,
} from "../../api/puestos.ts";
import {
  getTareasCatalogo,
  createTareaCatalogo,
  isTareaCatalogoDuplicada,
  MSG_TAREA_DUPLICADA,
  type TareaCatalogo,
  type TareaCatalogoFetchError,
} from "../../api/tareasCatalogo.ts";
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
  onSuccess: () => void;
};

type TipoFilter = "" | "principal" | "complemento";

// ── Iconos (Heroicons, currentColor) ─────────────────────────────────────────
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_DRAG = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM6 17a1 1 0 100-2 1 1 0 000 2zM15 4a1 1 0 11-2 0 1 1 0 012 0zM14 10a1 1 0 11-2 0 1 1 0 012 0zM14 17a1 1 0 100-2 1 1 0 000 2z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clip-rule="evenodd"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z"/></svg>`;

/** Chip de tipo unificado: Principal (blue) / Complementaria (amber). */
function tipoChip(esComplemento: boolean): string {
  if (esComplemento) {
    return `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>Complementaria</span>`;
  }
  return `<span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900"><span class="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>Principal</span>`;
}

/** Chip neutral de categoría. */
function categoriaChip(categoria: string | undefined): string {
  if (!categoria?.trim()) return "";
  return `<span class="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600" title="${escapeHtml(categoria.trim())}">${escapeHtml(categoria.trim())}</span>`;
}

function catalogoCategorias(catalogo: TareaCatalogo[]): string[] {
  const seen = new Map<string, string>();
  for (const t of catalogo) {
    const label = t.categoria?.trim();
    if (label) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "es"));
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
            <p class="mt-1 text-sm text-text-muted">Asigna, ordena y clasifica las tareas del perfil.</p>
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

function renderTareasList(tareas: PerfilTarea[]): string {
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
      <div id="tareas-sortable" class="max-h-64 space-y-1 overflow-y-auto pr-0.5">
        ${tareas.map(t => `
          <div class="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-slate-200 hover:bg-active-tint active:cursor-grabbing"
               draggable="true" data-tarea-id="${t.id}">
            <span class="flex size-5 shrink-0 cursor-grab items-center justify-center text-slate-300 transition-colors group-hover:text-slate-400" aria-hidden="true">${ICON_DRAG}</span>
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 font-mono text-[10px] font-bold tabular-nums text-leoni-blue" data-orden-badge>${t.orden}</span>
            <span class="min-w-0 flex-1 truncate text-sm text-text-primary" title="${escapeHtml(t.descripcion)}">${escapeHtml(t.descripcion)}</span>
            ${tipoChip(t.es_complemento)}
            <button type="button" data-delete-tarea="${t.id}" class="shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40" title="Eliminar" aria-label="Eliminar tarea">
              ${ICON_TRASH}
            </button>
          </div>
        `).join("")}
      </div>
    </section>`;
}

function renderAddForm(
  showCreateNew: boolean,
  filterTipo: TipoFilter,
  filterCategoria: string,
  categorias: string[],
): string {
  const catOpts = categorias
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${filterCategoria.toLowerCase() === c.toLowerCase() ? "selected" : ""}>${escapeHtml(c)}</option>`,
    )
    .join("");
  const datalistOpts = categorias.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");

  return `
    <section class="space-y-3 border-t border-slate-100 pt-5">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Agregar del catálogo</p>

      <div class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <!-- Search -->
        <div>
          <label for="tarea-search" class="${RH_LISTADO_LABEL}">Buscar</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input id="tarea-search" type="text" autocomplete="off"
              class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}"
              placeholder="Nombre de la tarea…" />
          </div>
          <div id="tarea-search-results" class="mt-1.5 hidden max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-[0_4px_12px_rgba(10,22,40,0.08)]"></div>
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
        <div class="mt-3 flex justify-end">
          <button type="button" id="tarea-submit-assign" class="${RH_LISTADO_BTN_PRIMARY} text-sm">${ICON_PLUS}<span>Agregar al perfil</span></button>
        </div>
      </div>

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
            placeholder="Descripción de la tarea" />
        </div>
        <div>
          <label for="tarea-new-categoria" class="${RH_LISTADO_LABEL}">Categoría <span class="font-normal normal-case tracking-normal text-text-muted">(opcional — elige una o escribe una nueva)</span></label>
          <input id="tarea-new-categoria" type="text" list="tarea-new-categoria-list" autocomplete="off"
            class="${FIELD_INPUT}"
            placeholder="Ej: logística, calidad, seguridad…" />
          <datalist id="tarea-new-categoria-list">${datalistOpts}</datalist>
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
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let catalogoCache: TareaCatalogo[] = [];
  let assignedCatalogoIds: Set<number> = new Set();
  let tareas: PerfilTarea[] = [];

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function refreshList(): Promise<void> {
    try {
      tareas = await getPerfilTareas(options.perfilId);
      assignedCatalogoIds = new Set(
        tareas.filter(t => t.tarea_catalogo_id).map(t => t.tarea_catalogo_id as number),
      );
      selectedCatalogo = null;
      body.innerHTML =
        renderTareasList(tareas) +
        renderAddForm(showCreateNew, filterTipo, filterCategoria, catalogoCategorias(catalogoCache));
      bindDeleteButtons();
      bindDragDrop();
      bindInteractions();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar tareas.</p>`;
    }
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

  function bindDragDrop(): void {
    const container = body.querySelector("#tareas-sortable") as HTMLElement | null;
    if (!container) return;

    let draggedEl: HTMLElement | null = null;

    container.addEventListener("dragstart", (e) => {
      draggedEl = (e.target as HTMLElement).closest("[data-tarea-id]");
      if (draggedEl) {
        draggedEl.classList.add("opacity-50");
        (e as DragEvent).dataTransfer!.effectAllowed = "move";
      }
    });

    container.addEventListener("dragend", () => {
      if (draggedEl) {
        draggedEl.classList.remove("opacity-50");
        draggedEl = null;
      }
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      (e as DragEvent).dataTransfer!.dropEffect = "move";
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tarea-id]");
      if (target && target !== draggedEl) {
        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if ((e as DragEvent).clientY < midY) {
          container.insertBefore(draggedEl!, target);
        } else {
          container.insertBefore(draggedEl!, target.nextSibling);
        }
      }
    });

    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      if (loading) return;
      loading = true;

      const rows = container.querySelectorAll<HTMLElement>("[data-tarea-id]");
      const reorderItems: { id: number; orden: number }[] = [];
      rows.forEach((row, i) => {
        const id = Number(row.dataset.tareaId);
        const newOrden = i + 1;
        reorderItems.push({ id, orden: newOrden });
        const badge = row.querySelector("[data-orden-badge]");
        if (badge) badge.textContent = String(newOrden);
      });
      try {
        await reorderPerfilTareas(options.perfilId, reorderItems);
        options.onSuccess();
      } catch {
        await refreshList();
      } finally {
        loading = false;
      }
    });
  }

  function bindInteractions(): void {
    bindSearch();
    bindAssignButton();
    bindCreateToggle();
    bindCreateSubmit();
  }

  function bindSearch(): void {
    const searchInput = body.querySelector("#tarea-search") as HTMLInputElement | null;
    const resultsEl = body.querySelector("#tarea-search-results") as HTMLElement | null;
    if (!searchInput || !resultsEl) return;

    searchInput.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        doSearch(searchInput.value.trim(), resultsEl);
      }, 320);
    });

    const tipoSelect = body.querySelector("#tarea-filter-tipo") as HTMLSelectElement | null;
    tipoSelect?.addEventListener("change", () => {
      filterTipo = tipoSelect.value as TipoFilter;
      doSearch(searchInput.value.trim(), resultsEl);
    });

    const catSelect = body.querySelector("#tarea-filter-categoria") as HTMLSelectElement | null;
    catSelect?.addEventListener("change", () => {
      filterCategoria = catSelect.value;
      doSearch(searchInput.value.trim(), resultsEl);
    });

    resultsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-select-tarea]");
      if (!btn) return;
      const id = Number(btn.dataset.selectTarea);
      const item = catalogoCache.find(t => t.id === id);
      if (item) selectTarea(item);
    });
  }

  function doSearch(q: string, resultsEl: HTMLElement): void {
    const hasFilter = filterTipo !== "" || filterCategoria !== "";
    if (q.length < 2 && !hasFilter) {
      resultsEl.classList.add("hidden");
      return;
    }
    const lower = q.toLowerCase();
    const cat = filterCategoria.trim().toLowerCase();
    const filtered = catalogoCache.filter(t => {
      if (assignedCatalogoIds.has(t.id)) return false;
      if (filterTipo === "principal" && t.es_complemento) return false;
      if (filterTipo === "complemento" && !t.es_complemento) return false;
      if (cat && (t.categoria?.trim().toLowerCase() ?? "") !== cat) return false;
      if (q.length >= 2 && !t.nombre.toLowerCase().includes(lower)) return false;
      return true;
    });
    if (filtered.length === 0) {
      resultsEl.innerHTML = `<p class="px-2 py-3 text-center text-xs text-text-muted">Sin resultados</p>`;
    } else {
      resultsEl.innerHTML = filtered.slice(0, 20).map(t => `
        <button type="button" data-select-tarea="${t.id}"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-active-tint focus:bg-active-tint focus:outline-none">
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-text-primary" title="${escapeHtml(t.nombre)}">${escapeHtml(t.nombre)}</span>
          ${categoriaChip(t.categoria)}
          ${tipoChip(t.es_complemento)}
        </button>
      `).join("");
    }
    resultsEl.classList.remove("hidden");
  }

  function selectTarea(item: TareaCatalogo): void {
    selectedCatalogo = item;
    const resultsEl = body.querySelector("#tarea-search-results") as HTMLElement;
    const selectedRow = body.querySelector("#tarea-selected-row") as HTMLElement;
    const selectedInfo = body.querySelector("#tarea-selected-info") as HTMLElement;
    const searchInput = body.querySelector("#tarea-search") as HTMLInputElement;

    resultsEl.classList.add("hidden");
    selectedRow.classList.remove("hidden");
    searchInput.value = "";

    selectedInfo.innerHTML = `
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <span class="min-w-0 truncate text-sm font-medium text-text-primary" title="${escapeHtml(item.nombre)}">${escapeHtml(item.nombre)}</span>
        ${categoriaChip(item.categoria)}
        ${tipoChip(item.es_complemento)}
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
        const orden = tareas.length + 1;
        await createPerfilTarea(options.perfilId, {
          orden,
          tarea_catalogo_id: selectedCatalogo.id,
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
      const categoria = (body.querySelector("#tarea-new-categoria") as HTMLInputElement)?.value.trim() || undefined;
      const es_complemento = (body.querySelector("#tarea-new-complemento") as HTMLInputElement)?.checked ?? false;

      if (!nombre) {
        showError("Indica el nombre de la tarea.");
        return;
      }

      loading = true;
      btn.disabled = true;
      btn.textContent = "Creando...";

      try {
        const created = await createTareaCatalogo({ nombre, categoria, es_complemento });
        catalogoCache.push(created);

        const orden = tareas.length + 1;
        await createPerfilTarea(options.perfilId, {
          orden,
          tarea_catalogo_id: created.id,
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
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      e.preventDefault();
      close();
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
      filterTipo = "";
      filterCategoria = "";
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      getTareasCatalogo({ page_size: 200 })
        .then(items => {
          catalogoCache = items;
        })
        .catch(() => { /* cache stays empty */ })
        .finally(() => { void refreshList(); });
    },
    close,
  };
}
