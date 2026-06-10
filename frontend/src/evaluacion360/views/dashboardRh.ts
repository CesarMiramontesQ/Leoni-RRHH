import { escapeHtml } from "../../ui/uiUtils.ts";
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY } from "../../ui/uiTokens.ts";
import type { EmpleadoEval360, Eval360Filters, PlantKpisRh, TalentoSaludCard } from "../types.ts";
import { renderEval360Filters } from "../filters.ts";
import {
  computeBrechaHeatmap,
  computeCompetenciasPorDepartamento,
  computePlantKpis,
  computeTalentoSalud,
  filterEmpleadosEval360,
  getBrechaCriticaList,
  getNecesidadesCapacitacion,
  getTopDestacados,
  MOCK_EMPLEADOS_EVAL360,
} from "../rhDashboardData.ts";
import { renderEval360ChartIds } from "../charts.ts";
import { eval360Sparkline, evaluacionEstadoBadge, renderSurfaceCard } from "../shared.ts";

const EXEC_KPIS_META = [
  { key: "totalEvaluados" as const, label: "Total empleados evaluados", icon: "users", fmt: (v: number) => String(v) },
  { key: "completadas" as const, label: "Evaluaciones completadas", icon: "check", fmt: (v: number) => String(v) },
  { key: "participacionPct" as const, label: "Participación general", icon: "target", fmt: (v: number) => String(v), suffix: "%" },
  { key: "promedioPlanta" as const, label: "Promedio general planta", icon: "star", fmt: (v: number) => v.toFixed(1), suffix: "/5" },
  { key: "competenciasRiesgo" as const, label: "Competencias en riesgo", icon: "warn", fmt: (v: number) => String(v) },
  { key: "brechasCriticas" as const, label: "Brechas críticas detectadas", icon: "alert", fmt: (v: number) => String(v) },
];

const KPI_ICONS: Record<string, string> = {
  users: `<path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  check: `<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  target: `<path d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 0v.008H12V15Z" stroke-linecap="round" stroke-linejoin="round" />`,
  star: `<path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  warn: `<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
  alert: `<path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

function renderExecKpis(kpis: PlantKpisRh): string {
  const sparks = [12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
    ${EXEC_KPIS_META.map((m) => {
      const raw = kpis[m.key];
      const value = m.fmt(raw);
      return `
      <div class="rounded-xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-medium text-text-muted">${escapeHtml(m.label)}</p>
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent" aria-hidden="true">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">${KPI_ICONS[m.icon]}</svg>
          </span>
        </div>
        <div class="mt-2 flex items-end justify-between gap-2">
          <p class="text-2xl font-bold tabular-nums text-text-primary">${value}${m.suffix ? `<span class="text-sm font-medium text-slate-400">${m.suffix}</span>` : ""}</p>
          ${eval360Sparkline(sparks, "var(--color-accent, #2563EB)")}
        </div>
        <p class="mt-2 text-[11px] text-slate-500">vs. ciclo anterior</p>
      </div>`;
    }).join("")}
  </div>`;
}

function renderTalentoSalud(cards: TalentoSaludCard[]): string {
  const tone: Record<TalentoSaludCard["segmento"], string> = {
    sobresaliente: "border-emerald-200 bg-emerald-50",
    estable: "border-blue-200 bg-blue-50",
    desarrollo: "border-amber-200 bg-amber-50",
    riesgo: "border-red-200 bg-red-50",
  };
  return `
  <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    ${cards
      .map(
        (c) => `
      <div class="rounded-xl border p-4 ${tone[c.segmento]}">
        <p class="text-xs font-semibold text-text-primary">${escapeHtml(c.label)}</p>
        <p class="mt-2 text-2xl font-bold tabular-nums text-text-primary">${c.cantidad}</p>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-sm font-semibold tabular-nums text-slate-700">${c.pct}%</span>
          <span class="text-[10px] font-semibold ${c.deltaPositive ? "text-emerald-700" : "text-red-700"}">${c.deltaPositive ? "↑" : "↓"} ${escapeHtml(c.delta)} vs ciclo ant.</span>
        </div>
      </div>`,
      )
      .join("")}
  </div>`;
}

