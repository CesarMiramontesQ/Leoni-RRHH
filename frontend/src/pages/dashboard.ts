import { getDashboardKpis, type KpiFetchError, type KpiResponse } from "../api/reportes.ts";
import { clearAuth } from "../auth/session.ts";
import {
  canAccessEmpleadoPersonalDashboard,
  canAccessLiderTeamDashboard,
  canAccessRhOperationalDashboard,
  canSeeDashboardTeamCalendar,
  getRolFromAccessToken,
} from "../auth/jwt.ts";
import {
  mountRhDashboardAnalyticsCharts,
  mountRhDashboardEmpleadosCharts,
  reconcileRhDashboardCharts,
  RH_DASH_ANALYTICS_CHART_IDS,
} from "../components/dashboard/rhAnalyticsCharts.ts";
import {
  renderRhAnalyticsBody,
  renderRhAnalyticsBodyPeriodLoading,
  renderRhAnalyticsBodySkeleton,
  renderRhAnalyticsSection,
  renderRhAnalyticsSectionSkeleton,
} from "../components/dashboard/rhAnalyticsSection.ts";
import { destroyAllCharts, destroyChart, destroyChartsIn, runChartsAfterLayout } from "../charts/index.ts";
import { mountSupervisorIncidenciasChart } from "../components/dashboard/liderSupervisorIncidenciasChart.ts";
import { mountSupervisorHomeOfficeWeekdayChart } from "../components/dashboard/liderSupervisorHomeOfficeWeekdayChart.ts";
import type {
  RhDashboardAnalyticsPayload,
  RhDashboardPeriodDays,
} from "../dashboard/rh/analyticsTypes.ts";
import {
  fetchRhDashboardAnalytics,
  fetchRhDashboardEmpleados,
  type RhDashboardEmpleadosSlice,
} from "../dashboard/rh/fetchRhDashboardAnalytics.ts";
import {
  readStoredRhDashboardPeriod,
  storeRhDashboardPeriod,
} from "../dashboard/rh/filterRowsByPeriod.ts";
import {
  fetchEmpleadoDashboard,
  fetchEmpleadoDashboardKpis,
} from "../dashboard/empleado/fetchEmpleadoDashboard.ts";
import { emptyEmpleadoDashboardPayload } from "../dashboard/empleado/mock.ts";
import type { EmpleadoDashboardPayload } from "../dashboard/empleado/types.ts";
import {
  EMPLEADO_STAT_CARDS_ID,
  bindEmpleadoCalendarNavigation,
  renderEmpleadoDashboardSkeleton,
  renderEmpleadoPersonalDashboard,
  renderEmpleadoStatCards,
} from "../components/dashboard/empleadoPersonalDashboard.ts";
import { resolveCalendarWeekStart } from "../components/dashboard/calendarShared.ts";
import {
  bindLiderApprovalsPagination,
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
import { RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_PAGE_OUTER_GRADIENT } from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { getMisEncuestasPendientes } from "../api/encuestas.ts";

/** Mismo ancho y padding X que Solicitudes, Actas e Incidencias sobre `.rh-dashboard-page`. */
function wrapDashboardPageContent(innerHtml: string): string {
  return `<div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">${innerHtml}</div>`;
}

/**
 * Banner no intrusivo en el dashboard del colaborador cuando tiene encuestas
 * post curso por responder. Se inyecta una sola vez sobre el contenido del
 * dashboard y enlaza a `#/mis-encuestas`. Si no hay pendientes no muestra nada.
 */
async function injectEncuestasPendientesBanner(container: HTMLElement): Promise<void> {
  try {
    const res = await getMisEncuestasPendientes();
    if (!res || res.total <= 0) return;
    const anchor =
      container.querySelector<HTMLElement>("#empleado-dashboard-root") ??
      container.querySelector<HTMLElement>("#lider-dashboard-root");
    const host = anchor?.parentElement;
    if (!host) return;
    if (host.querySelector("#mis-encuestas-banner")) return;
    const banner = document.createElement("div");
    banner.id = "mis-encuestas-banner";
    const plural = res.total === 1 ? "encuesta" : "encuestas";
    banner.innerHTML = `
      <a href="#/mis-encuestas" class="group flex items-center gap-3 rounded-2xl border border-[#bfdbfe] bg-gradient-to-br from-blue-50 via-white to-blue-50/40 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:border-[#1e40af]/40 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1e40af]/10 text-[#1e40af]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 3h1A2.25 2.25 0 0 1 16.65 3.836m-5.8 0c-.376.023-.75.05-1.124.08C8.095 4.01 7.25 4.973 7.25 6.108V8.25m0 0H5.625c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75"/></svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-text-primary">Tienes ${res.total} ${plural} por responder</span>
          <span class="block text-xs text-text-secondary">Califica los cursos que tomaste para ayudarnos a mejorar.</span>
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-5 shrink-0 text-[#1e40af] transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd"/></svg>
      </a>`;
    host.insertBefore(banner, anchor);
  } catch {
    /* sin banner si falla la consulta */
  }
}

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

let rhDashLoadSeq = 0;
let rhDashEmpleadosCache: RhDashboardEmpleadosSlice | null = null;

/** Limpia caché y cancela cargas en curso (p. ej. al cerrar sesión). */
export function resetRhDashboardSessionState(): void {
  rhDashEmpleadosCache = null;
  rhDashLoadSeq += 1;
}

async function loadRhDashboardEmpleados(): Promise<RhDashboardEmpleadosSlice> {
  if (rhDashEmpleadosCache) return rhDashEmpleadosCache;
  rhDashEmpleadosCache = await fetchRhDashboardEmpleados();
  return rhDashEmpleadosCache;
}

function syncRhDashboardPeriodButtons(root: ParentNode, activeDays: RhDashboardPeriodDays): void {
  root.querySelectorAll<HTMLButtonElement>("[data-rh-dash-period]").forEach((btn) => {
    const raw = btn.getAttribute("data-rh-dash-period");
    const days = Number(raw);
    const isActive = days === activeDays;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    btn.classList.toggle("rh-dash-period-btn--active", isActive);
  });
}

function mountRhDashboardChartsWhenReady(
  analyticsRoot: ParentNode,
  payload: RhDashboardAnalyticsPayload,
  isStale: () => boolean,
): void {
  runChartsAfterLayout(
    analyticsRoot,
    () => mountRhDashboardAnalyticsCharts(analyticsRoot, payload),
    {
      isStale,
      // Red de seguridad: remonta cualquier gráfica que quedó en blanco por una
      // carrera de layout al cambiar el periodo (idempotente en las sanas).
      afterSettle: () => reconcileRhDashboardCharts(analyticsRoot, payload),
    },
  );
}

function bindRhDashboardPeriodControls(
  container: HTMLElement,
  onPeriodChange: (days: RhDashboardPeriodDays) => void,
): void {
  const host = container.querySelector<HTMLElement>("#rh-dashboard-root");
  if (!host) return;
  if (host.dataset.rhDashPeriodBound === "1") return;
  host.dataset.rhDashPeriodBound = "1";
  host.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>("[data-rh-dash-period]");
    if (!btn) return;
    const raw = btn.getAttribute("data-rh-dash-period");
    const days = Number(raw);
    if (days !== 30 && days !== 60 && days !== 90) return;
    if (readStoredRhDashboardPeriod() === days) return;
    storeRhDashboardPeriod(days);
    syncRhDashboardPeriodButtons(host, days);
    onPeriodChange(days);
  });
}

