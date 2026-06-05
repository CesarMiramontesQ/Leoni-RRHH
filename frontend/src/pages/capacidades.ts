import { mountAppShell } from "../layouts/appShell.ts";
import {
  getMultihabilidadesPuestos,
  getMultihabilidadesData,
  type MultihabilidadesPuestoOption,
  type MultihabilidadesCompetencia,
  type MultihabilidadesEmpleado,
  type MultihabilidadesResponse,
} from "../api/competencias.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  RH_LISTADO_SURFACE,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_FOCUS_RING,
  BTN_SECONDARY,
} from "../ui/uiTokens.ts";

// ── Color helpers (mismos significados de negocio) ───────────────────────────

function capCellClasses(level: number, required: number): string {
  const below = required > 0 && level < required;
  let tone = "bg-slate-50/90 text-slate-400 border border-dashed border-slate-200";
  if (level === 1) tone = "bg-red-100 text-red-900 border border-red-200/80";
  else if (level === 2) tone = "bg-orange-100 text-orange-900 border border-orange-200/80";
  else if (level === 3) tone = "bg-amber-100 text-amber-900 border border-amber-200/80";
  else if (level >= 4) tone = "bg-emerald-100 text-emerald-900 border border-emerald-200/80";
  const gap = below ? " ring-2 ring-inset ring-red-400/90 shadow-[0_0_0_1px_rgba(239,68,68,0.15)]" : "";
  return `${tone}${gap}`;
}

