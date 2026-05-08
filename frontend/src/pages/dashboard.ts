import { getDashboardKpis, type KpiFetchError, type KpiResponse } from "../api/reportes.ts";
import { clearAuth } from "../auth/session.ts";
import {
  canAccessEmpleadoPersonalDashboard,
  canAccessLiderTeamDashboard,
  canAccessRhOperationalDashboard,
} from "../auth/jwt.ts";
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
import { fetchEmpleadoDashboard } from "../dashboard/empleado/fetchEmpleadoDashboard.ts";
import { emptyEmpleadoDashboardPayload } from "../dashboard/empleado/mock.ts";
import {
  bindEmpleadoCalendarNavigation,
  renderEmpleadoDashboardSkeleton,
  renderEmpleadoPersonalDashboard,
} from "../components/dashboard/empleadoPersonalDashboard.ts";
import { resolveCalendarWeekStart } from "../components/dashboard/calendarShared.ts";
import {
  bindLiderTeamCalendarNavigation,
  renderLiderDashboardSkeleton,
  renderLiderTeamDashboard,
} from "../components/dashboard/liderTeamDashboard.ts";
import { fetchLiderDashboard } from "../dashboard/lider/fetchLiderDashboard.ts";
import { emptyLiderDashboardPayload } from "../dashboard/lider/mock.ts";
import { getSolicitudById, mapSolicitudApiItemToRhTablaFila } from "../api/solicitudes.ts";
import {
  mountSolicitudDetalleModal,
  type SolicitudDetalleModalHandle,
} from "../components/solicitudes/solicitudDetalleModal.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import type { RhSolicitudTablaFila } from "../solicitudes/rh/types.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

