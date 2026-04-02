import {
  getEmpleadosCatalogoFiltros,
  getEmpleadosPage,
  getEmpleadosResumen,
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
import { canAccessEmpleadosPage, canAccessUsuariosAdmin } from "../auth/jwt.ts";
import { clearAuth } from "../auth/session.ts";
import { mountEditarAsignacionModal } from "../components/empleados/editarAsignacionModal.ts";
import type { EditarAsignacionModalHandle } from "../components/empleados/editarAsignacionModal.ts";
import { mountAppShell } from "../layouts/appShell.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initialsNombre(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? "").toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? "").toUpperCase();
  return (a + b) || "?";
}

type State = {
  page: number;
  page_size: number;
  q: string;
  area_id: string;
  puesto_id: string;
  /** RH: "" = todos, "true" = activos, "false" = no activos */
  activo_rh: "" | "true" | "false";
};

function parseOptionalInt(s: string): number | undefined {
  if (!s.trim()) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseActivoRh(s: State["activo_rh"]): boolean | undefined {
  if (s === "true") return true;
  if (s === "false") return false;
  return undefined;
}

function paginationRange(totalPages: number, p: number): (number | "ellipsis")[] {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out: (number | "ellipsis")[] = [];
  const push = (x: number | "ellipsis"): void => {
    if (out[out.length - 1] !== x) out.push(x);
  };
  push(1);
  if (p > 3) push("ellipsis");
  const start = Math.max(2, p - 1);
  const end = Math.min(totalPages - 1, p + 1);
  for (let i = start; i <= end; i++) push(i);
  if (p < totalPages - 2) push("ellipsis");
  push(totalPages);
  return out;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function filtrosActivos(state: State, rh: boolean): boolean {
  if (state.q.trim()) return true;
  if (state.area_id) return true;
  if (state.puesto_id) return true;
  if (rh && state.activo_rh) return true;
  return false;
}

/** Texto de celda cuando no hay dato (evita "—"). */
function textoAsignacion(val: string | null | undefined): string {
  const t = val?.trim();
  return t ? t : "Sin asignar";
}

type KpiMetricSemantic = "total" | "activo" | "inactivo";

/** Contenedor homogéneo: tinte suave, icono 600, borde y anillo inset para definición. */
function kpiMetricIconBox(semantic: KpiMetricSemantic, svgHtml: string): string {
  const cls: Record<KpiMetricSemantic, string> = {
    total:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-total-bg text-kpi-metric-total-icon border-kpi-metric-total-icon/25 ring-kpi-metric-total-icon/10",
    activo:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-activo-bg text-kpi-metric-activo-icon border-kpi-metric-activo-icon/25 ring-kpi-metric-activo-icon/10",
    inactivo:
      "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ring-1 ring-inset bg-kpi-metric-inactivo-bg text-kpi-metric-inactivo-icon border-kpi-metric-inactivo-icon/25 ring-kpi-metric-inactivo-icon/10",
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

const KPI_NUM_CLS =
  "mt-3 text-4xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-[2.125rem]";
const KPI_SUB_CLS = "mt-2 text-sm font-medium leading-snug text-slate-500";
const KPI_MICRO_CLS = "mt-1 text-xs text-slate-400";

function renderKpis(r: UsuarioResumen, isRh: boolean): string {
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
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
  const rest = puestos
    .map((p) => {
      const v = String(p.puesto_id);
      return `<option value="${escapeHtml(v)}" ${v === selected ? "selected" : ""}>${escapeHtml(p.descripcion)}</option>`;
    })
    .join("");
  return head + rest;
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

function rowHtml(u: UsuarioListItem, isRh: boolean): string {
  const name = u.nombre.trim() || "Sin nombre";
  const ini = initialsNombre(u.nombre);
  const sup = textoAsignacion(u.lider_nombre);
  const area = textoAsignacion(u.area?.descripcion);
  const puestoRaw = u.puesto?.descripcion?.trim() || "";
  const puesto = puestoRaw || "Sin asignar";
  const email = u.email?.trim() ? u.email : "Sin correo";
  const puestoTitle = escapeHtml(puestoRaw || "Sin asignar");
  return `
    <tr
      data-empleado-row-id="${u.id}"
      tabindex="0"
      aria-label="Ver vista 360 de ${escapeHtml(name)}"
      class="group cursor-pointer transition-colors hover:bg-slate-50/90 focus-within:bg-slate-50/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leoni-blue"
    >
      <td class="px-4 py-4 align-middle">
        <div class="flex min-w-0 items-center gap-3">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-slate-900 group-hover:text-leoni-blue">${escapeHtml(name)}</p>
            <p class="text-xs text-slate-400">${escapeHtml(email)}</p>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap px-4 py-4 text-right align-middle text-sm tabular-nums text-slate-500">#${escapeHtml(u.no_empleado)}</td>
      <td class="max-w-[10rem] px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${escapeHtml(area)}">${escapeHtml(area)}</span>
      </td>
      <td class="max-w-[14rem] px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${puestoTitle}">${escapeHtml(puesto)}</span>
      </td>
      <td class="max-w-[10rem] px-4 py-4 align-middle text-sm text-slate-600">
        <span class="block truncate" title="${escapeHtml(sup)}">${escapeHtml(sup)}</span>
      </td>
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
    </tr>`;
}

const EMPLEADOS_SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

const EMPLEADOS_FIELD_FOCUS =
  "outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2";

function empleadosSelectFilter(id: string, name: string, labelText: string, optionsHtml: string): string {
  return `<div>
  <label for="${id}" class="block text-sm/6 font-medium text-gray-900">${escapeHtml(labelText)}</label>
  <div class="mt-2 grid grid-cols-1">
    <select id="${id}" name="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 sm:text-sm/6 ${EMPLEADOS_FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${EMPLEADOS_SELECT_CHEVRON}
  </div>
</div>`;
}

function empleadosSearchInput(value: string): string {
  return `<label for="emp-search" class="block text-sm/6 font-medium text-gray-900">Búsqueda</label>
          <div class="mt-2">
            <input
              id="emp-search"
              type="text"
              name="emp-search"
              autocomplete="off"
              placeholder="Buscar por nombre, ID o número de empleado..."
              value="${escapeHtml(value)}"
              class="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 placeholder:text-gray-400 sm:text-sm/6 ${EMPLEADOS_FIELD_FOCUS}"
            />
          </div>`;
}

function renderPanel(
  state: State,
  catalogo: CatalogoFiltros,
  pg: UsuarioPage,
  isRh: boolean,
): string {
  const totalPages = Math.max(1, Math.ceil(pg.total / pg.page_size) || 1);
  const from = pg.total === 0 ? 0 : (pg.page - 1) * pg.page_size + 1;
  const to = Math.min(pg.page * pg.page_size, pg.total);
  const pages = paginationRange(totalPages, pg.page);

  const rows =
    pg.items.length === 0
      ? `<tr><td colspan="${isRh ? 7 : 6}" class="px-4 py-14 text-center text-sm text-slate-500">No hay empleados con los filtros actuales.</td></tr>`
      : pg.items.map((u) => rowHtml(u, isRh)).join("");

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

  const clearBtn = filtrosActivos(state, isRh)
    ? `<button type="button" data-emp-clear-filters class="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">Limpiar filtros</button>`
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
    : `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
        <div class="min-w-0 md:col-span-2 xl:col-span-6">${empleadosSearchInput(state.q)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-3">${empleadosSelectFilter("emp-filter-area", "emp-filter-area", "Área", areaOpts)}</div>
        <div class="min-w-0 md:col-span-1 xl:col-span-3">${empleadosSelectFilter("emp-filter-puesto", "emp-filter-puesto", "Puesto", puestoOpts)}</div>
      </div>`;

  const pageSizeOpts = [10, 25, 50, 100]
    .map((n) => `<option value="${n}" ${n === state.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  return `
    <div class="flex flex-col gap-8">
      <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-label="Filtros del listado de empleados">
        ${filtrosToolbar}
        ${filtrosGrid}
      </section>
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Listado de empleados">
      <div class="max-h-[min(72vh,780px)] overflow-auto">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[720px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr class="text-white">
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Empleado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-right text-sm font-semibold">Número</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Área</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Puesto</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Líder</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Estatus</th>
              ${isRh ? `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-right text-sm font-semibold">Acción</th>` : ""}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      <div class="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p class="text-sm font-medium text-slate-600">Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${pg.total}</span> empleados</p>
          <div class="flex flex-wrap items-center gap-2">
            <label for="emp-page-size" class="text-sm font-medium text-slate-600">Registros por página</label>
            <select id="emp-page-size" name="emp-page-size" class="rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm ${EMPLEADOS_FIELD_FOCUS}">
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

  const state: State = {
    page: 1,
    page_size: 10,
    q: "",
    area_id: "",
    puesto_id: "",
    activo_rh: "",
  };

  let currentPageItems: UsuarioListItem[] = [];

  let catalogo: CatalogoFiltros = { areas: [], puestos: [] };
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

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

  function renderError(message: string): string {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeHtml(message)}</div>`;
  }

  async function loadPage(): Promise<void> {
    const panel = panelEl();
    if (!panel) return;
    panel.innerHTML = `<div class="flex items-center gap-3 rounded-xl border border-border bg-white p-6 text-sm text-text-muted"><svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Cargando tabla…</div>`;
    try {
      const pg = await getEmpleadosPage({
        page: state.page,
        page_size: state.page_size,
        q: state.q,
        area_id: parseOptionalInt(state.area_id),
        puesto_id: parseOptionalInt(state.puesto_id),
        ...(isRh ? { activo: parseActivoRh(state.activo_rh) } : {}),
      });
      currentPageItems = pg.items;
      panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
    } catch (e: unknown) {
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
    }
  }

  async function init(): Promise<void> {
    const kpis = kpisEl();
    try {
      const [res, cat, pg] = await Promise.all([
        getEmpleadosResumen(),
        getEmpleadosCatalogoFiltros(),
        getEmpleadosPage({
          page: state.page,
          page_size: state.page_size,
          q: state.q,
          area_id: parseOptionalInt(state.area_id),
          puesto_id: parseOptionalInt(state.puesto_id),
          ...(isRh ? { activo: parseActivoRh(state.activo_rh) } : {}),
        }),
      ]);
      catalogo = cat;
      if (kpis) kpis.innerHTML = renderKpis(res, isRh);
      currentPageItems = pg.items;
      const panel = panelEl();
      if (panel) panel.innerHTML = renderPanel(state, catalogo, pg, isRh);
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
      if (t.closest("[data-emp-clear-filters]")) {
        state.q = "";
        state.area_id = "";
        state.puesto_id = "";
        state.activo_rh = "";
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
        void loadPage();
      }, 480);
    },
    { signal },
  );

  void init();
}
