import {
  getCursosDashboardHistorialEmpleado,
  getCursosDashboardRegistros,
  getCursosDashboardResumen,
} from "../api/cursosSeguimiento.ts";
import { getEmpleadosCatalogoFiltros } from "../api/empleados.ts";
import { getCursos } from "../api/cursos.ts";
import { renderEmpleadoHistorialPanel } from "../components/cursos/rhCursosEmpleadoHistorialPanel.ts";
import { renderCursosSeguimientoKpis } from "../components/cursos/rhCursosSeguimientoKpis.ts";
import { renderVistaRapida } from "../components/cursos/rhCursosSeguimientoVistaRapida.ts";
import type {
  CursosDashboardEmpleadoHistorial,
  CursosDashboardRegistroItem,
  CursosDashboardResumen,
  EstadoCursoEmpleado,
} from "../dashboard/cursos/seguimientoTypes.ts";
import {
  ESTADO_CURSO_BADGE,
  ESTADO_CURSO_LABELS,
} from "../dashboard/cursos/seguimientoTypes.ts";
import { ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import type { EstadoSesion } from "../dashboard/cursos/types.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  BTN_GHOST,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";

const FILTER_SELECT_CLS = `${RH_LISTADO_SELECT} col-start-1 row-start-1 appearance-none ${RH_LISTADO_FOCUS_RING}`;
const FILTER_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

interface FiltrosState {
  q: string;
  empleadoId: string;
  cursoId: string;
  areaId: string;
  puestoId: string;
  estadoCurso: string;
  estadoSesion: string;
  fechaDesde: string;
  fechaHasta: string;
}

interface State {
  resumen: CursosDashboardResumen | null;
  registros: CursosDashboardRegistroItem[];
  total: number;
  page: number;
  pageSize: number;
  loadingResumen: boolean;
  loadingRegistros: boolean;
  filtros: FiltrosState;
  historial: CursosDashboardEmpleadoHistorial | null;
  historialEmpleadoId: number | null;
  historialFiltroEstado: string;
  historialLoading: boolean;
  panelOpen: boolean;
  areas: { id: number; descripcion: string }[];
  puestos: { id: number; descripcion: string }[];
}

export function mountCursosSeguimiento(container: HTMLElement): void {
  const state: State = {
    resumen: null,
    registros: [],
    total: 0,
    page: 1,
    pageSize: 50,
    loadingResumen: true,
    loadingRegistros: true,
    filtros: {
      q: "",
      empleadoId: "",
      cursoId: "",
      areaId: "",
      puestoId: "",
      estadoCurso: "",
      estadoSesion: "",
      fechaDesde: "",
      fechaHasta: "",
    },
    historial: null,
    historialEmpleadoId: null,
    historialFiltroEstado: "",
    historialLoading: false,
    panelOpen: false,
    areas: [],
    puestos: [],
  };

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  async function loadCatalogos(): Promise<void> {
    try {
      const cat = await getEmpleadosCatalogoFiltros();
      state.areas = (cat.areas ?? []).map((a) => ({
        id: a.area_id,
        descripcion: a.descripcion,
      }));
      state.puestos = (cat.puestos ?? []).map((p) => ({
        id: p.puesto_id,
        descripcion: p.descripcion,
      }));
    } catch {
      state.areas = [];
      state.puestos = [];
    }
  }

  async function loadResumen(): Promise<void> {
    state.loadingResumen = true;
    render();
    try {
      state.resumen = await getCursosDashboardResumen();
    } catch {
      state.resumen = null;
    }
    state.loadingResumen = false;
    render();
  }

  function filtrosParams() {
    const f = state.filtros;
    return {
      page: state.page,
      page_size: state.pageSize,
      q: f.q || undefined,
      empleado_id: f.empleadoId ? Number(f.empleadoId) : undefined,
      curso_id: f.cursoId ? Number(f.cursoId) : undefined,
      area_id: f.areaId ? Number(f.areaId) : undefined,
      puesto_id: f.puestoId ? Number(f.puestoId) : undefined,
      estado_curso: (f.estadoCurso || undefined) as EstadoCursoEmpleado | undefined,
      estado_sesion: f.estadoSesion || undefined,
      fecha_desde: f.fechaDesde || undefined,
      fecha_hasta: f.fechaHasta || undefined,
    };
  }

  async function loadRegistros(): Promise<void> {
    state.loadingRegistros = true;
    render();
    try {
      const data = await getCursosDashboardRegistros(filtrosParams());
      state.registros = data.items;
      state.total = data.total;
    } catch {
      state.registros = [];
      state.total = 0;
    }
    state.loadingRegistros = false;
    render();
  }

  async function openHistorial(empleadoId: number): Promise<void> {
    state.panelOpen = true;
    state.historialEmpleadoId = empleadoId;
    state.historialLoading = true;
    state.historial = null;
    render();
    try {
      state.historial = await getCursosDashboardHistorialEmpleado(
        empleadoId,
        (state.historialFiltroEstado || undefined) as EstadoCursoEmpleado | undefined,
      );
    } catch {
      state.historial = null;
    }
    state.historialLoading = false;
    render();
  }

  function closeHistorial(): void {
    state.panelOpen = false;
    state.historialEmpleadoId = null;
    state.historial = null;
    render();
  }

  function renderFiltros(): string {
    const f = state.filtros;
    const areaOpts = state.areas
      .map((a) => `<option value="${a.id}" ${f.areaId === String(a.id) ? "selected" : ""}>${escapeHtml(a.descripcion)}</option>`)
      .join("");
    const puestoOpts = state.puestos
      .map((p) => `<option value="${p.id}" ${f.puestoId === String(p.id) ? "selected" : ""}>${escapeHtml(p.descripcion)}</option>`)
      .join("");
    const estadoCursoOpts = Object.entries(ESTADO_CURSO_LABELS)
      .map(([k, label]) => `<option value="${k}" ${f.estadoCurso === k ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("");
    const estadoSesionOpts = Object.entries(ESTADO_SESION_LABELS)
      .map(([k, label]) => `<option value="${k}" ${f.estadoSesion === k ? "selected" : ""}>${escapeHtml(label)}</option>`)
      .join("");

    return `<div class="${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-q">Buscar</label>
          <input id="seg-q" type="search" class="${FILTER_INPUT_CLS}" placeholder="Empleado o curso…" value="${escapeHtml(f.q)}" data-field="q" />
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-emp">ID empleado</label>
          <input id="seg-emp" type="number" class="${FILTER_INPUT_CLS}" placeholder="Opcional" value="${escapeHtml(f.empleadoId)}" data-field="empleadoId" />
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-curso">ID curso</label>
          <input id="seg-curso" type="number" class="${FILTER_INPUT_CLS}" placeholder="Opcional" value="${escapeHtml(f.cursoId)}" data-field="cursoId" />
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-area">Área</label>
          <div class="grid grid-cols-1">
            <select id="seg-area" class="${FILTER_SELECT_CLS}" data-field="areaId">
              <option value="">Todas</option>${areaOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-puesto">Puesto</label>
          <div class="grid grid-cols-1">
            <select id="seg-puesto" class="${FILTER_SELECT_CLS}" data-field="puestoId">
              <option value="">Todos</option>${puestoOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-est-curso">Estado curso</label>
          <div class="grid grid-cols-1">
            <select id="seg-est-curso" class="${FILTER_SELECT_CLS}" data-field="estadoCurso">
              <option value="">Todos</option>${estadoCursoOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-est-ses">Estado sesión</label>
          <div class="grid grid-cols-1">
            <select id="seg-est-ses" class="${FILTER_SELECT_CLS}" data-field="estadoSesion">
              <option value="">Todos</option>${estadoSesionOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-desde">Desde</label>
          <input id="seg-desde" type="date" class="${FILTER_INPUT_CLS}" value="${escapeHtml(f.fechaDesde)}" data-field="fechaDesde" />
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label class="${RH_LISTADO_LABEL}" for="seg-hasta">Hasta</label>
          <input id="seg-hasta" type="date" class="${FILTER_INPUT_CLS}" value="${escapeHtml(f.fechaHasta)}" data-field="fechaHasta" />
        </div>
      </div>
      <div class="mt-3 flex justify-end gap-2">
        <button type="button" class="${RH_LISTADO_BTN_GHOST}" data-action="limpiar-filtros">Limpiar</button>
      </div>
    </div>`;
  }

  function renderTabla(): string {
    if (state.loadingRegistros) {
      return `<div class="${RH_LISTADO_SURFACE} rounded-2xl border p-8 text-center text-sm text-text-muted animate-pulse">Cargando registros…</div>`;
    }
    if (!state.registros.length) {
      return `<div class="${RH_LISTADO_SURFACE} rounded-2xl border p-8 text-center text-sm text-text-muted">No hay registros con los filtros actuales.</div>`;
    }

    const rows = state.registros
      .map((r) => {
        const badge = ESTADO_CURSO_BADGE[r.estado_curso];
        const sesEst =
          r.estado_sesion
            ? (ESTADO_SESION_LABELS[r.estado_sesion as EstadoSesion] ?? r.estado_sesion)
            : "—";
        return `<tr class="cursor-pointer hover:bg-slate-50/80" data-action="open-empleado" data-empleado-id="${r.empleado_id}">
          <td class="px-4 py-3 text-sm font-medium text-text-primary">${escapeHtml(r.nombre_empleado ?? "—")}</td>
          <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(r.no_empleado ?? "—")}</td>
          <td class="px-4 py-3 text-sm text-text-primary">${escapeHtml(r.curso_nombre ?? "—")}</td>
          <td class="px-4 py-3"><span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badge}">${escapeHtml(ESTADO_CURSO_LABELS[r.estado_curso])}</span></td>
          <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(sesEst)}</td>
          <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(r.sesion_fecha_inicio ?? "—")}</td>
          <td class="px-4 py-3 text-sm text-text-muted">${escapeHtml(r.fecha_finalizacion ?? "—")}</td>
        </tr>`;
      })
      .join("");

    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const pages = paginationRange(state.page, totalPages);

    return `<div class="${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead class="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th class="px-4 py-3">Empleado</th>
              <th class="px-4 py-3">No.</th>
              <th class="px-4 py-3">Curso</th>
              <th class="px-4 py-3">Estado curso</th>
              <th class="px-4 py-3">Estado sesión</th>
              <th class="px-4 py-3">Fecha sesión</th>
              <th class="px-4 py-3">Finalización</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${rows}</tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-text-muted">
        <span>${state.total} registro(s)</span>
        <nav class="flex items-center gap-1" aria-label="Paginación">
          ${pages
            .map((p) =>
              typeof p === "number"
                ? `<button type="button" class="${p === state.page ? "rounded-md bg-accent px-2.5 py-1 text-white" : `${BTN_GHOST} px-2.5 py-1`}" data-action="page" data-page="${p}">${p}</button>`
                : `<span class="px-1">…</span>`,
            )
            .join("")}
        </nav>
      </div>
    </div>`;
  }

  function renderContent(): string {
    const resumen = state.resumen;
    return `<div class="${RH_LISTADO_PAGE_OUTER} space-y-6">
      <header>
        <h1 class="text-2xl font-bold text-text-primary">Seguimiento de capacitaciones</h1>
        <p class="mt-1 max-w-3xl text-sm text-text-muted">Vista consolidada de asignaciones, sesiones y cumplimiento por empleado y curso.</p>
      </header>

      ${renderCursosSeguimientoKpis(resumen?.kpis ?? null, state.loadingResumen)}

      ${
        resumen && !state.loadingResumen
          ? `<div class="space-y-3">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Vista rápida</h2>
              ${renderVistaRapida({
                empleadosCursosPendientes: resumen.empleados_cursos_pendientes,
                empleadosSesionesPendientes: resumen.empleados_sesiones_pendientes,
                sesionesProximas: resumen.sesiones_proximas,
              })}
            </div>`
          : ""
      }

      <div class="space-y-3">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Filtros y registros</h2>
        ${renderFiltros()}
        ${renderTabla()}
      </div>
    </div>
    ${renderEmpleadoHistorialPanel(state.historial, state.historialLoading, state.historialFiltroEstado, state.panelOpen)}`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Seguimiento de capacitaciones",
      activeNav: "cursos-seguimiento",
      mainClass: "py-0",
      mainHtml: renderContent(),
    });
  }

  async function reloadResumen(): Promise<void> {
    state.loadingResumen = true;
    render();
    await loadResumen();
  }

  async function reloadRegistros(): Promise<void> {
    state.loadingRegistros = true;
    render();
    await loadRegistros();
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === "open-empleado") {
      const id = Number(actionEl.dataset.empleadoId);
      if (id) await openHistorial(id);
      return;
    }
    if (action === "close-historial") {
      closeHistorial();
      return;
    }
    if (action === "page") {
      state.page = Number(actionEl.dataset.page) || 1;
      await reloadRegistros();
      return;
    }
    if (action === "limpiar-filtros") {
      state.filtros = {
        q: "",
        empleadoId: "",
        cursoId: "",
        areaId: "",
        puestoId: "",
        estadoCurso: "",
        estadoSesion: "",
        fechaDesde: "",
        fechaHasta: "",
      };
      state.page = 1;
      await reloadRegistros();
      return;
    }
    if (action === "hist-filtro-estado") {
      state.historialFiltroEstado = actionEl.dataset.estado ?? "";
      if (state.historialEmpleadoId) await openHistorial(state.historialEmpleadoId);
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLElement;
    const field = t.getAttribute("data-field") as keyof FiltrosState | null;
    if (!field || !(t instanceof HTMLInputElement || t instanceof HTMLSelectElement)) return;
    state.filtros[field] = t.value;
    state.page = 1;
    await reloadRegistros();
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLElement;
    if (t.getAttribute("data-field") !== "q" || !(t instanceof HTMLInputElement)) return;
    state.filtros.q = t.value;
    state.page = 1;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => void reloadRegistros(), 350);
  }

  render();
  container.addEventListener("click", (e) => void handleClick(e));
  container.addEventListener("change", (e) => void handleChange(e));
  container.addEventListener("input", handleInput);

  void (async () => {
    await loadCatalogos();
    await Promise.all([loadResumen(), loadRegistros()]);
    void getCursos({ page: 1, page_size: 1 }).catch(() => undefined);
  })();
}
