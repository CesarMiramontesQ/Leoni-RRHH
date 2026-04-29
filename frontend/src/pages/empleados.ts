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
import { mountEditarAsignacionModal } from "../components/empleados/editarAsignacionModal.ts";
import type { EditarAsignacionModalHandle } from "../components/empleados/editarAsignacionModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { antiguedadAniosMeses, formatFechaIngreso } from "../utils/vista360Domain.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON, BTN_GHOST } from "../ui/uiTokens.ts";

function nombreEmpleadoTablaMostrar(raw: string): string {
  return formatNombreEmpleadoUi(raw) || "Sin nombre";
}

function inicialesEmpleadoTabla(raw: string): string {
  const display = formatNombreEmpleadoUi(raw) || raw.trim();
  return inicialesDesdeNombreDisplay(display);
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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

function empleadoAvatarCellHtml(foto: string | null | undefined, iniciales: string): string {
  const url = foto?.trim();
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="" class="size-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`;
  }
  return `<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(iniciales)}</span>`;
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
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button type="button" data-emp-kpi="equipo" class="group flex min-h-[9.5rem] w-full flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition ${ringEq}">
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
      <button type="button" data-emp-kpi="contratos" class="group flex min-h-[9.5rem] w-full flex-col rounded-xl border bg-white p-5 text-left shadow-sm transition ${ringCt}">
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

  const pctInactivosPlantilla =
    r.total_plantilla > 0 ? round1((r.inactivos / r.total_plantilla) * 100) : 0;

  return `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Total de plantilla</p>
          ${kpiMetricIconBox("total", svgKpiTotalPlantilla())}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.total_plantilla))}</p>
        <p class="${KPI_SUB_CLS}">Registro actual de personas en nómina</p>
        <p class="${KPI_MICRO_CLS}">Variación vs mes anterior: pendiente de datos</p>
      </article>
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Activos</p>
          ${kpiMetricIconBox(
            "activo",
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
              <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />
            </svg>`,
          )}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.activos))}</p>
        <p class="mt-2 flex items-center gap-1.5 text-sm font-semibold text-kpi-metric-activo-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" /></svg>
          ${escapeHtml(String(r.porcentaje_operatividad))}% operatividad
        </p>
        <p class="${KPI_MICRO_CLS}">Comparación vs mes anterior: no disponible</p>
      </article>
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">No activos</p>
          ${kpiMetricIconBox("inactivo", svgKpiNoActivo())}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.inactivos))}</p>
        <p class="mt-2 text-sm font-semibold text-red-700">${escapeHtml(String(pctInactivosPlantilla))}% de la plantilla</p>
        <p class="${KPI_MICRO_CLS}">Comparación vs mes anterior: no disponible</p>
      </article>
      <article class="flex min-h-[9.5rem] flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <p class="text-sm font-semibold text-slate-600">Sin Líder Asignado</p>
          ${kpiMetricIconBox("sinLider", svgKpiSinLider())}
        </div>
        <p class="${KPI_NUM_CLS}">${escapeHtml(String(r.sin_lider_asignado))}</p>
        <p class="${KPI_SUB_CLS}">Empleados sin responsable jerárquico</p>
        <p class="${KPI_MICRO_CLS}">Requieren asignación de líder</p>
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

