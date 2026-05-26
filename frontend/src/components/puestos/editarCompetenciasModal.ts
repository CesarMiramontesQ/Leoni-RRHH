import {
  getPerfilCompetencias,
  createPerfilCompetencia,
  deletePerfilCompetencia,
  type PerfilCompetencia,
} from "../../api/puestos.ts";
import { getCompetencias, createCompetencia } from "../../api/competencias.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, BTN_DANGER, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const CATEGORIA_OPTIONS: { value: string; label: string }[] = [
  { value: "informatica", label: "Informatica" },
  { value: "idiomas", label: "Idiomas" },
  { value: "profesional", label: "Profesional" },
  { value: "social", label: "Social" },
  { value: "personal", label: "Personal" },
  { value: "metodos", label: "Metodos" },
  { value: "complementos", label: "Complementos" },
];

const CATEGORIA_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIA_OPTIONS.map(o => [o.value, o.label]),
);

const CATEGORIA_COLORS: Record<string, string> = {
  informatica: "bg-blue-50 text-blue-700",
  idiomas: "bg-violet-50 text-violet-700",
  profesional: "bg-emerald-50 text-emerald-700",
  social: "bg-amber-50 text-amber-700",
  personal: "bg-rose-50 text-rose-700",
  metodos: "bg-cyan-50 text-cyan-700",
  complementos: "bg-slate-100 text-slate-600",
};

function overlayHtml(): string {
  return `
    <div
      id="editar-competencias-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-competencias-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Editar competencias</h2>
          <button
            type="button"
            data-close-competencias-modal
            class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div id="editar-competencias-body">
          <p class="text-sm text-text-muted">Cargando...</p>
        </div>
      </div>
    </div>`;
}

