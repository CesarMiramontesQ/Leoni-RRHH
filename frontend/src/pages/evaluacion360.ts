import { hasRhOperativeViewerContext } from "../auth/jwt.ts";
import { hasRhModule } from "../auth/rhModulePermissions.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { destroyChartsIn, runChartsAfterLayout } from "../charts/index.ts";
import {
  mountEval360ReportesCharts,
  mountEval360ResultadosCharts,
  mountEval360RhDashboardCharts,
} from "../evaluacion360/charts.ts";
import { EMPTY_EVAL360_FILTERS, readEval360FiltersFromDom } from "../evaluacion360/filters.ts";
import { MOCK_EVALUACIONES } from "../evaluacion360/mockData.ts";
import { EVAL360_BASE_HASH, parseEval360ViewFromHash, renderEval360SubNav } from "../evaluacion360/subNav.ts";
import type { Campana360, Eval360Filters, Eval360ViewId } from "../evaluacion360/types.ts";
import { campanaEstadoBadge, renderAvanceBar } from "../evaluacion360/shared.ts";
import { renderEval360Configuracion } from "../evaluacion360/views/configuracion.ts";
import {
  getDashboardChartData,
  renderEval360RhDashboard,
  renderEval360RhHeader,
} from "../evaluacion360/views/dashboardRh.ts";
import { renderEval360Empleados } from "../evaluacion360/views/empleados.ts";
import { renderEval360Evaluaciones } from "../evaluacion360/views/evaluaciones.ts";
import { renderEval360Reportes } from "../evaluacion360/views/reportes.ts";
import { mapReporteToChartComps, renderResultadosReal } from "../evaluacion360/views/resultadosReal.ts";
import { BTN_PRIMARY, htmlAccessDenied, RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  activarEval360Campana,
  cancelarEval360Campana,
  cerrarEval360Campana,
  descargarEval360Export,
  duplicarEval360Campana,
  fetchEval360Campanas,
  fetchEval360Participantes,
  fetchEval360Reporte,
  type CampanaApi,
  type ParticipanteApi,
  type ReporteIndividualApi,
} from "../api/evaluacion360.ts";
import { openCampanaWizard } from "../evaluacion360/campanaWizard.ts";

const PAGE_SHELL = RH_DASHBOARD_PAGE_SHELL;

interface State {
  view: Eval360ViewId;
  showCampanaModal: boolean;
  filters: Eval360Filters;
  search: string;
  campanas: CampanaApi[] | null; // null = aún no cargadas
  campanasError: boolean;
  // Resultados
  resCampanaId: number | null;
  resParticipantes: ParticipanteApi[] | null;
  resParticipanteId: number | null;
  resReporte: ReporteIndividualApi | null;
  resLoading: boolean;
}

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "El módulo Evaluación 360° está disponible exclusivamente para usuarios con rol Recursos Humanos.",
  });
}

function renderHeader(view: Eval360ViewId): string {
  if (view === "dashboard") return renderEval360RhHeader();
  return `
    <div class="flex flex-col gap-1">
      <p class="text-xs font-medium text-text-muted">Level Up · Recursos Humanos</p>
      <h1 class="mt-0.5 text-xl font-bold text-text-primary">Evaluación 360°</h1>
      <p class="mt-1 text-sm text-text-muted">Vista integral de desempeño, competencias y brechas de talento por planta.</p>
    </div>`;
}

// ── Campañas conectadas a la API ──────────────────────────────────────────────
function adaptCampana(c: CampanaApi): Campana360 {
  const periodo = [c.fecha_inicio, c.fecha_cierre].filter(Boolean).join(" – ") || "—";
  return {
    id: String(c.id),
    nombre: c.nombre,
    periodo,
    empleados: c.participantes,
    evaluadores: c.evaluadores,
    avance: Math.round(c.avance),
    estado: c.estado,
    descripcion: c.descripcion ?? undefined,
    fechaInicio: c.fecha_inicio ?? undefined,
    fechaCierre: c.fecha_cierre ?? undefined,
  };
}

function renderCampanasSkeleton(): string {
  const row = `
    <div class="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
      <div class="h-4 w-40 animate-pulse rounded bg-slate-100"></div>
      <div class="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
      <div class="h-4 flex-1 animate-pulse rounded bg-slate-100"></div>
      <div class="h-4 w-20 animate-pulse rounded bg-slate-100"></div>
    </div>`;
  return `
    <div class="rounded-xl border border-border bg-white">
      <div class="border-b border-slate-100 px-5 py-4">
        <div class="h-4 w-48 animate-pulse rounded bg-slate-100"></div>
      </div>
      ${row.repeat(4)}
    </div>`;
}

