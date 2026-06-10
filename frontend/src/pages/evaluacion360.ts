import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { destroyChartsIn } from "../charts/index.ts";
import {
  mountEval360DashboardCharts,
  mountEval360ReportesCharts,
  mountEval360ResultadosCharts,
} from "../evaluacion360/charts.ts";
import { MOCK_CAMPANAS, MOCK_EVALUACIONES, RADAR_COMPETENCIAS } from "../evaluacion360/mockData.ts";
import { EVAL360_BASE_HASH, parseEval360ViewFromHash, renderEval360SubNav } from "../evaluacion360/subNav.ts";
import type { Eval360ViewId } from "../evaluacion360/types.ts";
import { renderEval360Campanas } from "../evaluacion360/views/campanas.ts";
import { renderEval360Configuracion } from "../evaluacion360/views/configuracion.ts";
import { renderEval360Dashboard } from "../evaluacion360/views/dashboard.ts";
import { renderEval360Evaluaciones } from "../evaluacion360/views/evaluaciones.ts";
import { renderEval360Reportes } from "../evaluacion360/views/reportes.ts";
import { renderEval360Resultados } from "../evaluacion360/views/resultados.ts";
import { BTN_PRIMARY, BTN_SECONDARY, RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../ui/uiTokens.ts";

const PAGE_SHELL = RH_DASHBOARD_PAGE_SHELL;

interface State {
  view: Eval360ViewId;
  showCampanaModal: boolean;
}

function renderHeader(view: Eval360ViewId): string {
  const showActions = view === "dashboard" || view === "campanas";
  return `
    <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium text-text-muted">Level Up · Desarrollo de talento</p>
        <h1 class="mt-0.5 text-xl font-bold text-text-primary">Evaluación 360°</h1>
        <p class="mt-1 text-sm text-text-muted">Análisis de competencias, desempeño y desarrollo de talento.</p>
      </div>
      ${
        showActions
          ? `<div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
        <button type="button" class="${BTN_SECONDARY}" data-action="e360-generar-reporte">Generar reporte</button>
        <button type="button" class="${BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
      </div>`
          : ""
      }
    </div>`;
}

function renderViewContent(state: State): string {
  switch (state.view) {
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
      return renderEval360Dashboard();
  }
}

function mountViewCharts(root: HTMLElement, view: Eval360ViewId): void {
  if (view === "dashboard") {
    mountEval360DashboardCharts(root);
  } else if (view === "resultados") {
    mountEval360ResultadosCharts(root, RADAR_COMPETENCIAS);
  } else if (view === "reportes") {
    mountEval360ReportesCharts(root);
  }
}

export function mountEvaluacion360(container: HTMLElement, signal: AbortSignal): void {
  const state: State = {
    view: parseEval360ViewFromHash(window.location.hash),
    showCampanaModal: false,
  };

  mountAppShell(container, {
    pageTitle: "Evaluación 360°",
    activeNav: "evaluacion-360",
    mainHtml: `<div id="eval360-page" class="${PAGE_SHELL}"></div>`,
    mainClass: "py-0",
  });

  const pageRoot = container.querySelector<HTMLElement>("#eval360-page")!;

  function paint(): void {
    destroyChartsIn(pageRoot);
    pageRoot.innerHTML = `
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLevelUpBackBar()}
        ${renderHeader(state.view)}
        <div class="mt-4">${renderEval360SubNav(state.view)}</div>
        <div id="eval360-content" class="mt-5">${renderViewContent(state)}</div>
      </div>`;
    const content = pageRoot.querySelector("#eval360-content");
    if (content) mountViewCharts(content as HTMLElement, state.view);
    bindEvents();
  }

  function bindEvents(): void {
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

    pageRoot.querySelector('form[data-form="e360-nueva-campana"]')?.addEventListener("submit", (e) => {
      e.preventDefault();
      state.showCampanaModal = false;
      paint();
    });

    pageRoot.querySelectorAll("[data-action^='e360-campana-']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-action");
        if (action === "e360-campana-editar") {
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
