import { getRolFromAccessToken, getEmpleadoIdFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  getCapacitaciones,
  createCapacitacion,
  updateCapacitacion,
  deleteCapacitacion,
  getMisInscripciones,
  inscribirse,
  cancelarInscripcion,
} from "../api/capacitaciones.ts";
import type {
  Capacitacion,
  CapacitacionListResponse,
  Inscripcion,
  InscripcionListResponse,
  CapacitacionCreatePayload,
} from "../dashboard/capacitaciones/types.ts";
import { MODALIDAD_LABELS, ESTADO_LABELS, INSCRIPCION_ESTADO_LABELS } from "../dashboard/capacitaciones/types.ts";
import { fetchWithAuth } from "../api/http.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";

function esc(s: string | null | undefined): string {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

interface AreaOption {
  id: number;
  label: string;
}

type TabId = "catalogo" | "inscripciones";

interface State {
  activeTab: TabId;
  capacitaciones: CapacitacionListResponse;
  inscripciones: InscripcionListResponse;
  areas: AreaOption[];
  filters: { area_id: string; modalidad: string; estado: string; search: string };
  page: number;
  inscripcionesPage: number;
  loading: boolean;
  showCreateModal: boolean;
  editingCapacitacion: Capacitacion | null;
  showInscripcionModal: Capacitacion | null;
  error: string | null;
}

export function mountCapacitaciones(container: HTMLElement, signal: AbortSignal): void {
  const rol = getRolFromAccessToken();
  const isRH = rol === "rh";

  const state: State = {
    activeTab: "catalogo",
    capacitaciones: { items: [], total: 0, page: 1, page_size: 10 },
    inscripciones: { items: [], total: 0, page: 1, page_size: 10 },
    areas: [],
    filters: { area_id: "", modalidad: "", estado: "", search: "" },
    page: 1,
    inscripcionesPage: 1,
    loading: true,
    showCreateModal: false,
    editingCapacitacion: null,
    showInscripcionModal: null,
    error: null,
  };

  mountAppShell(container, {
    activeNav: "capacitaciones" as any,
    mainHtml: `<div id="capacitaciones-page"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#capacitaciones-page")!;

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

  async function loadCapacitaciones() {
    try {
      state.capacitaciones = await getCapacitaciones({
        page: state.page,
        page_size: 10,
        area_id: state.filters.area_id ? Number(state.filters.area_id) : undefined,
        modalidad: state.filters.modalidad || undefined,
        estado: state.filters.estado || undefined,
        busqueda: state.filters.search || undefined,
      });
    } catch {
      state.capacitaciones = { items: [], total: 0, page: 1, page_size: 10 };
    }
  }

  async function loadInscripciones() {
    try {
      state.inscripciones = await getMisInscripciones({ page: state.inscripcionesPage, page_size: 10 });
    } catch {
      state.inscripciones = { items: [], total: 0, page: 1, page_size: 10 };
    }
  }

  function getStats() {
    const items = state.capacitaciones.items;
    const activas = items.filter((c) => c.estado === "activa").length;
    const totalInscritos = items.reduce((sum, c) => sum + c.inscritos_count, 0);
    const presencial = items.filter((c) => c.modalidad === "presencial").length;
    const online = items.filter((c) => c.modalidad === "online").length;
    const mixta = items.filter((c) => c.modalidad === "mixta").length;
    return { activas, totalInscritos, presencial, online, mixta };
  }

  function modalidadBadge(modalidad: string): string {
    const colors: Record<string, string> = {
      presencial: "border-blue-200 bg-blue-50 text-blue-800",
      online: "border-purple-200 bg-purple-50 text-purple-800",
      mixta: "border-teal-200 bg-teal-50 text-teal-800",
    };
    const color = colors[modalidad] ?? "border-gray-200 bg-gray-50 text-gray-700";
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}">${MODALIDAD_LABELS[modalidad] ?? modalidad}</span>`;
  }

  function estadoBadge(estado: string): string {
    const colors: Record<string, string> = {
      activa: "border-emerald-200 bg-emerald-50 text-emerald-900",
      finalizada: "border-slate-200 bg-slate-100 text-slate-700",
      cancelada: "border-red-200 bg-red-50 text-red-900",
    };
    const color = colors[estado] ?? "border-gray-200 bg-gray-50 text-gray-700";
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}">${ESTADO_LABELS[estado] ?? estado}</span>`;
  }

  function inscripcionEstadoBadge(estado: string): string {
    const colors: Record<string, string> = {
      inscrito: "border-blue-200 bg-blue-50 text-blue-800",
      en_curso: "border-amber-200 bg-amber-50 text-amber-800",
      completado: "border-emerald-200 bg-emerald-50 text-emerald-800",
      cancelado: "border-slate-200 bg-slate-100 text-slate-700",
    };
    const color = colors[estado] ?? "border-gray-200 bg-gray-50 text-gray-700";
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${color}">${INSCRIPCION_ESTADO_LABELS[estado] ?? estado}</span>`;
  }

  function render() {
    const stats = getStats();
    root.innerHTML = `
      <div class="px-6 py-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-xl font-semibold text-gray-900">Capacitaciones</h1>
          ${isRH ? `<button data-action="open-create" class="${BTN_PRIMARY}">
            <svg class="size-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
            Nueva capacitacion
          </button>` : ""}
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium text-gray-500 uppercase">Activas</p>
            <p class="mt-1 text-2xl font-bold text-gray-900">${stats.activas}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium text-gray-500 uppercase">Total inscritos</p>
            <p class="mt-1 text-2xl font-bold text-gray-900">${stats.totalInscritos}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium text-gray-500 uppercase">Presencial</p>
            <p class="mt-1 text-2xl font-bold text-blue-600">${stats.presencial}</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4">
            <p class="text-xs font-medium text-gray-500 uppercase">Online / Mixta</p>
            <p class="mt-1 text-2xl font-bold text-purple-600">${stats.online + stats.mixta}</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 mb-4">
          <nav class="-mb-px flex gap-x-6" aria-label="Tabs">
            <button data-action="tab" data-tab="catalogo" class="whitespace-nowrap border-b-2 pb-3 px-1 text-sm font-medium ${state.activeTab === "catalogo" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}">
              Catalogo
            </button>
            <button data-action="tab" data-tab="inscripciones" class="whitespace-nowrap border-b-2 pb-3 px-1 text-sm font-medium ${state.activeTab === "inscripciones" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"}">
              Mis Inscripciones
            </button>
          </nav>
        </div>

        ${state.activeTab === "catalogo" ? renderCatalogo() : renderInscripciones()}

        ${state.showCreateModal || state.editingCapacitacion ? renderCreateEditModal() : ""}
        ${state.showInscripcionModal ? renderInscripcionModal(state.showInscripcionModal) : ""}
      </div>
    `;
  }

  function renderCatalogo(): string {
    return `
      <!-- Filters -->
      <div class="flex flex-wrap gap-3 mb-4">
        <input
          data-action="filter-search"
          type="text"
          placeholder="Buscar capacitacion..."
          value="${state.filters.search}"
          class="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-56 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <div class="grid grid-cols-1">
          <select data-action="filter-area" class="col-start-1 row-start-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm appearance-none pr-8">
            <option value="">Todas las areas</option>
            ${state.areas.map((a) => `<option value="${a.id}" ${state.filters.area_id === String(a.id) ? "selected" : ""}>${a.label}</option>`).join("")}
          </select>
          ${SELECT_CHEVRON}
        </div>
        <div class="grid grid-cols-1">
          <select data-action="filter-modalidad" class="col-start-1 row-start-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm appearance-none pr-8">
            <option value="">Todas las modalidades</option>
            <option value="presencial" ${state.filters.modalidad === "presencial" ? "selected" : ""}>Presencial</option>
            <option value="online" ${state.filters.modalidad === "online" ? "selected" : ""}>En linea</option>
            <option value="mixta" ${state.filters.modalidad === "mixta" ? "selected" : ""}>Mixta</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
        <div class="grid grid-cols-1">
          <select data-action="filter-estado" class="col-start-1 row-start-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm appearance-none pr-8">
            <option value="">Todos los estados</option>
            <option value="activa" ${state.filters.estado === "activa" ? "selected" : ""}>Activa</option>
            <option value="finalizada" ${state.filters.estado === "finalizada" ? "selected" : ""}>Finalizada</option>
            <option value="cancelada" ${state.filters.estado === "cancelada" ? "selected" : ""}>Cancelada</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>

      ${state.loading ? `<div class="text-center py-12 text-gray-500">Cargando...</div>` : renderCapacitacionesList()}
    `;
  }

  function renderCapacitacionesList(): string {
    if (state.capacitaciones.items.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No hay capacitaciones registradas.</p>
        ${isRH ? `<p class="text-xs mt-1">Haz clic en "Nueva capacitacion" para comenzar.</p>` : ""}
      </div>`;
    }

    const totalPages = Math.ceil(state.capacitaciones.total / 10);
    return `
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        ${state.capacitaciones.items.map((c) => renderCapacitacionCard(c)).join("")}
      </div>
      ${totalPages > 1 ? renderPagination(totalPages, state.page, "catalogo") : ""}
    `;
  }

  function renderCapacitacionCard(c: Capacitacion): string {
    const fechaInicio = c.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const fechaFin = c.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—";
    const cupoDisponible = c.cupo_maximo ? c.cupo_maximo - c.inscritos_count : null;
    const puedeInscribirse = !isRH && c.estado === "activa" && (cupoDisponible === null || cupoDisponible > 0);

    return `
      <div class="rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-sm font-semibold text-gray-900 line-clamp-2">${esc(c.nombre)}</h3>
          ${estadoBadge(c.estado)}
        </div>
        <div class="flex flex-wrap gap-2">
          ${modalidadBadge(c.modalidad)}
          ${c.area_nombre ? `<span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">${esc(c.area_nombre)}</span>` : ""}
        </div>
        <div class="text-xs text-gray-500 space-y-1">
          ${c.instructor ? `<p><span class="font-medium text-gray-600">Instructor:</span> ${esc(c.instructor)}</p>` : ""}
          <p><span class="font-medium text-gray-600">Duracion:</span> ${c.duracion_horas}h</p>
          <p><span class="font-medium text-gray-600">Fechas:</span> ${fechaInicio} - ${fechaFin}</p>
          <p><span class="font-medium text-gray-600">Inscritos:</span> ${c.inscritos_count}${c.cupo_maximo ? `/${c.cupo_maximo}` : ""} ${cupoDisponible !== null && cupoDisponible <= 0 ? '<span class="text-red-600 font-medium">(Lleno)</span>' : ""}</p>
        </div>
        <div class="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
          ${puedeInscribirse ? `<button data-action="inscribirse" data-id="${c.id}" class="text-xs font-medium text-blue-600 hover:text-blue-800">Inscribirme</button>` : ""}
          ${isRH ? `
            <button data-action="edit-cap" data-id="${c.id}" class="text-xs font-medium text-blue-600 hover:text-blue-800">Editar</button>
            <button data-action="delete-cap" data-id="${c.id}" class="text-xs font-medium text-red-600 hover:text-red-800">Eliminar</button>
          ` : ""}
        </div>
      </div>
    `;
  }

  function renderInscripciones(): string {
    if (state.loading) {
      return `<div class="text-center py-12 text-gray-500">Cargando...</div>`;
    }
    if (state.inscripciones.items.length === 0) {
      return `<div class="text-center py-12 text-gray-500 border border-dashed border-gray-300 rounded-lg">
        <p class="text-sm">No tienes inscripciones registradas.</p>
        <p class="text-xs mt-1">Explora el catalogo para inscribirte a una capacitacion.</p>
      </div>`;
    }

    const totalPages = Math.ceil(state.inscripciones.total / 10);
    return `
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacitacion</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha inscripcion</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Calificacion</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            ${state.inscripciones.items.map((i) => renderInscripcionRow(i)).join("")}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? renderPagination(totalPages, state.inscripcionesPage, "inscripciones") : ""}
    `;
  }

  function renderInscripcionRow(i: Inscripcion): string {
    const fecha = new Date(i.fecha_inscripcion).toLocaleDateString("es-MX");
    const canCancel = i.estado === "inscrito";
    return `<tr>
      <td class="px-4 py-3 text-sm font-medium text-gray-900">${esc(i.capacitacion_nombre)}</td>
      <td class="px-4 py-3 text-sm">${inscripcionEstadoBadge(i.estado)}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${fecha}</td>
      <td class="px-4 py-3 text-sm text-gray-500">${i.calificacion != null ? i.calificacion : "-"}</td>
      <td class="px-4 py-3 text-center">
        ${canCancel ? `<button data-action="cancel-inscripcion" data-id="${i.id}" class="text-xs text-red-600 hover:text-red-800 font-medium">Cancelar</button>` : ""}
      </td>
    </tr>`;
  }

  function renderPagination(totalPages: number, currentPage: number, context: string): string {
    return `<div class="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Pagina ${currentPage} de ${totalPages} (${context === "catalogo" ? state.capacitaciones.total : state.inscripciones.total} total)</span>
      <div class="flex gap-2">
        <button data-action="prev-page" data-context="${context}" ${currentPage <= 1 ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40">Anterior</button>
        <button data-action="next-page" data-context="${context}" ${currentPage >= totalPages ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40">Siguiente</button>
      </div>
    </div>`;
  }

  function renderCreateEditModal(): string {
    const cap = state.editingCapacitacion;
    const title = cap ? "Editar Capacitacion" : "Nueva Capacitacion";
    return `
      <div id="cap-modal-backdrop" data-action="close-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div data-modal-inner class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">${title}</h2>
          <form data-action="submit-cap" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" name="nombre" required value="${cap?.nombre ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
              <textarea name="descripcion" rows="2" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">${cap?.descripcion ?? ""}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Modalidad *</label>
                <select name="modalidad" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="presencial" ${cap?.modalidad === "presencial" ? "selected" : ""}>Presencial</option>
                  <option value="online" ${cap?.modalidad === "online" ? "selected" : ""}>En linea</option>
                  <option value="mixta" ${cap?.modalidad === "mixta" ? "selected" : ""}>Mixta</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Duracion (horas) *</label>
                <input type="number" name="duracion_horas" required min="1" value="${cap?.duracion_horas ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
              <input type="text" name="instructor" value="${cap?.instructor ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Area</label>
              <select name="area_id" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Sin area especifica</option>
                ${state.areas.map((a) => `<option value="${a.id}" ${cap && cap.area_id === a.id ? "selected" : ""}>${a.label}</option>`).join("")}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha inicio *</label>
                <input type="date" name="fecha_inicio" required value="${cap?.fecha_inicio?.split("T")[0] ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Fecha fin *</label>
                <input type="date" name="fecha_fin" required value="${cap?.fecha_fin?.split("T")[0] ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Cupo maximo</label>
              <input type="number" name="cupo_maximo" min="1" value="${cap?.cupo_maximo ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div class="flex justify-end gap-3 pt-2">
              <button type="button" data-action="close-modal" class="${BTN_SECONDARY}">Cancelar</button>
              <button type="submit" class="${BTN_PRIMARY}">${cap ? "Guardar cambios" : "Crear"}</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  function renderInscripcionModal(cap: Capacitacion): string {
    const fechaInicio = cap.fecha_inicio ? new Date(cap.fecha_inicio).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const fechaFin = cap.fecha_fin ? new Date(cap.fecha_fin).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : "—";
    return `
      <div id="insc-modal-backdrop" data-action="close-inscripcion-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div data-inscripcion-inner class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Confirmar inscripcion</h2>
          <div class="space-y-3 mb-6">
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase">Capacitacion</p>
              <p class="text-sm text-gray-900 mt-0.5 font-medium">${esc(cap.nombre)}</p>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Modalidad</p>
                <p class="mt-0.5">${modalidadBadge(cap.modalidad)}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Duracion</p>
                <p class="text-sm text-gray-900 mt-0.5">${cap.duracion_horas} horas</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Fecha inicio</p>
                <p class="text-sm text-gray-900 mt-0.5">${fechaInicio}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-500 uppercase">Fecha fin</p>
                <p class="text-sm text-gray-900 mt-0.5">${fechaFin}</p>
              </div>
            </div>
            ${cap.instructor ? `<div><p class="text-xs font-medium text-gray-500 uppercase">Instructor</p><p class="text-sm text-gray-900 mt-0.5">${esc(cap.instructor)}</p></div>` : ""}
            <div>
              <p class="text-xs font-medium text-gray-500 uppercase">Cupo disponible</p>
              <p class="text-sm text-gray-900 mt-0.5">${cap.cupo_maximo ? `${cap.cupo_maximo - cap.inscritos_count} de ${cap.cupo_maximo}` : "Sin limite"}</p>
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" data-action="close-inscripcion-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-action="confirm-inscripcion" data-id="${cap.id}" class="${BTN_PRIMARY}">Confirmar inscripcion</button>
          </div>
        </div>
      </div>
    `;
  }

  async function handleAction(e: Event) {
    const t = e.target as HTMLElement;

    // Tabs
    const tabBtn = t.closest<HTMLElement>("[data-action='tab']");
    if (tabBtn) {
      const tab = tabBtn.dataset.tab as TabId;
      if (tab && tab !== state.activeTab) {
        state.activeTab = tab;
        if (tab === "inscripciones") {
          state.loading = true;
          render();
          await loadInscripciones();
          state.loading = false;
        }
        render();
      }
      return;
    }

    // Close modals
    const closeModal = t.closest<HTMLElement>("[data-action='close-modal']");
    if (closeModal) {
      if (!(closeModal.id === "cap-modal-backdrop" && t.closest("[data-modal-inner]"))) {
        state.showCreateModal = false;
        state.editingCapacitacion = null;
        render();
        return;
      }
    }

    const closeInscModal = t.closest<HTMLElement>("[data-action='close-inscripcion-modal']");
    if (closeInscModal) {
      if (!(closeInscModal.id === "insc-modal-backdrop" && t.closest("[data-inscripcion-inner]"))) {
        state.showInscripcionModal = null;
        render();
        return;
      }
    }

    // Open create modal
    if (t.closest("[data-action='open-create']")) {
      state.showCreateModal = true;
      state.editingCapacitacion = null;
      render();
      return;
    }

    // Edit capacitacion
    const editBtn = t.closest<HTMLElement>("[data-action='edit-cap']");
    if (editBtn) {
      const id = Number(editBtn.dataset.id);
      const cap = state.capacitaciones.items.find((c) => c.id === id);
      if (cap) {
        state.editingCapacitacion = cap;
        state.showCreateModal = false;
        render();
      }
      return;
    }

    // Delete capacitacion
    const deleteBtn = t.closest<HTMLElement>("[data-action='delete-cap']");
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      if (id && confirm("¿Eliminar esta capacitacion?")) {
        try {
          await deleteCapacitacion(id);
          await loadCapacitaciones();
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo eliminar la capacitacion.");
        }
      }
      return;
    }

    // Inscribirse (open confirm modal)
    const inscBtn = t.closest<HTMLElement>("[data-action='inscribirse']");
    if (inscBtn) {
      const id = Number(inscBtn.dataset.id);
      const cap = state.capacitaciones.items.find((c) => c.id === id);
      if (cap) {
        state.showInscripcionModal = cap;
        render();
      }
      return;
    }

    // Confirm inscripcion
    const confirmBtn = t.closest<HTMLElement>("[data-action='confirm-inscripcion']");
    if (confirmBtn) {
      const id = Number(confirmBtn.dataset.id);
      const empId = Number(getEmpleadoIdFromAccessToken());
      if (id && empId) {
        try {
          await inscribirse(id, empId);
          state.showInscripcionModal = null;
          await loadCapacitaciones();
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo completar la inscripcion.");
        }
      }
      return;
    }

    // Cancel inscripcion
    const cancelBtn = t.closest<HTMLElement>("[data-action='cancel-inscripcion']");
    if (cancelBtn) {
      const id = Number(cancelBtn.dataset.id);
      if (id && confirm("¿Cancelar esta inscripcion?")) {
        try {
          await cancelarInscripcion(id);
          await loadInscripciones();
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo cancelar la inscripcion.");
        }
      }
      return;
    }

    // Pagination
    const prevBtn = t.closest<HTMLElement>("[data-action='prev-page']");
    if (prevBtn) {
      const context = prevBtn.dataset.context;
      if (context === "catalogo" && state.page > 1) {
        state.page--;
        await loadCapacitaciones();
        render();
      } else if (context === "inscripciones" && state.inscripcionesPage > 1) {
        state.inscripcionesPage--;
        await loadInscripciones();
        render();
      }
      return;
    }

    const nextBtn = t.closest<HTMLElement>("[data-action='next-page']");
    if (nextBtn) {
      const context = nextBtn.dataset.context;
      if (context === "catalogo") {
        state.page++;
        await loadCapacitaciones();
        render();
      } else if (context === "inscripciones") {
        state.inscripcionesPage++;
        await loadInscripciones();
        render();
      }
      return;
    }
  }

  async function handleChange(e: Event) {
    const t = e.target as HTMLSelectElement;
    if (t.matches("[data-action='filter-area']")) {
      state.filters.area_id = t.value;
      state.page = 1;
      await loadCapacitaciones();
      render();
      return;
    }
    if (t.matches("[data-action='filter-modalidad']")) {
      state.filters.modalidad = t.value;
      state.page = 1;
      await loadCapacitaciones();
      render();
      return;
    }
    if (t.matches("[data-action='filter-estado']")) {
      state.filters.estado = t.value;
      state.page = 1;
      await loadCapacitaciones();
      render();
      return;
    }
  }

  async function handleSubmit(e: Event) {
    const form = (e.target as HTMLElement).closest("form");
    if (!form || !form.matches("[data-action='submit-cap']")) return;
    e.preventDefault();

    const fd = new FormData(form);
    const payload: CapacitacionCreatePayload = {
      nombre: fd.get("nombre") as string,
      descripcion: (fd.get("descripcion") as string) || undefined,
      modalidad: fd.get("modalidad") as "presencial" | "online" | "mixta",
      duracion_horas: Number(fd.get("duracion_horas")),
      instructor: (fd.get("instructor") as string) || undefined,
      area_id: fd.get("area_id") ? Number(fd.get("area_id")) : undefined,
      fecha_inicio: (fd.get("fecha_inicio") as string) || undefined,
      fecha_fin: (fd.get("fecha_fin") as string) || undefined,
      cupo_maximo: fd.get("cupo_maximo") ? Number(fd.get("cupo_maximo")) : undefined,
    };

    if (!payload.nombre || !payload.duracion_horas) return;

    try {
      if (state.editingCapacitacion) {
        await updateCapacitacion(state.editingCapacitacion.id, payload);
      } else {
        await createCapacitacion(payload);
      }
      state.showCreateModal = false;
      state.editingCapacitacion = null;
      await loadCapacitaciones();
      render();
    } catch (err: any) {
      alert(err?.detail ?? "Error al guardar la capacitacion");
    }
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='filter-search']")) {
      state.filters.search = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        state.page = 1;
        await loadCapacitaciones();
        render();
        const input = root.querySelector<HTMLInputElement>("[data-action='filter-search']");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      if (state.showInscripcionModal) {
        state.showInscripcionModal = null;
        render();
      } else if (state.showCreateModal || state.editingCapacitacion) {
        state.showCreateModal = false;
        state.editingCapacitacion = null;
        render();
      }
    }
  }

  root.addEventListener("click", handleAction, { signal });
  root.addEventListener("input", handleInput, { signal });
  root.addEventListener("change", handleChange, { signal });
  root.addEventListener("submit", handleSubmit, { signal });
  document.addEventListener("keydown", handleKeydown, { signal });

  // Initial load
  (async () => {
    render();
    await loadAreas();
    await loadCapacitaciones();
    state.loading = false;
    render();
  })();
}
