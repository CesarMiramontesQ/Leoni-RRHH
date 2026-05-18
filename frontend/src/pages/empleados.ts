import {
  getEmpleadosCatalogoFiltros,
  getEmpleadosPage,
  getEmpleadosResumen,
  type EmpleadosListParams,
} from "../api/empleados.ts";
import {
  isUsuariosFetchError,
  type AreaResponse,
  type CatalogoFiltros,
  type EstadoEmpleadoResponse,
  type PuestoResponse,
  type UsuarioListItem,
  type UsuarioPage,
  type UsuarioResumen,
} from "../api/usuarios.ts";
import {
  canAccessEmpleadosKpiGestionEquipo,
  canAccessEmpleadosPage,
  canAccessUsuariosAdmin,
  getRolFromAccessToken,
} from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { antiguedadAniosMeses, formatFechaIngreso } from "../utils/vista360Domain.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  SELECT_CHEVRON,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";

/** Filtros e inputs alineados a Solicitudes (misma altura, radio y sombra). */
const EMP_RH_FILTER_CONTROL = `rh-emp-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]`;

const EMP_RH_FILTER_SELECT = `${RH_LISTADO_SELECT} min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]`;

const EMP_RH_TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-3 text-left text-[13px] font-bold tracking-tight text-[#334155] sm:px-4";

/** Botón/icono «ver» en columna Acción (mismo estilo que Solicitudes). */
const EMP_RH_VER_BTN =
  "rh-sol-act-btn inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(148,163,184,0.35)] bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.45)] hover:text-[#002147] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

function svgIconVerEmpleado(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
}

const empleadosPageShellClass =
  "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

const empleadosMainClass = "pt-0 pb-5 sm:pb-6";

function iconSearchInput(): string {
  return `<span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-[1.125rem]"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
  </span>`;
}

function renderEmpleadosHeroRh(): string {
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6" aria-labelledby="rh-empleados-hero-title">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <div class="rh-sol-hero__copy min-w-0 flex-1 md:max-w-[min(100%,42rem)]">
          <h1 id="rh-empleados-hero-title" class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Empleados</h1>
          <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Gestión y consulta de información del personal.</p>
        </div>
      </div>
    </section>`;
}

function renderKpisSkeletonRh(): string {
  const skel = `<div class="animate-pulse rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
    <div class="flex items-start justify-between gap-2">
      <div class="h-3.5 w-28 rounded-md bg-slate-200/90"></div>
      <div class="h-11 w-11 rounded-xl bg-slate-200/80"></div>
    </div>
    <div class="mt-4 h-10 w-24 rounded-md bg-slate-100/90"></div>
    <div class="mt-3 h-3 w-full max-w-[14rem] rounded-md bg-slate-100/80"></div>
  </div>`;
  return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${skel}${skel}${skel}${skel}</div>`;
}

function renderTableLoadingRh(): string {
  const skRow = `<tr class="rh-sol-loading-row">${"<td class=\"px-3 py-3 sm:px-4\"><div class=\"h-4 animate-pulse rounded-md bg-slate-200/80\"></div></td>".repeat(7)}</tr>`;
  return `
    <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="Listado de empleados">
      <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
        <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Cargando tabla…
      </div>
      <div class="overflow-x-auto px-2 pb-3 sm:px-3">
        <table class="min-w-[760px] w-full text-left">
          <thead class="rh-sol-thead"><tr>
            ${["Empleado", "Número", "Área", "Puesto", "Líder", "Estatus", "Acción"]
              .map((lab) => `<th scope="col" class="${EMP_RH_TABLE_TH}">${lab}</th>`)
              .join("")}
          </tr></thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80">${skRow.repeat(5)}</tbody>
        </table>
      </div>
    </section>`;
}

function dotEstado(cls: string): string {
  return `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
}

function nombreEmpleadoTablaMostrar(raw: string): string {
  return formatNombreEmpleadoUi(raw) || "Sin nombre";
}

function inicialesEmpleadoTabla(raw: string): string {
  const display = formatNombreEmpleadoUi(raw) || raw.trim();
  return inicialesDesdeNombreDisplay(display, { singleTokenUnaLetra: true });
}

type State = {
  page: number;
  page_size: number;
  q: string;
  area_id: string;
  puesto_id: string;
  /** RH: "" = todos, "true" = activos, "false" = no activos */
  activo_rh: "" | "true" | "false";
  /** Supervisor/gerente: vacío = activos API; inactivo | permiso. */
  estatus_lider: "" | "inactivo" | "permiso";
  /** KPI: tabla solo colaboradores con contrato por vencer (30 días). */
  kpi_filtrar_contratos: boolean;
};

function parseOptionalInt(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseOptionalIntList(s: string): number[] | undefined {
  const raw = s.trim();
  if (!raw) return undefined;
  const values = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  if (values.length === 0) return undefined;
  return [...new Set(values)];
}

function parseActivoRh(s: State["activo_rh"]): boolean | undefined {
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

function filtrosActivos(state: State, rh: boolean, liderUi: boolean): boolean {
  if (state.q.trim()) return true;
  if (state.area_id) return true;
  if (state.puesto_id) return true;
  if (rh && state.activo_rh) return true;
  if (liderUi) {
    if (state.estatus_lider) return true;
    if (state.kpi_filtrar_contratos) return true;
  }
  return false;
}

type PanelMode = "rh" | "lider" | "director";

function panelMode(isRh: boolean, kpiGestionEquipo: boolean): PanelMode {
  if (isRh) return "rh";
  if (kpiGestionEquipo) return "lider";
  return "director";
}

function buildEmpleadosListParams(state: State, isRh: boolean, kpiGestionEquipo: boolean): EmpleadosListParams {
  const base: EmpleadosListParams = {
    page: state.page,
    page_size: state.page_size,
    q: state.q,
    area_id: parseOptionalInt(state.area_id),
    puesto_id: parseOptionalIntList(state.puesto_id),
    ...(isRh ? { activo: parseActivoRh(state.activo_rh) } : {}),
  };
  if (!kpiGestionEquipo || isRh) return base;
  if (state.kpi_filtrar_contratos) base.solo_contratos_por_vencer = true;
  if (state.estatus_lider) base.estatus = state.estatus_lider;
  return base;
}

function empleadoAvatarCellHtml(
  foto: string | null | undefined,
  iniciales: string,
  nombreTitle: string,
): string {
  const url = foto?.trim();
  const fallbackSpan = `<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white" title="${escapeHtml(nombreTitle)}">${escapeHtml(iniciales)}</span>`;
  if (!url) return fallbackSpan;
  return `<span class="relative inline-flex shrink-0">
    <img src="${escapeHtml(url)}" alt="" width="40" height="40" decoding="async" loading="lazy" data-emp-tabla-avatar class="size-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
    <span hidden class="emp-tabla-avatar-fallback--swap flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white" title="${escapeHtml(nombreTitle)}">${escapeHtml(iniciales)}</span>
  </span>`;
}

function antiguedadCeldaHtml(registro: string | null): string {
  const ing = formatFechaIngreso(registro);
  const ant = antiguedadAniosMeses(registro);
  const sub =
    ant === null
      ? "—"
      : `${ant.years} año${ant.years === 1 ? "" : "s"} · ${ant.months} mes${ant.months === 1 ? "" : "es"}`;
  return `<div class="min-w-0 text-sm">
    <p class="font-medium tabular-nums text-slate-800">${escapeHtml(ing)}</p>
    <p class="text-xs text-slate-500">${escapeHtml(sub)}</p>
  </div>`;
}

/** Texto de celda cuando no hay dato (evita "—"). */
function textoAsignacion(val: string | null | undefined): string {
  const t = val?.trim();
  return t ? t : "Sin asignar";
}

/** Nombre de persona (líder) con formato natural para UI. */
function textoLiderMostrar(val: string | null | undefined): string {
  const f = formatNombreEmpleadoUi(val);
  return f || "Sin asignar";
}

type KpiMetricSemantic = "total" | "activo" | "inactivo" | "sinLider" | "contrato";

/** Contenedor homogéneo: tinte suave, icono 600, borde y anillo inset para definición. */
function kpiMetricIconBox(semantic: KpiMetricSemantic, svgHtml: string): string {
  const cls: Record<KpiMetricSemantic, string> = {
    total:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-total-bg text-kpi-metric-total-icon border-kpi-metric-total-icon/25 ring-kpi-metric-total-icon/10",
    activo:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-activo-bg text-kpi-metric-activo-icon border-kpi-metric-activo-icon/25 ring-kpi-metric-activo-icon/10",
    inactivo:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-inactivo-bg text-kpi-metric-inactivo-icon border-kpi-metric-inactivo-icon/25 ring-kpi-metric-inactivo-icon/10",
    sinLider:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-amber-50 text-amber-700 border-amber-300/60 ring-amber-200/60",
    contrato:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-orange-50 text-orange-700 border-orange-300/60 ring-orange-200/60",
  };
  return `<span class="${cls[semantic]}" aria-hidden="true">${svgHtml}</span>`;
}

/** Icono KPI: grupo / plantilla (Heroicons user-group). */
function svgKpiTotalPlantilla(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>`;
}

/** Icono KPI: no activos (Heroicons x-circle). */
function svgKpiNoActivo(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>`;
}

function svgKpiSinLider(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5a7.5 7.5 0 0 1 15 0" />
    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5v6m3-3h-6" />
  </svg>`;
}

function svgKpiContratoCalendario(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" />
  </svg>`;
}

const KPI_NUM_CLS =
  "mt-3 text-4xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-[2.125rem]";
const KPI_SUB_CLS = "mt-2 text-sm font-medium leading-snug text-slate-500";
const KPI_MICRO_CLS = "mt-1 text-xs text-slate-400";

/** Misma cáscara visual que las tarjetas KPI de empleados RH (reutilizada en vista supervisor). */
const RH_EMPLEADOS_KPI_CARD_SHELL =
  "flex min-h-[10.5rem] flex-col rounded-[14px] border p-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.1)]";

type LiderKpiResaltado = { resaltarEquipo: boolean; resaltarContratos: boolean };

function liderKpiUiDesdeState(s: State): LiderKpiResaltado {
  return {
    resaltarEquipo: !s.kpi_filtrar_contratos && !s.estatus_lider,
    resaltarContratos: s.kpi_filtrar_contratos,
  };
}

function kpiLiderCardRing(on: boolean): string {
  return on
    ? "ring-2 ring-leoni-blue ring-offset-2 ring-offset-slate-50 border-leoni-blue/35"
    : "border-border hover:border-slate-300/90";
}

function renderKpis(
  r: UsuarioResumen,
  isRh: boolean,
  kpiGestionEquipo: boolean,
  liderKpi: LiderKpiResaltado | null,
): string {
  if (!isRh && kpiGestionEquipo && liderKpi) {
    const kpiLiderCardCls =
      getRolFromAccessToken() === "supervisor"
        ? `${RH_EMPLEADOS_KPI_CARD_SHELL} border-[rgba(148,163,184,0.32)] bg-linear-to-br from-white to-[#f8fbff]`
        : "min-h-[9.5rem] rounded-xl border bg-white p-5 shadow-sm";
    const kpiLiderGridCls =
      getRolFromAccessToken() === "supervisor"
        ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:gap-3"
        : "grid grid-cols-1 gap-4 md:grid-cols-2";
    const ringEq = kpiLiderCardRing(liderKpi.resaltarEquipo);
    const ringCt = kpiLiderCardRing(liderKpi.resaltarContratos);
    const todoAlDia =
      r.contratos_por_vencer === 0
        ? `<p class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
            Todo al día
          </p>`
        : "";
    return `
    <div class="${kpiLiderGridCls}">
      <button type="button" data-emp-kpi="equipo" class="group flex w-full flex-col text-left transition ${kpiLiderCardCls} ${ringEq}">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Número de colaboradores</p>
          ${kpiMetricIconBox(
            "activo",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>`,
          )}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.colaboradores_total))}</p>
        <p class="${KPI_SUB_CLS}">Activo(s) en tu alcance · quita el filtro de contratos</p>
        <p class="${KPI_MICRO_CLS}">Clic para restablecer vista de equipo</p>
      </button>
      <button type="button" data-emp-kpi="contratos" class="group flex w-full flex-col text-left transition ${kpiLiderCardCls} ${ringCt}">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Contratos por vencer</p>
          ${kpiMetricIconBox("contrato", svgKpiContratoCalendario())}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.contratos_por_vencer))}</p>
        <p class="${KPI_SUB_CLS}">Fin de contrato en 30 días · filtra la tabla</p>
        <p class="${KPI_MICRO_CLS}">Clic otra vez para quitar</p>
        ${todoAlDia}
      </button>
    </div>`;
  }

  if (!isRh) {
    return `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Empleados activos</p>
          ${kpiMetricIconBox(
            "activo",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>`,
          )}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.activos))}</p>
        <p class="${KPI_SUB_CLS}">Directorio de consulta (solo activos)</p>
        <p class="${KPI_MICRO_CLS}">Comparación vs mes anterior: no disponible</p>
      </article>
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">No activos</p>
          ${kpiMetricIconBox("inactivo", svgKpiNoActivo())}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.inactivos))}</p>
        <p class="${KPI_SUB_CLS}">Fuera de estados activos o sin estado</p>
        <p class="${KPI_MICRO_CLS}">Comparación vs mes anterior: no disponible</p>
      </article>
    </div>`;
  }

  const nContratosPv = r.contratos_por_vencer;
  const contratosRhResaltar = nContratosPv > 0;
  const kpiNumContratosRhCls = contratosRhResaltar
    ? `${KPI_NUM_CLS} text-orange-700`
    : KPI_NUM_CLS;
  const bordeContratosRh = contratosRhResaltar
    ? " border-orange-300/60 ring-1 ring-orange-200/50"
    : "";
  const estadoContratosRh = contratosRhResaltar
    ? `<p class="mt-2 text-sm font-semibold text-orange-800">Requieren seguimiento preventivo</p>`
    : `<p class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
        Sin vencimientos en la ventana
      </p>`;

  const sinLiderResaltar = r.sin_lider_asignado > 50;
  const titleKpi = "text-[13px] font-bold leading-tight text-[#475569]";
  const numPlantilla = `${KPI_NUM_CLS} text-[#0c2340]`;
  const numActivos = `${KPI_NUM_CLS} text-emerald-900`;
  const numSinLider = `${KPI_NUM_CLS} ${sinLiderResaltar ? "text-amber-900" : "text-[#0c2340]"}`;

  return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article class="${RH_EMPLEADOS_KPI_CARD_SHELL} border-[rgba(37,99,235,0.2)] bg-linear-to-br from-white to-[#eff6ff]">
        <div class="flex items-start justify-between gap-3">
          <h2 class="${titleKpi}">Total de plantilla</h2>
          ${kpiMetricIconBox("total", svgKpiTotalPlantilla())}
        </div>
        <p class="${numPlantilla}">${escapeHtml(String(r.total_plantilla))}</p>
        <p class="${KPI_SUB_CLS}">Registro actual de personas en nómina</p>
        <p class="${KPI_MICRO_CLS} mt-auto pt-2">Variación vs mes anterior: pendiente de datos</p>
      </article>
      <article class="${RH_EMPLEADOS_KPI_CARD_SHELL} border-emerald-200/60 bg-linear-to-br from-white to-emerald-50/90">
        <div class="flex items-start justify-between gap-3">
          <h2 class="${titleKpi}">Activos</h2>
          ${kpiMetricIconBox(
            "activo",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>`,
          )}
        </div>
        <p class="${numActivos}">${escapeHtml(String(r.activos))}</p>
        <p class="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 text-emerald-600" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
          ${escapeHtml(String(r.porcentaje_operatividad))}% operatividad
        </p>
        <p class="${KPI_MICRO_CLS} mt-auto pt-2">Comparación vs mes anterior: no disponible</p>
      </article>
      <article class="${RH_EMPLEADOS_KPI_CARD_SHELL} bg-linear-to-br from-white to-amber-50/80${bordeContratosRh}">
        <div class="flex items-start justify-between gap-3">
          <h2 class="${titleKpi}">Contratos por vencer</h2>
          ${kpiMetricIconBox("contrato", svgKpiContratoCalendario())}
        </div>
        <p class="${kpiNumContratosRhCls}">${escapeHtml(String(nContratosPv))}</p>
        <p class="${KPI_SUB_CLS}">Activos con fin de contrato en los próximos 30 días</p>
        ${estadoContratosRh}
        <p class="${KPI_MICRO_CLS} mt-auto pt-2">Comparación vs mes anterior: no disponible</p>
      </article>
      <article class="${RH_EMPLEADOS_KPI_CARD_SHELL} border-amber-200/55 bg-linear-to-br from-white to-amber-50/95${sinLiderResaltar ? " ring-2 ring-amber-300/45 ring-offset-2 ring-offset-white" : ""}">
        <div class="flex items-start justify-between gap-3">
          <h2 class="${titleKpi}">Sin Líder Asignado</h2>
          ${kpiMetricIconBox("sinLider", svgKpiSinLider())}
        </div>
        <p class="${numSinLider}">${escapeHtml(String(r.sin_lider_asignado))}</p>
        <p class="${KPI_SUB_CLS}">Empleados sin responsable jerárquico</p>
        <p class="${KPI_MICRO_CLS} mt-auto pt-2">Requieren asignación de líder</p>
      </article>
    </div>`;
}

function areaOptions(areas: AreaResponse[], selected: string, emptyLabel: string): string {
  const head = `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>`;
  const rest = areas
    .map((a) => {
      const v = String(a.area_id);
      return `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(a.descripcion)}</option>`;
    })
    .join("");
  return head + rest;
}

function puestoOptions(puestos: PuestoResponse[], selected: string, emptyLabel: string): string {
  const head = `<option value="" ${selected === "" ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>`;
  const groups = new Map<string, { descripcion: string; ids: number[] }>();
  for (const puesto of puestos) {
    const key = normalizaClavePuesto(puesto.descripcion);
    if (!key) continue;
    const prev = groups.get(key);
    if (!prev) {
      groups.set(key, { descripcion: puesto.descripcion.trim(), ids: [puesto.puesto_id] });
      continue;
    }
    if (!prev.ids.includes(puesto.puesto_id)) prev.ids.push(puesto.puesto_id);
  }
  const entries = [...groups.values()].sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));
  const rest = entries
    .map((p) => {
      const v = p.ids.sort((a, b) => a - b).join(",");
      return `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(p.descripcion)}</option>`;
    })
    .join("");
  return head + rest;
}

