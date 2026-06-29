import {
  getPerfilCompetencias,
  syncPerfilCompetencias,
  createPerfilCompetencia,
} from "../../api/puestos.ts";
import { getCompetencias, createCompetencia } from "../../api/competencias.ts";
import { getTiposCompetencia } from "../../api/tiposCompetencia.ts";
import type { TipoCompetencia } from "../../dashboard/tiposCompetencia/types.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { getNivelRequeridoOptions, ensureMetodosCalificacionCompetenciaLoaded } from "../../ui/nivelCompetencia.ts";
import { MODAL_OVERLAY, MODAL_PANEL, FIELD_FOCUS, RH_LISTADO_SELECT, SELECT_CHEVRON, RH_LISTADO_BTN_PRIMARY, RH_LISTADO_BTN_GHOST } from "../../ui/uiTokens.ts";

export type EditarCompetenciasModalHandle = {
  open: () => void;
  close: () => void;
};

export type EditarCompetenciasModalOptions = {
  perfilId: number;
  gradoId: number;
  gradoNombre?: string;
  onSuccess: () => void;
};

const TIPO_CHIP_PALETTE = [
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-cyan-50 text-cyan-700 border-cyan-200",
];

type CatalogoItem = { id: number; nombre: string; tipo_competencia_id: number };
type AssignedItem = {
  requisito_id: number;
  competencia_id: number;
  nombre: string;
  tipo_competencia_id: number | null;
  tipo_nombre: string | null;
  nivel_requerido: number;
};

function tipoChipColors(tipoId: number, tipos: TipoCompetencia[]): string {
  const idx = tipos.findIndex((t) => t.id === tipoId);
  return TIPO_CHIP_PALETTE[idx >= 0 ? idx % TIPO_CHIP_PALETTE.length : 0] ?? "bg-slate-100 text-slate-600 border-slate-200";
}

function nivelOptionsHtml(selected?: number): string {
  const opts = getNivelRequeridoOptions();
  if (opts.length === 0) {
    return `<option value="" disabled selected>Sin niveles configurados</option>`;
  }
  return opts
    .map(
      (o) =>
        `<option value="${o.value}" ${o.value === selected ? "selected" : ""}>${escapeHtml(o.label)}</option>`,
    )
    .join("");
}

function compactNivelSelect(selected: number, attrs: string): string {
  const opts = getNivelRequeridoOptions();
  const fallback = opts[0]?.value ?? 0;
  const nivel = opts.some((o) => o.value === selected) ? selected : fallback;
  return `<div class="relative grid grid-cols-1 shrink-0">
    <select ${attrs} class="relative z-[1] col-start-1 row-start-1 min-w-[8.5rem] cursor-pointer appearance-none rounded border border-slate-200 bg-white py-0.5 pl-1.5 pr-6 text-[10px] font-semibold text-slate-800 ${FIELD_FOCUS}">${nivelOptionsHtml(nivel)}</select>
    ${SELECT_CHEVRON.replace('class="', 'class="!size-3 !mr-0.5 ')}
  </div>`;
}

function isNivelValido(nivel: number): boolean {
  return nivel > 0 && getNivelRequeridoOptions().some((o) => o.value === nivel);
}

function mensajeNivelRequerido(): string {
  const opts = getNivelRequeridoOptions();
  if (opts.length === 0) return "Configura niveles de competencia en Ajustes de perfiles.";
  return "Selecciona el nivel mínimo requerido configurado en ajustes.";
}

function resolveNivelForSelect(nivel: number): number {
  const opts = getNivelRequeridoOptions();
  if (opts.some((o) => o.value === nivel)) return nivel;
  return opts[0]?.value ?? 0;
}

function optsFirstValue(): number {
  return getNivelRequeridoOptions()[0]?.value ?? 0;
}

const COMPETENCIAS_MODAL_ROOT_ID = "editar-competencias-modal-root";

function ensureCompetenciasModalRoot(): HTMLElement {
  let root = document.getElementById(COMPETENCIAS_MODAL_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = COMPETENCIAS_MODAL_ROOT_ID;
    document.body.appendChild(root);
  }
  return root;
}

