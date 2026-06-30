import type { CursosDashboardKpis } from "../../dashboard/cursos/seguimientoTypes.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const KPI_DEFS: ReadonlyArray<{
  key: keyof CursosDashboardKpis;
  label: string;
  hint: string;
  variant: string;
}> = [
  {
    key: "cursos_asignados",
    label: "Cursos asignados",
    hint: "Con al menos una asignación activa",
    variant: "rh-dash-kpi-icon--blue",
  },
  {
    key: "cursos_pendientes",
    label: "Cursos pendientes",
    hint: "Sin completar ni sesión activa",
    variant: "rh-dash-kpi-icon--amber",
  },
  {
    key: "cursos_con_sesion_proxima",
    label: "Programados / en curso",
    hint: "Cursos con sesión activa",
    variant: "rh-dash-kpi-icon--violet",
  },
  {
    key: "sesiones_pendientes",
    label: "Sesiones pendientes",
    hint: "Programadas o en curso",
    variant: "rh-dash-kpi-icon--sky",
  },
  {
    key: "sesiones_programadas",
    label: "Sesiones programadas",
    hint: "Por impartirse",
    variant: "rh-dash-kpi-icon--blue",
  },
  {
    key: "empleados_sin_completar_obligatorio",
    label: "Obligatorios sin completar",
    hint: "Empleados con brecha",
    variant: "rh-dash-kpi-icon--amber",
  },
];

const ICON_KPI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75h15m-15 0a9 9 0 1 0 15 0m-15 0v-4.5A2.25 2.25 0 0 1 6.75 6h10.5A2.25 2.25 0 0 1 19.5 8.25v4.5"/></svg>`;

function kpiSkeleton(): string {
  return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
    <div class="h-3 w-24 rounded bg-slate-200/90"></div>
    <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
    <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
  </article>`;
}

export function renderCursosSeguimientoKpis(
  kpis: CursosDashboardKpis | null,
  loading: boolean,
): string {
  if (loading || !kpis) {
    return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Resumen de capacitaciones">${kpiSkeleton().repeat(6)}</div>`;
  }
  const cards = KPI_DEFS.map((def) => {
    const value = kpis[def.key];
    return `<article class="rh-dash-kpi-card rounded-[18px] p-5">
      <div class="flex items-start justify-between gap-3">
        <p class="text-xs font-semibold text-text-muted">${escapeHtml(def.label)}</p>
        <span class="rh-dash-kpi-icon ${def.variant} size-11 shrink-0 [&_svg]:size-5">${ICON_KPI}</span>
      </div>
      <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(String(value))}</p>
      <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(def.hint)}</p>
    </article>`;
  }).join("");
  return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Resumen de capacitaciones">${cards}</div>`;
}