function rowAccionesLiderHtml(u: UsuarioListItem, name: string): string {
  const empDir = String(u.empleado_id);
  return `<td class="relative w-px px-2 py-3 align-middle" data-emp-row-nolink>
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
  const avatar = isLider
    ? empleadoAvatarCellHtml(u.foto ?? null, ini)
    : `<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>`;
  const nombreCls = isLider
    ? "text-sm font-bold text-slate-900 group-hover:text-leoni-blue"
    : "text-sm font-semibold text-slate-900 group-hover:text-leoni-blue";
  const emailCls = isLider ? "mt-0.5 text-xs leading-tight text-slate-500" : "text-xs text-slate-400";
  const userStack = isLider
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
    : `<td class="max-w-[10rem] px-4 py-4 align-middle text-sm text-slate-600">
        <span class="block truncate" title="${escapeHtml(sup)}">${escapeHtml(sup)}</span>
      </td>`;
  const colAntiguedad = isLider
    ? `<td class="whitespace-nowrap px-4 py-4 align-middle">${antiguedadCeldaHtml(u.registro)}</td>`
    : "";
  const colAccionesLider = isLider ? rowAccionesLiderHtml(u, name) : "";

  return `
    <tr
      data-empleado-row-id="${u.id}"
      tabindex="0"
      aria-label="Ver vista 360 de ${escapeHtml(name)}"
      class="group cursor-pointer transition-colors hover:bg-slate-50/90 focus-within:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue"
    >
      <td class="px-4 py-4 align-middle">
        <div class="flex min-w-0 items-center gap-3">
          ${avatar}
          ${userStack}
        </div>
      </td>
      <td class="whitespace-nowrap px-4 py-4 text-right align-middle text-sm tabular-nums text-slate-500">#${escapeHtml(formatNoEmpleadoDisplay(u.no_empleado))}</td>
      <td class="max-w-[10rem] px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${escapeHtml(area)}">${escapeHtml(area)}</span>
      </td>
      <td class="max-w-[14rem] px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${puestoTitle}">${escapeHtml(puesto)}</span>
      </td>
      ${colLider}
      ${colAntiguedad}
      <td class="px-4 py-4 align-middle">${estadoPill(u.estado)}</td>
      ${isRh ? `<td class="cursor-default px-4 py-4 text-right align-middle" data-empleado-row-actions>
        <button
          type="button"
          data-edit-empleado-id="${u.id}"
          title="Editar área, puesto o líder"
          class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 shadow-sm ring-1 ring-slate-200/80 transition-colors hover:bg-leoni-blue/10 hover:text-leoni-blue hover:ring-leoni-blue/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          aria-label="Editar asignación de ${escapeHtml(name)}"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true">
            <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
            <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
          </svg>
        </button>
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

function renderPanel(
  state: State,
  catalogo: CatalogoFiltros,
  pg: UsuarioPage,
  mode: PanelMode,
  liderUiForFilters: boolean,
): string {
  const isRh = mode === "rh";
  const isLider = mode === "lider";
  const jefeRol = getRolFromAccessToken();
  const ocultarLiderCol = isLider && jefeRol === "supervisor";
  const colCount = isRh ? 7 : isLider ? (ocultarLiderCol ? 7 : 8) : 6;

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
        ? "min-h-10 min-w-10 rounded-lg bg-leoni-blue px-3 text-sm font-bold text-white shadow-md transition hover:bg-leoni-blue-light"
        : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";
      return `<button type="button" data-emp-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");

  const areaOpts = areaOptions(catalogo.areas, state.area_id, "Todas las áreas");
  const puestoOpts = puestoOptions(catalogo.puestos, state.puesto_id, "Todos los puestos");
  const statusOpts = `<option value="" ${state.activo_rh === "" ? "selected" : ""}>Todos los estatus</option>
            <option value="true" ${state.activo_rh === "true" ? "selected" : ""}>Activos</option>
            <option value="false" ${state.activo_rh === "false" ? "selected" : ""}>No activos</option>`;

  const liderEstatusOpts = `<option value="" ${state.estatus_lider === "" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${state.estatus_lider === "inactivo" ? "selected" : ""}>Inactivo</option>
            <option value="permiso" ${state.estatus_lider === "permiso" ? "selected" : ""}>Permiso</option>`;

  const clearBtn = filtrosActivos(state, isRh, liderUiForFilters)
    ? `<button type="button" data-emp-clear-filters class="${BTN_GHOST} w-full sm:w-auto">Limpiar filtros</button>`
    : "";

  const filtrosToolbar = clearBtn
    ? `<div class="mb-4 flex justify-end sm:mb-3">${clearBtn}</div>`
    : "";

  const filtrosGrid = isRh
    ? `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
        <div class="min-w-0 md:col-span-2 xl:col-span-6">${empleadosSearchInput(state.q)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-2">${empleadosSelectFilter("emp-filter-area", "emp-filter-area", "Área", areaOpts)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-2">${empleadosSelectFilter("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}</div>
        <div class="min-w-0 md:col-span-2 xl:col-span-2">${empleadosSelectFilter("emp-filter-status", "emp-filter-status", "Estatus", statusOpts)}</div>
      </div>`
    : isLider
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

  const theadClassic = `
            <tr class="text-white">
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Empleado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-right text-sm font-semibold">Número</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Área</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Puesto</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Líder</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Estatus</th>
              ${isRh ? `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-right text-sm font-semibold">Acción</th>` : ""}
            </tr>`;

  const theadInner = isLider ? theadLider : theadClassic;
  const tableMinW = isLider ? "min-w-[880px]" : "min-w-[720px]";

  const pageSizeOpts = [10, 25, 50, 100]
    .map((n) => `<option value="${n}" ${n === state.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="flex flex-col gap-8">
      <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-label="Filtros del listado de empleados">
        ${filtrosToolbar}
        ${filtrosGrid}
      </section>
      <section data-emp-table-region class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5 transition-opacity duration-150" aria-label="Listado de empleados">
      <div class="max-h-[min(72vh,780px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="${tableMinW} w-full text-left">
          <thead class="${isLider ? "shadow-sm" : "border-b border-leoni-blue-light shadow-sm"}">
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
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">Se requiere rol RH, gerente, director o supervisor para el directorio.</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al dashboard</a>
    </div>`;
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

  let currentPageItems: UsuarioListItem[] = [];
  let resumenGestion: UsuarioResumen | null = null;

  let catalogo: CatalogoFiltros = { areas: [], puestos: [] };
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let latestLoadRequestId = 0;

  mountAppShell(container, {
    pageTitle: "Empleados",
    activeNav: "empleados",
    mainHtml: `
      <div id="empleados-root" class="space-y-8">
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
      </div>
      ${isRh ? `<div id="editar-asignacion-modal-host"></div>` : ""}`,
  });

  const empleadosRoot = container.querySelector("#empleados-root") as HTMLElement | null;
  const editModalHost = container.querySelector("#editar-asignacion-modal-host") as HTMLElement | null;

  let editModal: EditarAsignacionModalHandle | null = null;
  if (isRh && empleadosRoot && editModalHost) {
    editModal = mountEditarAsignacionModal(editModalHost, {
      onSuccess: () => void init(),
      onSessionExpired: () => {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
      },
      toastContainer: empleadosRoot,
      signal,
    });
  }

  if (empleadosRoot) {
    empleadosRoot.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.closest("[data-edit-empleado-id]")) return;
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

  container.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      const btn = t.closest<HTMLButtonElement>("[data-edit-empleado-id]");
      if (!btn || !isRh || !editModal) return;
      const id = Number.parseInt(btn.getAttribute("data-edit-empleado-id") ?? "", 10);
      const empleado = currentPageItems.find((u) => u.id === id);
      if (!empleado) return;
      void editModal.open(empleado);
    },
    { signal },
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
      panel.innerHTML = `<div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted"><svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Cargando tabla…</div>`;
    }
    try {
      const pg = await getEmpleadosPage(buildEmpleadosListParams(state, isRh, kpiGestionEquipo));
      if (requestId !== latestLoadRequestId) return;
      currentPageItems = pg.items;
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
      currentPageItems = pg.items;
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
