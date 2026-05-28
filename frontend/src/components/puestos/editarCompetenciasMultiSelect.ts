import {
  getPerfilCompetencias,
  syncPerfilCompetencias,
  createPerfilCompetencia,
} from "../../api/puestos.ts";
import { getCompetencias, createCompetencia } from "../../api/competencias.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_GHOST, FIELD_FOCUS } from "../../ui/uiTokens.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  onSuccess: () => void;
};

const SUBCATEGORIAS: { key: string; label: string }[] = [
  { key: "informatica", label: "Informática" },
  { key: "idiomas", label: "Idiomas" },
  { key: "profesional", label: "Profesional" },
  { key: "social", label: "Social" },
  { key: "personal", label: "Personal" },
  { key: "metodos", label: "Métodos" },
];

const SUBCATEGORIA_COLORS: Record<string, string> = {
  informatica: "bg-blue-50 text-blue-700 border-blue-200",
  idiomas: "bg-violet-50 text-violet-700 border-violet-200",
  profesional: "bg-emerald-50 text-emerald-700 border-emerald-200",
  social: "bg-amber-50 text-amber-700 border-amber-200",
  personal: "bg-rose-50 text-rose-700 border-rose-200",
  metodos: "bg-cyan-50 text-cyan-700 border-cyan-200",
};

type CatalogoItem = { id: number; nombre: string; subcategoria?: string };
type AssignedItem = { requisito_id: number; competencia_id: number; nombre: string; subcategoria: string | null };