function normalizaClavePuesto(descripcion: string): string {
  return descripcion
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function esEstadoVisualActivo(estado: EstadoEmpleadoResponse | null): boolean {
  if (!estado?.descripcion) return false;
  const d = estado.descripcion.trim().toLowerCase();
  if (d.includes("inactiv")) return false;
  return d.includes("activ");
}

function estadoPill(estado: EstadoEmpleadoResponse | null): string {
  const raw = estado?.descripcion?.trim();
  if (!raw) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
      <span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>Sin estado</span>`;
  }
  const label = raw;
  const on = esEstadoVisualActivo(estado);
  if (on) {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
      <svg viewBox="0 0 20 20" fill="currentColor" class="size-3.5 shrink-0 text-emerald-600" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
      ${escapeHtml(label)}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
      <svg viewBox="0 0 20 20" fill="currentColor" class="size-3.5 shrink-0 text-red-500" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>
      ${escapeHtml(label)}</span>`;
}

/** Badges de estatus para tabla RH (mismo lenguaje que Solicitudes). */
function estadoBadgeRh(estado: EstadoEmpleadoResponse | null): string {
  const raw = estado?.descripcion?.trim();
  const base =
    "rh-sol-badge-estado inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  if (!raw) {
    return `<span class="${base} rh-sol-badge-estado--cancelled">${dotEstado("bg-slate-400")}Sin estado</span>`;
  }
  const lower = raw.toLowerCase();
  const label = raw;
  if (lower.includes("pendiente")) {
    return `<span class="${base} rh-sol-badge-estado--pending">${dotEstado("bg-amber-400")}${escapeHtml(label)}</span>`;
  }
  if (lower.includes("inactiv") || lower.includes("baja")) {
    return `<span class="${base} rh-sol-badge-estado--rejected">${dotEstado("bg-red-400")}${escapeHtml(label)}</span>`;
  }
  if (esEstadoVisualActivo(estado)) {
    return `<span class="${base} rh-sol-badge-estado--approved"><svg viewBox="0 0 20 20" fill="currentColor" class="size-3 shrink-0 text-emerald-600" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>${escapeHtml(label)}</span>`;
  }
  return `<span class="${base} rh-sol-badge-estado--rejected">${dotEstado("bg-red-400")}${escapeHtml(label)}</span>`;
}

