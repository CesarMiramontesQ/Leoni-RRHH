import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel, RhIncidenciasEstadisticasData } from "../../incidencias/rh/types.ts";
import { formatNombreEmpleadoIncidenciasUi } from "../../utils/nombreEmpleadoDisplay.ts";
import { renderIncidenciasColumnasPorMes, renderIncidenciasDonutPorTipo } from "./rhIncidenciasCharts.ts";
import { RH_LISTADO_SURFACE } from "./rhIncidenciasPageStyles.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

const TOP = 5;

const CARD =
  `${RH_LISTADO_SURFACE} rh-inc-analytics-card flex min-h-0 flex-col rounded-lg border border-[color:var(--color-border)] p-4 shadow-sm sm:p-4`;

const ICON_WRAP =
  "flex size-9 shrink-0 items-center justify-center rounded border border-[color:var(--color-border)] bg-slate-100 text-[color:var(--color-text-muted)]";

const ICO_TOTAL = `<span class="${ICON_WRAP}" aria-hidden="true"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3.75A2.25 2.25 0 0 1 12 6v3.75A2.25 2.25 0 0 1 9.75 12H6A2.25 2.25 0 0 1 3.75 9.75V6ZM14.25 8.25h6M14.25 12h6M3.75 16.5h16.5M3.75 21h16.5" /></svg></span>`;

const ICO_SHIELD = `<span class="${ICON_WRAP}" aria-hidden="true"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg></span>`;

const ICO_CHECK = `<span class="${ICON_WRAP}" aria-hidden="true"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></span>`;

const ICO_MAP = `<span class="${ICON_WRAP}" aria-hidden="true"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg></span>`;

const ICO_USER = `<span class="${ICON_WRAP}" aria-hidden="true"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg></span>`;

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]!.charAt(0)}${p[1]!.charAt(0)}`.toUpperCase();
}

function pctDelTotal(parte: number, total: number): string {
  if (total <= 0) return "0";
  return (Math.round((1000 * parte) / total) / 10).toFixed(1);
}

function lineaVariacionTotal(d: RhIncidenciasEstadisticasData): string {
  const v = d.variacion_total_pct;
  if (v == null || Number.isNaN(v)) return "";
  const up = v > 0;
  const down = v < 0;
  const color = up ? "text-red-600" : down ? "text-emerald-600" : "text-[color:var(--color-text-muted)]";
  const arrow = up ? "↑" : down ? "↓" : "→";
  return `<p class="mt-1 text-[11px] font-semibold ${color}" aria-label="${escapeIncHtml(INC_COPY.kpiVariacionAria(v))}">${arrow} ${escapeIncHtml(String(Math.abs(v)))}% ${escapeIncHtml(INC_COPY.kpiVsAnterior)}</p>`;
}

function kpiCard(opts: {
  iconHtml: string;
  label: string;
  value: string;
  hint?: string;
  extra?: string;
  valueClass?: string;
}): string {
  const hint =
    opts.hint && opts.hint.length > 0
      ? `<p class="mt-0.5 text-[10px] leading-snug text-[color:var(--color-text-muted)]">${escapeIncHtml(opts.hint)}</p>`
      : "";
  const extra = opts.extra ?? "";
  const valCls = opts.valueClass ?? "text-[color:var(--color-text-primary)]";
  return `
    <article class="${CARD} min-h-[92px] flex-row items-start gap-3">
      ${opts.iconHtml}
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">${escapeIncHtml(opts.label)}</p>
        <p class="mt-1 text-xl font-bold tabular-nums leading-tight ${valCls}">${escapeIncHtml(opts.value)}</p>
        ${extra}
        ${hint}
      </div>
    </article>`;
}

function kpiSkeleton(): string {
  const one = `
    <div class="${CARD} min-h-[92px] flex-row gap-3 animate-pulse" aria-hidden="true">
      <div class="size-9 shrink-0 rounded border border-[color:var(--color-border)] bg-slate-100"></div>
      <div class="min-w-0 flex-1">
        <div class="h-3 w-20 rounded bg-slate-200"></div>
        <div class="mt-2 h-7 w-14 rounded bg-slate-200"></div>
      </div>
    </div>`;
  return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">${one.repeat(5)}</div>`;
}