export function mountEditarCompetenciasModal(
  host: HTMLElement,
  options: EditarCompetenciasModalOptions,
): EditarCompetenciasModalHandle {
  host.innerHTML = overlayHtml();
  const overlay = host.querySelector("#editar-competencias-overlay") as HTMLElement;
  const body = host.querySelector("#editar-competencias-body") as HTMLElement;

  let catalogo: CatalogoItem[] = [];
  let assigned: AssignedItem[] = [];
  let pendingRemovals: Set<number> = new Set(); // requisito_ids to remove
  let pendingAdds: Set<number> = new Set(); // competencia_ids to add
  let saving = false;
  let searchQuery = "";
  let searchSubcategoria = "";
  let showSearch = false;
  let showCreate = false;

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function load(): Promise<void> {
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
    try {
      const [catalogoItems, perfilComps] = await Promise.all([
        getCompetencias({ page_size: 200 }),
        getPerfilCompetencias(options.perfilId),
      ]);

      catalogo = catalogoItems
        .filter(c => c.subcategoria && SUBCATEGORIAS.some(s => s.key === c.subcategoria))
        .map(c => ({ id: c.id, nombre: c.nombre, subcategoria: c.subcategoria }));

      assigned = perfilComps
        .filter(c => c.subcategoria && SUBCATEGORIAS.some(s => s.key === c.subcategoria))
        .map(c => ({
          requisito_id: c.id,
          competencia_id: c.competencia_id,
          nombre: c.competencia_nombre,
          subcategoria: c.subcategoria,
        }));

      pendingRemovals = new Set();
      pendingAdds = new Set();
      showSearch = false;
      showCreate = false;
      searchQuery = "";
      searchSubcategoria = "";
      render();
    } catch {
      body.innerHTML = `<p class="text-sm text-red-600">Error al cargar datos</p>`;
    }
  }

  function getVisibleAssigned(): AssignedItem[] {
    return assigned.filter(a => !pendingRemovals.has(a.requisito_id));
  }

  function getVisiblePendingAdds(): CatalogoItem[] {
    const assignedIds = new Set(assigned.map(a => a.competencia_id));
    return catalogo.filter(c => pendingAdds.has(c.id) && !assignedIds.has(c.id));
  }

  function render(): void {
    const visible = getVisibleAssigned();
    const adding = getVisiblePendingAdds();

    const grouped = new Map<string, { assigned: AssignedItem[]; adding: CatalogoItem[] }>();
    for (const sub of SUBCATEGORIAS) {
      grouped.set(sub.key, { assigned: [], adding: [] });
    }
    for (const a of visible) {
      const g = grouped.get(a.subcategoria ?? "");
      if (g) g.assigned.push(a);
    }
    for (const a of adding) {
      const g = grouped.get(a.subcategoria ?? "");
      if (g) g.adding.push(a);
    }

    const hasChanges = pendingRemovals.size > 0 || pendingAdds.size > 0;
    const totalCount = visible.length + adding.length;

    const sections = SUBCATEGORIAS.map(sub => {
      const g = grouped.get(sub.key)!;
      const colors = SUBCATEGORIA_COLORS[sub.key] ?? "bg-slate-100 text-slate-600 border-slate-300";
      const count = g.assigned.length + g.adding.length;
      if (count === 0) return "";

      const chips = [
        ...g.assigned.map(a => `
          <span class="inline-flex items-center gap-1 rounded-md border ${colors} px-2 py-0.5 text-xs font-medium">
            ${escapeHtml(a.nombre)}
            <button type="button" data-remove-req="${a.requisito_id}" class="ml-0.5 text-current opacity-50 hover:opacity-100" aria-label="Quitar">×</button>
          </span>`),
        ...g.adding.map(a => `
          <span class="inline-flex items-center gap-1 rounded-md border border-dashed ${colors} px-2 py-0.5 text-xs font-medium opacity-75">
            ${escapeHtml(a.nombre)}
            <button type="button" data-undo-add="${a.id}" class="ml-0.5 text-current opacity-50 hover:opacity-100" aria-label="Deshacer">×</button>
          </span>`),
      ].join("");

      return `
        <div class="mb-3 last:mb-0">
          <div class="mb-1.5 flex items-center gap-2">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub.label)}</span>
            <span class="text-[10px] text-slate-400">${count}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">${chips}</div>
        </div>`;
    }).filter(Boolean).join("");

    const searchPanel = showSearch ? renderSearchPanel() : "";
    const createPanel = showCreate ? renderCreatePanel() : "";

    body.innerHTML = `
      ${sections || `<p class="text-sm text-slate-400 italic mb-4">Sin competencias asignadas</p>`}

      <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <button type="button" data-toggle-search class="${BTN_GHOST} text-xs">+ Agregar del catálogo</button>
        <button type="button" data-toggle-create class="${BTN_GHOST} text-xs">+ Crear nueva</button>
        <span class="ml-auto text-[10px] text-slate-400">${totalCount} total</span>
      </div>

      ${searchPanel}
      ${createPanel}

      ${hasChanges ? `
        <div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span class="text-xs text-slate-500">
            ${pendingAdds.size ? `+${pendingAdds.size} por agregar` : ""}
            ${pendingAdds.size && pendingRemovals.size ? " · " : ""}
            ${pendingRemovals.size ? `−${pendingRemovals.size} por quitar` : ""}
          </span>
          <div class="flex gap-2">
            <button type="button" data-discard class="${BTN_GHOST} text-xs">Descartar</button>
            <button type="button" data-save-all class="${BTN_PRIMARY} text-sm ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar cambios</button>
          </div>
        </div>` : ""}
    `;
  }

  function renderSearchPanel(): string {
    const assignedIds = new Set([
      ...assigned.map(a => a.competencia_id),
      ...pendingAdds,
    ]);
    const removedIds = new Set(
      [...pendingRemovals].map(rid => assigned.find(a => a.requisito_id === rid)?.competencia_id).filter(Boolean),
    );

    let results = catalogo.filter(c => !assignedIds.has(c.id) || removedIds.has(c.id));
    if (searchSubcategoria) {
      results = results.filter(c => c.subcategoria === searchSubcategoria);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(c => c.nombre.toLowerCase().includes(q));
    }
    results = results.slice(0, 20);

    const subcatOptions = SUBCATEGORIAS.map(s =>
      `<option value="${s.key}" ${searchSubcategoria === s.key ? "selected" : ""}>${escapeHtml(s.label)}</option>`
    ).join("");

    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div class="flex items-center gap-2 mb-2">
          <input type="text" data-search-input placeholder="Buscar competencia..." value="${escapeHtml(searchQuery)}"
            class="flex-1 rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm ${FIELD_FOCUS}" />
          <select data-search-subcat class="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs ${FIELD_FOCUS}">
            <option value="">Todas</option>
            ${subcatOptions}
          </select>
          <button type="button" data-close-search class="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>
        ${results.length > 0 ? `
          <div class="max-h-40 overflow-y-auto space-y-0.5">
            ${results.map(c => {
              const sub = SUBCATEGORIAS.find(s => s.key === c.subcategoria);
              const colors = SUBCATEGORIA_COLORS[c.subcategoria ?? ""] ?? "bg-slate-100 text-slate-600";
              return `
                <button type="button" data-add-comp="${c.id}" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white transition-colors">
                  <span class="rounded px-1 py-0.5 text-[9px] font-medium ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub?.label ?? "")}</span>
                  <span class="text-slate-700">${escapeHtml(c.nombre)}</span>
                </button>`;
            }).join("")}
          </div>
        ` : `<p class="text-xs text-slate-400 italic py-2">Sin resultados${searchQuery ? ` para "${escapeHtml(searchQuery)}"` : ""}</p>`}
      </div>`;
  }

  function renderCreatePanel(): string {
    const subcatOptions = SUBCATEGORIAS.map(s =>
      `<option value="${s.key}">${escapeHtml(s.label)}</option>`
    ).join("");

    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="text-xs font-medium text-slate-600 mb-2">Crear nueva competencia</p>
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <input type="text" data-create-nombre placeholder="Nombre de la competencia"
              class="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm ${FIELD_FOCUS}" />
          </div>
          <select data-create-subcat class="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs ${FIELD_FOCUS}">
            ${subcatOptions}
          </select>
          <button type="button" data-do-create class="${BTN_PRIMARY} !px-3 !py-1.5 text-xs">Crear y agregar</button>
          <button type="button" data-close-create class="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>
      </div>`;
  }

  // Single event delegation listener
  body.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    const removeBtn = target.closest<HTMLElement>("[data-remove-req]");
    if (removeBtn && !saving) {
      pendingRemovals.add(Number(removeBtn.dataset.removeReq));
      render();
      return;
    }

    const undoAddBtn = target.closest<HTMLElement>("[data-undo-add]");
    if (undoAddBtn && !saving) {
      pendingAdds.delete(Number(undoAddBtn.dataset.undoAdd));
      render();
      return;
    }

    const toggleSearch = target.closest<HTMLElement>("[data-toggle-search]");
    if (toggleSearch) {
      showSearch = !showSearch;
      showCreate = false;
      render();
      return;
    }

    const toggleCreate = target.closest<HTMLElement>("[data-toggle-create]");
    if (toggleCreate) {
      showCreate = !showCreate;
      showSearch = false;
      render();
      return;
    }

    const closeSearch = target.closest<HTMLElement>("[data-close-search]");
    if (closeSearch) {
      showSearch = false;
      render();
      return;
    }

    const closeCreate = target.closest<HTMLElement>("[data-close-create]");
    if (closeCreate) {
      showCreate = false;
      render();
      return;
    }

    const addComp = target.closest<HTMLElement>("[data-add-comp]");
    if (addComp && !saving) {
      const compId = Number(addComp.dataset.addComp);
      const alreadyAssigned = assigned.find(a => a.competencia_id === compId);
      if (alreadyAssigned && pendingRemovals.has(alreadyAssigned.requisito_id)) {
        pendingRemovals.delete(alreadyAssigned.requisito_id);
      } else {
        pendingAdds.add(compId);
      }
      render();
      return;
    }

    const doCreate = target.closest<HTMLElement>("[data-do-create]");
    if (doCreate && !saving) {
      handleCreate();
      return;
    }

    const discardBtn = target.closest<HTMLElement>("[data-discard]");
    if (discardBtn && !saving) {
      pendingRemovals = new Set();
      pendingAdds = new Set();
      render();
      return;
    }

    const saveAllBtn = target.closest<HTMLElement>("[data-save-all]");
    if (saveAllBtn && !saving) {
      saveAll();
    }
  });

  body.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-search-input]")) {
      searchQuery = (target as HTMLInputElement).value;
      render();
      const input = body.querySelector("[data-search-input]") as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  });

  body.addEventListener("change", (e) => {
    const target = e.target as HTMLElement;
    if (target.matches("[data-search-subcat]")) {
      searchSubcategoria = (target as HTMLSelectElement).value;
      render();
    }
  });

  async function handleCreate(): Promise<void> {
    const nombreInput = body.querySelector("[data-create-nombre]") as HTMLInputElement | null;
    const subcatSelect = body.querySelector("[data-create-subcat]") as HTMLSelectElement | null;
    if (!nombreInput || !subcatSelect) return;

    const nombre = nombreInput.value.trim();
    const subcategoria = subcatSelect.value;
    if (!nombre) { nombreInput.focus(); return; }

    saving = true;
    render();
    try {
      const newComp = await createCompetencia({
        nombre,
        descripcion: "",
        grupo: "tecnica",
        subcategoria,
      });
      await createPerfilCompetencia(options.perfilId, { competencia_id: newComp.id });
      // Reload fresh data
      await load();
      options.onSuccess();
    } catch {
      saving = false;
      render();
    }
  }

  async function saveAll(): Promise<void> {
    saving = true;
    render();
    try {
      // Group changes by subcategoria and sync each
      for (const sub of SUBCATEGORIAS) {
        const currentInSub = assigned.filter(a => a.subcategoria === sub.key);
        const hasRemovals = currentInSub.some(a => pendingRemovals.has(a.requisito_id));
        const addsInSub = [...pendingAdds].filter(id => {
          const c = catalogo.find(cat => cat.id === id);
          return c?.subcategoria === sub.key;
        });
        if (!hasRemovals && addsInSub.length === 0) continue;

        const keepIds = currentInSub
          .filter(a => !pendingRemovals.has(a.requisito_id))
          .map(a => a.competencia_id);
        const finalIds = [...new Set([...keepIds, ...addsInSub])];

        await syncPerfilCompetencias(options.perfilId, {
          subcategoria: sub.key,
          competencia_ids: finalIds,
        });
      }

      options.onSuccess();
      close();
    } catch {
      // keep state
    } finally {
      saving = false;
      render();
    }
  }

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
      load();
    },
    close,
  };
}

function overlayHtml(): string {
  return `
    <div
      id="editar-competencias-overlay"
      class="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        class="w-full max-w-xl rounded-xl border border-border bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-competencias-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Competencias demostradas</h2>
            <p class="text-xs text-slate-500 mt-0.5">Gestiona las competencias requeridas para este puesto</p>
          </div>
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