function renderList(competencias: PerfilCompetencia[]): string {
  if (competencias.length === 0) {
    return `<p class="text-sm text-slate-500 italic py-2">Sin competencias registradas.</p>`;
  }
  return `
    <div class="max-h-48 overflow-y-auto divide-y divide-slate-100 mb-4">
      ${competencias.map(c => {
        const colorClass = CATEGORIA_COLORS[c.categoria] ?? "bg-slate-100 text-slate-600";
        const displayName = c.competencia_nombre ?? c.descripcion;
        return `
        <div class="flex items-center justify-between gap-2 py-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${colorClass}">${escapeHtml(CATEGORIA_LABELS[c.categoria] ?? c.categoria)}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(displayName)}</span>
          </div>
          <button type="button" data-delete-competencia="${c.id}" class="${BTN_DANGER} !px-2 !py-1 text-xs shrink-0" title="Eliminar">
            <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      }).join("")}
    </div>`;
}

function renderAddForm(showCreateNew: boolean): string {
  const catOpts = CATEGORIA_OPTIONS.map(o =>
    `<option value="${o.value}">${escapeHtml(o.label)}</option>`
  ).join("");

  return `
    <div class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar del catálogo</p>

      <!-- Search -->
      <div>
        <input id="comp-search" type="text" autocomplete="off"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Buscar competencia por nombre..." />
      </div>
      <div id="comp-search-results" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>

      <!-- Selected -->
      <div id="comp-selected" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 px-3 py-2.5"></div>

      <!-- Categoria + orden (visible after selection) -->
      <div id="comp-assign-fields" class="hidden space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Subcategoría</label>
          <div class="grid grid-cols-1">
            <select id="comp-categoria" class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              ${catOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Orden</label>
          <input id="comp-orden" type="number" min="1" value="1"
            class="block w-24 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}" />
        </div>
        <div class="flex justify-end">
          <button type="button" id="comp-submit-assign" class="${BTN_PRIMARY} text-sm">Agregar al perfil</button>
        </div>
      </div>

      <!-- Create new toggle -->
      <div class="pt-2 border-t border-slate-100">
        <button type="button" id="comp-toggle-create" class="${BTN_GHOST} text-xs">
          ${showCreateNew ? "▼ Cerrar" : "+ Crear nueva competencia"}
        </button>
      </div>

      ${showCreateNew ? `
      <div id="comp-create-form" class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <p class="text-xs font-semibold text-slate-600">Nueva competencia en catálogo</p>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
          <input id="comp-new-nombre" type="text" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Nombre de la competencia" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Descripción</label>
          <textarea id="comp-new-desc" rows="2"
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Descripción breve..."></textarea>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Grupo</label>
          <div class="grid grid-cols-1">
            <select id="comp-new-grupo" class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}">
              <option value="tecnica">Técnica</option>
              <option value="habilidad_blanda">Habilidad blanda</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="flex justify-end">
          <button type="button" id="comp-create-submit" class="${BTN_PRIMARY} text-sm">Crear y seleccionar</button>
        </div>
      </div>` : ""}
    </div>`;
}

export function mountEditarCompetenciasModal(
  host: HTMLElement,
  options: EditarCompetenciasModalOptions,
): EditarCompetenciasModalHandle {
  host.innerHTML = overlayHtml();

  const overlay = host.querySelector("#editar-competencias-overlay") as HTMLElement;
  const body = host.querySelector("#editar-competencias-body") as HTMLElement;

  let loading = false;
  let showCreateNew = false;
  let selectedCatalogo: { id: number; nombre: string; grupo: string } | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let catalogoCache: Awaited<ReturnType<typeof getCompetencias>> = [];

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function refreshList(): Promise<void> {
    try {
      const items = await getPerfilCompetencias(options.perfilId);
      selectedCatalogo = null;
      body.innerHTML = renderList(items) + renderAddForm(showCreateNew);
      bindInteractions();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar competencias.</p>`;
    }
  }

  function bindInteractions(): void {
    bindDeleteButtons();
    bindSearch();
    bindAssignButton();
    bindCreateToggle();
    bindCreateSubmit();
  }

  function bindDeleteButtons(): void {
    body.querySelectorAll<HTMLButtonElement>("[data-delete-competencia]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.deleteCompetencia);
        if (loading) return;
        loading = true;
        btn.disabled = true;
        try {
          await deletePerfilCompetencia(options.perfilId, id);
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

  function bindSearch(): void {
    const searchInput = body.querySelector("#comp-search") as HTMLInputElement | null;
    const resultsEl = body.querySelector("#comp-search-results") as HTMLElement | null;
    if (!searchInput || !resultsEl) return;

    searchInput.addEventListener("input", () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        doSearch(searchInput.value.trim(), resultsEl);
      }, 320);
    });

    resultsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-select-comp]");
      if (!btn) return;
      const id = Number(btn.dataset.selectComp);
      const nombre = btn.dataset.selectNombre ?? "";
      const grupo = btn.dataset.selectGrupo ?? "";
      selectCompetencia(id, nombre, grupo);
    });
  }

  function doSearch(q: string, resultsEl: HTMLElement): void {
    if (q.length < 2) {
      resultsEl.classList.add("hidden");
      return;
    }
    const lower = q.toLowerCase();
    const filtered = catalogoCache.filter(c =>
      c.nombre.toLowerCase().includes(lower) ||
      c.descripcion.toLowerCase().includes(lower)
    );
    if (filtered.length === 0) {
      resultsEl.innerHTML = `<p class="px-2 py-3 text-xs text-slate-500 text-center">Sin resultados</p>`;
    } else {
      resultsEl.innerHTML = filtered.slice(0, 10).map(c => `
        <button type="button" data-select-comp="${c.id}" data-select-nombre="${escapeHtml(c.nombre)}" data-select-grupo="${escapeHtml(c.grupo)}"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-leoni-blue/10">
          <span class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
          <span class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.grupo === "tecnica" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}">${c.grupo === "tecnica" ? "Técnica" : "Blanda"}</span>
        </button>
      `).join("");
    }
    resultsEl.classList.remove("hidden");
  }

  function selectCompetencia(id: number, nombre: string, grupo: string): void {
    selectedCatalogo = { id, nombre, grupo };
    const resultsEl = body.querySelector("#comp-search-results") as HTMLElement;
    const selectedEl = body.querySelector("#comp-selected") as HTMLElement;
    const fieldsEl = body.querySelector("#comp-assign-fields") as HTMLElement;
    const searchInput = body.querySelector("#comp-search") as HTMLInputElement;

    resultsEl.classList.add("hidden");
    selectedEl.classList.remove("hidden");
    fieldsEl.classList.remove("hidden");
    searchInput.value = "";

    selectedEl.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(nombre)}</span>
          <span class="ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${grupo === "tecnica" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}">${grupo === "tecnica" ? "Técnica" : "Blanda"}</span>
        </div>
        <button type="button" id="comp-deselect" class="text-xs text-red-600 hover:underline">Quitar</button>
      </div>`;

    selectedEl.querySelector("#comp-deselect")?.addEventListener("click", () => {
      selectedCatalogo = null;
      selectedEl.classList.add("hidden");
      fieldsEl.classList.add("hidden");
    });
  }

  function bindAssignButton(): void {
    const btn = body.querySelector("#comp-submit-assign") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!selectedCatalogo || loading) return;
      loading = true;
      btn.disabled = true;
      btn.textContent = "Agregando...";

      const categoria = (body.querySelector("#comp-categoria") as HTMLSelectElement)?.value ?? "profesional";
      const orden = Number((body.querySelector("#comp-orden") as HTMLInputElement)?.value ?? 1);

      try {
        await createPerfilCompetencia(options.perfilId, {
          competencia_id: selectedCatalogo.id,
          categoria,
          orden,
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
    const btn = body.querySelector("#comp-toggle-create") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", () => {
      showCreateNew = !showCreateNew;
      refreshList();
    });
  }

  function bindCreateSubmit(): void {
    const btn = body.querySelector("#comp-create-submit") as HTMLButtonElement | null;
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (loading) return;
      const nombre = (body.querySelector("#comp-new-nombre") as HTMLInputElement)?.value.trim();
      const descripcion = (body.querySelector("#comp-new-desc") as HTMLTextAreaElement)?.value.trim();
      const grupo = (body.querySelector("#comp-new-grupo") as HTMLSelectElement)?.value as "tecnica" | "habilidad_blanda";

      if (!nombre || !descripcion) return;

      loading = true;
      btn.disabled = true;
      btn.textContent = "Creando...";

      try {
        const created = await createCompetencia({ nombre, descripcion, grupo });
        catalogoCache.push(created);
        showCreateNew = false;
        selectCompetencia(created.id, created.nombre, created.grupo);
        // Re-render list but keep selection
        const items = await getPerfilCompetencias(options.perfilId);
        const listHtml = renderList(items);
        const addFormHtml = renderAddForm(false);
        body.innerHTML = listHtml + addFormHtml;
        bindInteractions();
        selectCompetencia(created.id, created.nombre, created.grupo);
      } catch {
        // keep form
      } finally {
        loading = false;
        btn.disabled = false;
        btn.textContent = "Crear y seleccionar";
      }
    });
  }

  // Close handlers
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  host.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-close-competencias-modal]")) close();
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
      getCompetencias({ page_size: 100 }).then(items => {
        catalogoCache = items;
      }).catch(() => { /* cache stays empty, search won't match */ });
      refreshList();
    },
    close,
  };
}
