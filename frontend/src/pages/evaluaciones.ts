import { getRolFromAccessToken } from "../auth/jwt.ts";
import { ensureMetodosCalificacionCompetenciaLoaded } from "../ui/metodosCalificacionCompetencia.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { fetchWithAuth } from "../api/http.ts";
import {
  getEvaluaciones,
  createEvaluacion,
  deleteEvaluacion,
  getNivelLabels,
  NIVEL_COLORS,
  type Evaluacion,
  type EvaluacionListResponse,
} from "../api/evaluaciones.ts";

interface AreaOption {
  id: number;
  label: string;
}

interface CompetenciaOption {
  id: number;
  nombre: string;
}

interface EmpleadoOption {
  id: number;
  nombre: string;
}

interface State {
  evaluaciones: EvaluacionListResponse;
  areas: AreaOption[];
  competencias: CompetenciaOption[];
  empleados: EmpleadoOption[];
  filters: { area_id: string; empleado_id: string; competencia_id: string; search: string };
  page: number;
  showModal: boolean;
  detailEval: Evaluacion | null;
  loading: boolean;
}

export function mountEvaluaciones(container: HTMLElement, signal: AbortSignal): void {
  const rol = getRolFromAccessToken();
  const canEvaluate = rol === "rh" || rol === "supervisor";

  const state: State = {
    evaluaciones: { items: [], total: 0, page: 1, page_size: 10 },
    areas: [],
    competencias: [],
    empleados: [],
    filters: { area_id: "", empleado_id: "", competencia_id: "", search: "" },
    page: 1,
    showModal: false,
    detailEval: null,
    loading: true,
  };

  mountAppShell(container, {
    activeNav: "evaluaciones",
    mainHtml: `<div id="evaluaciones-page"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#evaluaciones-page")!;

  async function loadAreas() {
    const res = await fetchWithAuth("/api/v1/competencias/filter-options");
    if (res.ok) {
      const data = await res.json();
      state.areas = (data.areas ?? []).map((a: { id: string; label: string }) => ({
        id: Number(a.id),
        label: a.label,
      }));
    }
  }

  async function loadCompetencias() {
    const res = await fetchWithAuth("/api/v1/competencias?page_size=100");
    if (res.ok) {
      const data = await res.json();
      state.competencias = (data.items ?? []).map((c: { id: number; nombre: string }) => ({
        id: c.id,
        nombre: c.nombre,
      }));
    }
  }

  async function loadEmpleados() {
    const res = await fetchWithAuth("/api/v1/empleados?page_size=100");
    if (res.ok) {
      const data = await res.json();
      state.empleados = (data.items ?? []).map((e: { id: number; nombre: string }) => ({
        id: e.id,
        nombre: e.nombre,
      }));
    }
  }

  async function loadEvaluaciones() {
    const params: Record<string, number> = { page: state.page, page_size: 10 };
    if (state.filters.area_id) params.area_id = Number(state.filters.area_id);
    if (state.filters.empleado_id) params.empleado_id = Number(state.filters.empleado_id);
    if (state.filters.competencia_id) params.competencia_id = Number(state.filters.competencia_id);
    state.evaluaciones = await getEvaluaciones(params);
  }

  function renderNivelBadge(nivel: number): string {
    const label = getNivelLabels()[nivel] ?? `${nivel}`;
    const color = NIVEL_COLORS[nivel] ?? "bg-gray-100 text-gray-600";
    return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}">${label}</span>`;
  }

  function render() {
    root.innerHTML = `
      <div class="px-6 py-6 max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-semibold text-gray-900">Evaluaciones de Competencias</h1>
          ${canEvaluate ? `<button data-action="open-modal" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">Nueva evaluación</button>` : ""}
        </div>

        <div class="flex flex-wrap gap-3 mb-4">
          <input
            data-action="filter-search"
            type="text"
            placeholder="Buscar por empleado..."
            value="${state.filters.search}"
            class="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-56 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <select data-action="filter-area" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">Todas las áreas</option>
            ${state.areas.map((a) => `<option value="${a.id}" ${state.filters.area_id === String(a.id) ? "selected" : ""}>${a.label}</option>`).join("")}
          </select>
          <select data-action="filter-competencia" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
            <option value="">Todas las competencias</option>
            ${state.competencias.map((c) => `<option value="${c.id}" ${state.filters.competencia_id === String(c.id) ? "selected" : ""}>${c.nombre}</option>`).join("")}
          </select>
        </div>

        ${state.loading ? `<div class="text-center py-12 text-gray-500">Cargando...</div>` : renderTable()}

        ${state.showModal ? renderModal() : ""}
        ${state.detailEval ? renderDetailModal(state.detailEval) : ""}
      </div>
    `;
  }

  function getFilteredItems(): Evaluacion[] {
    if (!state.filters.search.trim()) return state.evaluaciones.items;
    const q = state.filters.search.trim().toLowerCase();
    return state.evaluaciones.items.filter((ev) =>
      (ev.empleado_nombre ?? "").toLowerCase().includes(q)
    );
  }

  function renderTable(): string {
    const filtered = getFilteredItems();

    if (state.evaluaciones.items.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No hay evaluaciones registradas.</p>
        ${canEvaluate ? `<p class="text-xs mt-1">Haz clic en "Nueva evaluación" para comenzar.</p>` : ""}
      </div>`;
    }

    if (filtered.length === 0) {
      return `<div class="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No se encontraron evaluaciones para "${state.filters.search}".</p>
      </div>`;
    }

    const totalPages = Math.ceil(state.evaluaciones.total / 10);
    return `
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empleado</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competencia</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nivel</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evaluador</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            ${filtered.map((ev) => renderRow(ev)).join("")}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? renderPagination(totalPages) : ""}
    `;
  }

  function renderRow(ev: Evaluacion): string {
    const fecha = ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString("es-MX") : "-";
    return `<tr>
      <td class="px-4 py-3 text-sm"><a href="#/evaluaciones/empleado/${ev.empleado_id}" class="text-blue-600 hover:text-blue-800 font-medium">${ev.empleado_nombre ?? `ID ${ev.empleado_id}`}</a></td>
      <td class="px-4 py-3 text-sm text-gray-700">${ev.competencia_nombre ?? `ID ${ev.competencia_id}`}</td>
      <td class="px-4 py-3 text-sm">${renderNivelBadge(ev.nivel_actual)}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${ev.evaluador_nombre ?? "-"}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${fecha}</td>
      <td class="px-4 py-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <button data-action="view-detail" data-id="${ev.id}" class="text-xs text-blue-600 hover:text-blue-800 font-medium">Ver detalle</button>
          ${canEvaluate ? `<button data-action="delete-eval" data-id="${ev.id}" class="text-xs text-red-600 hover:text-red-800">Eliminar</button>` : ""}
        </div>
      </td>
    </tr>`;
  }

  function renderPagination(totalPages: number): string {
    return `<div class="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Página ${state.page} de ${totalPages} (${state.evaluaciones.total} total)</span>
      <div class="flex gap-2">
        <button data-action="prev-page" ${state.page <= 1 ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
        <button data-action="next-page" ${state.page >= totalPages ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button>
      </div>
    </div>`;
  }

  function renderSearchSelect(name: string, placeholder: string, options: { id: number; label: string }[]): string {
    return `
      <div class="relative" data-searchselect="${name}">
        <input type="text" data-action="search-${name}" placeholder="${placeholder}" autocomplete="off"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        <input type="hidden" name="${name}" />
        <ul data-dropdown="${name}" class="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg hidden">
          ${options.map((o) => `<li data-action="pick-${name}" data-value="${o.id}" class="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50">${o.label}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderModal(): string {
    const empleadoOpts = state.empleados.map((e) => ({ id: e.id, label: e.nombre }));
    const compOpts = state.competencias.map((c) => ({ id: c.id, label: c.nombre }));

    return `
      <div id="eval-modal-backdrop" data-action="close-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div data-modal-inner class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Nueva Evaluación</h2>
          <form data-action="submit-eval" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
              ${renderSearchSelect("empleado_id", "Buscar empleado...", empleadoOpts)}
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Competencia</label>
              ${renderSearchSelect("competencia_id", "Buscar competencia...", compOpts)}
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
              <select name="nivel_actual" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                ${[0, 1, 2, 3, 4].map((n) => `<option value="${n}">${n} — ${getNivelLabels()[n]}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Observaciones (opcional)</label>
              <textarea name="observaciones" rows="2" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"></textarea>
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" data-action="close-modal" class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="submit" class="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderDetailModal(ev: Evaluacion): string {
    const fecha = ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "-";
    const createdAt = ev.created_at ? new Date(ev.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
    const updatedAt = ev.updated_at ? new Date(ev.updated_at).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

    return `
      <div id="detail-modal-backdrop" data-action="close-detail" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div data-detail-inner class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Detalle de Evaluación</h2>
            <button data-action="close-detail" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Empleado</p>
                <p class="text-sm text-gray-900 mt-0.5">${ev.empleado_nombre ?? `ID ${ev.empleado_id}`}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Competencia</p>
                <p class="text-sm text-gray-900 mt-0.5">${ev.competencia_nombre ?? `ID ${ev.competencia_id}`}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Nivel Actual</p>
                <p class="mt-0.5">${renderNivelBadge(ev.nivel_actual)}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Evaluador</p>
                <p class="text-sm text-gray-900 mt-0.5">${ev.evaluador_nombre ?? "-"}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Fecha Evaluación</p>
                <p class="text-sm text-gray-900 mt-0.5">${fecha}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Última Actualización</p>
                <p class="text-sm text-gray-900 mt-0.5">${updatedAt}</p>
              </div>
            </div>
            <div class="pt-2 border-t border-gray-100">
              <p class="text-xs font-medium text-gray-500 uppercase mb-1">Observaciones</p>
              <p class="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-md p-3 min-h-[60px]">${ev.observaciones || "Sin observaciones registradas."}</p>
            </div>
            <div class="text-xs text-gray-400 pt-2">
              Creado: ${createdAt}
            </div>
          </div>
          <div class="flex justify-end mt-4">
            <button data-action="close-detail" class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  }

  function handleSearchSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const name = input.dataset.action?.replace("search-", "");
    if (!name) return;

    const container = input.closest(`[data-searchselect="${name}"]`);
    if (!container) return;
    const dropdown = container.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
    if (!dropdown) return;

    const query = input.value.toLowerCase();
    const items = dropdown.querySelectorAll("li");
    let visible = 0;
    items.forEach((li) => {
      const match = li.textContent!.toLowerCase().includes(query);
      li.classList.toggle("hidden", !match);
      if (match) visible++;
    });
    dropdown.classList.toggle("hidden", visible === 0 && query === "");
    if (query.length > 0) dropdown.classList.remove("hidden");

    // Clear hidden input if text doesn't match selection
    const hidden = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    if (hidden) hidden.value = "";
  }

  function handlePickOption(e: Event) {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>("[data-action^='pick-']");
    if (!li) return;

    const action = li.dataset.action!;
    const name = action.replace("pick-", "");
    const value = li.dataset.value!;
    const label = li.textContent!;

    const container = li.closest(`[data-searchselect="${name}"]`);
    if (!container) return;

    const textInput = container.querySelector<HTMLInputElement>("input[type='text']");
    const hidden = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
    const dropdown = container.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);

    if (textInput) textInput.value = label;
    if (hidden) hidden.value = value;
    if (dropdown) dropdown.classList.add("hidden");
  }

  async function handleAction(e: Event) {
    const t = e.target as HTMLElement;

    // Pick from search-select dropdown
    if (t.closest("[data-action^='pick-']")) {
      handlePickOption(e);
      return;
    }

    // Close detail modal
    const closeDetail = t.closest<HTMLElement>("[data-action='close-detail']");
    if (closeDetail) {
      if (closeDetail.id === "detail-modal-backdrop" && t.closest("[data-detail-inner]")) {
        return;
      }
      state.detailEval = null;
      render();
      return;
    }

    // View detail
    if (t.matches("[data-action='view-detail']")) {
      const id = Number(t.dataset.id);
      const ev = state.evaluaciones.items.find((e) => e.id === id);
      if (ev) {
        state.detailEval = ev;
        render();
      }
      return;
    }

    // Close modal
    const closeBtn = t.closest<HTMLElement>("[data-action='close-modal']");
    if (closeBtn) {
      if (closeBtn.id === "eval-modal-backdrop" && t.closest("[data-modal-inner]")) {
        return;
      }
      state.showModal = false;
      render();
      return;
    }

    if (t.matches("[data-action='open-modal']")) {
      state.showModal = true;
      render();
      return;
    }

    if (t.matches("[data-action='delete-eval']")) {
      const id = Number(t.dataset.id);
      if (id && confirm("¿Eliminar esta evaluación?")) {
        await deleteEvaluacion(id);
        await loadEvaluaciones();
        render();
      }
      return;
    }

    if (t.matches("[data-action='prev-page']")) {
      if (state.page > 1) {
        state.page--;
        await loadEvaluaciones();
        render();
      }
      return;
    }

    if (t.matches("[data-action='next-page']")) {
      state.page++;
      await loadEvaluaciones();
      render();
      return;
    }
  }

  async function handleChange(e: Event) {
    const t = e.target as HTMLSelectElement;
    if (t.matches("[data-action='filter-area']")) {
      state.filters.area_id = t.value;
      state.page = 1;
      await loadEvaluaciones();
      render();
      return;
    }
    if (t.matches("[data-action='filter-competencia']")) {
      state.filters.competencia_id = t.value;
      state.page = 1;
      await loadEvaluaciones();
      render();
      return;
    }
  }

  async function handleSubmit(e: Event) {
    const form = (e.target as HTMLElement).closest("form");
    if (!form || !form.matches("[data-action='submit-eval']")) return;
    e.preventDefault();

    const fd = new FormData(form);
    const empleado_id = Number(fd.get("empleado_id"));
    const competencia_id = Number(fd.get("competencia_id"));
    const nivel_actual = Number(fd.get("nivel_actual"));
    const observaciones = (fd.get("observaciones") as string) || undefined;

    if (!empleado_id || !competencia_id) return;

    const result = await createEvaluacion({
      empleado_id,
      competencia_id,
      nivel_actual,
      observaciones,
    });

    if (result) {
      state.showModal = false;
      await loadEvaluaciones();
      render();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (state.detailEval) {
        state.detailEval = null;
        render();
      } else if (state.showModal) {
        state.showModal = false;
        render();
      }
    }
  }

  root.addEventListener("click", handleAction, { signal });
  root.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.matches("[data-action^='search-']")) handleSearchSelect(e);
    if (t.matches("[data-action='filter-search']")) {
      state.filters.search = (t as HTMLInputElement).value;
      render();
      const input = root.querySelector<HTMLInputElement>("[data-action='filter-search']");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }, { signal });
  root.addEventListener("focusin", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action^='search-']")) {
      const name = t.dataset.action!.replace("search-", "");
      const dropdown = t.closest(`[data-searchselect="${name}"]`)?.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
      if (dropdown) dropdown.classList.remove("hidden");
    }
  }, { signal });
  root.addEventListener("focusout", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action^='search-']")) {
      setTimeout(() => {
        const name = t.dataset.action!.replace("search-", "");
        const dropdown = t.closest(`[data-searchselect="${name}"]`)?.querySelector<HTMLUListElement>(`[data-dropdown="${name}"]`);
        if (dropdown) dropdown.classList.add("hidden");
      }, 200);
    }
  }, { signal });
  root.addEventListener("change", handleChange, { signal });
  root.addEventListener("submit", handleSubmit, { signal });
  document.addEventListener("keydown", handleKeydown, { signal });

  // Initial load
  (async () => {
    render();
    await ensureMetodosCalificacionCompetenciaLoaded();
    await Promise.all([loadAreas(), loadCompetencias(), loadEmpleados()]);
    await loadEvaluaciones();
    state.loading = false;
    render();
  })();
}