function scoreVisual(score: number): { bar: string; badge: string; track: string } {
  if (score >= 90) {
    return {
      track: "bg-emerald-100",
      bar: "bg-emerald-500",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (score >= 75) {
    return {
      track: "bg-amber-100",
      bar: "bg-amber-500",
      badge: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    track: "bg-red-100",
    bar: "bg-red-500",
    badge: "border-red-200 bg-red-50 text-red-800",
  };
}

// ── Iconos KPI (Heroicons outline) ───────────────────────────────────────────

const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_CHART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z"/></svg>`;

// ── Estados y skeletons ──────────────────────────────────────────────────────

function kpiSkeletonCard(): string {
  return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="h-3.5 w-28 rounded-md bg-slate-200/90"></div>
      <div class="h-11 w-11 rounded-xl bg-slate-200/80"></div>
    </div>
    <div class="mt-4 h-10 w-20 rounded-md bg-slate-100/90"></div>
    <div class="mt-3 h-3 w-full max-w-[12rem] rounded-md bg-slate-100/80"></div>
  </article>`;
}

function renderPageSkeleton(): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}" aria-busy="true" aria-label="Cargando matriz">
    <div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] animate-pulse">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="h-10 rounded-lg bg-slate-100/90"></div>
        <div class="h-10 rounded-lg bg-slate-100/90"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
    <div class="h-12 animate-pulse rounded-xl bg-slate-100/80"></div>
    <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
  </div>`;
}

function renderResultsSkeleton(): string {
  const skRow = `<tr>${"<td class=\"px-3 py-3\"><div class=\"h-8 animate-pulse rounded-md bg-slate-100/90\"></div></td>".repeat(6)}</tr>`;
  return `
    <div class="flex flex-col gap-4" aria-busy="true" aria-label="Cargando datos de la matriz">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-14 animate-pulse rounded-xl bg-slate-100/80"></div>
      <div class="${RH_LISTADO_SURFACE} overflow-hidden p-4">
        <table class="min-w-full"><tbody>${skRow}${skRow}${skRow}${skRow}</tbody></table>
      </div>
    </div>`;
}

function renderError(msg: string): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER}">
    <div class="flex min-h-[320px] items-center justify-center rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 via-white to-white px-6 py-16 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]" role="alert">
      <div class="flex max-w-md flex-col items-center gap-4">
        <span class="flex size-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">${ICON_ALERT}</span>
        <div>
          <p class="text-base font-semibold text-text-primary">No se pudo cargar la información</p>
          <p class="mt-1.5 text-sm leading-relaxed text-text-secondary">${escapeHtml(msg)}</p>
        </div>
        <button type="button" data-action="retry" class="${BTN_SECONDARY}">Reintentar</button>
      </div>
    </div>
  </div>`;
}

function renderEmptyState(): string {
  return `
  <div class="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50/90 via-white to-blue-50/20 px-6 py-14 text-center">
    <div class="flex max-w-sm flex-col items-center gap-3">
      <span class="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">${ICON_GRID}</span>
      <p class="text-sm font-semibold text-text-primary">Selecciona un puesto para ver la matriz</p>
      <p class="text-sm leading-relaxed text-text-muted">Elige un puesto en el panel de filtros para comparar competencias requeridas con el nivel actual de cada colaborador.</p>
    </div>
  </div>`;
}

function renderNoSearchResults(): string {
  return `
  <div class="flex min-h-[200px] items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 px-6 py-12 text-center">
    <div class="max-w-sm">
      <p class="text-sm font-semibold text-text-primary">Sin resultados para la búsqueda</p>
      <p class="mt-1 text-sm text-text-muted">No hay colaboradores que coincidan con el nombre ingresado. Prueba con otro término.</p>
    </div>
  </div>`;
}

// ── Filtros ────────────────────────────────────────────────────────────────────

function renderFilterActiveChips(
  puestos: MultihabilidadesPuestoOption[],
  selectedId: number | null,
  searchValue: string,
): string {
  const activeChips: string[] = [];
  if (selectedId) {
    const p = puestos.find((x) => x.id === selectedId);
    if (p) activeChips.push(`Puesto: ${escapeHtml(p.nombre)}`);
  }
  if (searchValue.trim()) {
    activeChips.push(`Búsqueda: “${escapeHtml(searchValue.trim())}”`);
  }
  if (activeChips.length === 0) return "";
  return `<div id="cap-filter-chips" class="flex flex-wrap items-center gap-2 border-t border-slate-100/90 pt-3 mt-1">
    <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Filtros activos</span>
    ${activeChips
      .map(
        (c) =>
          `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-900">${c}</span>`,
      )
      .join("")}
  </div>`;
}

function renderFilters(
  puestos: MultihabilidadesPuestoOption[],
  selectedId: number | null,
  searchValue: string,
): string {
  const options = puestos
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.nombre)} (${p.num_empleados} emp.)</option>`,
    )
    .join("");

  const activeChips = renderFilterActiveChips(puestos, selectedId, searchValue);
  const hasActive = activeChips.length > 0;

  return `
  <section class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-5" aria-label="Filtros de la matriz">
    <div class="mb-3 flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <span id="cap-filter-active-dot" class="inline-flex size-2 rounded-full bg-leoni-blue ${hasActive ? "" : "hidden"}" aria-hidden="true" title="Hay filtros activos"></span>
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(12rem,1fr)_minmax(0,1.4fr)] lg:items-end">
      <div class="min-w-0">
        <label class="mb-1.5 block text-xs font-semibold text-text-secondary">Puesto</label>
        <div class="grid grid-cols-1">
          <select data-action="select-puesto" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="">— Seleccionar puesto —</option>
            ${options}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-0">
        <label class="mb-1.5 block text-xs font-semibold text-text-secondary">Buscar colaborador</label>
        <div class="relative">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>
          </span>
          <input data-action="search-empleado" type="search" value="${escapeHtml(searchValue)}" placeholder="Nombre del colaborador…" autocomplete="off"
            class="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
        </div>
      </div>
    </div>
    ${activeChips}
  </section>`;
}

// ── KPIs ───────────────────────────────────────────────────────────────────────

function computeKpiMetrics(
  competencias: MultihabilidadesCompetencia[],
  empleados: MultihabilidadesEmpleado[],
): { numCaps: number; numEvals: number; promedio: string; brechas: number } {
  const numCaps = competencias.length;
  const numEvals = empleados.length;
  let totalLevel = 0;
  let totalCells = 0;
  let brechas = 0;
  for (const emp of empleados) {
    for (const comp of competencias) {
      const nivel = emp.niveles[comp.competencia_id] ?? 0;
      totalLevel += nivel;
      totalCells++;
      if (comp.nivel_requerido > 0 && nivel < comp.nivel_requerido) brechas++;
    }
  }
  const promedio = totalCells > 0 ? (totalLevel / totalCells).toFixed(1) : "0.0";
  return { numCaps, numEvals, promedio, brechas };
}

