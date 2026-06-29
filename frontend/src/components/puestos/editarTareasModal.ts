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
import { MODAL_OVERLAY, MODAL_PANEL, FIELD_INPUT, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_BTN_GHOST, RH_LISTADO_BTN_DANGER } from "../../ui/uiTokens.ts";

export type EditarTareasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarTareasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

function overlayHtml(): string {
  return `
    <div
      id="editar-tareas-overlay"
      class="${MODAL_OVERLAY} hidden"
      role="presentation"
    >
      <div
        class="${MODAL_PANEL} max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-tareas-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-tareas-title" class="text-lg font-semibold text-text-primary">Editar tareas</h2>
          <button
            type="button"
            data-close-tareas-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-tareas-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderTareasList(tareas: PerfilTarea[]): string {
  if (tareas.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin tareas registradas.</p>`;
  }
  return `
    <div id="tareas-sortable" class="divide-y divide-slate-100 mb-4 max-h-56 overflow-y-auto">
      ${tareas.map(t => `
        <div class="flex items-center justify-between gap-2 py-2 cursor-grab active:cursor-grabbing select-none"
             draggable="true" data-tarea-id="${t.id}">
          <div class="flex items-center gap-2 min-w-0">
            <span class="flex size-5 shrink-0 items-center justify-center text-slate-400">
              <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 8h16M4 16h16" stroke-linecap="round"/></svg>
            </span>
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue/10 font-mono text-[10px] font-bold text-leoni-blue" data-orden-badge>${t.orden}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(t.descripcion)}</span>
            ${t.es_complemento ? `<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Comp.</span>` : ""}
          </div>
          <button type="button" data-delete-tarea="${t.id}" class="${RH_LISTADO_BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join("")}
    </div>`;
}

function renderAddForm(showCreateNew: boolean): string {
  return `
    <div class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar del catalogo</p>

      <!-- Search -->
      <div>
        <input id="tarea-search" type="text" autocomplete="off"
          class="${FIELD_INPUT}"
          placeholder="Buscar tarea por nombre..." />
      </div>
      <div id="tarea-search-results" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>

      <!-- Selected + agregar -->
      <div id="tarea-selected-row" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
        <div id="tarea-selected-info" class="flex items-center justify-between"></div>
        <div class="flex justify-end mt-2">
          <button type="button" id="tarea-submit-assign" class="${RH_LISTADO_BTN_PRIMARY} text-sm">Agregar al perfil</button>
        </div>
      </div>

      <!-- Create new toggle -->
      <div class="pt-2 border-t border-slate-100">
        <button type="button" id="tarea-toggle-create" class="${RH_LISTADO_BTN_GHOST} text-xs">
          ${showCreateNew ? "Cerrar" : "+ Crear nueva tarea"}
        </button>
      </div>

      ${showCreateNew ? `
      <div id="tarea-create-form" class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <p class="text-xs font-semibold text-slate-600">Nueva tarea en catalogo</p>
        <div id="tarea-create-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
          <input id="tarea-new-nombre" type="text" required
            class="${FIELD_INPUT}"
            placeholder="Descripcion de la tarea" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Categoria (opcional)</label>
          <input id="tarea-new-categoria" type="text"
            class="${FIELD_INPUT}"
            placeholder="Ej: logistica, calidad, seguridad..." />
        </div>
        <div class="flex items-end pb-1">
          <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input id="tarea-new-complemento" type="checkbox"
              class="size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            Complementaria
          </label>
        </div>
        <div class="flex justify-end">
          <button type="button" id="tarea-create-submit" class="${RH_LISTADO_BTN_PRIMARY} text-sm">Crear y agregar al perfil</button>
        </div>
      </div>` : ""}
    </div>`;
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
      body.innerHTML = renderTareasList(tareas) + renderAddForm(showCreateNew);
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

    resultsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-select-tarea]");
      if (!btn) return;
      const id = Number(btn.dataset.selectTarea);
      const item = catalogoCache.find(t => t.id === id);
      if (item) selectTarea(item);
    });
  }

  function doSearch(q: string, resultsEl: HTMLElement): void {
    if (q.length < 2) {
      resultsEl.classList.add("hidden");
      return;
    }
    const lower = q.toLowerCase();
    const filtered = catalogoCache.filter(t =>
      !assignedCatalogoIds.has(t.id) &&
      t.nombre.toLowerCase().includes(lower),
    );
    if (filtered.length === 0) {
      resultsEl.innerHTML = `<p class="px-2 py-3 text-xs text-slate-500 text-center">Sin resultados</p>`;
    } else {
      resultsEl.innerHTML = filtered.slice(0, 10).map(t => `
        <button type="button" data-select-tarea="${t.id}"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-leoni-blue/10">
          <span class="text-sm font-medium text-text-primary">${escapeHtml(t.nombre)}</span>
          ${t.categoria ? `<span class="text-[10px] text-slate-500">${escapeHtml(t.categoria)}</span>` : ""}
          ${t.es_complemento ? `<span class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">Comp.</span>` : ""}
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
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-text-primary">${escapeHtml(item.nombre)}</span>
        ${item.categoria ? `<span class="text-[10px] text-slate-500">${escapeHtml(item.categoria)}</span>` : ""}
        ${item.es_complemento ? `<span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">Comp.</span>` : ""}
      </div>
      <button type="button" id="tarea-deselect" class="text-xs text-red-600 hover:underline">Quitar</button>`;

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
      btn.textContent = "Agregando...";

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
        btn.textContent = "Agregar al perfil";
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
        btn.textContent = "Crear y agregar al perfil";
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
      body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
      getTareasCatalogo({ page_size: 200 }).then(items => {
        catalogoCache = items;
      }).catch(() => { /* cache stays empty */ });
      refreshList();
    },
    close,
  };
}