function brechaHeatmapCell(nivel: string): string {
  const map: Record<string, string> = {
    ninguna: "bg-emerald-100 text-emerald-800",
    baja: "bg-sky-100 text-sky-800",
    media: "bg-amber-100 text-amber-900",
    critica: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    ninguna: "Sin brecha",
    baja: "Brecha baja",
    media: "Brecha media",
    critica: "Brecha crítica",
  };
  return `<div class="flex h-10 items-center justify-center rounded text-[10px] font-semibold ${map[nivel] ?? map.baja}">${labels[nivel] ?? nivel}</div>`;
}

function renderEmpleadosTable(empleados: EmpleadoEval360[]): string {
  const rows = empleados
    .map((e) => `
    <tr class="border-b border-slate-100 hover:bg-slate-50/80">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">${escapeHtml(e.iniciales)}</span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre)}</span>
        </div>
      </td>
      <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${escapeHtml(e.numero)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.puesto)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.departamento)}</td>
      <td class="px-4 py-3 text-sm text-slate-600 max-w-[10rem] truncate" title="${escapeHtml(e.campana)}">${escapeHtml(e.campana)}</td>
      <td class="px-4 py-3">${evaluacionEstadoBadge(e.estado)}</td>
      <td class="px-4 py-3 text-sm font-semibold tabular-nums text-text-primary">${e.calificacion > 0 ? e.calificacion.toFixed(1) : "—"}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.nivel)}</td>
      <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(e.brechaPrincipal)}</td>
      <td class="px-4 py-3">
        <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-select-empleado" data-id="${escapeHtml(e.id)}">Ver evaluación</button>
      </td>
    </tr>`)
    .join("");

  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-left">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <th class="px-4 py-3">Empleado</th>
            <th class="px-4 py-3">Número</th>
            <th class="px-4 py-3">Puesto</th>
            <th class="px-4 py-3">Departamento</th>
            <th class="px-4 py-3">Campaña</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3">Calificación</th>
            <th class="px-4 py-3">Nivel</th>
            <th class="px-4 py-3">Brecha principal</th>
            <th class="px-4 py-3">Acción</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="10" class="px-4 py-8 text-center text-sm text-text-muted">Sin empleados con los filtros actuales</td></tr>`}</tbody>
      </table>
    </div>`;
}

export interface RhDashboardRenderOpts {
  filters: Eval360Filters;
  search: string;
}

