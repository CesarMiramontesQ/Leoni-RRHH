import type { RhDashboardAnalyticsPayload, RhDashboardPeriodDays } from "../../dashboard/rh/analyticsTypes.ts";
import { RH_DASHBOARD_PERIOD_OPTIONS } from "../../dashboard/rh/analyticsTypes.ts";
import { RH_LISTADO_SURFACE, RH_SOLICITUDES_BTN_SECONDARY } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { renderOccupancyBars, renderRhPlatillosPorSemanaChart } from "../comedor/comedorCharts.ts";
import {
  renderDashEmpleadosRetardosChart,
  renderDashIncidenciasTendenciaChart,
  tendenciaIncidenciasChartSubtitle,
} from "./rhAnalyticsCharts.ts";

const CARD = `${RH_LISTADO_SURFACE} rounded-2xl border border-[rgba(148,163,184,0.22)] p-4 shadow-sm sm:p-5`;

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-MX").format(Math.trunc(n));
}

const iconKpiReloj = (): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;

const iconKpiVacaciones = (): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>`;

function laboralesKpiCard(
  title: string,
  subtitle: string,
  value: string,
  accent: "pendiente" | "vacaciones" | "urgente",
  icon: () => string,
): string {
  return `
    <article class="rh-sol-kpi-card rh-sol-kpi-card--${accent} min-w-0 rounded-[14px] border p-4 sm:p-5">
      <div class="flex items-center gap-3 sm:gap-3.5">
        <div class="rh-sol-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_rgba(15,23,42,0.06)]" aria-hidden="true">${icon()}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">${escapeHtml(title)}</p>
              <p class="mt-0.5 text-xs leading-snug text-[#64748b]">${escapeHtml(subtitle)}</p>
            </div>
            <p class="rh-sol-kpi-card__value shrink-0 text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl">${escapeHtml(value)}</p>
          </div>
        </div>
      </div>
    </article>`;
}

function kpiMini(label: string, value: string, hint?: string): string {
  const hintHtml = hint
    ? `<p class="mt-0.5 text-[10px] text-[color:var(--color-text-muted)]">${escapeHtml(hint)}</p>`
    : "";
  return `
    <div class="rounded-lg border border-[rgba(148,163,184,0.22)] bg-[color:var(--color-surface-container-low)] px-3 py-2.5 min-w-0 h-full">
      <p class="text-[10px] font-semibold uppercase leading-snug tracking-wide text-[color:var(--color-text-muted)]">${escapeHtml(label)}</p>
      <p class="mt-0.5 text-lg font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeHtml(value)}</p>
      ${hintHtml}
    </div>`;
}

function renderLaboralesKpiRow(
  solicitudesPendientes: number,
  vacacionesUrgentes: number,
): string {
  return `<div class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
    ${laboralesKpiCard(
      "Solicitudes pendientes",
      "Por aprobar",
      fmtInt(solicitudesPendientes),
      "pendiente",
      iconKpiReloj,
    )}
    ${laboralesKpiCard(
      "Vacaciones urgentes",
      "Inicio en menos de 7 días",
      fmtInt(vacacionesUrgentes),
      "urgente",
      iconKpiVacaciones,
    )}
  </div>`;
}

function sectionLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="text-sm font-semibold text-[color:var(--color-accent)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]/40 rounded">${escapeHtml(label)} →</a>`;
}

function blockErrors(errors: readonly string[]): string {
  if (errors.length === 0) return "";
  return `
    <div class="mb-3 rounded-lg border border-amber-200/90 bg-amber-50/95 px-3 py-2 text-xs text-amber-950" role="status">
      ${errors.map((e) => escapeHtml(e)).join(" · ")}
    </div>`;
}

function chartCard(title: string, subtitle: string, body: string): string {
  return `
    <article class="${CARD} flex min-h-0 flex-col">
      <header class="mb-3 shrink-0">
        <h4 class="text-sm font-bold text-[color:var(--color-text-primary)]">${escapeHtml(title)}</h4>
        <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">${escapeHtml(subtitle)}</p>
      </header>
      <div class="rh-dash-analytics-chart min-h-[220px] flex-1">${body}</div>
    </article>`;
}

