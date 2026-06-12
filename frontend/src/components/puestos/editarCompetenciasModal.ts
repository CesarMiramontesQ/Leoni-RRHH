import {
  getPerfilCompetencias,
  createPerfilCompetencia,
  type PerfilCompetencia,
} from "../../api/puestos.ts";
import { getCompetencias, createCompetencia } from "../../api/competencias.ts";
import { getTiposCompetencia } from "../../api/tiposCompetencia.ts";
import type { TipoCompetencia } from "../../dashboard/tiposCompetencia/types.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, FIELD_FOCUS, SELECT_CHEVRON } from "../../ui/uiTokens.ts";

const TIPO_CHIP_PALETTE = [
  "bg-blue-50 text-blue-700",
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
];

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
          <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Competencias del perfil</h2>
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

  const grouped = new Map<string, PerfilCompetencia[]>();
  for (const c of competencias) {
    const key = c.tipo_nombre ?? "Sin tipo";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  let html = `<div class="max-h-56 overflow-y-auto space-y-3 mb-4">`;
  let colorIdx = 0;
  for (const [tipoNombre, items] of grouped) {
    const colorClass = TIPO_CHIP_PALETTE[colorIdx % TIPO_CHIP_PALETTE.length] ?? "bg-slate-100 text-slate-600";
    colorIdx += 1;
    html += `
      <div>
        <span class="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold mb-1 ${colorClass}">${escapeHtml(tipoNombre)}</span>
        <div class="divide-y divide-slate-100">
          ${items.map(c => `
            <div class="flex items-center justify-between gap-2 py-1.5 pl-2">
              <span class="text-sm text-text-primary truncate">${escapeHtml(c.competencia_nombre)}</span>
              ${c.nivel_requerido > 0 ? `<span class="shrink-0 text-xs text-slate-500">Nivel ${c.nivel_requerido}</span>` : ""}
            </div>
          `).join("")}
        </div>
      </div>`;
  }
  html += `</div>`;
  html += `<p class="text-xs text-slate-400 italic mb-4">Para definir el nivel requerido (1–4) de cada competencia, ir a <a href="#/competencias" class="font-semibold text-leoni-blue hover:underline">Competencias</a> → «Niveles por puesto», elegir este perfil y guardar.</p>`;
  return html;
}

