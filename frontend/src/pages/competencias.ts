import { mountAppShell } from "../layouts/appShell.ts";
import {
  getCompetencias,
  createCompetencia,
  updateCompetencia,
  deleteCompetencia,
  getCompetenciaPuestos,
  type CompetenciasFetchError,
} from "../api/competencias.ts";
import type { Competencia } from "../dashboard/competencias/types.ts";
import { clearAuth } from "../auth/session.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import {
  TIPO_COMPETENCIA_OPTIONS,
  TIPO_COMPETENCIA_LABELS,
  esTipoCompetenciaValido,
  grupoFromTipo,
} from "../ui/catalogoCompetenciaTipo.ts";

// ── Helpers ───────────────────────────────────────────────────────────

function grupoBadge(grupo: "tecnica" | "habilidad_blanda"): string {
  if (grupo === "tecnica") {
    return `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">Tecnica</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-800">Habilidad blanda</span>`;
}

// ── Catalogo ─────────────────────────────────────────────────────────

function renderCatalogoTab(items: Competencia[], filterText: string, grupoFilter: string, subcategoriaFilter: string): string {
  let filtered = items;
  if (filterText.trim()) {
    const q = filterText.toLowerCase();
    filtered = filtered.filter((c) => c.nombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q));
  }
  if (grupoFilter) {
    filtered = filtered.filter((c) => c.grupo === grupoFilter);
  }
  if (subcategoriaFilter) {
    filtered = filtered.filter((c) => c.subcategoria === subcategoriaFilter);
  }

  const subcatLabels: Record<string, string> = {
    ...TIPO_COMPETENCIA_LABELS,
    complementos: "Complementos",
  };

  const rows = filtered.length === 0
    ? `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No hay competencias registradas.</td></tr>`
    : filtered.map((c) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(c.nombre)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(c.descripcion)}</td>
        <td class="px-4 py-3">${grupoBadge(c.grupo)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${c.subcategoria ? escapeHtml(subcatLabels[c.subcategoria] ?? c.subcategoria) : `<span class="text-slate-400">—</span>`}</td>
        <td class="px-4 py-3 text-right">
          <button type="button" data-action="edit-competencia" data-id="${c.id}" class="mr-2 rounded p-1 text-slate-500 hover:text-leoni-blue" title="Editar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /></svg>
          </button>
          <button type="button" data-action="delete-competencia" data-id="${c.id}" class="rounded p-1 text-slate-500 hover:text-red-600" title="Eliminar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>
          </button>
        </td>
      </tr>
    `).join("");

  return `
    <div class="flex flex-col gap-4">
      <!-- Filter bar + Add button -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2 flex-1">
          <div class="relative max-w-xs flex-1">
            <input
              type="text"
              id="comp-catalogo-search"
              data-action="catalogo-filter"
              placeholder="Buscar competencia..."
              value="${escapeHtml(filterText)}"
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 ${FIELD_FOCUS}"
            />
            <svg viewBox="0 0 20 20" fill="currentColor" class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
              <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
            </svg>
          </div>
          <select id="comp-catalogo-grupo" class="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 ${FIELD_FOCUS}">
            <option value="">Grupo</option>
            <option value="tecnica" ${grupoFilter === "tecnica" ? "selected" : ""}>Técnica</option>
            <option value="habilidad_blanda" ${grupoFilter === "habilidad_blanda" ? "selected" : ""}>Habilidad blanda</option>
          </select>
          <select id="comp-catalogo-subcategoria" class="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 ${FIELD_FOCUS}">
            <option value="">Subcategoría</option>
            <option value="informatica" ${subcategoriaFilter === "informatica" ? "selected" : ""}>Informática</option>
            <option value="idiomas" ${subcategoriaFilter === "idiomas" ? "selected" : ""}>Idiomas</option>
            <option value="profesional" ${subcategoriaFilter === "profesional" ? "selected" : ""}>Profesional</option>
            <option value="social" ${subcategoriaFilter === "social" ? "selected" : ""}>Social</option>
            <option value="personal" ${subcategoriaFilter === "personal" ? "selected" : ""}>Personal</option>
            <option value="metodos" ${subcategoriaFilter === "metodos" ? "selected" : ""}>Métodos</option>
            <option value="complementos" ${subcategoriaFilter === "complementos" ? "selected" : ""}>Complementos</option>
          </select>
        </div>
        <button type="button" data-action="add-competencia" class="${BTN_PRIMARY}">
          <span aria-hidden="true">+</span> Nueva competencia
        </button>
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="min-w-full w-full text-left">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Nombre</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Descripcion</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Grupo</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Subcategoría</th>
                <th class="px-4 py-3 text-right text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}


// ── Loading / Error ───────────────────────────────────────────────────

function renderLoading(): string {
  return `
    <div class="flex flex-col gap-4">
      <div class="h-10 w-64 animate-pulse rounded-lg bg-slate-200"></div>
      <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
      <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
    </div>`;
}

function renderError(message: string | null): string {
  return `
    <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="mt-1">${escapeHtml(message || "Error inesperado")}</p>
      <button type="button" data-action="retry" class="${BTN_SECONDARY} mt-3">Reintentar</button>
    </div>`;
}

// ── Modal inline (crear / editar competencia) ─────────────────────────

function renderCompetenciaModal(comp: Competencia | null): string {
  const isEdit = comp !== null;
  const title = isEdit ? "Editar Competencia" : "Nueva Competencia";
  const nombre = comp?.nombre ?? "";
  const descripcion = comp?.descripcion ?? "";
  const tipo = comp?.subcategoria && esTipoCompetenciaValido(comp.subcategoria)
    ? comp.subcategoria
    : "informatica";

  const tipoOpts = TIPO_COMPETENCIA_OPTIONS.map(o =>
    `<option value="${o.value}" ${tipo === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`
  ).join("");

  return `
    <div id="comp-modal-backdrop" data-action="close-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" data-modal-inner>
        <h2 class="text-lg font-semibold text-slate-900">${title}</h2>
        <form id="comp-modal-form" novalidate class="mt-4 flex flex-col gap-4">
          <div id="comp-modal-error" class="hidden rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></div>
          ${isEdit ? `<input type="hidden" name="id" value="${comp.id}" />` : ""}
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input type="text" name="nombre" value="${escapeHtml(nombre)}" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
            <textarea name="descripcion" rows="3" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${FIELD_FOCUS}">${escapeHtml(descripcion)}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
            <div class="grid grid-cols-1">
              <select name="tipo" required class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
                ${tipoOpts}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" data-action="close-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">${isEdit ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ── Page mount ────────────────────────────────────────────────────────

export function mountCompetencias(container: HTMLElement, signal: AbortSignal): void {
  // State
  let status: "loading" | "ready" | "error" = "loading";
  let catalogoItems: Competencia[] = [];
  let catalogoFilter = "";
  let catalogoGrupo = "";
  let catalogoSubcategoria = "";
  let errorMessage: string | null = null;
  let editingCompetencia: Competencia | null = null;
  let showModal = false;

  mountAppShell(container, {
    pageTitle: "Matriz de Competencias",
    activeNav: "empleados",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="competencias-page-root" class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
      <div id="competencias-inner">${renderLoading()}</div>
      <div id="comp-modal-host"></div>
      <div id="comp-delete-modal-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#competencias-inner");
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    inner.innerHTML = `
      <!-- Breadcrumb -->
      <nav class="text-xs text-slate-500" aria-label="Breadcrumb">
        <ol class="flex items-center gap-1">
          <li><a href="#/" class="hover:text-leoni-blue">Inicio</a></li>
          <li><span class="mx-1">/</span></li>
          <li class="font-semibold text-slate-800">Competencias</li>
        </ol>
      </nav>

      <!-- Header -->
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Cat&aacute;logo de Competencias</h1>
        <p class="text-sm text-slate-500">Administra el cat&aacute;logo de competencias disponibles.</p>
      </div>

      <!-- Content -->
      <div class="mt-1">${renderCatalogoTab(catalogoItems, catalogoFilter, catalogoGrupo, catalogoSubcategoria)}</div>
    `;
  }

  function paintModal(): void {
    const host = container.querySelector("#comp-modal-host");
    if (!host) return;
    if (!showModal) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = renderCompetenciaModal(editingCompetencia);
  }

  function showDeleteConfirmModal(id: number, nombre: string, puestos: { id: number; codigo: string; nombre: string }[]): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (!host) return;

    const puestosHtml = puestos.length === 0
      ? `<p class="text-sm text-slate-500 italic">No está asociada a ningún perfil de puesto.</p>`
      : `<p class="text-sm text-slate-600 mb-2">Se eliminará de <strong>${puestos.length}</strong> perfil${puestos.length !== 1 ? "es" : ""} de puesto:</p>
         <ul class="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
           ${puestos.map(p => `<li class="flex items-center gap-2 text-sm text-slate-700 py-1"><span class="font-mono text-xs text-slate-400">${escapeHtml(p.codigo)}</span> ${escapeHtml(p.nombre)}</li>`).join("")}
         </ul>`;

    host.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 class="text-base font-semibold text-slate-900 mb-3">Eliminar competencia</h3>
          <p class="text-sm text-slate-700 mb-3">¿Eliminar <strong>${escapeHtml(nombre)}</strong> del catálogo?</p>
          ${puestosHtml}
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" data-action="cancel-delete-competencia" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-action="confirm-delete-competencia" data-id="${id}" class="${BTN_DANGER}">Eliminar</button>
          </div>
        </div>
      </div>`;
  }

  function closeDeleteConfirmModal(): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (host) host.innerHTML = "";
  }

  function handleSessionExpired(): void {
    clearAuth();
    void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
      abortAuthenticatedShell();
      void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
    });
  }

  async function loadCatalogo(): Promise<void> {
    try {
      catalogoItems = await getCompetencias({ page_size: 200 });
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
      // silent fail on catalogo, keep empty
    }
  }

  async function init(): Promise<void> {
    status = "loading";
    paint();
    try {
      await loadCatalogo();
      status = "ready";
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
      status = "error";
      errorMessage = (e as CompetenciasFetchError)?.detail || "Error de conexion.";
    }
    paint();
  }

  // ── Event delegation ────────────────────────────────────────────────

  const root = container.querySelector("#competencias-page-root");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  root?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    // Add competencia
    if (t.closest("[data-action='add-competencia']")) {
      editingCompetencia = null;
      showModal = true;
      paintModal();
      return;
    }

    // Edit competencia
    const editBtn = t.closest<HTMLElement>("[data-action='edit-competencia']");
    if (editBtn) {
      const id = Number.parseInt(editBtn.getAttribute("data-id") ?? "", 10);
      const comp = catalogoItems.find((c) => c.id === id);
      if (comp) {
        editingCompetencia = comp;
        showModal = true;
        paintModal();
      }
      return;
    }

    // Delete competencia — show confirmation with affected puestos
    const delBtn = t.closest<HTMLElement>("[data-action='delete-competencia']");
    if (delBtn) {
      const id = Number.parseInt(delBtn.getAttribute("data-id") ?? "", 10);
      if (!Number.isFinite(id)) return;
      void (async () => {
        try {
          const puestos = await getCompetenciaPuestos(id);
          const comp = catalogoItems.find(c => c.id === id);
          const nombre = comp?.nombre ?? "esta competencia";
          showDeleteConfirmModal(id, nombre, puestos);
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) { handleSessionExpired(); return; }
          alert(fe?.detail || "Error al consultar puestos asociados");
        }
      })();
      return;
    }

    // Confirm delete from modal
    const confirmDelBtn = t.closest<HTMLElement>("[data-action='confirm-delete-competencia']");
    if (confirmDelBtn) {
      const id = Number.parseInt(confirmDelBtn.getAttribute("data-id") ?? "", 10);
      if (!Number.isFinite(id)) return;
      confirmDelBtn.setAttribute("disabled", "true");
      confirmDelBtn.textContent = "Eliminando...";
      void (async () => {
        try {
          await deleteCompetencia(id);
          closeDeleteConfirmModal();
          await loadCatalogo();
          paint();
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) { handleSessionExpired(); return; }
          alert(fe?.detail || "Error al eliminar");
          confirmDelBtn.removeAttribute("disabled");
          confirmDelBtn.textContent = "Eliminar";
        }
      })();
      return;
    }

    // Cancel delete from modal
    const cancelDelBtn = t.closest<HTMLElement>("[data-action='cancel-delete-competencia']");
    if (cancelDelBtn) {
      closeDeleteConfirmModal();
      return;
    }

    // Close modal (button click or direct backdrop click)
    const closeBtn = t.closest<HTMLElement>("[data-action='close-modal']");
    if (closeBtn) {
      // If backdrop was clicked, only close if click was directly on backdrop (not inner content)
      if (closeBtn.id === "comp-modal-backdrop" && t.closest("[data-modal-inner]")) {
        // Click was inside modal content, ignore
      } else {
        showModal = false;
        paintModal();
      }
      return;
    }

    // Retry
    if (t.closest("[data-action='retry']")) {
      void init();
      return;
    }
  }, { signal });

  // Input / change events
  root?.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;

    // Catalogo search
    if (t.id === "comp-catalogo-search" || t.closest("[data-action='catalogo-filter']")) {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        catalogoFilter = (t as HTMLInputElement).value;
        paint();
      }, 250);
      return;
    }
  }, { signal });

  root?.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;

    // Catalogo grupo/subcategoria filters
    if (t.id === "comp-catalogo-grupo") {
      catalogoGrupo = (t as HTMLSelectElement).value;
      paint();
      return;
    }
    if (t.id === "comp-catalogo-subcategoria") {
      catalogoSubcategoria = (t as HTMLSelectElement).value;
      paint();
      return;
    }

  }, { signal });

  root?.addEventListener("keydown", (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === "Escape" && showModal) {
      ke.preventDefault();
      showModal = false;
      paintModal();
    }
  }, { signal });

  // Modal form submit
  container.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest("#comp-modal-form");
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form as HTMLFormElement);
    const nombre = (fd.get("nombre") as string)?.trim();
    const descripcion = (fd.get("descripcion") as string)?.trim();
    const tipo = fd.get("tipo") as string;
    const subcategoria = tipo || undefined;
    const grupo = grupoFromTipo(tipo);
    const idRaw = fd.get("id") as string | null;
    const errorEl = (form as HTMLFormElement).querySelector("#comp-modal-error") as HTMLElement | null;

    const showError = (message: string) => {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    };
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.add("hidden");
    }

    if (!nombre) {
      showError("Indica el nombre de la competencia.");
      return;
    }
    if (!descripcion) {
      showError("Indica la descripcion de la competencia.");
      return;
    }
    if (!tipo) {
      showError("Selecciona un tipo.");
      return;
    }

    void (async () => {
      try {
        if (idRaw) {
          const id = Number.parseInt(idRaw, 10);
          await updateCompetencia(id, { nombre, descripcion, grupo, subcategoria });
        } else {
          await createCompetencia({ nombre, descripcion, grupo, subcategoria });
        }
        showModal = false;
        paintModal();
        await loadCatalogo();
        paint();
      } catch (err: unknown) {
        const fe = err as CompetenciasFetchError;
        if (fe?.status === 401) { handleSessionExpired(); return; }
        alert(fe?.detail || "Error al guardar");
      }
    })();
  }, { signal });

  // Cleanup
  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  // Init
  void init();
}
