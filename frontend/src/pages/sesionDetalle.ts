import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_SECONDARY, BTN_DANGER, FIELD_FOCUS } from "../ui/uiTokens.ts";
import { getCursoById, getCursoSesion, getSesionEmpleados, inscribirEmpleadoSesion, quitarEmpleadoSesion, getSesionEmpleadosElegibles } from "../api/cursos.ts";
import type { EmpleadoElegible } from "../api/cursos.ts";
import { ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import type { Curso, CursoSesion, SesionEmpleadoItem } from "../dashboard/cursos/types.ts";

export function mountSesionDetalle(container: HTMLElement, cursoId: number, sesionId: number, signal: AbortSignal): void {
  interface State {
    curso: Curso | null;
    sesion: CursoSesion | null;
    empleados: SesionEmpleadoItem[];
    loading: boolean;
    error: string | null;
    searchQuery: string;
    searchResults: EmpleadoElegible[];
    searchLoading: boolean;
    showAddModal: boolean;
  }

  const state: State = {
    curso: null,
    sesion: null,
    empleados: [],
    loading: true,
    error: null,
    searchQuery: "",
    searchResults: [],
    searchLoading: false,
    showAddModal: false,
  };

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async function loadData(): Promise<void> {
    try {
      const [curso, sesion, empleados] = await Promise.all([
        getCursoById(cursoId),
        getCursoSesion(cursoId, sesionId),
        getSesionEmpleados(cursoId, sesionId),
      ]);
      state.curso = curso;
      state.sesion = sesion;
      state.empleados = empleados;
      state.error = null;
    } catch (err: unknown) {
      const e = err as { detail?: string };
      state.error = e?.detail ?? "Error al cargar la sesión";
    }
  }

  function render(): void {
    mountAppShell(container, {
      activeNav: "sesiones",
      mainHtml: renderPage(),
    });
    bindEvents();
  }

  function renderPage(): string {
    if (state.loading) return `<p class="text-sm text-slate-400">Cargando...</p>`;
    if (state.error) return `
      <div class="space-y-4">
        <a href="#/sesiones" class="text-sm text-blue-600 hover:underline">← Volver a sesiones</a>
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p class="text-sm text-red-700">${escapeHtml(state.error)}</p>
        </div>
      </div>`;

    const s = state.sesion!;
    const c = state.curso!;

    const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const fechaFin = s.fecha_fin ? new Date(s.fecha_fin + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : null;
    const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : null;

    const estadoCls =
      s.estado === "completada" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
      s.estado === "cancelada" ? "border-red-200 bg-red-50 text-red-800" :
      s.estado === "en_curso" ? "border-blue-200 bg-blue-50 text-blue-800" :
      "border-slate-200 bg-slate-50 text-slate-700";

    return `
    <div class="space-y-6">
      <div class="flex items-center gap-2">
        <a href="#/sesiones" class="text-sm text-blue-600 hover:underline">← Sesiones</a>
        <span class="text-slate-300">/</span>
        <span class="text-sm text-slate-500">Detalle de sesión</span>
      </div>

      <!-- Curso Info -->
      <div class="rounded-2xl border border-border bg-white p-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-slate-400 uppercase tracking-wide font-semibold">Curso</p>
            <h1 class="text-lg font-bold text-text-primary mt-0.5">${escapeHtml(c.nombre)}</h1>
            ${c.descripcion ? `<p class="text-sm text-slate-500 mt-1">${escapeHtml(c.descripcion)}</p>` : ""}
          </div>
          <a href="#/cursos/${c.id}" class="text-xs text-blue-600 hover:underline">Ver curso completo →</a>
        </div>
        <div class="flex flex-wrap gap-4 mt-3 text-xs text-slate-500">
          ${c.proveedor ? `<span>Proveedor: <strong>${escapeHtml(c.proveedor)}</strong></span>` : ""}
          ${c.duracion_horas ? `<span>Duración: <strong>${c.duracion_horas}h</strong></span>` : ""}
          ${c.categoria ? `<span>Categoría: <strong>${escapeHtml(c.categoria)}</strong></span>` : ""}
          ${c.centro_costos ? `<span>Centro costos: <strong>${c.centro_costos}</strong></span>` : ""}
        </div>
      </div>

      <!-- Session Info -->
      <div class="rounded-2xl border border-border bg-white p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-text-primary">Datos de la Sesión</h2>
          <span class="inline-flex items-center rounded-full border ${estadoCls} px-2.5 py-0.5 text-xs font-semibold">${escapeHtml(ESTADO_SESION_LABELS[s.estado])}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p class="text-slate-400 text-xs">Fecha inicio</p>
            <p class="font-medium text-text-primary">${escapeHtml(fecha)}</p>
          </div>
          ${fechaFin ? `<div>
            <p class="text-slate-400 text-xs">Fecha fin</p>
            <p class="font-medium text-text-primary">${escapeHtml(fechaFin)}</p>
          </div>` : ""}
          ${horario ? `<div>
            <p class="text-slate-400 text-xs">Horario</p>
            <p class="font-medium text-text-primary">${escapeHtml(horario)}</p>
          </div>` : ""}
          ${s.ubicacion ? `<div>
            <p class="text-slate-400 text-xs">Ubicación</p>
            <p class="font-medium text-text-primary">${escapeHtml(s.ubicacion)}</p>
          </div>` : ""}
          ${s.instructor ? `<div>
            <p class="text-slate-400 text-xs">Instructor</p>
            <p class="font-medium text-text-primary">${escapeHtml(s.instructor)}</p>
          </div>` : ""}
          <div>
            <p class="text-slate-400 text-xs">Cupo</p>
            <p class="font-medium text-text-primary">${s.cupo_max ? `${state.empleados.length}/${s.cupo_max}` : `${state.empleados.length} inscritos`}</p>
          </div>
        </div>
        ${s.notas ? `<div class="mt-4 pt-3 border-t border-slate-100">
          <p class="text-xs text-slate-400">Notas</p>
          <p class="text-sm text-slate-600 mt-0.5">${escapeHtml(s.notas)}</p>
        </div>` : ""}
      </div>

      <!-- Empleados inscritos -->
      <div class="rounded-2xl border border-border bg-white p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-base font-semibold text-text-primary">Empleados Inscritos (${state.empleados.length})</h2>
          <button data-action="open-add-empleado" class="${BTN_SECONDARY} text-xs">+ Agregar empleado</button>
        </div>
        ${state.empleados.length === 0 ? `
          <p class="text-sm text-slate-400 text-center py-4">Sin empleados inscritos en esta sesión.</p>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-2">No. Empleado</th>
                  <th class="px-4 py-2">Nombre</th>
                  <th class="px-4 py-2">Asistencia</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>${state.empleados.map(emp => `
                <tr class="border-b border-slate-100 hover:bg-slate-50/60">
                  <td class="px-4 py-2.5 text-sm text-slate-600 tabular-nums">${escapeHtml(emp.no_empleado ?? "—")}</td>
                  <td class="px-4 py-2.5 text-sm font-medium text-text-primary">${escapeHtml(emp.nombre_empleado ?? "—")}</td>
                  <td class="px-4 py-2.5 text-sm">${emp.asistio === true ? `<span class="text-emerald-600 font-medium">✓ Asistió</span>` : emp.asistio === false ? `<span class="text-red-600 font-medium">✗ No asistió</span>` : `<span class="text-slate-400">Pendiente</span>`}</td>
                  <td class="px-4 py-2.5 text-right">
                    <button data-action="quitar-empleado" data-id="${emp.id}" class="${BTN_DANGER} text-xs">Quitar</button>
                  </td>
                </tr>`).join("")}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${state.showAddModal ? renderAddModal() : ""}
    </div>`;
  }

  function renderAddModal(): string {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" data-backdrop="add-empleado-modal">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-text-primary">Agregar Empleado a Sesión</h3>
          <button data-action="close-add-modal" class="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>
        <input type="text" data-action="search-elegible" placeholder="Buscar por nombre o número..."
          value="${escapeHtml(state.searchQuery)}"
          class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm ${FIELD_FOCUS}" />
        <div class="max-h-60 overflow-y-auto space-y-1">
          ${state.searchLoading ? `<p class="text-xs text-slate-400 text-center py-3">Buscando...</p>` :
            state.searchResults.length === 0 && state.searchQuery.length >= 2 ? `<p class="text-xs text-slate-400 text-center py-3">Sin resultados.</p>` :
            state.searchResults.map(emp => `
              <button data-action="inscribir-empleado" data-empleado-id="${emp.id}" class="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-blue-50 text-left transition-colors">
                <div>
                  <span class="text-sm font-medium text-text-primary">${escapeHtml(emp.nombre ?? "—")}</span>
                  <span class="text-xs text-slate-400 ml-2">#${escapeHtml(emp.no_empleado ?? "")}</span>
                </div>
                <span class="text-[10px] text-slate-400">${escapeHtml(emp.origen)}</span>
              </button>`).join("")}
        </div>
      </div>
    </div>`;
  }

  function bindEvents(): void {
    container.addEventListener("click", handleClick, { signal });
    container.addEventListener("input", handleInput, { signal });
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    if ((t as HTMLElement).matches("[data-backdrop='add-empleado-modal']")) {
      state.showAddModal = false;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      return;
    }

    if (t.closest("[data-action='open-add-empleado']")) {
      state.showAddModal = true;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      const input = container.querySelector("[data-action='search-elegible']") as HTMLInputElement | null;
      input?.focus();
      return;
    }

    if (t.closest("[data-action='close-add-modal']")) {
      state.showAddModal = false;
      state.searchQuery = "";
      state.searchResults = [];
      render();
      return;
    }

    const inscribirBtn = t.closest("[data-action='inscribir-empleado']") as HTMLElement | null;
    if (inscribirBtn) {
      const empId = Number(inscribirBtn.dataset.empleadoId);
      if (!empId) return;
      try {
        await inscribirEmpleadoSesion(cursoId, sesionId, empId);
        state.empleados = await getSesionEmpleados(cursoId, sesionId);
        state.searchResults = state.searchResults.filter(r => r.id !== empId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    const quitarBtn = t.closest("[data-action='quitar-empleado']") as HTMLElement | null;
    if (quitarBtn) {
      const id = Number(quitarBtn.dataset.id);
      if (!id) return;
      try {
        await quitarEmpleadoSesion(cursoId, sesionId, id);
        state.empleados = state.empleados.filter(e => e.id !== id);
        render();
      } catch { /* silently handle */ }
      return;
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='search-elegible']")) {
      state.searchQuery = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      if (t.value.trim().length < 2) {
        state.searchResults = [];
        render();
        return;
      }
      searchTimeout = setTimeout(async () => {
        state.searchLoading = true;
        render();
        try {
          state.searchResults = await getSesionEmpleadosElegibles(cursoId, sesionId, state.searchQuery);
        } catch {
          state.searchResults = [];
        }
        state.searchLoading = false;
        render();
        const input = container.querySelector("[data-action='search-elegible']") as HTMLInputElement | null;
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }
  }

  render();

  (async () => {
    await loadData();
    state.loading = false;
    render();
  })();
}
