import { getRolFromAccessToken, hasRhOperativeViewerContext } from "../auth/jwt.ts";
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
import { MOCK_CAMPANAS, MOCK_EVALUACIONES, RADAR_COMPETENCIAS } from "../evaluacion360/mockData.ts";
import { EVAL360_BASE_HASH, parseEval360ViewFromHash, renderEval360SubNav } from "../evaluacion360/subNav.ts";
import type { Eval360Filters, Eval360ViewId } from "../evaluacion360/types.ts";
import { renderEval360Campanas } from "../evaluacion360/views/campanas.ts";
import { renderEval360Configuracion } from "../evaluacion360/views/configuracion.ts";
import {
  getDashboardChartData,
  renderEval360RhDashboard,
  renderEval360RhHeader,
} from "../evaluacion360/views/dashboardRh.ts";
import { renderEval360Empleados } from "../evaluacion360/views/empleados.ts";
import { renderEval360Evaluaciones } from "../evaluacion360/views/evaluaciones.ts";
import { renderEval360Reportes } from "../evaluacion360/views/reportes.ts";
import { renderEval360Resultados } from "../evaluacion360/views/resultados.ts";
import { htmlAccessDenied, RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../ui/uiTokens.ts";

const PAGE_SHELL = RH_DASHBOARD_PAGE_SHELL;

interface State {
  view: Eval360ViewId;
  showCampanaModal: boolean;
  filters: Eval360Filters;
  search: string;
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

function renderViewContent(state: State): string {
  switch (state.view) {
    case "empleados":
      return renderEval360Empleados({ filters: state.filters, search: state.search });
    case "campanas":
      return renderEval360Campanas(MOCK_CAMPANAS, state.showCampanaModal);
    case "evaluaciones":
      return renderEval360Evaluaciones(MOCK_EVALUACIONES);
    case "resultados":
      return renderEval360Resultados();
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
    mountEval360ResultadosCharts(root, RADAR_COMPETENCIAS);
  } else if (state.view === "reportes") {
    mountEval360ReportesCharts(root);
  }
}

export function mountEvaluacion360(container: HTMLElement, signal: AbortSignal): void {
  if (!hasRhOperativeViewerContext() || !hasRhModule("level-up")) {
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
  };

  mountAppShell(container, {
    pageTitle: "Evaluación 360°",
    activeNav: "evaluacion-360",
    mainHtml: `<div id="eval360-page" class="${PAGE_SHELL}"></div>`,
    mainClass: "py-0",
  });

  const pageRoot = container.querySelector<HTMLElement>("#eval360-page")!;

  let paintSeq = 0;

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

    pageRoot.querySelector('[data-action="e360-open-modal"]')?.addEventListener("click", () => {
      state.showCampanaModal = true;
      if (state.view !== "campanas") {
        window.location.hash = `${EVAL360_BASE_HASH}/campanas`;
        return;
      }
      paint();
    });

    pageRoot.querySelector('[data-action="e360-close-modal"]')?.addEventListener("click", () => {
      state.showCampanaModal = false;
      paint();
    });

    pageRoot.querySelector('[data-action="e360-generar-reporte"]')?.addEventListener("click", () => {
      window.location.hash = `${EVAL360_BASE_HASH}/reportes`;
    });

    pageRoot.querySelector('[data-action="e360-exportar"]')?.addEventListener("click", () => {
      window.alert("Exportación de resultados 360° (demo).");
    });

    pageRoot.querySelector('form[data-form="e360-nueva-campana"]')?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.showCampanaModal = false;
      paint();
    });

    pageRoot.querySelectorAll("[data-action^='e360-campana-']").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.getAttribute("data-action") === "e360-campana-editar") {
          state.showCampanaModal = true;
          paint();
        }
      });
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