function renderAddForm(showCreateNew: boolean, tipos: TipoCompetencia[]): string {
  return `
    <div class="border-t border-slate-200 pt-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Agregar del catalogo</p>

      <!-- Search -->
      <div>
        <input id="comp-search" type="text" autocomplete="off"
          class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
          placeholder="Buscar competencia por nombre..." />
      </div>
      <div id="comp-search-results" class="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>

      <!-- Selected + agregar -->
      <div id="comp-selected-row" class="hidden rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
        <div id="comp-selected-info" class="flex items-center justify-between"></div>
        <div class="flex justify-end mt-2">
          <button type="button" id="comp-submit-assign" class="${BTN_PRIMARY} text-sm">Agregar al perfil</button>
        </div>
      </div>

      <!-- Create new toggle -->
      <div class="pt-2 border-t border-slate-100">
        <button type="button" id="comp-toggle-create" class="${BTN_GHOST} text-xs">
          ${showCreateNew ? "Cerrar" : "+ Crear nueva competencia"}
        </button>
      </div>

      ${showCreateNew ? `
      <div id="comp-create-form" class="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <p class="text-xs font-semibold text-slate-600">Nueva competencia en catalogo</p>
        <div id="comp-create-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Nombre</label>
          <input id="comp-new-nombre" type="text" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Nombre de la competencia" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Descripcion</label>
          <textarea id="comp-new-desc" rows="2" required
            class="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary ${FIELD_FOCUS}"
            placeholder="Descripcion breve..."></textarea>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
          <div class="grid grid-cols-1">
            <select id="comp-new-tipo" required class="col-start-1 row-start-1 block w-full appearance-none rounded-lg border border-border bg-white px-3 py-2 pr-8 text-sm text-text-primary ${FIELD_FOCUS}" ${tipos.length === 0 ? "disabled" : ""}>
              ${tipos.length === 0 ? `<option value="">Sin tipos registrados</option>` : tipos.map((t) => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join("")}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="flex justify-end">
          <button type="button" id="comp-create-submit" class="${BTN_PRIMARY} text-sm">Crear y agregar al perfil</button>
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
  let tiposCatalogo: TipoCompetencia[] = [];
  let assignedCompetenciaIds: Set<number> = new Set();

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function refreshList(): Promise<void> {
    try {
      const items = await getPerfilCompetencias(options.perfilId);
      assignedCompetenciaIds = new Set(items.map(c => c.competencia_id));
      selectedCatalogo = null;
      body.innerHTML = renderList(items) + renderAddForm(showCreateNew, tiposCatalogo);
      bindInteractions();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar competencias.</p>`;
    }
  }

  function bindInteractions(): void {
    bindSearch();
    bindAssignButton();
    bindCreateToggle();
    bindCreateSubmit();
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
      !assignedCompetenciaIds.has(c.id) &&
      (c.nombre.toLowerCase().includes(lower) ||
      c.descripcion.toLowerCase().includes(lower))
    );
    if (filtered.length === 0) {
      resultsEl.innerHTML = `<p class="px-2 py-3 text-xs text-slate-500 text-center">Sin resultados</p>`;
    } else {
      resultsEl.innerHTML = filtered.slice(0, 10).map(c => {
        const subLabel = c.tipo_nombre ?? "";
        return `
        <button type="button" data-select-comp="${c.id}" data-select-nombre="${escapeHtml(c.nombre)}" data-select-grupo="${escapeHtml(c.grupo)}"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-leoni-blue/10">
          <span class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
          ${subLabel ? `<span class="text-[10px] text-slate-500">${escapeHtml(subLabel)}</span>` : ""}
          <span class="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.grupo === "tecnica" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}">${c.grupo === "tecnica" ? "Tecnica" : "Blanda"}</span>
        </button>`;
      }).join("");
    }
    resultsEl.classList.remove("hidden");
  }

  function selectCompetencia(id: number, nombre: string, grupo: string): void {
    selectedCatalogo = { id, nombre, grupo };
    const resultsEl = body.querySelector("#comp-search-results") as HTMLElement;
    const selectedRow = body.querySelector("#comp-selected-row") as HTMLElement;
    const selectedInfo = body.querySelector("#comp-selected-info") as HTMLElement;
    const searchInput = body.querySelector("#comp-search") as HTMLInputElement;

    resultsEl.classList.add("hidden");
    selectedRow.classList.remove("hidden");
    searchInput.value = "";

    const catItem = catalogoCache.find(c => c.id === id);
    const subLabel = catItem?.tipo_nombre ?? "";

    selectedInfo.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-text-primary">${escapeHtml(nombre)}</span>
        <span class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${grupo === "tecnica" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}">${grupo === "tecnica" ? "Tecnica" : "Blanda"}</span>
        ${subLabel ? `<span class="text-[10px] text-slate-500">${escapeHtml(subLabel)}</span>` : ""}
      </div>
      <button type="button" id="comp-deselect" class="text-xs text-red-600 hover:underline">Quitar</button>`;

    selectedInfo.querySelector("#comp-deselect")?.addEventListener("click", () => {
      selectedCatalogo = null;
      selectedRow.classList.add("hidden");
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

      try {
        await createPerfilCompetencia(options.perfilId, {
          competencia_id: selectedCatalogo.id,
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

      const errorEl = body.querySelector("#comp-create-error") as HTMLElement | null;
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

      const nombre = (body.querySelector("#comp-new-nombre") as HTMLInputElement)?.value.trim();
      const descripcion = (body.querySelector("#comp-new-desc") as HTMLTextAreaElement)?.value.trim();
      const tipoRaw = (body.querySelector("#comp-new-tipo") as HTMLSelectElement)?.value;
      const tipoCompetenciaId = Number.parseInt(tipoRaw ?? "", 10);

      if (!nombre) {
        showError("Indica el nombre de la competencia.");
        return;
      }
      if (!descripcion) {
        showError("Indica la descripcion de la competencia.");
        return;
      }
      if (!tipoRaw || Number.isNaN(tipoCompetenciaId) || tipoCompetenciaId <= 0) {
        showError("Selecciona un tipo válido.");
        return;
      }

      loading = true;
      btn.disabled = true;
      btn.textContent = "Creando...";

      try {
        const created = await createCompetencia({ nombre, descripcion, tipo_competencia_id: tipoCompetenciaId });
        catalogoCache.push(created);

        await createPerfilCompetencia(options.perfilId, {
          competencia_id: created.id,
        });

        showCreateNew = false;
        options.onSuccess();
        await refreshList();
      } catch (err: unknown) {
        const detail = (err as { detail?: string })?.detail ?? "No se pudo crear la competencia.";
        showError(detail);
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
      Promise.all([
        getCompetencias({ page_size: 200 }),
        getTiposCompetencia({ page_size: 200 }),
      ]).then(([items, tipos]) => {
        catalogoCache = items;
        tiposCatalogo = tipos;
      }).catch(() => { /* cache stays empty */ });
      refreshList();
    },
    close,
  };
}