function renderLaboralesBlock(payload: RhDashboardAnalyticsPayload): string {
  const k = payload.laborales.kpis;
  const errors = payload.laborales.errors;

  const kpisRow = k
    ? renderLaboralesKpiRow(k.solicitudes_pendientes, k.vacaciones_urgentes)
    : `<p class="text-sm text-text-muted">Indicadores laborales no disponibles.</p>`;

  const charts = `<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${chartCard(
      "Top 5 empleados con más retardos",
      "Incidencias de tipo retardo en el periodo seleccionado",
      renderDashEmpleadosRetardosChart(payload.laborales.empleadosRetardosRanking),
    )}
    ${chartCard(
      "Tendencia de incidencias por tipo",
      tendenciaIncidenciasChartSubtitle(payload.laborales.incidenciasTendenciaPorTipo),
      renderDashIncidenciasTendenciaChart(payload.laborales.incidenciasTendenciaPorTipo),
    )}
  </div>`;

  return `
    <section class="rh-dash-analytics-block" aria-labelledby="rh-dash-laborales-title">
      <div class="mb-4">
        <h3 id="rh-dash-laborales-title" class="text-base font-semibold text-[color:var(--color-text-primary)]">Laborales</h3>
        <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">Solicitudes, incidencias y actas</p>
      </div>
      ${blockErrors(errors)}
      ${kpisRow}
      ${charts}
    </section>`;
}

function renderComedorBlock(payload: RhDashboardAnalyticsPayload): string {
  const k = payload.comedor.kpis;
  const sidebar = payload.comedor.sidebar;
  const errors = payload.comedor.errors;

  const kpisRow = k
    ? `<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        ${kpiMini("Hoy (total)", fmtInt(k.almuerzos_hoy), `A ${fmtInt(k.caseras_hoy)} · B ${fmtInt(k.saludables_hoy)}`)}
        ${kpiMini("% dieta (sem.)", k.pct_dieta_periodo !== null ? `${fmtInt(k.pct_dieta_periodo)}%` : "—", "Semana ISO actual")}
        ${kpiMini("Registros semana", fmtInt(k.semana_actual))}
        ${kpiMini("Prom. proyectado", fmtInt(k.semana_proxima), "Promedio semanal histórico")}
      </div>`
    : `<p class="text-sm text-text-muted">Indicadores de comedor no disponibles.</p>`;

  const platillos =
    sidebar?.rhPlatillosPorSemana && sidebar.rhPlatillosPorSemana.length > 0
      ? renderRhPlatillosPorSemanaChart(sidebar.rhPlatillosPorSemana)
      : `<p class="rh-dash-analytics-empty">Sin datos de platillos.</p>`;

  const ocupacion =
    sidebar?.weeklyOccupancy && sidebar.weeklyOccupancy.length > 0
      ? renderOccupancyBars(sidebar.weeklyOccupancy)
      : `<p class="rh-dash-analytics-empty">Sin datos de ocupación.</p>`;

  const charts = `<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
    ${chartCard("Caseras vs saludables", "Últimas 4 semanas", platillos)}
    ${chartCard("Ocupación semanal", "% dieta por semana (proyección)", ocupacion)}
  </div>
  <p class="mt-2 text-[10px] text-[color:var(--color-text-muted)]">Proyección y estadísticas de semana usan la semana ISO actual; el resumen diario respeta el periodo del selector.</p>`;

  return `
    <section class="rh-dash-analytics-block" aria-labelledby="rh-dash-comedor-title">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="rh-dash-comedor-title" class="text-base font-semibold text-[color:var(--color-text-primary)]">Comedor</h3>
          <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">Consumo y distribución de platillos</p>
        </div>
        ${sectionLink("#/comedor", "Gestionar comedor")}
      </div>
      ${blockErrors(errors)}
      ${kpisRow}
      ${charts}
    </section>`;
}

