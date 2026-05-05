import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { fetchWithAuth } from "../api/http.ts";
import {
  getEvaluaciones,
  createEvaluacion,
  deleteEvaluacion,
  NIVEL_LABELS,
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
  filters: { area_id: string; empleado_id: string; competencia_id: string };
  page: number;
  showModal: boolean;
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
    filters: { area_id: "", empleado_id: "", competencia_id: "" },
    page: 1,
    showModal: false,
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
    const res = await fetchWithAuth("/api/v1/empleados?page_size=200");
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
    const label = NIVEL_LABELS[nivel] ?? `${nivel}`;
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
      </div>
    `;
  }

  function renderTable(): string {
    if (state.evaluaciones.items.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No hay evaluaciones registradas.</p>
        ${canEvaluate ? `<p class="text-xs mt-1">Haz clic en "Nueva evaluación" para comenzar.</p>` : ""}
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
              ${canEvaluate ? `<th class="px-4 py-3"></th>` : ""}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            ${state.evaluaciones.items.map((ev) => renderRow(ev)).join("")}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? renderPagination(totalPages) : ""}
    `;
  }

  function renderRow(ev: Evaluacion): string {
    const fecha = ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString("es-MX") : "-";
    return `<tr>
      <td class="px-4 py-3 text-sm text-gray-900">${ev.empleado_nombre ?? `ID ${ev.empleado_id}`}</td>
      <td class="px-4 py-3 text-sm text-gray-700">${ev.competencia_nombre ?? `ID ${ev.competencia_id}`}</td>
      <td class="px-4 py-3 text-sm">${renderNivelBadge(ev.nivel_actual)}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${ev.evaluador_nombre ?? "-"}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${fecha}</td>
      ${canEvaluate ? `<td class="px-4 py-3 text-right"><button data-action="delete-eval" data-id="${ev.id}" class="text-xs text-red-600 hover:text-red-800">Eliminar</button></td>` : ""}
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

  function renderModal(): string {
    return `
      <div id="eval-modal-backdrop" data-action="close-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div data-modal-inner class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Nueva Evaluación</h2>
          <form data-action="submit-eval" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
              <select name="empleado_id" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                ${state.empleados.map((e) => `<option value="${e.id}">${e.nombre}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Competencia</label>
              <select name="competencia_id" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccionar...</option>
                ${state.competencias.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nivel</label>
              <select name="nivel_actual" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                ${[0, 1, 2, 3, 4].map((n) => `<option value="${n}">${n} — ${NIVEL_LABELS[n]}</option>`).join("")}
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

  async function handleAction(e: Event) {
    const t = e.target as HTMLElement;

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
    if (e.key === "Escape" && state.showModal) {
      state.showModal = false;
      render();
    }
  }

  root.addEventListener("click", handleAction, { signal });
  root.addEventListener("change", handleChange, { signal });
  root.addEventListener("submit", handleSubmit, { signal });
  document.addEventListener("keydown", handleKeydown, { signal });

  // Initial load
  (async () => {
    render();
    await Promise.all([loadAreas(), loadCompetencias(), loadEmpleados()]);
    await loadEvaluaciones();
    state.loading = false;
    render();
  })();
}