function chartPairSkeleton(): string {
  return `<div class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch" aria-hidden="true">
    <div class="${CARD} min-h-[260px] animate-pulse space-y-3 lg:col-span-7">
      <div class="h-4 w-48 rounded bg-slate-200"></div>
      <div class="h-44 w-full rounded-md bg-slate-100"></div>
    </div>
    <div class="${CARD} min-h-[260px] animate-pulse space-y-3 lg:col-span-5">
      <div class="h-4 w-40 rounded bg-slate-200"></div>
      <div class="mx-auto h-40 w-40 rounded-full bg-slate-100"></div>
    </div>
  </div>`;
}

function rankingExtraDetails(slug: string, rowsHtmlTop: string, rowsHtmlRest: string): string {
  if (!rowsHtmlRest.trim()) return rowsHtmlTop;
  return `
    ${rowsHtmlTop}
    <details class="mt-2 border-t border-[color:var(--color-border)] pt-2">
      <summary class="cursor-pointer list-none text-xs font-semibold text-[color:var(--color-text-secondary)] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        ${escapeIncHtml(INC_COPY.verRankingCompleto)}
      </summary>
      <div class="mt-2 space-y-0" data-rh-inc-ranking-rest="${slug}">
        ${rowsHtmlRest}
      </div>
    </details>`;
}

function areaBarsBlock(
  rows: readonly { area: string; total: number }[],
  totalGeneral: number,
): { top: string; rest: string } {
  const topRows = rows.slice(0, TOP);
  const max = Math.max(1, ...topRows.map((r) => r.total));
  const rowHtml = (r: { area: string; total: number }, idx: number) => {
    const barPct = Math.min(100, Math.max(6, Math.round((r.total / max) * 100)));
    const delTotal = pctDelTotal(r.total, totalGeneral);
    const isLead = idx === 0;
    const leadCls = isLead ? "rounded-md bg-slate-50 px-2 -mx-0.5" : "";
    return `
      <div class="flex flex-col gap-1 border-b border-[color:var(--color-border)] py-2.5 first:pt-0 last:border-b-0 last:pb-0 ${leadCls}">
        <div class="flex items-start justify-between gap-2 text-xs">
          <span class="min-w-0 flex-1 font-medium leading-snug text-[color:var(--color-text-primary)]" title="${escapeIncHtml(r.area)}">${escapeIncHtml(r.area)}</span>
          <span class="shrink-0 text-right">
            <span class="text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeIncHtml(String(r.total))}</span>
            <span class="ml-1.5 text-[10px] font-medium tabular-nums text-[color:var(--color-text-muted)]">${escapeIncHtml(delTotal)}%</span>
          </span>
        </div>
        <div class="h-2 max-w-[min(100%,12rem)] overflow-hidden rounded-full bg-slate-100">
          <div class="h-full max-w-full rounded-full bg-[color:var(--color-text-primary)] opacity-80" style="width:${barPct}%"></div>
        </div>
      </div>`;
  };
  const top = topRows.map((r, i) => rowHtml(r, i)).join("");
  const rest = rows.slice(TOP).map((r, i) => rowHtml(r, i + TOP)).join("");
  return { top, rest };
}