async function loadRhOperationalDashboard(
  container: HTMLElement,
  periodDays: RhDashboardPeriodDays = readStoredRhDashboardPeriod(),
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) return;
  const root = container.querySelector<HTMLElement>("#rh-dashboard-root");
  if (!root) return;

  const seq = ++rhDashLoadSeq;
  // Obsoleto si: se reentró al dashboard (seq) o se navegó fuera de la ruta (signal).
  const isStale = (): boolean => seq !== rhDashLoadSeq || (signal?.aborted ?? false);

  destroyAllCharts();
  for (const id of RH_DASH_ANALYTICS_CHART_IDS) destroyChart(id);
  const analyticsRoot = root.querySelector<HTMLElement>("#rh-dashboard-analytics");
  const analyticsBody = root.querySelector<HTMLElement>("#rh-dashboard-analytics-body");
  if (analyticsRoot) destroyChartsIn(analyticsRoot);

  const canPatchBody = analyticsRoot !== null && analyticsBody !== null;
  const pinEmpleadosWhileLoading = canPatchBody && rhDashEmpleadosCache !== null;
  if (canPatchBody) {
    syncRhDashboardPeriodButtons(root, periodDays);
    analyticsBody.setAttribute("aria-busy", "true");
    analyticsBody.innerHTML = pinEmpleadosWhileLoading
      ? renderRhAnalyticsBodyPeriodLoading(rhDashEmpleadosCache!)
      : renderRhAnalyticsBodySkeleton();
    if (pinEmpleadosWhileLoading && analyticsRoot && rhDashEmpleadosCache) {
      runChartsAfterLayout(
        analyticsRoot,
        () => mountRhDashboardEmpleadosCharts(analyticsRoot, rhDashEmpleadosCache),
        { isStale },
      );
    }
  } else {
    root.innerHTML = wrapDashboardPageContent(renderRhAnalyticsSectionSkeleton(periodDays));
  }

  let analyticsPayload: RhDashboardAnalyticsPayload | null = null;
  let analyticsPartial = false;
  let empleadosSlice: RhDashboardEmpleadosSlice = { resumen: null, errors: [] };
  try {
    const [periodResult, empleadosResult] = await Promise.all([
      fetchRhDashboardAnalytics(periodDays).catch((e: unknown) => {
        console.error("[rh-dashboard] fetch analytics failed", e);
        return null;
      }),
      loadRhDashboardEmpleados(),
    ]);
    if (isStale()) return;
    empleadosSlice = empleadosResult;
    if (periodResult) {
      analyticsPayload = { ...periodResult.payload, empleados: empleadosSlice };
      analyticsPartial =
        periodResult.partialFailure || empleadosSlice.errors.length > 0;
    }
  } catch {
    if (isStale()) return;
    analyticsPayload = null;
  }

  if (canPatchBody && analyticsBody && analyticsRoot) {
    if (!analyticsPayload) {
      analyticsBody.removeAttribute("aria-busy");
      analyticsBody.innerHTML = `<p class="text-sm text-text-muted">No se pudo cargar la analítica. Intenta recargar la página.</p>`;
      return;
    }
    analyticsBody.removeAttribute("aria-busy");
    destroyChartsIn(analyticsBody);
    analyticsBody.innerHTML = renderRhAnalyticsBody(analyticsPayload, analyticsPartial);
    syncRhDashboardPeriodButtons(root, analyticsPayload.periodDays);
    try {
      mountRhDashboardChartsWhenReady(analyticsRoot, analyticsPayload, isStale);
    } catch (e: unknown) {
      console.error("[rh-dashboard] chart mount failed", e);
    }
    return;
  }

  root.innerHTML = wrapDashboardPageContent(
    renderRhAnalyticsSection(analyticsPayload, analyticsPartial),
  );
  const mountedAnalytics = root.querySelector<HTMLElement>("#rh-dashboard-analytics");
  if (analyticsPayload && mountedAnalytics) {
    try {
      mountRhDashboardChartsWhenReady(mountedAnalytics, analyticsPayload, isStale);
    } catch (e: unknown) {
      console.error("[rh-dashboard] chart mount failed", e);
    }
  }
}

