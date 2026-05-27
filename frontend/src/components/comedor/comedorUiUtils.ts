import type { ComedorKpi } from "../../comedor/rh/types.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";

/** KPIs «% Opción A» / «% Opción B» en vista líder (`#/comedor`). */
const COMEDOR_KPI_IDS_OPCION_AB = new Set(["porcentaje_caseras", "porcentaje_saludables"]);

/** Oculta tarjetas Opción A/B para supervisor y gerente en `#/comedor`. */
export function filterComedorKpisOpcionAb(
  kpis: readonly ComedorKpi[],
  hideOpcionAb: boolean,
): readonly ComedorKpi[] {
  if (!hideOpcionAb) return kpis;
  return kpis.filter((k) => !COMEDOR_KPI_IDS_OPCION_AB.has(k.id));
}

/** @deprecated Usar `filterComedorKpisOpcionAb`. */
export function filterComedorKpisOpcionAbForSupervisor(
  kpis: readonly ComedorKpi[],
  hideOpcionAb: boolean,
): readonly ComedorKpi[] {
  return filterComedorKpisOpcionAb(kpis, hideOpcionAb);
}

export function comedorLiderOcultaKpisOpcionAb(rol: string | null): boolean {
  return rol === "supervisor" || rol === "gerente";
}

export function comedorLiderStatsGridClass(hideOpcionAb: boolean): string {
  return hideOpcionAb
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
}

export function comedorLiderStatsSkeletonCount(hideOpcionAb: boolean): number {
  return hideOpcionAb ? 3 : 5;
}

/** Cabecera de tabla alineada a Solicitudes (`.rh-sol-th` + reglas bajo `#rh-comedor-page`). */
export const COMEDOR_TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-3 text-left text-[13px] font-semibold tracking-tight text-[#334155] sm:px-4";

/** Input de búsqueda en barra de filtros (mismo tacto que Solicitudes). */
export const COMEDOR_FILTER_INPUT =
  "rh-comedor-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2";

/** Variante visual de tarjeta KPI según `ComedorKpi.id` (sin tocar contratos). */
export function comedorKpiVariantClass(kpiId: string): string {
  const map: Record<string, string> = {
    reservas_hoy: "rh-comedor-kpi--semana-actual",
    registros_proxima_semana: "rh-comedor-kpi--proxima-semana",
    ocupacion_actual: "rh-comedor-kpi--activos",
    porcentaje_asistencia: "rh-comedor-kpi--asistencia",
    semana_actual_total: "rh-comedor-kpi--semana-actual",
    semana_proxima_total: "rh-comedor-kpi--proxima-semana",
    porcentaje_caseras: "rh-comedor-kpi--activos",
    porcentaje_saludables: "rh-comedor-kpi--asistencia",
  };
  return map[kpiId] ?? "rh-comedor-kpi--default";
}

// Re-exportamos con los nombres legacy para no romper importadores existentes.
export { escapeHtml as escapeComedorHtml } from "../../ui/uiUtils.ts";
export { paginationRange } from "../../ui/uiUtils.ts";

export function formatComedorMonthTitle(year: number, monthIndex: number): string {
  const raw = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function addComedorMonths(year: number, monthIndex: number, delta: number): [number, number] {
  const dt = new Date(year, monthIndex + delta, 1);
  return [dt.getFullYear(), dt.getMonth()];
}

export function isoLocalDate(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dietBadgeLabel(type: "normal" | "dieta"): string {
  return type === "dieta" ? "Dieta" : "Normal";
}

/** Badge de estado de reserva — patrón unificado: píldora + dot. */
export function reservationStatusBadge(status: "confirmado" | "cancelado" | "pendiente"): string {
  if (status === "confirmado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml("Confirmado")}</span>`;
  }
  if (status === "cancelado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${escapeHtml("Cancelado")}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${escapeHtml("Pendiente")}</span>`;
}

export function reservationDietBadge(type: "normal" | "dieta"): string {
  if (type === "dieta") {
    return '<span class="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Dieta</span>';
  }
  return '<span class="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Normal</span>';
}

export function renderEmpleadoAvatarCell(
  empleadoNombre: string,
  empleadoNumero: string,
  avatarUrl: string | null,
): string {
  const display = formatNombreEmpleadoUi(empleadoNombre) || empleadoNombre || "Sin nombre";
  const initials = inicialesDesdeNombreDisplay(display);
  const avatar =
    avatarUrl && avatarUrl.trim()
      ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
      : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(initials)}</span>`;

  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(display)}</p>
        <p class="truncate text-xs text-slate-500">${escapeHtml(empleadoNumero)}</p>
      </div>
    </div>`;
}