function renderEmpleadosBlock(payload: RhDashboardAnalyticsPayload): string {
  const r = payload.empleados.resumen;
  const errors = payload.empleados.errors;

  const kpisRow = r
    ? `<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        ${kpiMini("Plantilla", fmtInt(r.total_plantilla))}
        ${kpiMini("Activos", fmtInt(r.activos))}
        ${kpiMini("Inactivos", fmtInt(r.inactivos))}
        ${kpiMini("Operatividad", `${fmtInt(r.porcentaje_operatividad)}%`)}
        ${kpiMini("Sin líder", fmtInt(r.sin_lider_asignado))}
        ${kpiMini("Contratos 30d", fmtInt(r.contratos_por_vencer))}
      </div>`
    : `<p class="text-sm text-text-muted">Resumen de plantilla no disponible.</p>`;

  return `
    <section class="rh-dash-analytics-block" aria-labelledby="rh-dash-empleados-title">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="rh-dash-empleados-title" class="text-base font-semibold text-[color:var(--color-text-primary)]">Empleados</h3>
          <p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">Plantilla y riesgos de contrato</p>
        </div>
        <div class="flex flex-wrap gap-3">
          ${sectionLink("#/empleados", "Directorio")}
          ${sectionLink("#/empleados?kpi_filtrar_contratos=1", "Contratos por vencer")}
        </div>
      </div>
      ${blockErrors(errors)}
      ${kpisRow}
    </section>`;
}

function renderAnalyticsHero(active: RhDashboardPeriodDays): string {
  const buttons = RH_DASHBOARD_PERIOD_OPTIONS.map((opt) => {
    const isActive = opt.days === active;
    const activeCls = isActive
      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-light)] text-[color:var(--color-accent)] shadow-sm"
      : "";
    return `
      <button
        type="button"
        class="${RH_SOLICITUDES_BTN_SECONDARY} rh-dash-period-btn w-full min-[520px]:w-auto ${activeCls}"
        data-rh-dash-period="${opt.days}"
        aria-pressed="${isActive ? "true" : "false"}"
      >${escapeHtml(opt.label)}</button>`;
  }).join("");

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card mb-5 p-4 sm:p-6" aria-labelledby="rh-dash-analytics-title">
      <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
          <h1 id="rh-dash-analytics-title" class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Analítica operativa</h1>
          <p class="mt-2 max-w-[65ch] text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Resumen por dominio · datos filtrados por periodo (solicitudes e incidencias)</p>
        </div>
        <div
          class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2 min-[520px]:flex-row min-[520px]:flex-wrap min-[520px]:justify-end md:w-auto md:flex-nowrap md:items-center md:justify-end md:gap-2.5"
          role="group"
          aria-label="Periodo de analítica"
        >${buttons}</div>
      </div>
    </section>`;
}

export function renderRhAnalyticsSectionSkeleton(): string {
  return `
    <div class="rh-dashboard-analytics" aria-busy="true">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card mb-5 animate-pulse p-4 sm:p-6" aria-hidden="true">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="space-y-2">
            <div class="h-7 w-56 max-w-full rounded bg-slate-200"></div>
            <div class="h-4 w-72 max-w-full rounded bg-slate-100"></div>
          </div>
          <div class="flex gap-2">
            <div class="h-10 w-20 rounded-md bg-slate-100"></div>
            <div class="h-10 w-20 rounded-md bg-slate-100"></div>
            <div class="h-10 w-20 rounded-md bg-slate-200"></div>
          </div>
        </div>
      </section>
      <div class="space-y-8">
        ${[1, 2, 3].map(() => `<div class="${CARD} min-h-[200px] animate-pulse"><div class="h-full rounded bg-slate-100"></div></div>`).join("")}
      </div>
    </div>`;
}

export function renderRhAnalyticsSection(
  payload: RhDashboardAnalyticsPayload | null,
  partialFailure: boolean,
): string {
  if (!payload) {
    return `
      <div class="rh-dashboard-analytics">
        <p class="text-sm text-text-muted">No se pudo cargar la analítica. Intenta recargar la página.</p>
      </div>`;
  }

  const banner = partialFailure
    ? `<div class="mb-4 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-white px-4 py-3 text-sm text-amber-950" role="status">
        Algunos bloques no pudieron cargarse. Los demás muestran datos disponibles.
      </div>`
    : "";

  return `
    <div id="rh-dashboard-analytics" class="rh-dashboard-analytics">
      ${renderAnalyticsHero(payload.periodDays)}
      ${banner}
      <div class="flex flex-col gap-8">
        ${renderLaboralesBlock(payload)}
        ${renderComedorBlock(payload)}
        ${renderEmpleadosBlock(payload)}
      </div>
    </div>`;
}
