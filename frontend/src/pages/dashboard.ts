import { getDashboardKpis, type KpiFetchError, type KpiResponse } from "../api/reportes.ts";
import { clearAuth } from "../auth/session.ts";
import { canAccessRhOperationalDashboard } from "../auth/jwt.ts";
import {
  renderRhDashboardSkeletonGrid,
  renderRhOperationalDashboardGrid,
} from "../components/dashboard/rhOperationalCards.ts";
import {
  bindRhCalendarNavigation,
  renderRhLowerSection,
  renderRhLowerSectionSkeleton,
} from "../components/dashboard/rhLowerSection.ts";
import { fetchRhDashboardLowerSection } from "../dashboard/rh/fetchRhDashboardLowerSection.ts";
import { fetchRhDashboardMetrics } from "../dashboard/rh/fetchRhDashboardMetrics.ts";
import { mapMetricsToCardViews } from "../dashboard/rh/mapMetricsToCardViews.ts";
import { mountAppShell } from "../layouts/appShell.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderError(message: string): string {
  return `
    <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
      ${escapeHtml(message)}
    </div>`;
}

function renderKpis(kpi: KpiResponse): string {
  const entries = Object.entries(kpi.solicitudes_por_estado);
  const solicitudesBlock =
    entries.length === 0
      ? `<p class="text-sm text-text-muted">Sin solicitudes agrupadas por estado.</p>`
      : `<dl class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          ${entries
            .map(
              ([estado, n]) => `
            <div class="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
              <dt class="text-sm font-medium text-text-muted">${escapeHtml(estado)}</dt>
              <dd class="text-lg font-semibold text-leoni-blue">${escapeHtml(String(n))}</dd>
            </div>`,
            )
            .join("")}
        </dl>`;

  return `
    <div class="mb-6 flex justify-end">
      <p class="text-sm text-text-muted">Datos al ${escapeHtml(kpi.fecha)}</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article class="rounded-xl border border-border border-t-4 border-t-leoni-green bg-white p-5 shadow-sm">
        <h2 class="text-sm font-medium text-text-muted">Empleados activos</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(kpi.empleados_activos))}</p>
      </article>
      <article class="rounded-xl border border-border border-t-4 border-t-amber-400 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-medium text-text-muted">Incidencias abiertas</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(kpi.incidencias_abiertas))}</p>
      </article>
      <article class="rounded-xl border border-border border-t-4 border-t-orange-400 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-medium text-text-muted">Actas pendientes de firma</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-text-primary">${escapeHtml(String(kpi.actas_pendientes_firma))}</p>
      </article>
      <article class="rounded-xl border border-border border-t-4 border-t-leoni-blue bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-4">
        <h2 class="text-sm font-medium text-text-muted">Solicitudes por estado</h2>
        <div class="mt-4">
          ${solicitudesBlock}
        </div>
      </article>
    </div>`;
}

function isKpiFetchError(e: unknown): e is KpiFetchError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    "detail" in e &&
    typeof (e as KpiFetchError).detail === "string"
  );
}

async function loadDashboardKpis(container: HTMLElement): Promise<void> {
  const root = container.querySelector<HTMLElement>("#dashboard-kpis-root");
  if (!root) return;

  try {
    const kpi = await getDashboardKpis();
    root.innerHTML = renderKpis(kpi);
  } catch (e: unknown) {
    if (isKpiFetchError(e) && e.status === 401) {
      clearAuth();
      void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
        abortAuthenticatedShell();
        void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
      });
      return;
    }
    if (isKpiFetchError(e)) {
      root.innerHTML = renderError(e.detail);
      return;
    }
    root.innerHTML = renderError("Error de conexión. Verifica que el servidor esté activo e intenta de nuevo.");
  }
}

function rhMetricsUnavailableBanner(): string {
  return `
    <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      No se pudieron obtener las métricas en este momento. Las tarjetas muestran valores no disponibles (—) sin afectar el diseño.
    </div>`;
}

async function loadRhOperationalDashboard(container: HTMLElement): Promise<void> {
  const root = container.querySelector<HTMLElement>("#rh-dashboard-root");
  if (!root) return;

  let data = null;
  let lower = null;
  try {
    const results = await Promise.all([
      fetchRhDashboardMetrics().catch(() => null),
      fetchRhDashboardLowerSection().catch(() => null),
    ]);
    data = results[0];
    lower = results[1];
  } catch {
    data = null;
    lower = null;
  }

  const views = mapMetricsToCardViews(data);
  const banner = data === null ? rhMetricsUnavailableBanner() : "";
  const now = new Date();
  const calYear = lower?.calendar.initialYear ?? now.getFullYear();
  const calMonth = lower?.calendar.initialMonthIndex ?? now.getMonth();
  root.innerHTML =
    banner + renderRhOperationalDashboardGrid(views) + renderRhLowerSection(calYear, calMonth, lower);
  bindRhCalendarNavigation(container, lower, calYear, calMonth);
}

function mountRhOperationalDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    mainHtml: `<div id="rh-dashboard-root">${renderRhDashboardSkeletonGrid()}${renderRhLowerSectionSkeleton()}</div>`,
  });

  void loadRhOperationalDashboard(container);
}

function mountStandardDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    mainHtml: `
      <div id="dashboard-kpis-root">
        <div class="flex items-center gap-3 py-8 text-sm text-text-muted">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Cargando indicadores…
        </div>
      </div>
    `,
  });

  void loadDashboardKpis(container);
}

/** Punto único de entrada del hash \`#/\`: RH ve operativo; el resto conserva KPIs actuales. */
export function mountDashboardPlaceholder(container: HTMLElement): void {
  if (canAccessRhOperationalDashboard()) {
    mountRhOperationalDashboard(container);
    return;
  }
  mountStandardDashboard(container);
}