function mountRhOperationalDashboard(container: HTMLElement, signal?: AbortSignal): void {
  const period = readStoredRhDashboardPeriod();

  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    /** Sin padding-top en `<main>` para que no se vea `bg-surface` gris entre navbar y el degradado del dashboard. */
    mainClass: "pt-0 pb-10",
    mainHtml: `<div id="rh-dashboard-root" class="${RH_DASHBOARD_PAGE_SHELL} pb-10 sm:pb-10">${wrapDashboardPageContent(renderRhAnalyticsSectionSkeleton(period))}</div>`,
  });

  bindRhDashboardPeriodControls(container, (days) => {
    void loadRhOperationalDashboard(container, days, signal);
  });

  void loadRhOperationalDashboard(container, period, signal);
}

/**
 * Rellena las tarjetas de vacaciones y home office cuando responde TRESS.
 *
 * Si no responde, las tarjetas quedan con "—" en vez de un esqueleto eterno.
 */
async function hidratarKpisEmpleado(
  container: HTMLElement,
  payload: EmpleadoDashboardPayload,
): Promise<void> {
  const kpis = await fetchEmpleadoDashboardKpis().catch(() => null);
  const host = container.querySelector<HTMLElement>(`#${EMPLEADO_STAT_CARDS_ID}`);
  if (!host) return;
  const conKpis: EmpleadoDashboardPayload = { ...payload, ...(kpis ?? {}) };
  host.outerHTML = renderEmpleadoStatCards(conKpis, { kpisCargando: false });
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

  root.innerHTML = renderEmpleadoPersonalDashboard(calYear, calMonth, payload, {
    kpisCargando: true,
  });
  bindEmpleadoCalendarNavigation(container, payload, calYear, calMonth, {
    loadMonthData: async (target) => fetchEmpleadoDashboard(target).catch(() => null),
  });
  void injectEncuestasPendientesBanner(container);
  // Los KPIs de TRESS se piden aparte y sustituyen sus tarjetas al llegar: si esa
  // BD no responde, el resto del dashboard ya está en pantalla.
  void hidratarKpisEmpleado(container, payload);
}