function subareaBarsBlock(
  rows: readonly { subarea: string; total: number; area?: string | null }[],
  totalGeneral: number,
): { top: string; rest: string } {
  const topRows = rows.slice(0, TOP);
  const max = Math.max(1, ...topRows.map((r) => r.total));
  const rowHtml = (r: (typeof rows)[number], idx: number) => {
    const barPct = Math.min(100, Math.max(6, Math.round((r.total / max) * 100)));
    const delTotal = pctDelTotal(r.total, totalGeneral);
    const ar = r.area?.trim();
    const meta =
      ar && ar.length > 0
        ? `<span class="block text-[10px] font-medium text-[color:var(--color-text-muted)]">${escapeIncHtml(ar)}</span>`
        : "";
    const isLead = idx === 0;
    const leadCls = isLead ? "rounded-md bg-slate-50 px-2 -mx-0.5" : "";
    return `
      <div class="flex flex-col gap-1 border-b border-[color:var(--color-border)] py-2 first:pt-0 last:border-b-0 last:pb-0 ${leadCls}">
        <div class="flex items-start justify-between gap-2 text-xs">
          <span class="min-w-0 flex-1 font-medium leading-snug text-[color:var(--color-text-primary)]" title="${escapeIncHtml(r.subarea)}">
            ${escapeIncHtml(r.subarea)}
            ${meta}
          </span>
          <span class="shrink-0 text-right">
            <span class="text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeIncHtml(String(r.total))}</span>
            <span class="ml-1.5 text-[10px] font-medium tabular-nums text-[color:var(--color-text-muted)]">${escapeIncHtml(delTotal)}%</span>
          </span>
        </div>
        <div class="h-2 max-w-[min(100%,12rem)] overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-[color:var(--color-leoni-blue-light)] opacity-90" style="width:${barPct}%"></div>
        </div>
      </div>`;
  };
  const top = topRows.map((r, i) => rowHtml(r, i)).join("");
  const rest = rows.slice(TOP).map((r, i) => rowHtml(r, i + TOP)).join("");
  return { top, rest };
}

function empleadoListaCompacta(
  rows: readonly {
    empleado_id: number;
    no_empleado: string | null;
    nombre: string | null;
    total: number;
  }[],
  totalGeneral: number,
): { top: string; rest: string } {
  const topRows = rows.slice(0, TOP);
  const row = (r: (typeof rows)[number], idx: number) => {
    const rawNombre = r.nombre?.trim() || "";
    const nombre =
      rawNombre.length > 0 ? formatNombreEmpleadoIncidenciasUi(rawNombre) : INC_COPY.sinNombre;
    const no = r.no_empleado?.trim();
    const noLabel = no && no.length > 0 ? `${INC_COPY.etiquetaNoEmpleadoCorto} ${no}` : `ID ${r.empleado_id}`;
    const ini = iniciales(nombre);
    const delTotal = pctDelTotal(r.total, totalGeneral);
    const isLead = idx === 0;
    const rowBg = isLead ? "bg-slate-50" : "";
    return `
      <div class="flex items-center gap-2.5 border-b border-[color:var(--color-border)] py-2 first:pt-0 last:border-b-0 last:pb-0 ${rowBg} rounded-md px-2 -mx-0.5">
        <span class="w-5 shrink-0 text-center text-[11px] font-bold tabular-nums text-[color:var(--color-text-muted)]" aria-label="${escapeIncHtml(INC_COPY.rankingPuesto(idx + 1))}">${idx + 1}</span>
        <div class="flex size-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-slate-100 text-[10px] font-bold text-[color:var(--color-text-primary)]" aria-hidden="true">${escapeIncHtml(ini)}</div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-semibold text-[color:var(--color-text-primary)]" title="${escapeIncHtml(nombre)}">${escapeIncHtml(nombre)}</p>
          <p class="truncate text-[10px] font-medium text-[color:var(--color-text-muted)]">${escapeIncHtml(noLabel)}</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-bold tabular-nums text-[color:var(--color-text-primary)]">${escapeIncHtml(String(r.total))}</p>
          <p class="text-[10px] font-medium text-[color:var(--color-text-muted)]">${escapeIncHtml(delTotal)}%</p>
        </div>
      </div>`;
  };
  const top = topRows.map((r, i) => row(r, i)).join("");
  const rest = rows.slice(TOP).map((r, i) => row(r, i + TOP)).join("");
  return { top, rest };
}