function rowAccionesLiderHtml(
  u: UsuarioListItem,
  name: string,
  tdClass = "relative w-px px-2 py-3 align-middle",
): string {
  const empDir = String(u.empleado_id);
  return `<td class="${tdClass}" data-emp-row-nolink>
    <details class="group/act relative">
      <summary
        class="inline-flex list-none cursor-pointer items-center justify-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue [&::-webkit-details-marker]:hidden"
        aria-label="Acciones para ${escapeHtml(name)}"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" class="size-5" aria-hidden="true"><path d="M12 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm0 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg>
      </summary>
      <div class="absolute right-0 z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-slate-900/5">
        <a href="#/empleados/${u.id}" class="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Ver perfil</a>
        <a href="#/empleados/${u.id}?tab=historial" class="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Editar</a>
        <a href="#/solicitudes?empleado_dir=${escapeHtml(empDir)}" class="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Historial de solicitudes</a>
      </div>
    </details>
  </td>`;
}

function rowHtml(u: UsuarioListItem, mode: PanelMode): string {
  const name = nombreEmpleadoTablaMostrar(u.nombre);
  const ini = inicialesEmpleadoTabla(u.nombre);
  const sup = textoLiderMostrar(u.lider_nombre);
  const area = textoAsignacion(u.area?.descripcion);
  const puestoRaw = u.puesto?.descripcion?.trim() || "";
  const puesto = puestoRaw || "Sin asignar";
  const email = u.email?.trim() ? u.email : "Sin correo";
  const puestoTitle = escapeHtml(puestoRaw || "Sin asignar");
  const isRh = mode === "rh";
  const isLider = mode === "lider";
  const jefeRol = getRolFromAccessToken();
  const ocultarLider = isLider && jefeRol === "supervisor";
  const useRhTableChrome = isRh || (isLider && jefeRol === "supervisor");

  const fotoUrl = u.foto?.trim();
  const avatarRhFallback = `<span class="rh-sol-avatar-fallback flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" title="${escapeHtml(name)}">${escapeHtml(ini)}</span>`;
  const avatarRh = fotoUrl
    ? `<span class="relative inline-flex shrink-0">
        <img src="${escapeHtml(fotoUrl)}" alt="" width="40" height="40" decoding="async" loading="lazy" data-rh-sol-avatar class="rh-sol-avatar-img size-10 rounded-full object-cover ring-1 ring-[rgba(148,163,184,0.35)]" />
        <span hidden class="rh-sol-avatar-fallback rh-sol-avatar-fallback--swap flex size-10 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" title="${escapeHtml(name)}">${escapeHtml(ini)}</span>
      </span>`
    : avatarRhFallback;

  const avatar = isLider
    ? empleadoAvatarCellHtml(u.foto ?? null, ini, name)
    : isRh
      ? avatarRh
      : `<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>`;
  const nombreCls = useRhTableChrome
    ? "text-sm font-semibold leading-snug text-[#0f172a] group-hover:text-leoni-blue"
    : isLider
      ? "text-sm font-bold text-slate-900 group-hover:text-leoni-blue"
      : "text-sm font-semibold leading-snug text-[#0f172a] group-hover:text-leoni-blue";
  const emailCls = useRhTableChrome
    ? "mt-0.5 text-[13px] leading-snug text-[#64748b]"
    : isLider
      ? "mt-0.5 text-xs leading-tight text-slate-500"
      : "text-xs text-slate-400";
  const userStack = useRhTableChrome
    ? `<div class="min-w-0">
          <p class="${nombreCls}">${escapeHtml(name)}</p>
          <p class="${emailCls}">${escapeHtml(email)}</p>
        </div>`
    : isLider
      ? `<div class="min-w-0 flex-1">
          <p class="${nombreCls}">${escapeHtml(name)}</p>
          <p class="${emailCls}">${escapeHtml(email)}</p>
        </div>`
      : `<div class="min-w-0">
          <p class="${nombreCls}">${escapeHtml(name)}</p>
          <p class="${emailCls}">${escapeHtml(email)}</p>
        </div>`;

  const colLider = ocultarLider
    ? ""
    : isRh
      ? `<td class="max-w-[10rem] px-3 py-3 align-middle text-[13px] text-[#475569] sm:px-4">
        <span class="block truncate" title="${escapeHtml(sup)}">${escapeHtml(sup)}</span>
      </td>`
      : `<td class="max-w-[10rem] px-4 py-4 align-middle text-sm text-slate-600">
        <span class="block truncate" title="${escapeHtml(sup)}">${escapeHtml(sup)}</span>
      </td>`;
  const colAntiguedad = isLider
    ? `<td class="whitespace-nowrap ${useRhTableChrome ? "px-3 py-3 align-middle sm:px-4" : "px-4 py-4 align-middle"}">${antiguedadCeldaHtml(u.registro)}</td>`
    : "";
  const colAccionesLider = isLider
    ? rowAccionesLiderHtml(
        u,
        name,
        useRhTableChrome ? "relative w-px px-3 py-3 align-middle sm:px-4" : "relative w-px px-2 py-3 align-middle",
      )
    : "";

  const trCls = useRhTableChrome
    ? "group rh-sol-data-row rh-sol-data-row--interactive cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue"
    : "group cursor-pointer transition-colors hover:bg-slate-50/90 focus-within:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue";

  const tdPad = useRhTableChrome ? "px-3 py-3 align-middle sm:px-4" : "px-4 py-4 align-middle";
  const celdaEmpleadoInner = useRhTableChrome
    ? `<div class="rh-sol-empleado-celda flex min-w-0 items-center gap-3">
          ${avatar}
          ${userStack}
        </div>`
    : `<div class="flex min-w-0 items-center gap-3">
          ${avatar}
          ${userStack}
        </div>`;

  const numCell = useRhTableChrome
    ? `<span class="inline-flex rounded-lg border border-[rgba(148,163,184,0.32)] bg-[linear-gradient(135deg,#f8fafc_0%,#f1f5f9_100%)] px-2.5 py-1 text-sm font-semibold tabular-nums text-[#475569]">#${escapeHtml(formatNoEmpleadoDisplay(u.no_empleado))}</span>`
    : `#${escapeHtml(formatNoEmpleadoDisplay(u.no_empleado))}`;

  const estadoUi = useRhTableChrome ? estadoBadgeRh(u.estado) : estadoPill(u.estado);

  return `
    <tr
      data-empleado-row-id="${u.id}"
      tabindex="0"
      aria-label="Ver vista 360 de ${escapeHtml(name)}"
      class="${trCls}"
    >
      <td class="${tdPad}">
        ${celdaEmpleadoInner}
      </td>
      <td class="whitespace-nowrap ${tdPad} text-right text-sm tabular-nums ${useRhTableChrome ? "" : "text-slate-500"}">${numCell}</td>
      <td class="max-w-[10rem] ${tdPad} ${useRhTableChrome ? "text-[13px] text-[#334155]" : "text-sm text-slate-700"}">
        <span class="block truncate" title="${escapeHtml(area)}">${escapeHtml(area)}</span>
      </td>
      <td class="max-w-[14rem] ${tdPad} ${useRhTableChrome ? "text-[13px] text-[#334155]" : "text-sm text-slate-700"}">
        <span class="block truncate" title="${puestoTitle}">${escapeHtml(puesto)}</span>
      </td>
      ${colLider}
      ${colAntiguedad}
      <td class="${tdPad}">${estadoUi}</td>
      ${isRh ? `<td class="cursor-default ${tdPad} text-right" data-empleado-row-actions>
        <a
          href="#/empleados/${u.id}"
          class="${EMP_RH_VER_BTN}"
          title="Ver empleado"
          aria-label="Ver empleado"
        >${svgIconVerEmpleado()}</a>
      </td>` : ""}
      ${colAccionesLider}
    </tr>`;
}