function renderKpis(
  competencias: MultihabilidadesCompetencia[],
  empleados: MultihabilidadesEmpleado[],
): string {
  const { numCaps, numEvals, promedio, brechas } = computeKpiMetrics(competencias, empleados);
  const brechasCritico = brechas > 0;

  const items: {
    label: string;
    value: string;
    sup?: string;
    sub: string;
    icon: string;
    iconWrap: string;
    valueClass?: string;
  }[] = [
    {
      label: "Competencias",
      value: String(numCaps),
      sub: "Requeridas para este puesto",
      icon: ICON_GRID,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: "Personas evaluadas",
      value: String(numEvals),
      sub: "Asignadas al puesto",
      icon: ICON_USERS,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
    {
      label: "Nivel promedio",
      value: promedio,
      sup: "/4",
      sub: "Todos los colaboradores",
      icon: ICON_CHART,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
    },
    {
      label: "Brechas activas",
      value: String(brechas),
      sub: "Celdas debajo del requerido",
      icon: ICON_ALERT,
      iconWrap: brechasCritico ? "rh-dash-kpi-icon rh-dash-kpi-icon--red" : "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      valueClass: brechasCritico ? "text-red-700" : "",
    },
  ];

  return `
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Indicadores de la matriz">
    ${items
      .map(
        (k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5 ${k.label === "Brechas activas" && brechasCritico ? "border-red-200/80 bg-gradient-to-br from-red-50/40 via-white to-white" : ""}">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary ${k.valueClass ?? ""}">
          ${k.value}${k.sup ? `<span class="ml-0.5 text-base font-semibold text-text-muted">${k.sup}</span>` : ""}
        </p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`,
      )
      .join("")}
  </div>`;
}

// ── Leyenda ────────────────────────────────────────────────────────────────────

function legendBadge(
  swatchClass: string,
  label: string,
  extra = "",
): string {
  return `<span class="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm ${extra}">
    <span class="inline-block size-3.5 shrink-0 rounded ${swatchClass}" aria-hidden="true"></span>
    ${label}
  </span>`;
}

function renderSinNivelRequeridoBanner(competencias: MultihabilidadesCompetencia[]): string {
  if (competencias.length === 0) return "";
  const conRequisito = competencias.some((c) => c.nivel_requerido > 0);
  if (conRequisito) return "";
  return `
  <div class="rounded-xl border border-amber-200/90 bg-amber-50/70 px-4 py-3 text-sm text-amber-950" role="status">
    <p class="font-semibold">Sin niveles mínimos configurados</p>
    <p class="mt-1 leading-relaxed text-amber-900/90">
      Las competencias de este puesto están asociadas pero con nivel requerido <strong>0 (N/A)</strong>.
      Para detectar brechas y bordes rojos, en
      <a href="#/competencias" class="font-semibold text-leoni-blue hover:underline">Competencias → Niveles por puesto</a>
      elige este perfil y asigna nivel 1–4 a cada competencia.
    </p>
  </div>`;
}

function renderLegend(): string {
  return `
  <section class="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3.5 sm:px-5" aria-label="Leyenda de niveles de dominio">
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
      <span class="text-xs font-semibold uppercase tracking-wide text-text-secondary shrink-0">Nivel de dominio</span>
      <div class="flex flex-wrap items-center gap-2">
        ${legendBadge("bg-red-100 ring-1 ring-red-200/80", "1 — Planeado")}
        ${legendBadge("bg-orange-100 ring-1 ring-orange-200/80", "2 — En entrenamiento")}
        ${legendBadge("bg-amber-100 ring-1 ring-amber-200/80", "3 — Certificado")}
        ${legendBadge("bg-emerald-100 ring-1 ring-emerald-200/80", "4 — Experto")}
        ${legendBadge("bg-slate-50 ring-1 ring-dashed ring-slate-300", "0 — Sin evaluar")}
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:ml-auto">
        ${legendBadge(
          "bg-white ring-2 ring-red-400/90",
          "Debajo del requerido",
          "border-red-300/90 bg-red-50/90 font-semibold text-red-900",
        )}
      </div>
    </div>
  </section>`;
}

// ── Celdas y tabla ─────────────────────────────────────────────────────────────

function renderLevelCell(nivel: number, required: number): string {
  const cls = capCellClasses(nivel, required);
  const below = required > 0 && nivel < required;
  const display = nivel === 0 ? "—" : String(nivel);
  const title = nivel === 0 ? "Sin evaluar" : `Nivel ${nivel}`;
  return `<td class="px-1 py-1.5 text-center align-middle">
    <span class="relative inline-flex size-8 items-center justify-center rounded-md text-xs font-bold tabular-nums ${cls}" title="${escapeHtml(title)}">
      ${below ? `<span class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true"></span>` : ""}
      ${display}
    </span>
  </td>`;
}

function renderScoreCell(score: number): string {
  const vis = scoreVisual(score);
  return `<td class="px-2 py-2 text-center align-middle min-w-[5.5rem]">
    <div class="flex flex-col items-center gap-1.5">
      <div class="h-1.5 w-full max-w-[4.5rem] overflow-hidden rounded-full ${vis.track}" role="progressbar" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" aria-label="Score ${score}%">
        <div class="h-full rounded-full ${vis.bar}" style="width:${score}%"></div>
      </div>
      <span class="inline-flex min-w-[2.75rem] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${vis.badge}">${score}%</span>
    </div>
  </td>`;
}

function renderHeatmap(
  competencias: MultihabilidadesCompetencia[],
  empleados: MultihabilidadesEmpleado[],
  searchActive: boolean,
): string {
  if (searchActive && empleados.length === 0) {
    return renderNoSearchResults();
  }

  if (empleados.length === 0) {
    return `
    <div class="${RH_LISTADO_SURFACE} flex min-h-[200px] items-center justify-center p-8 text-center">
      <div>
        <p class="text-sm font-semibold text-text-primary">No hay colaboradores asignados a este puesto</p>
        <p class="mt-1 text-sm text-text-muted">Cuando existan asignaciones, aparecerán en la matriz.</p>
      </div>
    </div>`;
  }

  if (competencias.length === 0) {
    return `
    <div class="${RH_LISTADO_SURFACE} flex min-h-[200px] items-center justify-center p-8 text-center">
      <div>
        <p class="text-sm font-semibold text-text-primary">Sin competencias configuradas</p>
        <p class="mt-1 text-sm text-text-muted">Este puesto no tiene competencias requeridas definidas.</p>
      </div>
    </div>`;
  }

  const nivelNames = ["—", "Planeado", "En entrenamiento", "Certificado", "Experto"];
  const colHeaders = competencias
    .map((c) => {
      const reqLabel = nivelNames[c.nivel_requerido] ?? "—";
      const catLabel = c.tipo_nombre || "General";
      return `<th scope="col" class="px-1 py-2 text-center align-bottom min-w-[2.75rem] cursor-help bg-[var(--color-grid-header-bg,#f8fafc)]" data-tooltip-name="${escapeHtml(c.competencia_nombre)}" data-tooltip-cat="${escapeHtml(catLabel)}" data-tooltip-req="${escapeHtml(reqLabel)}">
        <span class="cap-matriz-comp-label" title="${escapeHtml(c.competencia_nombre)}">${escapeHtml(c.competencia_nombre)}</span>
      </th>`;
    })
    .join("");

  const empRows = empleados
    .map((emp) => {
      let scoreSum = 0;
      let scoreCount = 0;
      const cells = competencias
        .map((comp) => {
          const nivel = emp.niveles[comp.competencia_id] ?? 0;
          if (nivel > 0) {
            scoreSum += nivel;
            scoreCount++;
          }
          return renderLevelCell(nivel, comp.nivel_requerido);
        })
        .join("");
      const score = scoreCount > 0 ? Math.round((scoreSum / (scoreCount * 4)) * 100) : 0;
      const initials = emp.nombre
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
      const noEmpDisplay = emp.no_empleado.replace(/\.0$/, "");

      return `
    <tr class="border-t border-slate-100/90 transition-colors hover:bg-slate-50/80 focus-within:bg-blue-50/50 focus-within:ring-1 focus-within:ring-inset focus-within:ring-blue-200/80">
      <th scope="row" class="cap-matriz-sticky-col px-3 py-2.5 text-left font-normal">
        <div class="flex items-center gap-3 min-w-[11.5rem] max-w-[14rem]">
          <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-xs font-bold text-white shadow-sm" aria-hidden="true">${escapeHtml(initials)}</span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold leading-snug text-text-primary">${escapeHtml(emp.nombre)}</div>
            <div class="truncate text-xs tabular-nums text-text-muted">#${escapeHtml(noEmpDisplay)}</div>
          </div>
        </div>
      </th>
      ${cells}
      ${renderScoreCell(score)}
    </tr>`;
    })
    .join("");

  let totalBrechas = 0;
  let empConBrecha = 0;
  for (const emp of empleados) {
    let tieneBrecha = false;
    for (const comp of competencias) {
      if (comp.nivel_requerido > 0 && (emp.niveles[comp.competencia_id] ?? 0) < comp.nivel_requerido) {
        totalBrechas++;
        tieneBrecha = true;
      }
    }
    if (tieneBrecha) empConBrecha++;
  }

  return `
  <div class="${RH_LISTADO_SURFACE} overflow-hidden flex flex-col">
    <div class="cap-matriz-scroll flex-1">
      <table class="cap-matriz-table w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200/90">
            <th scope="col" class="cap-matriz-sticky-col px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-muted min-w-[12rem]">Colaborador</th>
            ${colHeaders}
            <th scope="col" class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-text-muted bg-[var(--color-grid-header-bg,#f8fafc)] min-w-[5.5rem]">Score</th>
          </tr>
        </thead>
        <tbody>
          ${empRows}
        </tbody>
      </table>
    </div>
    <footer class="border-t border-slate-200/90 bg-gradient-to-r from-slate-50/95 via-white to-blue-50/30 px-4 py-4 sm:px-5">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-3">Resumen de brechas</p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex items-center gap-3 rounded-xl border border-red-200/60 bg-red-50/50 px-4 py-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">${ICON_ALERT}</span>
          <div>
            <p class="text-2xl font-bold tabular-nums text-red-900">${totalBrechas}</p>
            <p class="text-xs text-red-800/80">Brechas detectadas en la matriz</p>
          </div>
        </div>
        <div class="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">${ICON_USERS}</span>
          <div>
            <p class="text-2xl font-bold tabular-nums text-amber-950">${empConBrecha}</p>
            <p class="text-xs text-amber-900/80">Colaboradores con al menos una brecha</p>
          </div>
        </div>
      </div>
    </footer>
  </div>`;
}

// ── Page mount ───────────────────────────────────────────────────────────────

export function mountCapacidades(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let errorMessage = "";
  let puestoOptions: MultihabilidadesPuestoOption[] = [];
  let selectedPuestoId: number | null = null;
  let matrizData: MultihabilidadesResponse | null = null;
  let searchFilter = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let loadVersion = 0;
  let initialLoad = true;

  mountAppShell(container, {
    pageTitle: "Matriz de Multihabilidades",
    activeNav: "capacidades",
    mainHtml: `<div id="capacidades-root"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#capacidades-root")!;

  function paint(): void {
    if (status === "error") {
      root.innerHTML = renderError(errorMessage);
      return;
    }

    if (status === "loading" && initialLoad) {
      root.innerHTML = renderPageSkeleton();
      return;
    }

    const matrizLoading = status === "loading" && !initialLoad;

    let content = `
    <div class="${RH_LISTADO_PAGE_OUTER}">
      ${renderFilters(puestoOptions, selectedPuestoId, searchFilter)}`;

    if (!selectedPuestoId || !matrizData) {
      content += `<div id="cap-results">${matrizLoading ? renderResultsSkeleton() : renderEmptyState()}</div>`;
    } else {
      const filtered = searchFilter
        ? matrizData.empleados.filter((e) => e.nombre.toLowerCase().includes(searchFilter.toLowerCase()))
        : matrizData.empleados;
      const searchActive = searchFilter.trim().length > 0;

      content += `<div id="cap-results" class="flex flex-col gap-4">`;
      if (matrizLoading) {
        content += renderResultsSkeleton();
      } else {
        content += renderKpis(matrizData.competencias, filtered);
        content += renderSinNivelRequeridoBanner(matrizData.competencias);
        content += renderLegend();
        content += renderHeatmap(matrizData.competencias, filtered, searchActive);
      }
      content += `</div>`;
    }

    content += `</div>`;
    root.innerHTML = content;
  }

  async function loadPuestos(): Promise<void> {
    try {
      puestoOptions = await getMultihabilidadesPuestos();
      status = "ready";
      initialLoad = false;
      if (puestoOptions.length > 0 && !selectedPuestoId) {
        selectedPuestoId = puestoOptions[0].id;
        paint();
        await loadMatriz();
        return;
      }
    } catch (err: unknown) {
      status = "error";
      initialLoad = false;
      errorMessage = (err as { detail?: string })?.detail ?? "Error al cargar puestos";
    }
    paint();
  }

  async function loadMatriz(): Promise<void> {
    if (!selectedPuestoId) return;
    const version = ++loadVersion;
    status = "loading";
    paint();
    try {
      const data = await getMultihabilidadesData(selectedPuestoId);
      if (version !== loadVersion) return;
      matrizData = data;
      status = "ready";
    } catch (err: unknown) {
      if (version !== loadVersion) return;
      status = "error";
      errorMessage = (err as { detail?: string })?.detail ?? "Error al cargar matriz";
    }
    paint();
  }

  function handleChange(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.matches("[data-action='select-puesto']")) {
      const val = (target as HTMLSelectElement).value;
      selectedPuestoId = val ? Number(val) : null;
      matrizData = null;
      searchFilter = "";
      if (selectedPuestoId) {
        loadMatriz();
      } else {
        paint();
      }
    }
  }

  function paintResults(): void {
    const resultsEl = root.querySelector<HTMLElement>("#cap-results");
    if (!resultsEl) return;

    const existingChips = root.querySelector("#cap-filter-chips");
    if (existingChips) existingChips.remove();
    const chipsHtml = renderFilterActiveChips(puestoOptions, selectedPuestoId, searchFilter);
    if (chipsHtml) {
      const filterSection = root.querySelector("section[aria-label='Filtros de la matriz']");
      filterSection?.insertAdjacentHTML("beforeend", chipsHtml);
    }
    const dot = root.querySelector("#cap-filter-active-dot");
    if (dot) {
      const hasActive =
        Boolean(selectedPuestoId) || searchFilter.trim().length > 0;
      dot.classList.toggle("hidden", !hasActive);
    }

    if (!selectedPuestoId || !matrizData) {
      resultsEl.innerHTML = renderEmptyState();
      return;
    }
    const filtered = searchFilter
      ? matrizData.empleados.filter((e) => e.nombre.toLowerCase().includes(searchFilter.toLowerCase()))
      : matrizData.empleados;
    const searchActive = searchFilter.trim().length > 0;

    resultsEl.innerHTML =
      renderKpis(matrizData.competencias, filtered) +
      renderSinNivelRequeridoBanner(matrizData.competencias) +
      renderLegend() +
      renderHeatmap(matrizData.competencias, filtered, searchActive);
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.matches("[data-action='search-empleado']")) {
      const val = (target as HTMLInputElement).value;
      searchFilter = val;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        paintResults();
      }, 250);
    }
  }

  function handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest("[data-action='retry']")) {
      status = "loading";
      if (selectedPuestoId) {
        loadMatriz();
      } else {
        initialLoad = true;
        loadPuestos();
      }
    }
  }

  let tooltip: HTMLDivElement | null = null;

  function showTooltip(target: HTMLElement): void {
    const name = target.dataset.tooltipName;
    const cat = target.dataset.tooltipCat;
    const req = target.dataset.tooltipReq;
    if (!name) return;

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "fixed z-[9999] pointer-events-none transition-opacity duration-150";
      document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
      <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-xl text-left w-56">
        <p class="text-xs font-bold text-slate-900 leading-snug">${escapeHtml(name)}</p>
        <div class="mt-2 space-y-1.5 text-[11px] text-slate-600">
          <div class="flex items-center justify-between gap-2"><span class="text-slate-500">Categoría</span><span class="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">${escapeHtml(cat ?? "")}</span></div>
          ${req ? `<div class="flex items-center justify-between gap-2"><span class="text-slate-500">Requerido</span><span class="font-semibold text-slate-800">${escapeHtml(req)}</span></div>` : ""}
        </div>
      </div>`;

    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - 112}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.style.transform = "translateY(-100%)";
    tooltip.style.opacity = "1";
  }

  function hideTooltip(): void {
    if (tooltip) {
      tooltip.style.opacity = "0";
      tooltip.innerHTML = "";
    }
  }

  let currentTooltipTarget: HTMLElement | null = null;

  function handleMouseOver(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tooltip-name]");
    if (target && target !== currentTooltipTarget) {
      currentTooltipTarget = target;
      showTooltip(target);
    }
  }

  function handleMouseOut(e: Event): void {
    const target = e.target as HTMLElement;
    const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
    const tooltipCell = target.closest<HTMLElement>("[data-tooltip-name]");
    if (tooltipCell && related && tooltipCell.contains(related)) return;
    currentTooltipTarget = null;
    hideTooltip();
  }

  root.addEventListener("change", handleChange);
  root.addEventListener("input", handleInput);
  root.addEventListener("click", handleClick);
  root.addEventListener("mouseover", handleMouseOver);
  root.addEventListener("mouseout", handleMouseOut);

  signal.addEventListener("abort", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
    root.removeEventListener("change", handleChange);
    root.removeEventListener("input", handleInput);
    root.removeEventListener("click", handleClick);
    root.removeEventListener("mouseover", handleMouseOver);
    root.removeEventListener("mouseout", handleMouseOut);
  });

  loadPuestos();
}