export function renderEval360RhDashboard(opts: RhDashboardRenderOpts): string {
  const filtered = filterEmpleadosEval360(MOCK_EMPLEADOS_EVAL360, opts.filters, opts.search);
  const kpis = computePlantKpis(filtered);
  const salud = computeTalentoSalud(filtered);
  const heatmap = computeBrechaHeatmap(filtered);
  const charts = renderEval360ChartIds();

  const topDestacados = getTopDestacados(filtered);
  const brechaCritica = getBrechaCriticaList(filtered);
  const capacitacion = getNecesidadesCapacitacion(filtered);

  const heatmapHeader = heatmap.competencias.map((c) => `<th class="px-2 py-2 text-[10px] font-semibold text-text-muted">${escapeHtml(c)}</th>`).join("");
  const heatmapRows = heatmap.departamentos
    .map(
      (dept, di) => `
    <tr>
      <td class="px-3 py-2 text-xs font-medium text-text-primary">${escapeHtml(dept)}</td>
      ${heatmap.matrix[di]?.map((cell) => `<td class="p-1">${brechaHeatmapCell(cell)}</td>`).join("") ?? ""}
    </tr>`,
    )
    .join("");

  return `
    ${renderEval360Filters(opts.filters)}

    <section class="mt-6" aria-labelledby="e360-seccion-planta">
      <h2 id="e360-seccion-planta" class="text-sm font-semibold text-text-primary">Resumen general de planta</h2>
      <p class="mt-0.5 text-xs text-text-muted">${filtered.length} empleados en el universo filtrado</p>
      <div class="mt-4">${renderExecKpis(kpis)}</div>

      <div class="mt-6">
        <h3 class="text-sm font-semibold text-text-primary">Salud de talento de la planta</h3>
        <div class="mt-3">${renderTalentoSalud(salud)}</div>
      </div>

      <div class="mt-6 grid gap-5 lg:grid-cols-2">
        ${renderSurfaceCard("Promedio de competencias por departamento", "Comparativo por área organizacional", charts.barDeptComp)}
        ${renderSurfaceCard(
          "Mapa de brechas por competencia y departamento",
          "Sin brecha · Brecha baja · Brecha media · Brecha crítica",
          `<div class="overflow-x-auto -mx-5 px-5">
            <table class="min-w-full text-left">
              <thead><tr><th class="px-3 py-2"></th>${heatmapHeader}</tr></thead>
              <tbody>${heatmapRows}</tbody>
            </table>
          </div>`,
        )}
      </div>

      <div class="mt-5 grid gap-5 lg:grid-cols-3">
        ${renderSurfaceCard(
          "Top empleados destacados",
          "",
          `<ul class="space-y-3">${topDestacados.map((e) => `<li class="flex items-start justify-between gap-2"><div><p class="text-sm font-medium text-text-primary">${escapeHtml(e.nombre)}</p><p class="text-xs text-text-muted">${escapeHtml(e.puesto)} · ${escapeHtml(e.departamento)}</p></div><div class="text-right"><p class="text-sm font-bold tabular-nums text-accent">${e.calificacion.toFixed(1)}</p><p class="text-[10px] text-emerald-700">${escapeHtml(e.nivel)}</p></div></li>`).join("") || `<p class="text-sm text-text-muted">Sin datos</p>`}</ul>`,
        )}
        ${renderSurfaceCard(
          "Empleados con brecha crítica",
          "",
          `<ul class="space-y-3">${brechaCritica.map((b) => `<li><p class="text-sm font-medium text-text-primary">${escapeHtml(b.nombre)}</p><p class="text-xs text-red-700">${escapeHtml(b.competencia)} · ${escapeHtml(b.brecha)}</p><p class="text-[11px] text-text-muted">${escapeHtml(b.accion)}</p></li>`).join("") || `<p class="text-sm text-text-muted">Sin alertas</p>`}</ul>`,
        )}
        ${renderSurfaceCard(
          "Necesidades de capacitación",
          "Agrupado por competencia",
          `<ul class="space-y-3">${capacitacion.map((n) => `<li class="flex items-center justify-between gap-2"><div><p class="text-sm font-medium text-text-primary">${escapeHtml(n.competencia)}</p><p class="text-xs text-text-muted">${n.afectados} empleados</p></div><span class="rounded-full border px-2 py-0.5 text-[10px] font-semibold ${n.prioridad === "Alta" ? "border-red-200 bg-red-50 text-red-800" : n.prioridad === "Media" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-100 text-slate-700"}">${n.prioridad}</span></li>`).join("") || `<p class="text-sm text-text-muted">Sin necesidades detectadas</p>`}</ul>`,
        )}
      </div>
    </section>

    <section class="mt-10" aria-labelledby="e360-seccion-selector">
      <h2 id="e360-seccion-selector" class="text-sm font-semibold text-text-primary">Selector de empleado</h2>
      <p class="mt-0.5 text-xs text-text-muted">Busque colaboradores evaluados y acceda a su evaluación en la pestaña Resultados</p>
      <div class="mt-4 rounded-xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <label class="mb-1 block text-xs font-medium text-text-muted">Buscar empleado</label>
        <input type="search" name="e360-search" value="${escapeHtml(opts.search)}" placeholder="Nombre, número, puesto o departamento…" class="w-full max-w-xl rounded-lg border border-border px-3 py-2 text-sm" data-input="e360-search" />
        <div class="mt-4">${renderEmpleadosTable(filtered)}</div>
      </div>
    </section>`;
}

export function renderEval360RhHeader(): string {
  return `
    <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium text-text-muted">Level Up · Recursos Humanos</p>
        <h1 class="mt-0.5 text-xl font-bold text-text-primary">Evaluación 360°</h1>
        <p class="mt-1 text-sm text-text-muted">Vista integral de desempeño, competencias y brechas de talento por planta.</p>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
        <button type="button" class="${BTN_GHOST}" data-action="e360-exportar">Exportar resultados</button>
        <button type="button" class="${BTN_SECONDARY}" data-action="e360-generar-reporte">Generar reporte</button>
        <button type="button" class="${BTN_PRIMARY}" data-action="e360-open-modal">Nueva campaña</button>
      </div>
    </div>`;
}

/** Datos de gráfica competencias/depto para mount charts. */
export function getDashboardChartData(opts: RhDashboardRenderOpts) {
  const filtered = filterEmpleadosEval360(MOCK_EMPLEADOS_EVAL360, opts.filters, opts.search);
  return {
    filtered,
    competenciasDept: computeCompetenciasPorDepartamento(filtered),
  };
}