export function mountEditarCompetenciasModal(
  host: HTMLElement,
  options: EditarCompetenciasModalOptions,
): EditarCompetenciasModalHandle {
  const modalRoot = ensureCompetenciasModalRoot();
  modalRoot.innerHTML = overlayHtml(options.gradoNombre);
  host.innerHTML = "";
  const overlay = modalRoot.querySelector("#editar-competencias-overlay") as HTMLElement;
  const body = modalRoot.querySelector("#editar-competencias-body") as HTMLElement;

  let catalogo: CatalogoItem[] = [];
  let tiposCatalogo: TipoCompetencia[] = [];
  let assigned: AssignedItem[] = [];
  let pendingRemovals: Set<number> = new Set();
  let pendingAdds: Map<number, number> = new Map();
  let pendingNivelUpdates: Map<number, number> = new Map();
  let saving = false;
  let searchQuery = "";
  let searchSubcategoria = "";
  let showSearch = false;
  let showCreate = false;
  let pickNivelCompId: number | null = null;
  let saveError = "";

  function close(): void {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.style.overflow = "";
    document.removeEventListener("keydown", escHandler);
  }

  async function load(): Promise<void> {
    saving = false;
    body.innerHTML = `<p class="text-sm text-text-muted">Cargando...</p>`;
    try {
      await ensureMetodosCalificacionCompetenciaLoaded(true);
      const [catalogoItems, perfilComps, tipos] = await Promise.all([
        getCompetencias({ page_size: 200 }),
        getPerfilCompetencias(options.perfilId, options.gradoId),
        getTiposCompetencia({ page_size: 200 }),
      ]);

      tiposCatalogo = tipos;
      const tipoIds = new Set(tipos.map((t) => t.id));

      catalogo = catalogoItems
        .filter((c) => tipoIds.has(c.tipo_competencia_id))
        .map((c) => ({ id: c.id, nombre: c.nombre, tipo_competencia_id: c.tipo_competencia_id }));

      assigned = perfilComps
        .filter((c) => c.tipo_competencia_id && tipoIds.has(c.tipo_competencia_id))
        .map((c) => ({
          requisito_id: c.id,
          competencia_id: c.competencia_id,
          nombre: c.competencia_nombre,
          tipo_competencia_id: c.tipo_competencia_id,
          tipo_nombre: c.tipo_nombre,
          nivel_requerido: c.nivel_requerido ?? 0,
        }));

      pendingRemovals = new Set();
      pendingAdds = new Map();
      pendingNivelUpdates = new Map();
      pickNivelCompId = null;
      saveError = "";
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
    const assignedIds = new Set(assigned.map((a) => a.competencia_id));
    return catalogo.filter((c) => pendingAdds.has(c.id) && !assignedIds.has(c.id));
  }

  function effectiveNivel(a: AssignedItem): number {
    if (pendingNivelUpdates.has(a.requisito_id)) {
      return pendingNivelUpdates.get(a.requisito_id)!;
    }
    return a.nivel_requerido;
  }

  function effectiveNivelAdd(compId: number): number {
    return pendingAdds.get(compId) ?? 0;
  }

  function render(): void {
    const visible = getVisibleAssigned();
    const adding = getVisiblePendingAdds();

    const grouped = new Map<number, { assigned: AssignedItem[]; adding: CatalogoItem[] }>();
    for (const sub of tiposCatalogo) {
      grouped.set(sub.id, { assigned: [], adding: [] });
    }
    for (const a of visible) {
      if (a.tipo_competencia_id != null) {
        const g = grouped.get(a.tipo_competencia_id);
        if (g) g.assigned.push(a);
      }
    }
    for (const a of adding) {
      const g = grouped.get(a.tipo_competencia_id);
      if (g) g.adding.push(a);
    }

    const hasChanges =
      pendingRemovals.size > 0 || pendingAdds.size > 0 || pendingNivelUpdates.size > 0;
    const totalCount = visible.length + adding.length;

    const sections = tiposCatalogo.map((sub) => {
      const g = grouped.get(sub.id)!;
      const colors = tipoChipColors(sub.id, tiposCatalogo);
      const count = g.assigned.length + g.adding.length;
      if (count === 0) return "";

      const chips = [
        ...g.assigned.map((a) => {
          const nivel = effectiveNivel(a);
          return `
          <span class="inline-flex flex-wrap items-center gap-1 rounded-md border ${colors} px-2 py-1 text-xs font-medium">
            <span class="truncate max-w-[10rem]">${escapeHtml(a.nombre)}</span>
            ${compactNivelSelect(resolveNivelForSelect(nivel), `data-nivel-assigned="${a.requisito_id}"`)}
            <button type="button" data-remove-req="${a.requisito_id}" class="text-current opacity-50 hover:opacity-100" aria-label="Quitar">×</button>
          </span>`;
        }),
        ...g.adding.map((a) => {
          const nivel = effectiveNivelAdd(a.id);
          return `
          <span class="inline-flex flex-wrap items-center gap-1 rounded-md border border-dashed ${colors} px-2 py-1 text-xs font-medium opacity-90">
            <span class="truncate max-w-[10rem]">${escapeHtml(a.nombre)}</span>
            ${compactNivelSelect(resolveNivelForSelect(nivel), `data-nivel-pending-add="${a.id}"`)}
            <button type="button" data-undo-add="${a.id}" class="text-current opacity-50 hover:opacity-100" aria-label="Deshacer">×</button>
          </span>`;
        }),
      ].join("");

      return `
        <div class="mb-3 last:mb-0">
          <div class="mb-1.5 flex items-center gap-2">
            <span class="rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(sub.nombre)}</span>
            <span class="text-[10px] text-slate-400">${count}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">${chips}</div>
        </div>`;
    }).filter(Boolean).join("");

    const searchPanel = showSearch ? renderSearchPanel() : "";
    const createPanel = showCreate ? renderCreatePanel() : "";
    const sinNiveles = getNivelRequeridoOptions().length === 0;

    body.innerHTML = `
      ${sinNiveles ? `<p class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">No hay niveles de competencia cargados. Configúralos en <a href="#/puestos/ajustes" class="font-semibold underline">Ajustes de perfiles de puesto</a> y vuelve a abrir este diálogo.</p>` : ""}
      ${sections || `<p class="text-sm text-slate-400 italic mb-4">Sin competencias asignadas</p>`}

      <div class="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <button type="button" data-toggle-search class="${RH_LISTADO_BTN_GHOST} text-xs">+ Agregar del catálogo</button>
        <button type="button" data-toggle-create class="${RH_LISTADO_BTN_GHOST} text-xs">+ Crear nueva</button>
        <span class="ml-auto text-[10px] text-slate-400">${totalCount} total</span>
      </div>

      ${searchPanel}
      ${createPanel}
      ${saveError ? `<p data-comp-save-error class="mt-3 text-sm text-red-700 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">${escapeHtml(saveError)}</p>` : ""}

      ${hasChanges ? `
        <div data-comp-save-footer class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span class="text-xs text-slate-500">
            ${pendingAdds.size ? `+${pendingAdds.size} por agregar` : ""}
            ${pendingAdds.size && pendingRemovals.size ? " · " : ""}
            ${pendingRemovals.size ? `−${pendingRemovals.size} por quitar` : ""}
          </span>
          <div class="flex gap-2">
            <button type="button" data-discard class="${RH_LISTADO_BTN_GHOST} text-xs">Descartar</button>
            <button type="button" data-save-all class="${RH_LISTADO_BTN_PRIMARY} text-sm ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar cambios</button>
          </div>
        </div>` : ""}
    `;
  }

  function paintSaveFooter(): void {
    const existingError = body.querySelector("[data-comp-save-error]");
    if (saveError) {
      if (existingError) {
        existingError.textContent = saveError;
      } else {
        body.insertAdjacentHTML(
          "beforeend",
          `<p data-comp-save-error class="mt-3 text-sm text-red-700 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">${escapeHtml(saveError)}</p>`,
        );
      }
    } else {
      existingError?.remove();
    }

    const hasChanges =
      pendingRemovals.size > 0 || pendingAdds.size > 0 || pendingNivelUpdates.size > 0;
    const footerHtml = hasChanges
      ? `<div data-comp-save-footer class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <span class="text-xs text-slate-500">
            ${pendingAdds.size ? `+${pendingAdds.size} por agregar` : ""}
            ${pendingAdds.size && pendingRemovals.size ? " · " : ""}
            ${pendingRemovals.size ? `−${pendingRemovals.size} por quitar` : ""}
          </span>
          <div class="flex gap-2">
            <button type="button" data-discard class="${RH_LISTADO_BTN_GHOST} text-xs">Descartar</button>
            <button type="button" data-save-all class="${RH_LISTADO_BTN_PRIMARY} text-sm ${saving ? "opacity-50 pointer-events-none" : ""}">Guardar cambios</button>
          </div>
        </div>`
      : "";

    const footer = body.querySelector("[data-comp-save-footer]");
    if (!hasChanges) {
      footer?.remove();
      return;
    }
    if (footer) footer.outerHTML = footerHtml;
    else body.insertAdjacentHTML("beforeend", footerHtml);
  }

  function renderSearchPanel(): string {
    const assignedIds = new Set([
      ...assigned.map((a) => a.competencia_id),
      ...pendingAdds.keys(),
    ]);
    const removedIds = new Set(
      [...pendingRemovals].map(rid => assigned.find(a => a.requisito_id === rid)?.competencia_id).filter(Boolean),
    );

    let results = catalogo.filter(c => !assignedIds.has(c.id) || removedIds.has(c.id));
    if (searchSubcategoria) {
      const tipoId = Number.parseInt(searchSubcategoria, 10);
      if (!Number.isNaN(tipoId)) {
        results = results.filter((c) => c.tipo_competencia_id === tipoId);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(c => c.nombre.toLowerCase().includes(q));
    }
    results = results.slice(0, 20);

    const subcatOptions = tiposCatalogo.map((s) =>
      `<option value="${s.id}" ${searchSubcategoria === String(s.id) ? "selected" : ""}>${escapeHtml(s.nombre)}</option>`,
    ).join("");

    const pickPanel =
      pickNivelCompId !== null
        ? (() => {
            const comp = catalogo.find((c) => c.id === pickNivelCompId);
            if (!comp) return "";
            return `
        <div class="mb-3 rounded-lg border border-leoni-blue/30 bg-leoni-blue/5 p-3">
          <p class="text-xs font-semibold text-slate-700 mb-2">Nivel mínimo para <span class="text-leoni-blue">${escapeHtml(comp.nombre)}</span></p>
          <div class="flex flex-wrap items-end gap-2">
            <div class="relative grid grid-cols-1 flex-1 min-w-[12rem]">
              <select data-pick-nivel-select class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} cursor-pointer">${nivelOptionsHtml(resolveNivelForSelect(optsFirstValue()))}</select>
              ${SELECT_CHEVRON}
            </div>
            <button type="button" data-confirm-pick-nivel class="${RH_LISTADO_BTN_PRIMARY} !py-1.5 text-xs">Agregar</button>
            <button type="button" data-cancel-pick-nivel class="${RH_LISTADO_BTN_GHOST} !py-1.5 text-xs">Cancelar</button>
          </div>
        </div>`;
          })()
        : "";

    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        ${pickPanel}
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
              const tipo = tiposCatalogo.find((t) => t.id === c.tipo_competencia_id);
              const colors = tipoChipColors(c.tipo_competencia_id, tiposCatalogo);
              return `
                <button type="button" data-add-comp="${c.id}" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-white transition-colors">
                  <span class="rounded px-1 py-0.5 text-[9px] font-medium ${colors.split(" ").slice(0, 2).join(" ")}">${escapeHtml(tipo?.nombre ?? "")}</span>
                  <span class="text-slate-700">${escapeHtml(c.nombre)}</span>
                </button>`;
            }).join("")}
          </div>
        ` : `<p class="text-xs text-slate-400 italic py-2">Sin resultados${searchQuery ? ` para "${escapeHtml(searchQuery)}"` : ""}</p>`}
      </div>`;
  }

  function renderCreatePanel(): string {
    const subcatOptions = tiposCatalogo.map((s) =>
      `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`,
    ).join("");

    return `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p class="text-xs font-medium text-slate-600 mb-2">Crear nueva competencia</p>
        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <div class="flex-1 min-w-[10rem]">
            <label class="mb-1 block text-[10px] font-semibold text-slate-500">Nombre</label>
            <input type="text" data-create-nombre placeholder="Nombre de la competencia"
              class="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="mb-1 block text-[10px] font-semibold text-slate-500">Tipo</label>
            <select data-create-subcat class="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs ${FIELD_FOCUS}">
              ${subcatOptions}
            </select>
          </div>
          <div>
            <label class="mb-1 block text-[10px] font-semibold text-slate-500">Nivel mínimo requerido</label>
            <div class="relative grid grid-cols-1">
              <select data-create-nivel required class="${RH_LISTADO_SELECT} ${FIELD_FOCUS} min-w-[11rem] cursor-pointer">${nivelOptionsHtml(resolveNivelForSelect(optsFirstValue()))}</select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <button type="button" data-do-create class="${RH_LISTADO_BTN_PRIMARY} !px-3 !py-1.5 text-xs">Crear y agregar</button>
          <button type="button" data-close-create class="text-slate-400 hover:text-slate-600 text-lg leading-none self-center">&times;</button>
        </div>
      </div>`;
  }

  function isFormControl(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest("select, input, textarea, option, label"));
  }

  // Single event delegation listener
  body.addEventListener("click", (e) => {
    if (isFormControl(e.target)) return;

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

    const confirmPick = target.closest<HTMLElement>("[data-confirm-pick-nivel]");
    if (confirmPick && pickNivelCompId !== null && !saving) {
      const sel = body.querySelector("[data-pick-nivel-select]") as HTMLSelectElement | null;
      const nivel = Number.parseInt(sel?.value ?? "", 10);
      if (!isNivelValido(nivel)) {
        saveError = mensajeNivelRequerido();
        render();
        return;
      }
      const alreadyAssigned = assigned.find((a) => a.competencia_id === pickNivelCompId);
      if (alreadyAssigned && pendingRemovals.has(alreadyAssigned.requisito_id)) {
        pendingRemovals.delete(alreadyAssigned.requisito_id);
        pendingNivelUpdates.set(alreadyAssigned.requisito_id, nivel);
      } else {
        pendingAdds.set(pickNivelCompId, nivel);
      }
      pickNivelCompId = null;
      saveError = "";
      render();
      return;
    }

    const cancelPick = target.closest<HTMLElement>("[data-cancel-pick-nivel]");
    if (cancelPick) {
      pickNivelCompId = null;
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
      pickNivelCompId = Number(addComp.dataset.addComp);
      saveError = "";
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
      pendingAdds = new Map();
      pendingNivelUpdates = new Map();
      pickNivelCompId = null;
      saveError = "";
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
      return;
    }
    if (target.matches("[data-nivel-assigned], [data-nivel-pending-add], [data-pick-nivel-select], [data-create-nivel]")) {
      const nivel = Number.parseInt((target as HTMLSelectElement).value, 10);
      if (!isNivelValido(nivel)) return;

      if (target.matches("[data-nivel-assigned]")) {
        const reqId = Number.parseInt(target.getAttribute("data-nivel-assigned") ?? "", 10);
        if (!Number.isFinite(reqId)) return;
        const orig = assigned.find((a) => a.requisito_id === reqId)?.nivel_requerido ?? 0;
        if (nivel === orig) pendingNivelUpdates.delete(reqId);
        else pendingNivelUpdates.set(reqId, nivel);
      } else if (target.matches("[data-nivel-pending-add]")) {
        const compId = Number.parseInt(target.getAttribute("data-nivel-pending-add") ?? "", 10);
        if (!Number.isFinite(compId)) return;
        pendingAdds.set(compId, nivel);
      }
      saveError = "";
      paintSaveFooter();
    }
  });

  async function handleCreate(): Promise<void> {
    const nombreInput = body.querySelector("[data-create-nombre]") as HTMLInputElement | null;
    const subcatSelect = body.querySelector("[data-create-subcat]") as HTMLSelectElement | null;
    if (!nombreInput || !subcatSelect) return;

    const nombre = nombreInput.value.trim();
    const subcategoria = subcatSelect.value;
    const tipoCompetenciaId = Number.parseInt(subcategoria, 10);
    const nivelSelect = body.querySelector("[data-create-nivel]") as HTMLSelectElement | null;
    const nivel = Number.parseInt(nivelSelect?.value ?? "", 10);
    if (!nombre) {
      nombreInput.focus();
      return;
    }
    if (!isNivelValido(nivel)) {
      saveError = mensajeNivelRequerido();
      render();
      return;
    }

    if (!Number.isFinite(tipoCompetenciaId) || tipoCompetenciaId <= 0) {
      saveError = "Selecciona un tipo válido.";
      saving = false;
      render();
      return;
    }

    saving = true;
    saveError = "";
    render();
    try {
      const newComp = await createCompetencia({
        nombre,
        descripcion: nombre,
        tipo_competencia_id: tipoCompetenciaId,
      });
      await createPerfilCompetencia(options.perfilId, {
        competencia_id: newComp.id,
        grado_id: options.gradoId,
        nivel_requerido: nivel,
      });
      // Reload fresh data
      await load();
      options.onSuccess();
    } catch {
      saving = false;
      saveError = "No se pudo crear la competencia. Intenta de nuevo.";
      render();
    }
  }

  async function saveAll(): Promise<void> {
    saving = true;
    saveError = "";
    render();
    try {
      for (const sub of tiposCatalogo) {
        const currentInSub = assigned.filter((a) => a.tipo_competencia_id === sub.id);
        const hasRemovals = currentInSub.some((a) => pendingRemovals.has(a.requisito_id));
        const addsInSub = [...pendingAdds.keys()].filter((id) => {
          const c = catalogo.find((cat) => cat.id === id);
          return c?.tipo_competencia_id === sub.id;
        });
        const hasNivelEdits = currentInSub.some((a) => pendingNivelUpdates.has(a.requisito_id));
        if (!hasRemovals && addsInSub.length === 0 && !hasNivelEdits) continue;

        const competencias: { competencia_id: number; nivel_requerido: number }[] = [];

        for (const a of currentInSub) {
          if (pendingRemovals.has(a.requisito_id)) continue;
          const nivel = effectiveNivel(a);
          if (!isNivelValido(nivel)) {
            saveError = `${mensajeNivelRequerido()} Competencia: «${a.nombre}».`;
            saving = false;
            render();
            return;
          }
          competencias.push({ competencia_id: a.competencia_id, nivel_requerido: nivel });
        }

        for (const compId of addsInSub) {
          const nivel = pendingAdds.get(compId);
          if (!isNivelValido(nivel)) {
            const c = catalogo.find((cat) => cat.id === compId);
            saveError = `${mensajeNivelRequerido()} Competencia: «${c?.nombre ?? "competencia"}».`;
            saving = false;
            render();
            return;
          }
          if (!competencias.some((x) => x.competencia_id === compId)) {
            competencias.push({ competencia_id: compId, nivel_requerido: nivel });
          }
        }

        await syncPerfilCompetencias(options.perfilId, {
          grado_id: options.gradoId,
          tipo_competencia_id: sub.id,
          competencias,
        });
      }

      options.onSuccess();
      close();
    } catch {
      saveError = "No se pudieron guardar los cambios. Intenta de nuevo.";
    } finally {
      saving = false;
      render();
    }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  modalRoot.addEventListener("click", (e) => {
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

function overlayHtml(gradoNombre?: string): string {
  return `
    <div
      id="editar-competencias-overlay"
      class="${MODAL_OVERLAY} hidden"
      role="presentation"
    >
      <div
        class="${MODAL_PANEL} max-w-xl p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-competencias-title"
      >
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="editar-competencias-title" class="text-lg font-semibold text-text-primary">Competencias demostradas</h2>
            <p id="editar-competencias-grado-hint" class="text-xs text-slate-500 mt-0.5">Competencias para <strong>${escapeHtml(gradoNombre ?? "este grado")}</strong>. Selecciona el nivel mínimo requerido según los niveles configurados en ajustes.</p>
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
