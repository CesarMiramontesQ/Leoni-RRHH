import {
  type NuevaActaEmpleadoOption,
  type NuevaActaSelectOption,
} from "../actas/nuevaActaModalConfig.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import { isUsuariosFetchError, type UsuarioListItem } from "../api/usuarios.ts";
import {
  createActaAdministrativa,
  getActasPage,
  type ActaListItem,
} from "../api/actas.ts";
import {
  mountNuevaActaModal,
  type NuevaActaSubmitPayload,
} from "../components/actas/nuevaActaModal.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../utils/nombreEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../utils/rhListadoTablaLayout.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  ACTAS_ESTADOS,
  ACTAS_PERIODOS,
  ACTAS_SUPERVISORES,
  ACTAS_TIPOS,
  type ActaEstadoCodigo,
  type ActaTablaFila,
  type ActaTipoCodigo,
} from "../actas/actasMockData.ts";
import { escapeHtml, fmtFechaCorta, paginationRange } from "../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  badgeOpen,
  badgeInProgress,
  badgeApproved,
  badgeCancelled,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";

type ActasTableData = {
  items: ActaTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

type ActasStatCard = {
  id: ActaEstadoCodigo;
  titulo: string;
  microcopy: string;
  valor: number;
  toneClass: string;
  icon: string;
};

type ActasFilterState = {
  empleado_busqueda: string;
  supervisor_id: string;
  tipo: "" | ActaTipoCodigo;
  estado: "" | ActaEstadoCodigo;
  periodo: "30d" | "90d" | "365d" | "all";
  page: number;
  page_size: number;
};

const ACTAS_RESPONSABLES_RH: readonly NuevaActaSelectOption[] = [
  {
    id: "ALMA LIZBETH HERNANDEZ HERNANDEZ",
    label: "ALMA LIZBETH HERNANDEZ HERNANDEZ",
  },
  {
    id: "MARTHA VERONICA BARAY ARMENDARIZ",
    label: "MARTHA VERONICA BARAY ARMENDARIZ",
  },
];

const DEFAULT_FILTERS: ActasFilterState = {
  empleado_busqueda: "",
  supervisor_id: "",
  tipo: "",
  estado: "",
  periodo: "30d",
  page: 1,
  page_size: 10,
};

function forbiddenHtml(): string {
  return htmlAccessDenied({
    title: "Acceso restringido",
    description: "La sección de actas administrativas solo está disponible para RH.",
    linkHref: "#/",
    linkLabel: "Volver al dashboard",
  });
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function parseLocalDate(iso: string): Date | null {
  const p = iso.trim().split("-");
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function dentroDePeriodo(fechaIso: string, periodo: ActasFilterState["periodo"]): boolean {
  if (periodo === "all") return true;
  const d = parseLocalDate(fechaIso);
  if (!d) return true;
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  const lim = new Date(hoy);
  const dias = periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
  lim.setDate(lim.getDate() - dias);
  lim.setHours(0, 0, 0, 0);
  return d.getTime() >= lim.getTime();
}

function hasActiveFilters(filters: ActasFilterState): boolean {
  return Boolean(
    filters.empleado_busqueda.trim() ||
      filters.supervisor_id ||
      filters.tipo ||
      filters.estado ||
      filters.periodo !== "30d",
  );
}

function filterActasRows(rows: readonly ActaTablaFila[], filters: ActasFilterState): ActaTablaFila[] {
  const search = normalizeText(filters.empleado_busqueda);
  return rows.filter((row) => {
    if (filters.supervisor_id && row.supervisor_id !== filters.supervisor_id) return false;
    if (filters.tipo && row.tipo !== filters.tipo) return false;
    if (filters.estado && row.estado !== filters.estado) return false;
    if (!dentroDePeriodo(row.fecha, filters.periodo)) return false;
    if (search) {
      const haystack = normalizeText(
        `${row.empleado_nombre_raw} ${row.empleado_id} ${row.folio} ${row.supervisor_nombre}`,
      );
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function paginateActas(filtered: readonly ActaTablaFila[], filters: ActasFilterState): ActasTableData {
  const total = filtered.length;
  const page = Math.max(1, filters.page);
  const page_size = Math.max(1, filters.page_size);
  const start = (page - 1) * page_size;
  return {
    items: filtered.slice(start, start + page_size),
    total,
    page,
    page_size,
  };
}

function labelTipo(tipo: ActaTipoCodigo): string {
  if (tipo === "amonestacion") return "Amonestación";
  if (tipo === "suspension") return "Suspensión";
  return "Administrativa";
}

function badgeTipo(tipo: ActaTipoCodigo): string {
  const text = escapeHtml(labelTipo(tipo));
  if (tipo === "suspension") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800"><span class="size-1.5 rounded-full bg-red-500" aria-hidden="true"></span>${text}</span>`;
  }
  if (tipo === "administrativa") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900"><span class="size-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>${text}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"><span class="size-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>${text}</span>`;
}

function badgeEstado(estado: ActaEstadoCodigo): string {
  switch (estado) {
    case "abierta":    return badgeOpen("Abierta");
    case "en_proceso": return badgeInProgress("En proceso");
    case "firmada":    return badgeApproved("Firmada");
    case "cerrada":    return badgeCancelled("Cerrada");
    default:           return escapeHtml(estado);
  }
}

function mapUsuarioToNuevaActaEmpleado(item: UsuarioListItem): NuevaActaEmpleadoOption {
  const empleadoId = String(item.id);
  const nombre = formatNombreEmpleadoUi(item.nombre) || item.nombre || empleadoId;
  const numeroEmpleado = item.no_empleado?.trim() || empleadoId;
  const areaDepartamento = item.area?.descripcion?.trim() || "Sin área";
  const supervisorDirecto = item.lider_nombre?.trim() || "Sin supervisor";
  return {
    id: empleadoId,
    nombre,
    numeroEmpleado,
    areaDepartamento,
    supervisorDirecto,
  };
}

function mapModalTipoToTableTipo(value: string): ActaTipoCodigo {
  const normalized = normalizeText(value);
  if (!normalized) return "administrativa";
  if (normalized.includes("leve") || normalized.includes("amonest")) return "amonestacion";
  if (
    normalized.includes("grave") ||
    normalized.includes("suspension") ||
    normalized.includes("suspender")
  ) {
    return "suspension";
  }
  return "administrativa";
}

function createFolioFromId(id: number): string {
  return `ACT-${String(id).padStart(4, "0")}`;
}

function normalizeNumeroEmpleadoDisplay(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d+\.0+$/.test(raw)) return raw.replace(/\.0+$/, "");
  return raw;
}

function mapBackendEstadoToTableEstado(
  estado: "draft" | "pending_sign" | "signed" | "archived",
): ActaEstadoCodigo {
  if (estado === "pending_sign") return "en_proceso";
  if (estado === "signed") return "firmada";
  if (estado === "archived") return "cerrada";
  return "abierta";
}

function mapActaListItemToRow(item: ActaListItem): ActaTablaFila {
  const fecha = item.fecha_evento?.trim() || item.created_at.slice(0, 10);
  const numeroEmpleado =
    normalizeNumeroEmpleadoDisplay(item.numero_empleado) ||
    String(item.empleado_id);
  const nombreEmpleado = item.empleado_nombre?.trim() || `Empleado ${numeroEmpleado}`;
  const supervisorRaw = item.supervisor_directo?.trim() || "Sin supervisor";
  const supervisor = formatNombreEmpleadoUi(supervisorRaw) || supervisorRaw;
  return {
    id: item.id,
    folio: createFolioFromId(item.id),
    empleado_id: numeroEmpleado,
    empleado_nombre_raw: nombreEmpleado,
    foto_url: null,
    area: item.area_departamento?.trim() || "Sin área",
    supervisor_id: "sup-1",
    supervisor_nombre: supervisor,
    tipo: mapModalTipoToTableTipo(item.tipo_falta ?? ""),
    fecha,
    estado: mapBackendEstadoToTableEstado(item.estado),
  };
}

function celdaEmpleado(row: ActaTablaFila): string {
  const name = formatNombreEmpleadoUi(row.empleado_nombre_raw) || "Sin nombre";
  const initials = inicialesDesdeNombreDisplay(name);
  const avatar = row.foto_url?.trim()
    ? `<img src="${escapeHtml(row.foto_url)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
    : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(initials)}</span>`;
  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-slate-900">${escapeHtml(name)}</p>
        <p class="truncate text-xs text-slate-500">${escapeHtml(row.empleado_id)}</p>
      </div>
    </div>`;
}

function renderStatsCards(rows: readonly ActaTablaFila[], filters: ActasFilterState, loading: boolean): string {
  if (loading) {
    const skeleton = Array.from({ length: 4 })
      .map(
        () => `
        <article class="animate-pulse rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div class="h-4 w-28 rounded bg-slate-200"></div>
          <div class="mt-3 h-8 w-14 rounded bg-slate-200"></div>
          <div class="mt-3 h-3 w-24 rounded bg-slate-100"></div>
        </article>`,
      )
      .join("");
    return `<section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy="true">${skeleton}</section>`;
  }

  const cardsData: readonly ActasStatCard[] = [
    {
      id: "abierta",
      titulo: "Actas abiertas",
      microcopy: "Requieren atención",
      valor: rows.filter((row) => row.estado === "abierta").length,
      toneClass: "border-blue-200 bg-blue-50/50 text-blue-900",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 3.5v6.5l3.5 2.1M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>`,
    },
    {
      id: "en_proceso",
      titulo: "En proceso",
      microcopy: "Pendientes de seguimiento",
      valor: rows.filter((row) => row.estado === "en_proceso").length,
      toneClass: "border-amber-200 bg-amber-50/50 text-amber-900",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 3.5v3m0 7v3m6.5-6.5h-3m-7 0h-3m10.95 4.95-2.12-2.12m-4.66-4.66L5.05 5.05m9.9 0-2.12 2.12m-4.66 4.66-2.12 2.12" /></svg>`,
    },
    {
      id: "firmada",
      titulo: "Firmadas",
      microcopy: "Completadas",
      valor: rows.filter((row) => row.estado === "firmada").length,
      toneClass: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 10 3.2 3.2 7.8-7.8" /></svg>`,
    },
    {
      id: "cerrada",
      titulo: "Cerradas",
      microcopy: "Archivadas",
      valor: rows.filter((row) => row.estado === "cerrada").length,
      toneClass: "border-slate-200 bg-slate-50 text-slate-800",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6.5h12m-10.5 3h9m-9 3h6M4 4.5h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" /></svg>`,
    },
  ];
  const cards = cardsData.map(
    (card) => `
      <article>
        <button
          type="button"
          data-rh-actas-metric="${card.id}"
          aria-label="Filtrar actas por estado ${escapeHtml(card.titulo)}"
          class="group w-full rounded-2xl border bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30 ${
            filters.estado === card.id
              ? `${card.toneClass} ring-1 ring-current/20`
              : "border-[#e5e7eb] text-slate-800 hover:border-slate-300"
          }"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-[#667085]">${escapeHtml(card.titulo)}</p>
              <p class="mt-2 text-3xl font-semibold leading-none tabular-nums text-[#111827]">${escapeHtml(String(card.valor))}</p>
              <p class="mt-2 text-xs text-[#667085]">${escapeHtml(card.microcopy)}</p>
            </div>
            <span class="inline-flex size-9 items-center justify-center rounded-xl ${card.toneClass}">
              ${card.icon}
            </span>
          </div>
        </button>
      </article>`,
  ).join("");
  return `<section class="grid grid-cols-2 gap-3 xl:grid-cols-4">${cards}</section>`;
}

function renderSelectFilter(
  id: string,
  label: string,
  field: string,
  value: string,
  options: ReadonlyArray<{ id: string; label: string }>,
  emptyLabel: string,
): string {
  const optionsHtml =
    `<option value="" ${value === "" ? "selected" : ""}>${escapeHtml(emptyLabel)}</option>` +
    options
      .map(
        (option) =>
          `<option value="${escapeHtml(option.id)}" ${value === option.id ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
      )
      .join("");
  return `<div class="min-w-0">
    <label for="${id}" class="mb-1 block text-xs font-medium text-[#667085]">${escapeHtml(label)}</label>
    <div class="grid grid-cols-1">
      <select
        id="${id}"
        data-rh-actas-filter="${field}"
        class="col-start-1 row-start-1 w-full appearance-none rounded-[10px] border border-[#e5e7eb] bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
      >
        ${optionsHtml}
      </select>
      ${SELECT_CHEVRON}
    </div>
  </div>`;
}

function renderActasFilters(filters: ActasFilterState, loading: boolean): string {
  if (loading) {
    return `
      <section class="animate-pulse rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-busy="true">
        <div class="h-4 w-16 rounded bg-slate-200"></div>
        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-10 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  const clearBtn = hasActiveFilters(filters)
    ? `<div class="w-full shrink-0 sm:w-auto">
      <button
        type="button"
        data-rh-actas-clear-filters
        class="${RH_LISTADO_BTN_GHOST} w-full sm:w-auto"
      >
        Limpiar filtros
      </button>
    </div>`
    : "";

  return `
    <section class="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-label="Filtros de actas">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-[#111827]">Filtros</h2>
        ${clearBtn}
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div class="min-w-0">
          <label for="rh-actas-f-empleado" class="mb-1 block text-xs font-medium text-[#667085]">Empleado</label>
          <div class="relative">
            <span class="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-slate-400">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m14 14 3 3m-1.5-8A6.5 6.5 0 1 1 2.5 9a6.5 6.5 0 0 1 13 0Z" /></svg>
            </span>
            <input
              id="rh-actas-f-empleado"
              type="search"
              value="${escapeHtml(filters.empleado_busqueda)}"
              placeholder="Buscar por nombre o número de empleado"
              data-rh-actas-empleado-busqueda
              autocomplete="off"
              class="w-full rounded-[10px] border border-[#e5e7eb] bg-white py-2 pr-3 pl-9 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
            />
          </div>
        </div>
        <div class="min-w-0">
          ${renderSelectFilter("rh-actas-f-sup", "Supervisor", "supervisor", filters.supervisor_id, ACTAS_SUPERVISORES, "Todos los supervisores")}
        </div>
        <div class="min-w-0">
          ${renderSelectFilter("rh-actas-f-tipo", "Tipo", "tipo", filters.tipo, ACTAS_TIPOS, "Todos los tipos")}
        </div>
        <div class="min-w-0">
          ${renderSelectFilter("rh-actas-f-estado", "Estado", "estado", filters.estado, ACTAS_ESTADOS, "Todos los estados")}
        </div>
        <div class="min-w-0">
          ${renderSelectFilter("rh-actas-f-periodo", "Periodo", "periodo", filters.periodo, ACTAS_PERIODOS, "Últimos 30 días")}
        </div>
      </div>
    </section>`;
}

function renderActasEmptyState(filters: ActasFilterState): string {
  const showClear = hasActiveFilters(filters);
  return `
    <section class="rounded-2xl border border-[#e5e7eb] bg-white p-8 text-center shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <div class="mx-auto inline-flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 15.75 4.5 4.5M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" /></svg>
      </div>
      <h3 class="mt-4 text-lg font-semibold text-[#111827]">No se encontraron actas</h3>
      <p class="mt-2 text-sm text-[#667085]">Intenta ajustar los filtros o crea una nueva acta administrativa.</p>
      <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
        ${showClear ? `<button type="button" data-rh-actas-clear-filters class="${RH_LISTADO_BTN_GHOST}">Limpiar filtros</button>` : ""}
        <button type="button" id="rh-actas-nueva-empty" class="${RH_LISTADO_BTN_PRIMARY}">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z" /></svg>
          Nueva acta administrativa
        </button>
      </div>
    </section>`;
}

function renderActasTable(table: ActasTableData, filters: ActasFilterState, loading: boolean): string {
  if (loading) {
    return `
      <section class="animate-pulse rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-busy="true">
        <div class="h-5 w-40 rounded bg-slate-200"></div>
        <div class="mt-2 h-4 w-28 rounded bg-slate-100"></div>
        <div class="mt-4 space-y-2">
          <div class="h-10 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
          <div class="h-12 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  if (table.total === 0) return renderActasEmptyState(filters);

  const rows = table.items
    .map(
      (row) => `
      <tr
        class="cursor-pointer transition-colors hover:bg-slate-50 focus-within:bg-slate-50"
        tabindex="0"
        role="button"
        data-rh-actas-row="1"
        data-rh-actas-id="${row.id}"
      >
        <td class="px-3 py-3.5 align-middle sm:px-4">${celdaEmpleado(row)}</td>
        <td class="whitespace-nowrap px-3 py-3.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">
          <a
            href="#/actas/${row.id}"
            data-rh-actas-open="${row.id}"
            class="rounded text-[#1e40af] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2"
          >${escapeHtml(row.folio)}</a>
        </td>
        <td class="max-w-40 px-3 py-3.5 align-middle text-sm text-slate-700 sm:px-4"><span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span></td>
        <td class="px-3 py-3.5 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
        <td class="whitespace-nowrap px-3 py-3.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha))}</td>
        <td class="px-3 py-3.5 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
        <td class="max-w-48 px-3 py-3.5 align-middle text-sm text-slate-600 sm:px-4"><span class="block truncate" title="${escapeHtml(row.supervisor_nombre)}">${escapeHtml(row.supervisor_nombre)}</span></td>
        <td class="whitespace-nowrap px-3 py-3.5 align-middle sm:px-4">
          <div class="flex items-center gap-1">
            <a
              href="#/actas/${row.id}"
              data-rh-actas-action="view"
              class="rounded-md px-2 py-1 text-xs font-semibold text-[#1e40af] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/30"
            >Ver detalle</a>
            <a
              href="#/actas/${row.id}"
              data-rh-actas-action="edit"
              class="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >Editar</a>
            <button
              type="button"
              data-rh-actas-action="pdf"
              data-rh-actas-download="${row.id}"
              aria-label="Descargar PDF del acta ${escapeHtml(row.folio)}"
              class="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >PDF</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");

  const th = (
    label: string,
    sortable = false,
    edge: "first" | "last" | "none" = "none",
  ) =>
    `<th scope="col" class="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-3 py-3 text-left text-[13px] font-semibold text-slate-700 sm:px-4 ${
      edge === "first" ? "rounded-tl-2xl" : edge === "last" ? "rounded-tr-2xl" : ""
    }">
      <span class="inline-flex items-center gap-1">
        ${escapeHtml(label)}
        ${
          sortable
            ? `<svg viewBox="0 0 20 20" fill="currentColor" class="size-3.5 text-slate-300" aria-hidden="true"><path d="M10 4.5 7.25 7.25h5.5L10 4.5Zm0 11 2.75-2.75h-5.5L10 15.5Z" /></svg>`
            : ""
        }
      </span>
    </th>`;

  const totalPages = Math.max(1, Math.ceil(table.total / table.page_size) || 1);
  const from = table.total === 0 ? 0 : (table.page - 1) * table.page_size + 1;
  const to = Math.min(table.page * table.page_size, table.total);
  const pageButtons = paginationRange(totalPages, table.page)
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
      }
      const active = x === table.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-rh-actas-page="${x}" class="${cls}">${x}</button>`;
    })
    .join("");
  const pageSizeOpts = [5, 10, 25, 50]
    .map((n) => `<option value="${n}" ${n === table.page_size ? "selected" : ""}>${n}</option>`)
    .join("");

  const visibleRowCount = table.items.length;
  const { sectionLayoutCls, bodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(visibleRowCount),
  );

  const mobileCards = table.items
    .map(
      (row) => `
      <article
        class="rounded-xl border border-[#e5e7eb] bg-white p-3 shadow-sm transition hover:border-slate-300"
        data-rh-actas-row="1"
        data-rh-actas-id="${row.id}"
        role="button"
        tabindex="0"
      >
        <div class="flex items-start justify-between gap-2">
          ${celdaEmpleado(row)}
          ${badgeEstado(row.estado)}
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#667085]">
          <div><dt>Folio</dt><dd class="mt-0.5 text-sm font-semibold text-[#111827]">${escapeHtml(row.folio)}</dd></div>
          <div><dt>Fecha</dt><dd class="mt-0.5 text-sm font-semibold text-[#111827]">${escapeHtml(fmtFechaCorta(row.fecha))}</dd></div>
          <div><dt>Área</dt><dd class="mt-0.5 truncate text-sm text-[#111827]" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</dd></div>
          <div><dt>Supervisor</dt><dd class="mt-0.5 truncate text-sm text-[#111827]" title="${escapeHtml(row.supervisor_nombre)}">${escapeHtml(row.supervisor_nombre)}</dd></div>
        </dl>
        <div class="mt-3 flex items-center gap-1">
          <a href="#/actas/${row.id}" data-rh-actas-action="view" class="rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900">Ver detalle</a>
          <a href="#/actas/${row.id}" data-rh-actas-action="edit" class="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">Editar</a>
          <button type="button" data-rh-actas-action="pdf" data-rh-actas-download="${row.id}" class="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">PDF</button>
        </div>
      </article>`,
    )
    .join("");

  return `
    <section class="${sectionLayoutCls} gap-3 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]" aria-label="Tabla de actas">
      <div class="space-y-2 md:hidden">
        ${mobileCards}
      </div>
      <div class="hidden overflow-hidden rounded-t-2xl md:block ${bodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[1080px] w-full border-separate border-spacing-0 text-left">
          <thead class="bg-slate-50">
            <tr>
              ${th("Empleado", true, "first")}
              ${th("Folio", true)}
              ${th("Área")}
              ${th("Tipo")}
              ${th("Fecha", true)}
              ${th("Estado", true)}
              ${th("Supervisor")}
              ${th("Acciones", false, "last")}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">${rows}</tbody>
        </table>
      </div>
      <div class="flex shrink-0 flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">Mostrando ${from}-${to} de ${table.total} actas</p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="rh-actas-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="rh-actas-page-size" data-rh-actas-page-size class="rounded-[10px] border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm focus:border-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-start gap-1 sm:justify-end">
          <button type="button" data-rh-actas-page="${table.page - 1}" ${table.page <= 1 ? "disabled" : ""} class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-actas-page="${table.page + 1}" ${table.page >= totalPages ? "disabled" : ""} class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>
    </section>`;
}

function renderActasMain(
  filters: ActasFilterState,
  table: ActasTableData,
  allRows: readonly ActaTablaFila[],
  loading: boolean,
): string {
  const listadoHeading = loading
    ? ""
    : `<section class="mb-3">
        <h2 class="text-lg font-semibold text-slate-900">Listado de actas</h2>
        <p class="text-sm text-slate-500">${table.total} actas encontradas</p>
      </section>`;

  return `
    <div class="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col gap-5 bg-[#f6f8fb] px-2 pb-2 sm:gap-6 sm:px-3">
      <section class="rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div class="min-w-0">
            <h1 class="text-[28px] font-semibold leading-tight tracking-tight text-[#111827]">Actas disciplinarias</h1>
            <p class="mt-1 min-w-0 max-w-2xl text-sm leading-snug text-[#667085]">
            ${escapeHtml("Registro y seguimiento de actas disciplinarias del personal.")}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center justify-start gap-2 md:justify-end">
            <button
              type="button"
              id="rh-actas-export"
              class="${RH_LISTADO_BTN_SECONDARY}"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar actas
            </button>
            <button
              type="button"
              id="rh-actas-nueva"
              class="${RH_LISTADO_BTN_PRIMARY}"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z" /></svg>
              Nueva acta administrativa
            </button>
          </div>
        </div>
      </section>
      ${renderStatsCards(allRows, filters, loading)}
      ${renderActasFilters(filters, loading)}
      <div>
        ${listadoHeading}
        ${renderActasTable(table, filters, loading)}
      </div>
    </div>`;
}

export function mountActas(container: HTMLElement): void {
  const actasMainClass = "py-5 sm:py-6";

  if (getRolFromAccessToken() !== "rh") {
    mountAppShell(container, {
      pageTitle: "Actas",
      activeNav: "actas",
      mainClass: actasMainClass,
      mainHtml: forbiddenHtml(),
    });
    return;
  }

  const state: ActasFilterState = { ...DEFAULT_FILTERS };
  const allRows: ActaTablaFila[] = [];
  let isLoading = true;
  const modalEmpleadoOptions: NuevaActaEmpleadoOption[] = [];
  let empleadoBusquedaDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let empleadosModalLoadingPromise: Promise<void> | null = null;

  function setModalEmpleadoOptions(next: readonly NuevaActaEmpleadoOption[]): void {
    modalEmpleadoOptions.splice(0, modalEmpleadoOptions.length, ...next);
  }

  async function ensureModalEmpleadoOptionsLoaded(): Promise<void> {
    if (empleadosModalLoadingPromise) {
      await empleadosModalLoadingPromise;
      return;
    }
    empleadosModalLoadingPromise = (async () => {
      const dedup = new Map<string, NuevaActaEmpleadoOption>();
      for (const item of modalEmpleadoOptions) dedup.set(item.id, item);
      let page = 1;
      const pageSize = 100;
      while (true) {
        const pg = await getEmpleadosPage({ page, page_size: pageSize, activo: true });
        for (const item of pg.items) {
          const mapped = mapUsuarioToNuevaActaEmpleado(item);
          dedup.set(mapped.id, mapped);
        }
        const loaded = pg.page * pg.page_size;
        if (loaded >= pg.total || pg.items.length === 0) break;
        page += 1;
      }
      setModalEmpleadoOptions(Array.from(dedup.values()));
    })();
    try {
      await empleadosModalLoadingPromise;
    } finally {
      empleadosModalLoadingPromise = null;
    }
  }

  function tableFromState(): ActasTableData {
    const filtered = filterActasRows(allRows, state);
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.page_size) || 1);
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    return paginateActas(filtered, state);
  }

  const initialTable = tableFromState();
  mountAppShell(container, {
    pageTitle: "Actas",
    activeNav: "actas",
    mainClass: actasMainClass,
    mainHtml: `<div id="rh-actas-page" class="flex min-h-[calc(100dvh-11rem)] flex-col">
      <div id="rh-actas-inner" class="flex min-h-0 flex-1 flex-col">${renderActasMain(state, initialTable, allRows, isLoading)}</div>
      <div id="rh-actas-nueva-modal-host" class="shrink-0"></div>
    </div>`,
  });

  const nuevaActaModalHost = container.querySelector("#rh-actas-nueva-modal-host");
  const nuevaActaModal =
    nuevaActaModalHost instanceof HTMLElement
      ? mountNuevaActaModal(nuevaActaModalHost, {
          empleados: modalEmpleadoOptions,
          responsablesRh: ACTAS_RESPONSABLES_RH,
          toastContainer: container,
          onSubmit: async (payload: NuevaActaSubmitPayload) => {
            const empleado = modalEmpleadoOptions.find((item) => item.id === payload.formData.empleadoId);
            if (!empleado) throw new Error("Empleado no encontrado.");
            const supervisorId =
              ACTAS_SUPERVISORES.find((sup) => sup.label === payload.formData.supervisorDirecto)?.id ??
              ACTAS_SUPERVISORES[0]?.id ??
              "sup-1";

            const empleadoId = Number.parseInt(payload.formData.empleadoId, 10);
            if (!Number.isFinite(empleadoId)) {
              throw new Error("El ID del empleado no es valido.");
            }

            const evidencia =
              payload.formData.evidencias.length > 0
                ? payload.formData.evidencias.map((file) => file.name).join(", ")
                : null;

            const created = await createActaAdministrativa({
              empleado_id: empleadoId,
              numero_empleado: payload.formData.numeroEmpleado,
              area_departamento: payload.formData.areaDepartamento,
              supervisor_directo: payload.formData.supervisorDirecto,
              tipo_falta: payload.formData.tipoFalta,
              fundamento_legal: payload.formData.fundamentoLegal as
                | "Ley Federal del Trabajo"
                | "Reglamento Interior de Trabajo",
              articulo_inciso: payload.formData.articuloInciso.trim() || null,
              fecha_evento: payload.formData.fechaEvento,
              lugar_incidente: payload.formData.lugarIncidente,
              descripcion_hechos: payload.formData.descripcionHechos,
              personas_involucradas: payload.formData.personasInvolucradas.trim() || null,
              testigos: payload.formData.testigos.trim() || null,
              responsable_rh: payload.formData.responsableRhId,
              evidencia,
            });

            allRows.unshift({
              id: created.id,
              folio: createFolioFromId(created.id),
              empleado_id: empleado.id,
              empleado_nombre_raw: empleado.nombre,
              foto_url: null,
              area: created.area_departamento ?? payload.formData.areaDepartamento,
              supervisor_id: supervisorId,
              supervisor_nombre: created.supervisor_directo ?? payload.formData.supervisorDirecto,
              tipo: mapModalTipoToTableTipo(created.tipo_falta ?? payload.formData.tipoFalta),
              fecha: created.fecha_evento ?? payload.formData.fechaEvento,
              estado: "abierta",
            });
            state.page = 1;
            paint();
          },
        })
      : null;

  void ensureModalEmpleadoOptionsLoaded().catch((error: unknown) => {
    if (isUsuariosFetchError(error) && error.status === 401) return;
    showEmpleadosToast(container, "No se pudo cargar la lista de empleados activos.", "error");
  });

  async function loadActasFromBackend(): Promise<void> {
    const items: ActaListItem[] = [];
    let cursor: number | null = null;
    while (true) {
      const page = await getActasPage({ cursor, limit: 200 });
      items.push(...page.items);
      if (page.next_cursor == null) break;
      cursor = page.next_cursor;
    }
    allRows.splice(0, allRows.length, ...items.map(mapActaListItemToRow));
    state.page = 1;
    isLoading = false;
    paint();
  }

  function paint(): void {
    const inner = container.querySelector("#rh-actas-inner");
    const active = document.activeElement;
    let restoreSearch: { start: number; end: number; dir: "forward" | "backward" | "none" } | null = null;
    if (active instanceof HTMLInputElement && active.matches("[data-rh-actas-empleado-busqueda]")) {
      restoreSearch = {
        start: active.selectionStart ?? active.value.length,
        end: active.selectionEnd ?? active.value.length,
        dir:
          active.selectionDirection === "backward"
            ? "backward"
            : active.selectionDirection === "none"
              ? "none"
              : "forward",
      };
    }
    const table = tableFromState();
    if (inner) inner.innerHTML = renderActasMain(state, table, allRows, isLoading);
    if (restoreSearch) {
      const el = container.querySelector<HTMLInputElement>("[data-rh-actas-empleado-busqueda]");
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(restoreSearch.start, restoreSearch.end, restoreSearch.dir);
        } catch {
          /* noop */
        }
      }
    }
  }

  const pageRoot = container.querySelector("#rh-actas-page");
  pageRoot?.addEventListener("input", (event) => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>(
      "[data-rh-actas-empleado-busqueda]",
    );
    if (!input) return;
    state.empleado_busqueda = input.value;
    state.page = 1;
    if (empleadoBusquedaDebounceTimer != null) window.clearTimeout(empleadoBusquedaDebounceTimer);
    empleadoBusquedaDebounceTimer = window.setTimeout(() => {
      empleadoBusquedaDebounceTimer = null;
      paint();
    }, 200);
  });

  pageRoot?.addEventListener("change", (event) => {
    const select = (event.target as HTMLElement).closest<HTMLSelectElement>("[data-rh-actas-filter]");
    if (select) {
      const field = select.getAttribute("data-rh-actas-filter");
      const value = select.value;
      state.page = 1;
      if (field === "supervisor") state.supervisor_id = value;
      else if (field === "tipo") state.tipo = value === "" ? "" : (value as ActaTipoCodigo);
      else if (field === "estado") state.estado = value === "" ? "" : (value as ActaEstadoCodigo);
      else if (field === "periodo")
        state.periodo = value === "30d" || value === "90d" || value === "365d" || value === "all" ? value : "30d";
      paint();
      return;
    }

    const pageSizeSelect = (event.target as HTMLElement).closest<HTMLSelectElement>(
      "[data-rh-actas-page-size]",
    );
    if (pageSizeSelect) {
      const size = Number.parseInt(pageSizeSelect.value, 10);
      state.page_size = Number.isFinite(size) && size > 0 ? size : 10;
      state.page = 1;
      paint();
    }
  });

  pageRoot?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const actionBtn = target.closest<HTMLElement>("[data-rh-actas-action]");
    if (actionBtn) {
      if (actionBtn.getAttribute("data-rh-actas-action") === "pdf") {
        showEmpleadosToast(container, "Descarga PDF disponible desde el detalle del acta.", "success");
      }
      return;
    }

    const metric = target.closest<HTMLButtonElement>("[data-rh-actas-metric]");
    if (metric) {
      const value = metric.getAttribute("data-rh-actas-metric");
      if (value === "abierta" || value === "en_proceso" || value === "firmada" || value === "cerrada") {
        state.estado = state.estado === value ? "" : value;
        state.page = 1;
        paint();
      }
      return;
    }

    const openLink = target.closest<HTMLAnchorElement>("[data-rh-actas-open]");
    if (openLink) {
      return;
    }
    const row = target.closest<HTMLElement>("[data-rh-actas-row]");
    if (row) {
      const raw = row.getAttribute("data-rh-actas-id");
      const id = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(id)) {
        window.location.hash = `#/actas/${id}`;
      }
      return;
    }
    if (target.closest("#rh-actas-nueva") || target.closest("#rh-actas-nueva-empty")) {
      try {
        await ensureModalEmpleadoOptionsLoaded();
      } catch (error: unknown) {
        const msg =
          isUsuariosFetchError(error) && error.status === 401
            ? "Tu sesión expiró. Inicia sesión nuevamente."
            : "No se pudo cargar la lista de empleados activos.";
        showEmpleadosToast(container, msg, "error");
        return;
      }
      nuevaActaModal?.open();
      return;
    }
    if (target.closest("[data-rh-actas-clear-filters]")) {
      state.empleado_busqueda = "";
      state.supervisor_id = "";
      state.tipo = "";
      state.estado = "";
      state.periodo = "30d";
      state.page = 1;
      paint();
      return;
    }

    const pageBtn = target.closest<HTMLButtonElement>("[data-rh-actas-page]");
    if (pageBtn) {
      const raw = pageBtn.getAttribute("data-rh-actas-page");
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n)) {
        state.page = n;
        paint();
      }
    }
  });

  pageRoot?.addEventListener("keydown", (event: Event) => {
    const ke = event as KeyboardEvent;
    const row = (ke.target as HTMLElement | null)?.closest?.("[data-rh-actas-row]");
    if (!row) return;
    if (ke.key !== "Enter" && ke.key !== " ") return;
    ke.preventDefault();
    const raw = row.getAttribute("data-rh-actas-id");
    const id = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(id)) {
      window.location.hash = `#/actas/${id}`;
    }
  });

  void loadActasFromBackend().catch((error: unknown) => {
    isLoading = false;
    paint();
    const msg =
      typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 401
        ? "Tu sesión expiró. Inicia sesión nuevamente."
        : "No se pudieron cargar las actas guardadas.";
    showEmpleadosToast(container, msg, "error");
  });
}