function renderError(message: string): string {
  return `
    <div class="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-4 text-sm text-red-800 shadow-[0_8px_24px_rgba(127,29,29,0.08)]" role="alert">
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
      <article class="rounded-2xl border border-[#e5e7eb] border-t-4 border-t-leoni-green bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
        <h2 class="text-sm font-medium text-[#667085]">Empleados activos</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-[#111827]">${escapeHtml(String(kpi.empleados_activos))}</p>
      </article>
      <article class="rounded-2xl border border-[#e5e7eb] border-t-4 border-t-amber-400 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
        <h2 class="text-sm font-medium text-[#667085]">Incidencias abiertas</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-[#111827]">${escapeHtml(String(kpi.incidencias_abiertas))}</p>
      </article>
      <article class="rounded-2xl border border-[#e5e7eb] border-t-4 border-t-orange-400 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
        <h2 class="text-sm font-medium text-[#667085]">Actas pendientes de firma</h2>
        <p class="mt-2 text-3xl font-bold tracking-tight text-[#111827]">${escapeHtml(String(kpi.actas_pendientes_firma))}</p>
      </article>
      <article class="rounded-2xl border border-[#e5e7eb] border-t-4 border-t-[#1e40af] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:col-span-2 xl:col-span-4">
        <h2 class="text-sm font-medium text-[#667085]">Solicitudes por estado</h2>
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
    <div class="mb-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-white px-4 py-3 text-sm text-amber-950 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" role="status">
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
    /** Sin padding-top en `<main>` para que no se vea `bg-surface` gris entre navbar y el degradado del dashboard. */
    mainClass: "pt-0 pb-10",
    mainHtml: `<div id="rh-dashboard-root" class="rh-dashboard-page -mx-4 px-4 pb-10 pt-8 sm:-mx-6 sm:px-6 sm:pt-10 lg:-mx-8 lg:px-8">${renderRhDashboardSkeletonGrid()}${renderRhLowerSectionSkeleton()}</div>`,
  });

  void loadRhOperationalDashboard(container);
}

async function loadEmpleadoPersonalDashboard(container: HTMLElement): Promise<void> {
  const root = container.querySelector<HTMLElement>("#empleado-dashboard-root");
  if (!root) return;

  const now = new Date();
  const weekStartsOn = resolveCalendarWeekStart();
  let raw = null;
  try {
    raw = await fetchEmpleadoDashboard({
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      weekStartsOn,
    }).catch(() => null);
  } catch {
    raw = null;
  }
  const payload = raw ?? emptyEmpleadoDashboardPayload(new Date());
  const cal = payload.calendar;
  const calYear = cal.initial_year ?? now.getFullYear();
  const calMonth = cal.initial_month_index ?? now.getMonth();

  root.innerHTML = renderEmpleadoPersonalDashboard(calYear, calMonth, payload);
  bindEmpleadoCalendarNavigation(container, payload, calYear, calMonth, {
    loadMonthData: async (target) => fetchEmpleadoDashboard(target).catch(() => null),
  });
}

function mountEmpleadoPersonalDashboardShell(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    mainClass: "py-0",
    mainHtml: `<div class="rh-dashboard-page flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-10 pt-8 sm:-mx-6 sm:px-6 sm:pt-10 lg:-mx-8 lg:px-8"><div id="empleado-dashboard-root">${renderEmpleadoDashboardSkeleton()}</div></div>`,
  });

  void loadEmpleadoPersonalDashboard(container);
}

/** Cache + modal de detalle solo para la tabla de aprobaciones del dashboard líder (supervisor/gerente). */
const liderSolicitudDetalleFilaCache = new Map<number, RhSolicitudTablaFila>();
let liderSolicitudDetalleModal: SolicitudDetalleModalHandle | null = null;
let liderSolicitudDetalleAc: AbortController | null = null;

function tearDownLiderSolicitudDetalleModal(): void {
  liderSolicitudDetalleAc?.abort();
  liderSolicitudDetalleAc = null;
  liderSolicitudDetalleModal?.destroy();
  liderSolicitudDetalleModal = null;
  liderSolicitudDetalleFilaCache.clear();
}

function setupLiderSolicitudDetalleModal(container: HTMLElement): void {
  tearDownLiderSolicitudDetalleModal();
  const host = container.querySelector("#lider-solicitud-detalle-modal-host");
  if (!host) return;
  liderSolicitudDetalleAc = new AbortController();
  liderSolicitudDetalleModal = mountSolicitudDetalleModal(host as HTMLElement, {
    signal: liderSolicitudDetalleAc.signal,
    toastContainer: container,
    getFilaById: (id) => liderSolicitudDetalleFilaCache.get(id),
    onRefrescarListado: () => loadLiderTeamDashboard(container),
    cargarDetalleServidor: (id) => getSolicitudById(id),
  });
}

async function loadLiderTeamDashboard(container: HTMLElement): Promise<void> {
  const root = container.querySelector<HTMLElement>("#lider-dashboard-root");
  if (!root) return;

  const now = new Date();
  const weekStartsOn = resolveCalendarWeekStart();
  let raw = null;
  try {
    raw = await fetchLiderDashboard({
      year: now.getFullYear(),
      monthIndex: now.getMonth(),
      weekStartsOn,
    }).catch(() => null);
  } catch {
    raw = null;
  }
  const payload = raw ?? emptyLiderDashboardPayload(new Date());
  const cal = payload.team_calendar;
  const calYear = cal.initial_year ?? now.getFullYear();
  const calMonth = cal.initial_month_index ?? now.getMonth();

  root.innerHTML = renderLiderTeamDashboard(calYear, calMonth, payload);
  bindLiderTeamCalendarNavigation(container, payload, calYear, calMonth, {
    loadMonthData: async (target) => fetchLiderDashboard(target).catch(() => null),
  });

  if (root.dataset.liderApprovalBound !== "1") {
    root.dataset.liderApprovalBound = "1";
    root.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const verBtn = target.closest<HTMLButtonElement>("[data-lider-solicitud-detalle]");
      if (!verBtn) return;

      const solicitudIdRaw = verBtn.getAttribute("data-lider-solicitud-detalle");
      const solicitudId = Number(solicitudIdRaw);
      if (!Number.isFinite(solicitudId)) return;

      verBtn.disabled = true;
      void (async () => {
        try {
          const item = await getSolicitudById(solicitudId);
          const fila = mapSolicitudApiItemToRhTablaFila(item);
          liderSolicitudDetalleFilaCache.set(solicitudId, fila);
          liderSolicitudDetalleModal?.open(solicitudId);
        } catch (e: unknown) {
          const detail =
            typeof e === "object" &&
            e !== null &&
            "detail" in e &&
            typeof (e as { detail?: unknown }).detail === "string"
              ? (e as { detail: string }).detail
              : "No se pudo cargar el detalle de la solicitud.";
          showEmpleadosToast(container, detail, "error");
        } finally {
          verBtn.disabled = false;
        }
      })();
    });
  }
}

function mountLiderTeamDashboardShell(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    /** Misma envolvente visual que dashboard RH y empleado (degradado + ancho). */
    mainClass: "py-0",
    mainHtml: `<div class="rh-dashboard-page flex min-h-[calc(100dvh-4rem)] flex-col -mx-4 px-4 pb-10 pt-8 sm:-mx-6 sm:px-6 sm:pt-10 lg:-mx-8 lg:px-8"><div id="lider-dashboard-root">${renderLiderDashboardSkeleton()}</div><div id="lider-solicitud-detalle-modal-host" class="shrink-0"></div></div>`,
  });

  setupLiderSolicitudDetalleModal(container);
  void loadLiderTeamDashboard(container);
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

/**
 * Punto único de entrada del hash `#/`:
 * - `rh` → dashboard operativo
 * - `supervisor` / `gerente` → dashboard personal + equipo
 * - `empleado` → dashboard personal
 * - resto (p. ej. `director`) → KPIs actuales
 */
export function mountDashboardPlaceholder(container: HTMLElement): void {
  if (canAccessRhOperationalDashboard()) {
    mountRhOperationalDashboard(container);
    return;
  }
  if (canAccessLiderTeamDashboard()) {
    mountLiderTeamDashboardShell(container);
    return;
  }
  if (canAccessEmpleadoPersonalDashboard()) {
    mountEmpleadoPersonalDashboardShell(container);
    return;
  }
  mountStandardDashboard(container);
}