function cardShell(slug: string, title: string, subtitle: string | undefined, body: string): string {
  const hid = `rh-inc-anl-${slug}-h`;
  const sub =
    subtitle && subtitle.length > 0
      ? `<p class="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(subtitle)}</p>`
      : "";
  return `
    <article class="${CARD}" aria-labelledby="${hid}">
      <header class="mb-3 shrink-0">
        <h3 id="${hid}" class="text-sm font-semibold tracking-tight text-[color:var(--color-text-primary)]">${escapeIncHtml(title)}</h3>
        ${sub}
      </header>
      <div class="min-h-0 flex-1 text-left">${body}</div>
    </article>`;
}

function resumenContextoListado(vm: RhIncidenciasAdminViewModel): string | undefined {
  if (!vm.resumenListado) return undefined;
  const { abiertas, en_investigacion } = vm.resumenListado;
  return INC_COPY.kpiTotalContexto(abiertas, en_investigacion);
}

export function renderRhIncidenciasAnalyticsSection(vm: RhIncidenciasAdminViewModel): string {
  if (vm.estadisticasStatus === "loading") {
    return `
      <div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4" aria-busy="true">
        ${kpiSkeleton()}
        ${chartPairSkeleton()}
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${`<div class="${CARD} min-h-[140px] animate-pulse" aria-hidden="true"><div class="mb-2 h-4 w-32 rounded bg-slate-200"></div><div class="h-20 rounded bg-slate-100"></div></div>`.repeat(3)}
        </div>
      </div>`;
  }

  if (vm.estadisticasStatus === "error") {
    const msg = vm.estadisticasErrorMessage?.trim() || INC_COPY.errorEstadisticas;
    return `
      <div id="rh-inc-analytics" class="shrink-0">
        <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>${escapeIncHtml(msg)}</p>
          <p class="mt-2 text-xs text-red-700">${escapeIncHtml(INC_COPY.errorEstadisticasAccion)}</p>
          <button type="button" data-rh-inc-apply-filters class="mt-3 inline-flex items-center justify-center rounded border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text-primary)] shadow-sm hover:bg-slate-50">
            ${escapeIncHtml(INC_COPY.reintentarCarga)}
          </button>
        </div>
      </div>`;
  }

  const d = vm.estadisticas;
  if (!d) {
    return `<div id="rh-inc-analytics" class="shrink-0">
      <div class="rounded-lg border border-[color:var(--color-border)] bg-white px-4 py-3 text-sm text-[color:var(--color-text-muted)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</div>
    </div>`;
  }

  const total = d.total_incidencias ?? 0;

  if (total === 0) {
    return `
      <div id="rh-inc-analytics" class="shrink-0">
        <div class="${CARD} items-center py-10 text-center">
          <h3 class="text-base font-semibold text-[color:var(--color-text-primary)]">${escapeIncHtml(INC_COPY.analiticaVaciaTitulo)}</h3>
          <p class="mt-2 max-w-md text-sm text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.tablaVaciaDescripcion)}</p>
          <button type="button" id="rh-inc-nueva-empty" class="mt-5 inline-flex items-center justify-center rounded border border-transparent bg-[color:var(--color-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95">
            ${escapeIncHtml(INC_COPY.analiticaVaciaCta)}
          </button>
        </div>
      </div>`;
  }

  const topArea = d.areas_con_mas_incidencias[0];
  const topEmp = d.empleados_con_mas_incidencias[0];
  const rawEmpNom = topEmp?.nombre?.trim() || "";
  const empNom =
    rawEmpNom.length > 0 ? formatNombreEmpleadoIncidenciasUi(rawEmpNom) : INC_COPY.sinNombre;

  const ctxListado = resumenContextoListado(vm);
  const variacionHtml = lineaVariacionTotal(d);

  const kpis = `
    <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="${escapeIncHtml(INC_COPY.analiticaSeccionAria)}">
      ${kpiCard({
        iconHtml: ICO_TOTAL,
        label: INC_COPY.kpiTotal,
        value: String(total),
        hint: ctxListado,
        extra: variacionHtml,
      })}
      ${kpiCard({
        iconHtml: ICO_SHIELD,
        label: INC_COPY.kpiSeguridad,
        value: String(d.incidencias_seguridad ?? 0),
        hint: INC_COPY.kpiSeguridadHint,
        valueClass: "text-red-700",
      })}
      ${kpiCard({
        iconHtml: ICO_CHECK,
        label: INC_COPY.kpiCalidad,
        value: String(d.incidencias_calidad ?? 0),
        hint: INC_COPY.kpiCalidadHint,
        valueClass: "text-amber-800",
      })}
      ${kpiCard({
        iconHtml: ICO_MAP,
        label: INC_COPY.kpiAreaTop,
        value: topArea ? topArea.area : INC_COPY.kpiSinDato,
        hint: topArea ? INC_COPY.kpiAreaTopHint(topArea.total) : undefined,
      })}
      ${kpiCard({
        iconHtml: ICO_USER,
        label: INC_COPY.kpiEmpleadoTop,
        value: topEmp ? empNom : INC_COPY.kpiSinDato,
        hint: topEmp ? INC_COPY.kpiEmpleadoTopHint(topEmp.total) : undefined,
      })}
    </section>`;

  const serie = d.incidencias_por_mes ?? [];
  const tendencia = renderIncidenciasColumnasPorMes(serie);
  const donut = renderIncidenciasDonutPorTipo(d.incidencias_por_tipo);

  const bloquePrincipal = `
    <section class="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch" aria-label="${escapeIncHtml(INC_COPY.analiticaBloquePrincipalAria)}">
      <div class="lg:col-span-7">
        ${cardShell("tendencia", INC_COPY.analiticaTendenciaTitulo, INC_COPY.analiticaTendenciaSub, tendencia)}
      </div>
      <div class="lg:col-span-5">
        ${cardShell("tipo", INC_COPY.analiticaTipoTitulo, INC_COPY.analiticaTipoSub, donut)}
      </div>
    </section>`;

  const areasSplit = areaBarsBlock(d.areas_con_mas_incidencias, total);
  const subSplit = subareaBarsBlock(d.subareas_con_mas_incidencias, total);
  const empSplit = empleadoListaCompacta(d.empleados_con_mas_incidencias, total);

  const areasBody =
    d.areas_con_mas_incidencias.length === 0
      ? `<p class="py-6 text-center text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</p>`
      : rankingExtraDetails("areas", areasSplit.top, areasSplit.rest);

  const subBody =
    d.subareas_con_mas_incidencias.length === 0
      ? `<p class="py-6 text-center text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</p>`
      : rankingExtraDetails("subareas", subSplit.top, subSplit.rest);

  const empBody =
    d.empleados_con_mas_incidencias.length === 0
      ? `<p class="py-6 text-center text-xs text-[color:var(--color-text-secondary)]">${escapeIncHtml(INC_COPY.analiticaSinDatos)}</p>`
      : `<div class="space-y-0">${rankingExtraDetails("emp", empSplit.top, empSplit.rest)}</div>`;

  const rankings = `
    <section class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="${escapeIncHtml(INC_COPY.analiticaRankingsAria)}">
      ${cardShell("areas", INC_COPY.analiticaAreas, INC_COPY.analiticaAreasSub, areasBody)}
      ${cardShell("subareas", INC_COPY.analiticaSubareas, INC_COPY.analiticaSubareasSub, subBody)}
      ${cardShell("empleados", INC_COPY.analiticaEmpleados, INC_COPY.analiticaEmpleadosSub, empBody)}
    </section>`;

  return `<div id="rh-inc-analytics" class="flex shrink-0 flex-col gap-4">
    ${kpis}
    ${bloquePrincipal}
    ${rankings}
  </div>`;
}
