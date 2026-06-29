import type { CursosDashboardKpis } from "../../dashboard/cursos/seguimientoTypes.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

const KPI_DEFS: ReadonlyArray<{
  key: keyof CursosDashboardKpis;
  label: string;
  hint: string;
  icon: string;
  variant: string;
}> = [
  {
    key: "cursos_asignados",
    label: "Cursos asignados",
    hint: "Con al menos una asignación activa",
    icon: "blue",
    variant: "rh-dash-kpi-icon--blue",
  },
  {
    key: "cursos_pendientes",
    label: "Cursos pendientes",
    hint: "Sin completar ni sesión activa",
    icon: "amber",
    variant: "rh-dash-kpi-icon--amber",
  },
  {
    key: "cursos_completados",
    label: "Cursos completados",
    hint: "Con asistencia registrada",
    icon: "emerald",
    variant: "rh-dash-kpi-icon--emerald",
  },
  {
    key: "cursos_con_sesion_proxima",
    label: "Programados / en curso",
    hint: "Cursos con sesión activa",
    icon: "violet",
    variant: "rh-dash-kpi-icon--violet",
  },
  {
    key: "sesiones_pendientes",
    label: "Sesiones pendientes",
    hint: "Programadas o en curso",
    icon: "sky",
    variant: "rh-dash-kpi-icon--sky",
  },
  {
    key: "sesiones_programadas",
    label: "Sesiones programadas",
    hint: "Por impartirse",
    icon: "blue",
    variant: "rh-dash-kpi-icon--blue",
  },
  {
    key: "sesiones_completadas",
    label: "Sesiones completadas",
    hint: "Finalizadas",
    icon: "emerald",
    variant: "rh-dash-kpi-icon--emerald",
  },
  {
    key: "empleados_sin_completar_obligatorio",
    label: "Obligatorios sin completar",
    hint: "Empleados con brecha",
    icon: "amber",
    variant: "rh-dash-kpi-icon--amber",
  },
];

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
    return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeleton().repeat(8)}</div>`;
  }
  const cards = KPI_DEFS.map((def) => {
    const value = kpis[def.key];
    return `<article class="rh-dash-kpi-card rounded-[18px] border border-[rgba(148,163,184,0.22)] bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(def.label)}</p>
          <p class="mt-2 text-3xl font-bold tabular-nums text-text-primary">${escapeHtml(String(value))}</p>
          <p class="mt-1 text-xs text-text-muted">${escapeHtml(def.hint)}</p>
        </div>
        <span class="rh-dash-kpi-icon ${def.variant} flex size-10 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75h15m-15 0a9 9 0 1 0 15 0m-15 0v-4.5A2.25 2.25 0 0 1 6.75 6h10.5A2.25 2.25 0 0 1 19.5 8.25v4.5"/></svg>
        </span>
      </div>
    </article>`;
  }).join("");
  return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${cards}</div>`;
}