function empleadosSelectFilter(id: string, name: string, labelText: string, optionsHtml: string): string {
  return `<div>
  <label for="${id}" class="block text-sm/6 font-medium text-gray-900">${escapeHtml(labelText)}</label>
  <div class="mt-2 grid grid-cols-1">
    <select id="${id}" name="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 sm:text-sm/6 ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadosSearchInput(value: string): string {
  return `<label for="emp-search" class="block text-sm/6 font-medium text-gray-900">Búsqueda</label>
          <div class="mt-2">
            <div class="relative">
              <input
                id="emp-search"
                type="text"
                name="emp-search"
                autocomplete="off"
                placeholder="Buscar por nombre, ID o número de empleado..."
                value="${escapeHtml(value)}"
                class="block w-full rounded-md bg-white px-3 py-1.5 pr-10 text-base text-gray-900 placeholder:text-gray-400 sm:text-sm/6 ${FIELD_FOCUS}"
              />
              <span
                data-emp-search-loading
                class="pointer-events-none absolute inset-y-0 right-3 hidden items-center text-text-muted"
                aria-hidden="true"
              >
                <svg class="size-4 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
              </span>
            </div>
          </div>`;
}

function empleadosSearchFieldLiderCompact(value: string): string {
  return `<div class="min-w-0 min-w-[11rem] flex-[2]">
    <label for="emp-search" class="block text-xs font-semibold text-slate-700">Búsqueda</label>
    <div class="mt-1 relative">
      <input
        id="emp-search"
        type="text"
        name="emp-search"
        autocomplete="off"
        placeholder="Nombre, ID o número…"
        value="${escapeHtml(value)}"
        class="block h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 pr-9 text-sm text-slate-900 placeholder:text-slate-400 ${FIELD_FOCUS}"
      />
      <span
        data-emp-search-loading
        class="pointer-events-none absolute inset-y-0 right-2 hidden items-center text-text-muted"
        aria-hidden="true"
      >
        <svg class="size-4 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
      </span>
    </div>
  </div>`;
}

function empleadosSelectFilterCompact(id: string, name: string, labelText: string, optionsHtml: string): string {
  return `<div class="min-w-0 min-w-[9rem] flex-1">
  <label for="${id}" class="block text-xs font-semibold text-slate-700">${escapeHtml(labelText)}</label>
  <div class="mt-1 grid grid-cols-1">
    <select id="${id}" name="${name}" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2 text-sm text-slate-900 ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadosSelectFilterRh(id: string, name: string, labelText: string, optionsHtml: string): string {
  return `<div class="min-w-0">
  <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(labelText)}</label>
  <div class="mt-1 grid grid-cols-1">
    <select id="${id}" name="${name}" class="col-start-1 row-start-1 ${EMP_RH_FILTER_SELECT} ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

/** Vista listado RH: filtros y tabla alineados a Solicitudes. */
function renderPanelRh(state: State, catalogo: CatalogoFiltros, pg: UsuarioPage, liderUiForFilters: boolean): string {
  const colCount = 7;
  const totalPages = Math.max(1, Math.ceil(pg.total / pg.page_size) || 1);
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.page_size + 1;
  const to = Math.min(pg.page * pg.page_size, pg.total);
  const pages = paginationRange(totalPages, pg.page);

  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="${colCount}" class="p-0">
    <div class="rh-sol-empty px-4 py-12 sm:px-6" role="status">
      <p class="rh-sol-empty__title text-center text-sm font-semibold text-[#0f172a]">No se encontraron empleados</p>
      <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">Prueba ajustando los filtros de búsqueda.</p>
    </div>
  </td></tr>`
      : pg.items.map((u) => rowHtml(u, "rh")).join("");

  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-emp-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const areaOpts = areaOptions(catalogo.areas, state.area_id, "Todas las áreas");
  const puestoOpts = puestoOptions(catalogo.puestos, state.puesto_id, "Todos los puestos");
  const statusOpts = `<option value="" ${state.activo_rh === "" ? "selected" : ""}>Todos los estatus</option>
            <option value="true" ${state.activo_rh === "true" ? "selected" : ""}>Activos</option>
            <option value="false" ${state.activo_rh === "false" ? "selected" : ""}>No activos</option>`;

  const clearVisible = filtrosActivos(state, true, liderUiForFilters);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
        <button type="button" data-emp-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">Limpiar filtros</button>
      </div>`
    : "";

  const countHtml = `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeHtml(String(pg.total))}</span> empleados</p>`;

  const searchWrap = `
    <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
      <label for="emp-search" class="${RH_LISTADO_LABEL}">Búsqueda</label>
      <div class="relative mt-1">
        ${iconSearchInput()}
        <input
          id="emp-search"
          type="search"
          name="emp-search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Buscar por nombre, ID o número de empleado..."
          value="${escapeHtml(state.q)}"
          class="${EMP_RH_FILTER_CONTROL} ${FIELD_FOCUS}"
        />
        <span data-emp-search-loading class="pointer-events-none absolute inset-y-0 right-3 hidden items-center text-text-muted" aria-hidden="true">
          <svg class="size-4 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </span>
      </div>
    </div>`;

  const filtrosInner = `
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${searchWrap}
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-area", "emp-filter-area", "Área", areaOpts)}</div>
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}</div>
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-status", "emp-filter-status", "Estatus", statusOpts)}</div>
        ${clearBtn}
      </div>`;

  const pageSizeOpts = [10, 25, 50, 100]
    .map((n) => `<option value="${n}" ${n === state.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="flex flex-col gap-5">
      <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros del listado de empleados">
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Filtros de búsqueda</h2>
          ${countHtml}
        </div>
        ${filtrosInner}
      </section>
      <section data-emp-table-region class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE} transition-opacity duration-150" aria-label="Listado de empleados">
      <div class="max-h-[min(72vh,780px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[760px] w-full text-left">
          <thead class="rh-sol-thead">
            <tr>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Empleado</th>
              <th scope="col" class="${EMP_RH_TABLE_TH} text-right">Número</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Área</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Puesto</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Líder</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Estatus</th>
              <th scope="col" class="${EMP_RH_TABLE_TH} text-right">Acción</th>
            </tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span> empleados
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="emp-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="emp-page-size" name="emp-page-size" class="rh-sol-filter-select min-h-[38px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[rgba(100,116,139,0.45)] sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-emp-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-emp-page="${pg.page + 1}" ${pg.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>
      </section>
    </div>`;
}

/** Listado empleados vista supervisor: mismos patrones de superficie/filtros/tabla que RH (sin columna Líder). */
function renderPanelLiderSupervisorRh(state: State, catalogo: CatalogoFiltros, pg: UsuarioPage): string {
  const colCount = 7;
  const totalPages = Math.max(1, Math.ceil(pg.total / pg.page_size) || 1);
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.page_size + 1;
  const to = Math.min(pg.page * pg.page_size, pg.total);
  const pages = paginationRange(totalPages, pg.page);

  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="${colCount}" class="p-0">
    <div class="rh-sol-empty px-4 py-12 sm:px-6" role="status">
      <p class="rh-sol-empty__title text-center text-sm font-semibold text-[#0f172a]">No se encontraron empleados</p>
      <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">Prueba ajustando los filtros de búsqueda.</p>
    </div>
  </td></tr>`
      : pg.items.map((u) => rowHtml(u, "lider")).join("");

  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-emp-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const areaOpts = areaOptions(catalogo.areas, state.area_id, "Todas las áreas");
  const puestoOpts = puestoOptions(catalogo.puestos, state.puesto_id, "Todos los puestos");
  const liderEstatusOpts = `<option value="" ${state.estatus_lider === "" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${state.estatus_lider === "inactivo" ? "selected" : ""}>Inactivo</option>
            <option value="permiso" ${state.estatus_lider === "permiso" ? "selected" : ""}>Permiso</option>`;

  const clearVisible = filtrosActivos(state, false, true);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
        <button type="button" data-emp-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">Limpiar filtros</button>
      </div>`
    : "";

  const countHtml = `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeHtml(String(pg.total))}</span> empleados</p>`;

  const searchWrap = `
    <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
      <label for="emp-search" class="${RH_LISTADO_LABEL}">Búsqueda</label>
      <div class="relative mt-1">
        ${iconSearchInput()}
        <input
          id="emp-search"
          type="search"
          name="emp-search"
          autocomplete="off"
          enterkeyhint="search"
          placeholder="Nombre, ID o número…"
          value="${escapeHtml(state.q)}"
          class="${EMP_RH_FILTER_CONTROL} ${FIELD_FOCUS}"
        />
        <span data-emp-search-loading class="pointer-events-none absolute inset-y-0 right-3 hidden items-center text-text-muted" aria-hidden="true">
          <svg class="size-4 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
        </span>
      </div>
    </div>`;

  const filtrosInner = `
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${searchWrap}
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-area", "emp-filter-area", "Área", areaOpts)}</div>
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}</div>
        <div class="${FILTER_FIELD_WRAP}">${empleadosSelectFilterRh("emp-filter-lider-estatus", "emp-filter-lider-estatus", "Estatus", liderEstatusOpts)}</div>
        ${clearBtn}
      </div>`;

  const pageSizeOpts = [10, 25, 50, 100]
    .map((n) => `<option value="${n}" ${n === state.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="flex flex-col gap-5">
      <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros del listado de empleados">
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Filtros de búsqueda</h2>
          ${countHtml}
        </div>
        ${filtrosInner}
      </section>
      <section data-emp-table-region class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE} transition-opacity duration-150" aria-label="Listado de empleados">
      <div class="max-h-[min(72vh,780px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[880px] w-full text-left">
          <thead class="rh-sol-thead">
            <tr>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Empleado</th>
              <th scope="col" class="${EMP_RH_TABLE_TH} text-right">Número</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Área</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Puesto</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Ingreso / antigüedad</th>
              <th scope="col" class="${EMP_RH_TABLE_TH}">Estatus</th>
              <th scope="col" class="${EMP_RH_TABLE_TH} text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span> empleados
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="emp-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="emp-page-size" name="emp-page-size" class="rh-sol-filter-select min-h-[38px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[rgba(100,116,139,0.45)] sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-emp-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-emp-page="${pg.page + 1}" ${pg.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>
      </section>
    </div>`;
}

function renderPanel(
  state: State,
  catalogo: CatalogoFiltros,
  pg: UsuarioPage,
  mode: PanelMode,
  liderUiForFilters: boolean,
): string {
  if (mode === "rh") {
    return renderPanelRh(state, catalogo, pg, liderUiForFilters);
  }

  if (mode === "lider" && getRolFromAccessToken() === "supervisor") {
    return renderPanelLiderSupervisorRh(state, catalogo, pg);
  }

  const isLider = mode === "lider";
  const jefeRol = getRolFromAccessToken();
  const ocultarLiderCol = isLider && jefeRol === "supervisor";
  const colCount = isLider ? (ocultarLiderCol ? 7 : 8) : 6;

  const totalPages = Math.max(1, Math.ceil(pg.total / pg.page_size) || 1);
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.page_size + 1;
  const to = Math.min(pg.page * pg.page_size, pg.total);
  const pages = paginationRange(totalPages, pg.page);

  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="${colCount}" class="px-4 py-14 text-center text-sm text-slate-500">No hay empleados con los filtros actuales.</td></tr>`
      : pg.items.map((u) => rowHtml(u, mode)).join("");

  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-10 items-center px-2 text-sm text-slate-500">…</span>`;
      }
      const active = x === pg.page;
      const cls = active
        ? "min-h-10 min-w-10 rounded-lg bg-[#1e40af] px-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
        : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";
      return `<button type="button" data-emp-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const areaOpts = areaOptions(catalogo.areas, state.area_id, "Todas las áreas");
  const puestoOpts = puestoOptions(catalogo.puestos, state.puesto_id, "Todos los puestos");

  const liderEstatusOpts = `<option value="" ${state.estatus_lider === "" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${state.estatus_lider === "inactivo" ? "selected" : ""}>Inactivo</option>
            <option value="permiso" ${state.estatus_lider === "permiso" ? "selected" : ""}>Permiso</option>`;

  const clearBtn = filtrosActivos(state, false, liderUiForFilters)
    ? `<button type="button" data-emp-clear-filters class="${RH_LISTADO_BTN_GHOST} w-full sm:w-auto">Limpiar filtros</button>`
    : "";

  const filtrosToolbar = clearBtn
    ? `<div class="mb-4 flex justify-end sm:mb-3">${clearBtn}</div>`
    : "";

  const filtrosGrid = isLider
    ? `<div class="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end xl:gap-x-3 xl:gap-y-2">
        ${empleadosSearchFieldLiderCompact(state.q)}
        ${empleadosSelectFilterCompact("emp-filter-area", "emp-filter-area", "Área", areaOpts)}
        ${empleadosSelectFilterCompact("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}
        ${empleadosSelectFilterCompact("emp-filter-lider-estatus", "emp-filter-lider-estatus", "Estatus", liderEstatusOpts)}
      </div>`
    : `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
        <div class="min-w-0 md:col-span-2 xl:col-span-6">${empleadosSearchInput(state.q)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-3">${empleadosSelectFilter("emp-filter-area", "emp-filter-area", "Área", areaOpts)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-3">${empleadosSelectFilter("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}</div>
      </div>`;

  const theadLider = `
            <tr class="text-slate-900">
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Empleado</th>
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-right text-sm font-bold">Número</th>
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Área</th>
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Puesto</th>
              ${ocultarLiderCol ? "" : `<th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Líder</th>`}
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Ingreso / antigüedad</th>
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-left text-sm font-bold">Estatus</th>
              <th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-4 py-3 text-right text-sm font-bold">Acciones</th>
            </tr>`;

  const thClassic = (align: "text-left" | "text-right") =>
    `sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 py-3 ${align} text-[13px] font-semibold text-slate-700`;
  const theadClassic = `
            <tr>
              <th scope="col" class="${thClassic("text-left")}">Empleado</th>
              <th scope="col" class="${thClassic("text-right")}">Número</th>
              <th scope="col" class="${thClassic("text-left")}">Área</th>
              <th scope="col" class="${thClassic("text-left")}">Puesto</th>
              <th scope="col" class="${thClassic("text-left")}">Líder</th>
              <th scope="col" class="${thClassic("text-left")}">Estatus</th>
            </tr>`;

  const theadInner = isLider ? theadLider : theadClassic;
  const tableMinW = isLider ? "min-w-[880px]" : "min-w-[720px]";

  const pageSizeOpts = [10, 25, 50, 100]
    .map((n) => `<option value="${n}" ${n === state.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="flex flex-col gap-8">
      <section class="${RH_LISTADO_SURFACE} p-4 sm:p-6" aria-label="Filtros del listado de empleados">
        ${filtrosToolbar}
        ${filtrosGrid}
      </section>
      <section data-emp-table-region class="overflow-hidden ${RH_LISTADO_SURFACE} transition-opacity duration-150" aria-label="Listado de empleados">
      <div class="max-h-[min(72vh,780px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="${tableMinW} w-full text-left">
          <thead class="${isLider ? "bg-slate-50" : "bg-slate-50"}">
            ${theadInner}
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      <div class="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p class="text-sm font-medium text-slate-600">Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span> empleados</p>
          <div class="flex flex-wrap items-center gap-2">
            <label for="emp-page-size" class="text-sm font-medium text-slate-600">Registros por página</label>
            <select id="emp-page-size" name="emp-page-size" class="rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
          <button type="button" data-emp-page="${pg.page - 1}" ${pg.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-emp-page="${pg.page + 1}" ${pg.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>
      </section>
    </div>`;
}

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "Se requiere rol RH, gerente, director o supervisor para el directorio.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

export function mountEmpleados(container: HTMLElement, signal: AbortSignal): void {
  if (!canAccessEmpleadosPage()) {
    mountAppShell(container, {
      pageTitle: "Empleados",
      activeNav: "empleados",
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const isRh = canAccessUsuariosAdmin();
  const kpiGestionEquipo = canAccessEmpleadosKpiGestionEquipo();
  const supervisorRhShell = !isRh && getRolFromAccessToken() === "supervisor";

  const state: State = {
    page: 1,
    page_size: 10,
    q: "",
    area_id: "",
    puesto_id: "",
    activo_rh: "",
    estatus_lider: "",
    kpi_filtrar_contratos: false,
  };

  let resumenGestion: UsuarioResumen | null = null;

  let catalogo: CatalogoFiltros = { areas: [], puestos: [] };
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let latestLoadRequestId = 0;

  mountAppShell(container, {
    pageTitle: "Empleados",
    activeNav: "empleados",
    ...(isRh || supervisorRhShell ? { mainClass: empleadosMainClass } : {}),
    mainHtml: isRh
      ? `<div id="rh-empleados-page" class="${empleadosPageShellClass}">
      <div id="empleados-root" class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderEmpleadosHeroRh()}
        <div id="empleados-kpis">${renderKpisSkeletonRh()}</div>
        <div id="empleados-panel">${renderTableLoadingRh()}</div>
      </div>
    </div>`
      : supervisorRhShell
        ? `<div class="${empleadosPageShellClass}">
      <div id="empleados-root" class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderEmpleadosHeroRh()}
        <div id="empleados-kpis">${renderKpisSkeletonRh()}</div>
        <div id="empleados-panel">${renderTableLoadingRh()}</div>
      </div>
    </div>`
        : `
      <div id="empleados-root" class="${RH_LISTADO_PAGE_OUTER}">
        <div id="empleados-kpis">
          <div class="flex items-center gap-3 py-4 text-sm text-text-muted">
            <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Cargando indicadores…
          </div>
        </div>
        <div id="empleados-panel">
          <div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted">
            <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Cargando tabla…
          </div>
        </div>
      </div>`,
  });

  const empleadosRoot = container.querySelector("#empleados-root") as HTMLElement | null;

  if (empleadosRoot) {
    empleadosRoot.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("details") || t.closest("summary") || t.closest("a[href]")) return;
        const tr = t.closest<HTMLTableRowElement>("tr[data-empleado-row-id]");
        if (!tr) return;
        const id = tr.getAttribute("data-empleado-row-id");
        if (!id) return;
        window.location.hash = `#/empleados/${id}`;
      },
      { signal },
    );

    empleadosRoot.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const tr = (e.target as HTMLElement).closest("tr[data-empleado-row-id]");
        if (!tr || e.target !== tr) return;
        e.preventDefault();
        const id = tr.getAttribute("data-empleado-row-id");
        if (!id) return;
        window.location.hash = `#/empleados/${id}`;
      },
      { signal },
    );
  }

  /** Avatares con `<img>`: fallback a iniciales si falla la carga (RH y vista supervisor en `#empleados-root`). */
  empleadosRoot?.addEventListener(
    "error",
    (ev) => {
      const el = ev.target;
      if (!(el instanceof HTMLImageElement)) return;
      if (!el.hasAttribute("data-rh-sol-avatar") && !el.hasAttribute("data-emp-tabla-avatar")) return;
      el.classList.add("hidden");
      const fb = el.nextElementSibling;
      if (
        fb instanceof HTMLElement &&
        (fb.classList.contains("rh-sol-avatar-fallback--swap") ||
          fb.classList.contains("emp-tabla-avatar-fallback--swap"))
      ) {
        fb.removeAttribute("hidden");
      }
    },
    { capture: true, signal },
  );

  const kpisEl = (): HTMLElement | null => container.querySelector("#empleados-kpis");
  const panelEl = (): HTMLElement | null => container.querySelector("#empleados-panel");

  function setSearchLoading(loading: boolean): void {
    const spinner = container.querySelector<HTMLElement>("[data-emp-search-loading]");
    if (spinner) {
      spinner.classList.toggle("hidden", !loading);
      spinner.classList.toggle("flex", loading);
    }
    const tableRegion = container.querySelector<HTMLElement>("[data-emp-table-region]");
    if (tableRegion) {
      tableRegion.classList.toggle("opacity-70", loading);
    }
  }

  function renderError(message: string): string {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(message)}</div>`;
  }

  async function loadPage(options?: { background?: boolean; preserveSearchFocus?: boolean }): Promise<void> {
    const background = options?.background === true;
    const preserveSearchFocus = options?.preserveSearchFocus === true;
    const panel = panelEl();
    if (!panel) return;
    const activeSearch = container.querySelector<HTMLInputElement>("#emp-search");
    const shouldRestoreSearch =
      preserveSearchFocus && activeSearch instanceof HTMLInputElement && activeSearch === document.activeElement;
    const searchSelectionStart = shouldRestoreSearch ? activeSearch.selectionStart : null;
    const searchSelectionEnd = shouldRestoreSearch ? activeSearch.selectionEnd : null;
    const requestId = ++latestLoadRequestId;
    if (background) {
      setSearchLoading(true);
    } else {
      panel.innerHTML =
        isRh || supervisorRhShell
          ? renderTableLoadingRh()
          : `<div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted"><svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Cargando tabla…</div>`;
    }
    try {
      const pg = await getEmpleadosPage(buildEmpleadosListParams(state, isRh, kpiGestionEquipo));
      if (requestId !== latestLoadRequestId) return;
      const pm = panelMode(isRh, kpiGestionEquipo);
      panel.innerHTML = renderPanel(state, catalogo, pg, pm, kpiGestionEquipo);
      const kEl = kpisEl();
      if (kpiGestionEquipo && resumenGestion && kEl) {
        kEl.innerHTML = renderKpis(resumenGestion, isRh, true, liderKpiUiDesdeState(state));
      }
      if (shouldRestoreSearch) {
        const nextSearch = container.querySelector<HTMLInputElement>("#emp-search");
        if (nextSearch) {
          nextSearch.focus({ preventScroll: true });
          const valueLength = nextSearch.value.length;
          const start = searchSelectionStart == null ? valueLength : Math.min(searchSelectionStart, valueLength);
          const end = searchSelectionEnd == null ? valueLength : Math.min(searchSelectionEnd, valueLength);
          nextSearch.setSelectionRange(start, end);
        }
      }
    } catch (e: unknown) {
      if (requestId !== latestLoadRequestId) return;
      if (isUsuariosFetchError(e) && e.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      const msg =
        isUsuariosFetchError(e) && e.status === 403
          ? e.detail
          : isUsuariosFetchError(e)
            ? e.detail
            : "Error de conexión.";
      panel.innerHTML = `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(msg)}</div>`;
    } finally {
      if (background && requestId === latestLoadRequestId) {
        setSearchLoading(false);
      }
    }
  }

  async function init(): Promise<void> {
    const kpis = kpisEl();
    try {
      const [res, cat, pg] = await Promise.all([
        getEmpleadosResumen(),
        getEmpleadosCatalogoFiltros(),
        getEmpleadosPage(buildEmpleadosListParams(state, isRh, kpiGestionEquipo)),
      ]);
      catalogo = cat;
      resumenGestion = res;
      if (kpis) {
        kpis.innerHTML = renderKpis(
          res,
          isRh,
          kpiGestionEquipo,
          kpiGestionEquipo ? liderKpiUiDesdeState(state) : null,
        );
      }
      const panel = panelEl();
      if (panel) panel.innerHTML = renderPanel(state, catalogo, pg, panelMode(isRh, kpiGestionEquipo), kpiGestionEquipo);
    } catch (e: unknown) {
      if (isUsuariosFetchError(e) && e.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      const msg = isUsuariosFetchError(e) ? e.detail : "Error de conexión.";
      if (kpis) kpis.innerHTML = renderError(msg);
      const panel = panelEl();
      if (panel) panel.innerHTML = "";
    }
  }

  container.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      const kpiBtn = t.closest<HTMLButtonElement>("[data-emp-kpi]");
      if (kpiBtn && kpiGestionEquipo) {
        const kind = kpiBtn.getAttribute("data-emp-kpi");
        if (kind === "equipo") {
          state.kpi_filtrar_contratos = false;
          state.estatus_lider = "";
          state.page = 1;
        } else if (kind === "contratos") {
          state.kpi_filtrar_contratos = !state.kpi_filtrar_contratos;
          if (state.kpi_filtrar_contratos) state.estatus_lider = "";
          state.page = 1;
        }
        void loadPage();
        return;
      }
      if (t.closest("[data-emp-clear-filters]")) {
        state.q = "";
        state.area_id = "";
        state.puesto_id = "";
        state.activo_rh = "";
        state.estatus_lider = "";
        state.kpi_filtrar_contratos = false;
        state.page = 1;
        void loadPage();
        return;
      }
      const btn = t.closest<HTMLButtonElement>("[data-emp-page]");
      if (!btn || btn.disabled) return;
      const raw = btn.getAttribute("data-emp-page");
      if (raw == null) return;
      const next = Number.parseInt(raw, 10);
      if (Number.isNaN(next) || next < 1) return;
      state.page = next;
      void loadPage();
    },
    { signal },
  );

  container.addEventListener(
    "change",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "emp-page-size") {
        const n = Number.parseInt((t as HTMLSelectElement).value, 10);
        if (!Number.isNaN(n) && n > 0) {
          state.page_size = n;
          state.page = 1;
          void loadPage();
        }
        return;
      }
      if (t.id === "emp-filter-area") {
        state.area_id = (t as HTMLSelectElement).value;
        state.page = 1;
        void loadPage();
        return;
      }
      if (t.id === "emp-filter-puesto") {
        state.puesto_id = (t as HTMLSelectElement).value;
        state.page = 1;
        void loadPage();
        return;
      }
      if (isRh && t.id === "emp-filter-status") {
        const v = (t as HTMLSelectElement).value;
        state.activo_rh = v === "true" ? "true" : v === "false" ? "false" : "";
        state.page = 1;
        void loadPage();
        return;
      }
      if (kpiGestionEquipo && t.id === "emp-filter-lider-estatus") {
        const v = (t as HTMLSelectElement).value;
        state.estatus_lider = v === "inactivo" || v === "permiso" ? v : "";
        state.kpi_filtrar_contratos = false;
        state.page = 1;
        void loadPage();
      }
    },
    { signal },
  );

  container.addEventListener(
    "input",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id !== "emp-search") return;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        state.q = (t as HTMLInputElement).value;
        state.page = 1;
        void loadPage({ background: true, preserveSearchFocus: true });
      }, 400);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  void init();
}
