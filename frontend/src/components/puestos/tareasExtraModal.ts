import {
  getPerfilTareas,
  getAsignacionTareasExtra,
  createAsignacionTareaExtra,
  deleteAsignacionTareaExtra,
  type PerfilTareaExtra,
} from "../../api/puestos.ts";
import { getTareasCatalogo, type TareaCatalogo } from "../../api/tareasCatalogo.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { MODAL_OVERLAY, MODAL_PANEL, FIELD_INPUT, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_BTN_DANGER } from "../../ui/uiTokens.ts";

export type TareasExtraModalHandle = {
  open: () => void;
  close: () => void;
};

export type TareasExtraModalOptions = {
  perfilId: number;
  asignacionId: number;
  nombreEmpleado: string;
};

function overlayHtml(nombreEmpleado: string): string {
  return `
    <div
      id="tareas-extra-overlay"
      class="${MODAL_OVERLAY} hidden"
      role="presentation"
    >
      <div
        class="${MODAL_PANEL} max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tareas-extra-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="tareas-extra-title" class="text-lg font-semibold text-text-primary">Tareas extra</h2>
            <p class="text-xs text-text-muted mt-0.5">${escapeHtml(nombreEmpleado)}</p>
          </div>
          <button
            type="button"
            data-close-tareas-extra
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="tareas-extra-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderExtraList(extras: PerfilTareaExtra[]): string {
  if (extras.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin tareas extra asignadas.</p>`;
  }
  return `
    <div class="divide-y divide-slate-100 mb-4 max-h-56 overflow-y-auto">
      ${extras.map(t => `
        <div class="flex items-center justify-between gap-2 py-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm text-text-primary truncate">${escapeHtml(t.tarea_catalogo_nombre)}</span>
            ${t.tarea_catalogo_categoria ? `<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">${escapeHtml(t.tarea_catalogo_categoria)}</span>` : ""}
          </div>
          <button type="button" data-delete-extra="${t.id}" class="${RH_LISTADO_BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Quitar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `).join("")}
    </div>`;
}

function renderSearchForm(): string {
  return `
    <div class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar tarea extra</p>
      <div>
        <input id="extra-search" type="text" autocomplete="off"
          class="${FIELD_INPUT}"
          placeholder="Buscar tarea por nombre..." />
      </div>
      <div id="extra-search-results" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>
      <div id="extra-selected-row" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
        <div id="extra-selected-info" class="flex items-center justify-between"></div>
        <div class="flex justify-end mt-2">
          <button type="button" id="extra-submit-assign" class="${RH_LISTADO_BTN_PRIMARY} text-sm">Agregar</button>
        </div>
      </div>
    </div>`;
}

export function mountTareasExtraModal(
  host: HTMLElement,
  options: TareasExtraModalOptions,
): TareasExtraModalHandle {
  host.innerHTML = overlayHtml(options.nombreEmpleado);

  const overlay = host.querySelector("#tareas-extra-overlay") as HTMLElement;
  const body = host.querySelector("#tareas-extra-body") as HTMLElement;

  let loading = false;
  let selectedCatalogo: TareaCatalogo | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let catalogoCache: TareaCatalogo[] = [];
  let principalesIds: Set<number> = new Set();
  let extrasIds: Set<number> = new Set();
  let extras: PerfilTareaExtra[] = [];

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  function escHandler(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }

  async function refreshList(): Promise<void> {
    try {
      extras = await getAsignacionTareasExtra(options.perfilId, options.asignacionId);
      extrasIds = new Set(extras.map(t => t.tarea_catalogo_id));
      selectedCatalogo = null;
      body.innerHTML = renderExtraList(extras) + renderSearchForm();
      bindDeleteButtons();
      bindSearch();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar tareas extra.</p>`;
    }
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-extra]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const extraId = Number(btn.dataset.deleteExtra);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deleteAsignacionTareaExtra(options.perfilId, options.asignacionId, extraId);
          await refreshList();
        } catch {
          btn.disabled = false;
          alert("Error al eliminar tarea extra.");
        } finally {
          loading = false;
        }
      });
    });
  }

  function bindSearch(): void {
    const searchInput = body.querySelector("#extra-search") as HTMLInputElement | null;
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const q = searchInput.value.trim().toLowerCase();
        showResults(q);
      }, 320);
    });

    const submitBtn = body.querySelector("#extra-submit-assign") as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (!selectedCatalogo || loading) return;
        loading = true;
        submitBtn.disabled = true;
        submitBtn.textContent = "...";
        try {
          await createAsignacionTareaExtra(options.perfilId, options.asignacionId, {
            tarea_catalogo_id: selectedCatalogo.id,
          });
          await refreshList();
        } catch {
          alert("Error al agregar tarea extra.");
          submitBtn.disabled = false;
          submitBtn.textContent = "Agregar";
        } finally {
          loading = false;
        }
      });
    }
  }

  function showResults(q: string): void {
    const resultsContainer = body.querySelector("#extra-search-results") as HTMLElement | null;
    if (!resultsContainer) return;

    if (!q) {
      resultsContainer.classList.add("hidden");
      resultsContainer.innerHTML = "";
      return;
    }

    const filtered = catalogoCache.filter(t =>
      t.activa &&
      !principalesIds.has(t.id) &&
      !extrasIds.has(t.id) &&
      t.nombre.toLowerCase().includes(q),
    );

    if (filtered.length === 0) {
      resultsContainer.classList.remove("hidden");
      resultsContainer.innerHTML = `<p class="text-xs text-slate-500 p-2 italic">Sin resultados.</p>`;
      return;
    }

    resultsContainer.classList.remove("hidden");
    resultsContainer.innerHTML = filtered.slice(0, 10).map(t => `
      <button type="button" data-cat-id="${t.id}"
        class="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-leoni-blue/5 transition-colors">
        <span class="text-text-primary">${escapeHtml(t.nombre)}</span>
        ${t.categoria ? `<span class="ml-2 text-[10px] text-slate-400">${escapeHtml(t.categoria)}</span>` : ""}
      </button>
    `).join("");

    resultsContainer.querySelectorAll<HTMLButtonElement>("[data-cat-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const catId = Number(btn.dataset.catId);
        selectedCatalogo = catalogoCache.find(c => c.id === catId) ?? null;
        if (!selectedCatalogo) return;

        resultsContainer.classList.add("hidden");
        const selectedRow = body.querySelector("#extra-selected-row") as HTMLElement;
        const selectedInfo = body.querySelector("#extra-selected-info") as HTMLElement;
        selectedRow.classList.remove("hidden");
        selectedInfo.innerHTML = `
          <span class="text-sm font-medium text-text-primary">${escapeHtml(selectedCatalogo.nombre)}</span>
          <button type="button" id="extra-clear-sel" class="text-xs text-slate-500 hover:text-red-600">Quitar</button>
        `;
        selectedInfo.querySelector("#extra-clear-sel")?.addEventListener("click", () => {
          selectedCatalogo = null;
          selectedRow.classList.add("hidden");
        });
      });
    });
  }

  async function open(): Promise<void> {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", escHandler);

    body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;

    try {
      const [tareasMain, extrasList, catalogo] = await Promise.all([
        getPerfilTareas(options.perfilId),
        getAsignacionTareasExtra(options.perfilId, options.asignacionId),
        getTareasCatalogo({ page_size: 200 }),
      ]);

      principalesIds = new Set(
        tareasMain.filter(t => t.tarea_catalogo_id).map(t => t.tarea_catalogo_id as number),
      );
      catalogoCache = catalogo;
      extras = extrasList;
      extrasIds = new Set(extras.map(t => t.tarea_catalogo_id));

      body.innerHTML = renderExtraList(extras) + renderSearchForm();
      bindDeleteButtons();
      bindSearch();

      const searchInput = body.querySelector("#extra-search") as HTMLInputElement | null;
      if (searchInput) searchInput.focus();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar datos.</p>`;
    }
  }

  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // Close button
  host.querySelector("[data-close-tareas-extra]")?.addEventListener("click", close);

  return { open, close };
}