function renderCampanaAcciones(c: CampanaApi): string {
  const btn = (accion: string, label: string, cls: string) =>
    `<button type="button" class="${cls}" data-action="${accion}" data-id="${c.id}">${label}</button>`;
  const acciones: string[] = [
    btn("e360-campana-ver", "Ver", "text-xs font-semibold text-accent hover:underline"),
    btn("e360-campana-duplicar", "Duplicar", "text-xs font-semibold text-slate-600 hover:underline"),
  ];
  if (c.estado === "borrador") {
    acciones.splice(1, 0, btn("e360-campana-activar", "Activar", "text-xs font-semibold text-blue-600 hover:underline"));
  }
  if (["activa", "en_progreso", "finalizada"].includes(c.estado)) {
    acciones.push(btn("e360-campana-cerrar", "Cerrar", "text-xs font-semibold text-emerald-700 hover:underline"));
  }
  if (!["cerrada", "cancelada"].includes(c.estado)) {
    acciones.push(btn("e360-campana-cancelar", "Cancelar", "text-xs font-semibold text-red-600 hover:underline"));
  }
  return `<div class="flex flex-wrap gap-2">${acciones.join("")}</div>`;
}

function renderCampanasReal(campanas: CampanaApi[]): string {
  if (campanas.length === 0) {
    return `
      <div class="rounded-xl border border-border bg-white">
        <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-sm font-semibold text-text-primary">Campañas de evaluación</h2>
            <p class="mt-0.5 text-xs text-text-muted">Sin campañas registradas</p>
          </div>
        </div>
        <div class="px-5 py-12 text-center text-sm text-text-muted">
          <p>Aún no hay campañas.</p>
          <button type="button" class="${BTN_PRIMARY} mt-4" data-action="e360-open-modal">Nueva campaña</button>
        </div>
      </div>`;
  }
  const rows = campanas
    .map((c) => {
      const a = adaptCampana(c);
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/50">
        <td class="px-4 py-3">
          <p class="text-sm font-medium text-text-primary">${escapeHtml(a.nombre)}</p>
          <p class="text-xs text-text-muted">#${escapeHtml(a.id)}</p>
        </td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(a.periodo)}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-700">${a.empleados}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-700">${a.evaluadores}</td>
        <td class="px-4 py-3">${renderAvanceBar(a.avance)}</td>
        <td class="px-4 py-3">${campanaEstadoBadge(a.estado)}</td>
        <td class="px-4 py-3">${renderCampanaAcciones(c)}</td>
      </tr>`;
    })
    .join("");
  return `
    <div class="rounded-xl border border-border bg-white">
      <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Campañas de evaluación</h2>
          <p class="mt-0.5 text-xs text-text-muted">${campanas.length} campañas registradas</p>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-campanas-refresh">Actualizar</button>
          <button type="button" class="${BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Periodo</th>
              <th class="px-4 py-3">Participantes</th>
              <th class="px-4 py-3">Evaluadores</th>
              <th class="px-4 py-3">Avance</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderCampanasView(state: State): string {
  if (state.campanasError) {
    return `
      <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">
        No se pudieron cargar las campañas. Intenta de nuevo.
      </div>`;
  }
  if (state.campanas === null) return renderCampanasSkeleton();
  // El listado opera contra la API real. El asistente guiado de creación llega
  // en la próxima entrega (ver plan de fases).
  return renderCampanasReal(state.campanas);
}

function renderViewContent(state: State): string {
  switch (state.view) {
    case "empleados":
      return renderEval360Empleados({ filters: state.filters, search: state.search });
    case "campanas":
      return renderCampanasView(state);
    case "evaluaciones":
      return renderEval360Evaluaciones(MOCK_EVALUACIONES);
    case "resultados":
      return renderResultadosReal({
        campanas: state.campanas,
        campanaId: state.resCampanaId,
        participantes: state.resParticipantes,
        participanteId: state.resParticipanteId,
        reporte: state.resReporte,
        loading: state.resLoading,
      });
    case "reportes":
      return renderEval360Reportes();
    case "configuracion":
      return renderEval360Configuracion();
    default:
      return renderEval360RhDashboard({ filters: state.filters });
  }
}

function mountViewCharts(root: HTMLElement, state: State): void {
  if (state.view === "dashboard") {
    const data = getDashboardChartData({ filters: state.filters });
    mountEval360RhDashboardCharts(root, data.competenciasDept);
  } else if (state.view === "resultados") {
    if (state.resReporte) {
      mountEval360ResultadosCharts(root, mapReporteToChartComps(state.resReporte));
    }
  } else if (state.view === "reportes") {
    mountEval360ReportesCharts(root);
  }
}

export function mountEvaluacion360(container: HTMLElement, signal: AbortSignal): void {
  if (!hasRhOperativeViewerContext() || !hasRhModule("evaluacion-360")) {
    mountAppShell(container, {
      pageTitle: "Evaluación 360°",
      activeNav: "evaluacion-360",
      mainClass: "py-0",
      mainHtml: `<div class="${PAGE_SHELL}"><div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">${renderLevelUpBackBar()}${forbiddenHtml()}</div></div>`,
    });
    return;
  }

  const state: State = {
    view: parseEval360ViewFromHash(window.location.hash),
    showCampanaModal: false,
    filters: { ...EMPTY_EVAL360_FILTERS },
    search: "",
    campanas: null,
    campanasError: false,
    resCampanaId: null,
    resParticipantes: null,
    resParticipanteId: null,
    resReporte: null,
    resLoading: false,
  };

  mountAppShell(container, {
    pageTitle: "Evaluación 360°",
    activeNav: "evaluacion-360",
    mainHtml: `<div id="eval360-page" class="${PAGE_SHELL}"></div>`,
    mainClass: "py-0",
  });

  const pageRoot = container.querySelector<HTMLElement>("#eval360-page")!;

  let paintSeq = 0;

  async function loadCampanas(force = false): Promise<void> {
    if (state.campanas !== null && !force) return;
    state.campanasError = false;
    try {
      const data = await fetchEval360Campanas({ page_size: 50 });
      state.campanas = data.items;
    } catch {
      state.campanasError = true;
      state.campanas = [];
    }
    if (!signal.aborted && (state.view === "campanas" || state.view === "resultados")) paint();
  }

  async function loadResParticipantes(campanaId: number): Promise<void> {
    state.resCampanaId = campanaId;
    state.resParticipantes = null;
    state.resParticipanteId = null;
    state.resReporte = null;
    paint();
    state.resParticipantes = await fetchEval360Participantes(campanaId);
    if (!signal.aborted && state.view === "resultados") paint();
  }

  async function loadResReporte(participanteId: number): Promise<void> {
    state.resParticipanteId = participanteId;
    state.resReporte = null;
    state.resLoading = true;
    paint();
    state.resReporte = await fetchEval360Reporte(participanteId);
    state.resLoading = false;
    if (!signal.aborted && state.view === "resultados") paint();
  }

  async function ejecutarAccionCampana(
    accion: (id: number) => Promise<unknown>,
    id: number,
    errorMsg: string,
  ): Promise<void> {
    try {
      const res = await accion(id);
      if (res === null) {
        window.alert(errorMsg);
        return;
      }
    } catch {
      window.alert(errorMsg);
      return;
    }
    await loadCampanas(true);
  }

  function paint(): void {
    const seq = ++paintSeq;
    const isStale = (): boolean => seq !== paintSeq || signal.aborted;
    destroyChartsIn(pageRoot);
    pageRoot.innerHTML = `
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLevelUpBackBar()}
        ${renderHeader(state.view)}
        <div class="mt-4">${renderEval360SubNav(state.view)}</div>
        <div id="eval360-content">${renderViewContent(state)}</div>
      </div>`;
    const content = pageRoot.querySelector("#eval360-content");
    if (content) {
      runChartsAfterLayout(content, () => mountViewCharts(content as HTMLElement, state), { isStale });
    }
    if (state.view === "campanas" || state.view === "resultados") void loadCampanas();
    bindEvents();
  }

  function bindEvents(): void {
    pageRoot.querySelectorAll("[data-filter]").forEach((el) => {
      el.addEventListener("change", () => {
        state.filters = readEval360FiltersFromDom(pageRoot);
        paint();
      });
    });

    pageRoot.querySelector('[data-action="e360-clear-filters"]')?.addEventListener("click", () => {
      state.filters = { ...EMPTY_EVAL360_FILTERS };
      paint();
    });

    const searchInput = pageRoot.querySelector<HTMLInputElement>('[data-input="e360-search"]');
    searchInput?.addEventListener("input", () => {
      state.search = searchInput.value;
      paint();
    });

    pageRoot.querySelectorAll('[data-action="e360-select-empleado"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        window.location.hash = `${EVAL360_BASE_HASH}/resultados`;
      });
    });

    pageRoot.querySelectorAll('[data-action="e360-open-modal"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.view !== "campanas") {
          window.location.hash = `${EVAL360_BASE_HASH}/campanas`;
          return;
        }
        openCampanaWizard(pageRoot, () => {
          void loadCampanas(true);
        });
      });
    });

    pageRoot.querySelector('[data-action="e360-campanas-refresh"]')?.addEventListener("click", () => {
      void loadCampanas(true);
    });

    pageRoot.querySelector('[data-action="e360-generar-reporte"]')?.addEventListener("click", () => {
      window.location.hash = `${EVAL360_BASE_HASH}/reportes`;
    });

    pageRoot.querySelector('[data-action="e360-exportar"]')?.addEventListener("click", () => {
      window.alert("Exportación de resultados 360° (próxima entrega).");
    });

    // Acciones de ciclo de vida de campaña (datos reales).
    const idOf = (btn: Element): number => Number(btn.getAttribute("data-id"));
    pageRoot.querySelectorAll('[data-action="e360-campana-ver"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        void loadResParticipantes(idOf(btn));
        window.location.hash = `${EVAL360_BASE_HASH}/resultados`;
      });
    });
    pageRoot.querySelectorAll('[data-action="e360-campana-activar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm("¿Activar la campaña? Se generarán las evaluaciones y se notificará a los evaluadores.")) return;
        void ejecutarAccionCampana(activarEval360Campana, idOf(btn), "No se pudo activar la campaña. Verifica participantes y pesos (deben sumar 100%).");
      });
    });
    pageRoot.querySelectorAll('[data-action="e360-campana-duplicar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        void ejecutarAccionCampana(duplicarEval360Campana, idOf(btn), "No se pudo duplicar la campaña.");
      });
    });
    pageRoot.querySelectorAll('[data-action="e360-campana-cerrar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm("¿Cerrar la campaña? Se calcularán los resultados finales.")) return;
        void ejecutarAccionCampana(cerrarEval360Campana, idOf(btn), "No se pudo cerrar la campaña.");
      });
    });
    pageRoot.querySelectorAll('[data-action="e360-campana-cancelar"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!window.confirm("¿Cancelar la campaña? Esta acción no calcula resultados.")) return;
        void ejecutarAccionCampana(cancelarEval360Campana, idOf(btn), "No se pudo cancelar la campaña.");
      });
    });

    // Resultados: selectores de campaña/participante y exportación.
    pageRoot.querySelector<HTMLSelectElement>('[data-select="e360-res-campana"]')?.addEventListener("change", (e) => {
      const id = Number((e.target as HTMLSelectElement).value);
      if (id) void loadResParticipantes(id);
    });
    pageRoot.querySelector<HTMLSelectElement>('[data-select="e360-res-participante"]')?.addEventListener("change", (e) => {
      const id = Number((e.target as HTMLSelectElement).value);
      if (id) void loadResReporte(id);
    });
    pageRoot.querySelector('[data-action="e360-export-pdf"]')?.addEventListener("click", () => {
      if (state.resParticipanteId) {
        void descargarEval360Export(
          `/participantes/${state.resParticipanteId}/reporte/export?formato=pdf`,
          `reporte_360_${state.resParticipanteId}.pdf`,
        );
      }
    });
    pageRoot.querySelector('[data-action="e360-export-excel"]')?.addEventListener("click", () => {
      if (state.resParticipanteId) {
        void descargarEval360Export(
          `/participantes/${state.resParticipanteId}/reporte/export?formato=excel`,
          `reporte_360_${state.resParticipanteId}.xlsx`,
        );
      }
    });
  }

  const onHashChange = (): void => {
    const next = parseEval360ViewFromHash(window.location.hash);
    if (next !== state.view) {
      state.view = next;
      if (next !== "campanas") state.showCampanaModal = false;
      paint();
    }
  };

  window.addEventListener("hashchange", onHashChange, { signal });
  paint();
}