function mountEmpleadoPersonalDashboardShell(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    mainClass: "py-0",
    mainHtml: `<div class="${RH_DASHBOARD_PAGE_SHELL} pb-10 sm:pb-10"><div id="empleado-dashboard-root">${renderEmpleadoDashboardSkeleton()}</div></div>`,
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

  destroyChartsIn(root);
  try {
    root.innerHTML = renderLiderTeamDashboard(calYear, calMonth, payload);
  } catch (e: unknown) {
    console.error("[lider-dashboard] render failed", e);
    root.innerHTML = wrapDashboardPageContent(renderError("No se pudo mostrar el dashboard. Recarga la página."));
    return;
  }
  if (canAccessLiderTeamDashboard()) {
    const chartsHost = root.querySelector("#lider-supervisor-charts");
    if (chartsHost) {
      runChartsAfterLayout(chartsHost, () => {
        if (payload.supervisor_incidencias_chart) {
          mountSupervisorIncidenciasChart(chartsHost, payload.supervisor_incidencias_chart);
        }
        if (payload.supervisor_ho_weekday_chart) {
          mountSupervisorHomeOfficeWeekdayChart(chartsHost, payload.supervisor_ho_weekday_chart);
        }
      });
    }
  }
  bindLiderApprovalsPagination(root, payload.approval_requests ?? []);

  if (canSeeDashboardTeamCalendar()) {
    bindLiderTeamCalendarNavigation(container, payload, calYear, calMonth, {
      loadMonthData: async (target) => fetchLiderDashboard(target).catch(() => null),
    });
  }

  void injectEncuestasPendientesBanner(container);

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
    mainHtml: `<div class="${RH_DASHBOARD_PAGE_SHELL} pb-10 sm:pb-10"><div id="lider-dashboard-root">${renderLiderDashboardSkeleton()}</div><div id="lider-solicitud-detalle-modal-host" class="shrink-0"></div></div>`,
  });

  setupLiderSolicitudDetalleModal(container);
  void loadLiderTeamDashboard(container);
}

function mountStandardDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Dashboard",
    activeNav: "dashboard",
    mainHtml: wrapDashboardPageContent(`
      <div id="dashboard-kpis-root">
        <div class="flex items-center gap-3 py-8 text-sm text-text-muted">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Cargando indicadores…
        </div>
      </div>
    `),
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
export function mountDashboardPlaceholder(container: HTMLElement, signal?: AbortSignal): void {
  if (canAccessEmpleadoPersonalDashboard()) {
    mountEmpleadoPersonalDashboardShell(container);
    return;
  }
  if (canAccessLiderTeamDashboard()) {
    mountLiderTeamDashboardShell(container);
    return;
  }
  if (canAccessRhOperationalDashboard()) {
    mountRhOperationalDashboard(container, signal);
    return;
  }
  mountStandardDashboard(container);
}
