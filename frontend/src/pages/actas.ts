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
  FILTER_FIELD_WRAP,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_GHOST,
  badgeOpen,
  badgeInProgress,
  badgeApproved,
  badgeCancelled,
} from "../ui/uiTokens.ts";

type ActasTableData = {
  items: ActaTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

type ActasStatCard = {
  id: string;
  titulo: string;
  valor: number;
  borderTop: string;
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
  return `
    <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
      <p class="font-semibold">Acceso restringido</p>
      <p class="mt-1">La sección de actas administrativas solo está disponible para RH.</p>
      <a href="#/" class="mt-3 inline-block font-semibold text-leoni-blue hover:underline">Volver al dashboard</a>
    </div>`;
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
    return `<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">${text}</span>`;
  }
  if (tipo === "administrativa") {
    return `<span class="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900">${text}</span>`;
  }
  return `<span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">${text}</span>`;
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

function buildNuevaActaEmpleados(rows: readonly ActaTablaFila[]): NuevaActaEmpleadoOption[] {
  const dedup = new Map<string, NuevaActaEmpleadoOption>();
  for (const row of rows) {
    if (dedup.has(row.empleado_id)) continue;
    dedup.set(row.empleado_id, {
      id: row.empleado_id,
      nombre: formatNombreEmpleadoUi(row.empleado_nombre_raw) || row.empleado_nombre_raw || row.empleado_id,
      numeroEmpleado: row.empleado_id,
      areaDepartamento: row.area,
      supervisorDirecto: row.supervisor_nombre,
    });
  }
  return Array.from(dedup.values());
}

function mapUsuarioToNuevaActaEmpleado(item: UsuarioListItem): NuevaActaEmpleadoOption {
  const empleadoId = String(item.empleado_id);
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
  const numeroEmpleado = item.numero_empleado?.trim() || String(item.empleado_id);
  const supervisor = item.supervisor_directo?.trim() || "Sin supervisor";
  return {
    id: item.id,
    folio: createFolioFromId(item.id),
    empleado_id: numeroEmpleado,
    empleado_nombre_raw: `Empleado ${numeroEmpleado}`,
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

function renderStatsCards(rows: readonly ActaTablaFila[]): string {
  const cardsData: readonly ActasStatCard[] = [
    {
      id: "abiertas",
      titulo: "Actas abiertas",
      valor: rows.filter((row) => row.estado === "abierta").length,
      borderTop: "border-t-blue-600",
    },
    {
      id: "proceso",
      titulo: "En proceso",
      valor: rows.filter((row) => row.estado === "en_proceso").length,
      borderTop: "border-t-amber-500",
    },
    {
      id: "firmadas",
      titulo: "Firmadas",
      valor: rows.filter((row) => row.estado === "firmada").length,
      borderTop: "border-t-emerald-500",
    },
    {
      id: "cerradas",
      titulo: "Cerradas",
      valor: rows.filter((row) => row.estado === "cerrada").length,
      borderTop: "border-t-slate-500",
    },
  ];
  const cards = cardsData.map(
    (card) => `
      <article class="rounded-xl border border-border border-t-4 ${card.borderTop} bg-white p-3 shadow-sm sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <h2 class="min-w-0 text-xs font-medium text-text-muted sm:text-sm">${escapeHtml(card.titulo)}</h2>
          <p class="shrink-0 text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">${escapeHtml(String(card.valor))}</p>
        </div>
      </article>`,
  ).join("");
  return `<section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${cards}</section>`;
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
    <label for="${id}" class="mb-1 block text-xs font-medium text-gray-800">${escapeHtml(label)}</label>
    <div class="grid grid-cols-1">
      <select
        id="${id}"
        data-rh-actas-filter="${field}"
        class="col-start-1 row-start-1 w-full appearance-none rounded-md border border-slate-300 bg-white py-1.5 pr-8 pl-2.5 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
      >
        ${optionsHtml}
      </select>
      ${SELECT_CHEVRON}
    </div>
  </div>`;
}

function renderActasFilters(filters: ActasFilterState): string {
  const clearBtn = hasActiveFilters(filters)
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
      <button
        type="button"
        data-rh-actas-clear-filters
        class="${BTN_GHOST} w-full sm:w-auto"
      >
        Limpiar filtros
      </button>
    </div>`
    : "";

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-label="Filtros de actas">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        <div class="${FILTER_FIELD_WRAP}">
          <label for="rh-actas-f-empleado" class="mb-1 block text-xs font-medium text-gray-800">Empleado</label>
          <input
            id="rh-actas-f-empleado"
            type="search"
            value="${escapeHtml(filters.empleado_busqueda)}"
            placeholder="Buscar empleado..."
            data-rh-actas-empleado-busqueda
            autocomplete="off"
            class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}"
          />
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          ${renderSelectFilter("rh-actas-f-sup", "Supervisor", "supervisor", filters.supervisor_id, ACTAS_SUPERVISORES, "Cualquier supervisor")}
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          ${renderSelectFilter("rh-actas-f-tipo", "Tipo", "tipo", filters.tipo, ACTAS_TIPOS, "Todos los tipos")}
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          ${renderSelectFilter("rh-actas-f-estado", "Estado", "estado", filters.estado, ACTAS_ESTADOS, "Cualquier estado")}
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          ${renderSelectFilter("rh-actas-f-periodo", "Periodo", "periodo", filters.periodo, ACTAS_PERIODOS, "Periodo")}
        </div>
        ${clearBtn}
      </div>
    </section>`;
}

function renderActasTable(table: ActasTableData, filters: ActasFilterState): string {
  const emptyHint =
    filters.empleado_busqueda.trim() ?
      `<span class="mt-2 block text-xs text-slate-400">Intenta limpiar la búsqueda o cambiar filtros.</span>`
    : "";
  const rows =
    table.items.length === 0
      ? `<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-slate-500 sm:px-4">Sin actas para los filtros seleccionados.${emptyHint}</td></tr>`
      : table.items
          .map(
            (row) => `
      <tr
        class="cursor-pointer transition-colors hover:bg-slate-100/90 focus-within:bg-slate-50/90"
        tabindex="0"
        role="button"
        data-rh-actas-row="1"
        data-rh-actas-id="${row.id}"
      >
        <td class="px-3 py-2.5 align-middle sm:px-4">${celdaEmpleado(row)}</td>
        <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">
          <a
            href="#/actas/${row.id}"
            data-rh-actas-open="${row.id}"
            class="rounded text-leoni-blue underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          >${escapeHtml(row.folio)}</a>
        </td>
        <td class="max-w-40 px-3 py-2.5 align-middle text-sm text-slate-700 sm:px-4"><span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span></td>
        <td class="px-3 py-2.5 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
        <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha))}</td>
        <td class="px-3 py-2.5 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
        <td class="px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(row.supervisor_nombre)}</td>
      </tr>`,
          )
          .join("");

  const th = (label: string) =>
    `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold text-white sm:px-4 sm:text-sm">${escapeHtml(label)}</th>`;

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
        ? "min-h-8 min-w-8 rounded-lg bg-leoni-blue px-2 text-xs font-bold text-white shadow-sm transition hover:bg-leoni-blue-light sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
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

  return `
    <section class="${sectionLayoutCls} rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Tabla de actas">
      <div class="${bodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[960px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr>
              ${th("Empleado")}
              ${th("Folio")}
              ${th("Área")}
              ${th("Tipo")}
              ${th("Fecha")}
              ${th("Estado")}
              ${th("Supervisor")}
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">Mostrando ${from}-${to} de ${table.total} actas</p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="rh-actas-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="rh-actas-page-size" data-rh-actas-page-size class="rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm focus:border-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-actas-page="${table.page - 1}" ${table.page <= 1 ? "disabled" : ""} class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-actas-page="${table.page + 1}" ${table.page >= totalPages ? "disabled" : ""} class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
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
): string {
  return `
    <div class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
      <section class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="min-w-0 max-w-2xl text-xs leading-snug text-text-muted sm:max-w-none sm:text-sm">
            ${escapeHtml("Registro y seguimiento de actas disciplinarias del personal.")}
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">
          <button
            type="button"
            id="rh-actas-export"
            class="${BTN_SECONDARY}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar actas
          </button>
          <button
            type="button"
            id="rh-actas-nueva"
            class="${BTN_PRIMARY}"
          >
            <span aria-hidden="true">+</span> Nueva acta administrativa
          </button>
        </div>
      </section>
      ${renderStatsCards(allRows)}
      ${renderActasFilters(filters)}
      ${renderActasTable(table, filters)}
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
  const modalEmpleadoOptions: NuevaActaEmpleadoOption[] = buildNuevaActaEmpleados(allRows);
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
      <div id="rh-actas-inner" class="flex min-h-0 flex-1 flex-col">${renderActasMain(state, initialTable, allRows)}</div>
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
    if (inner) inner.innerHTML = renderActasMain(state, table, allRows);
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
    const openLink = target.closest<HTMLAnchorElement>("[data-rh-actas-open]");
    if (openLink) {
      return;
    }
    const row = target.closest<HTMLTableRowElement>("tr[data-rh-actas-row]");
    if (row) {
      const raw = row.getAttribute("data-rh-actas-id");
      const id = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(id)) {
        window.location.hash = `#/actas/${id}`;
      }
      return;
    }
    if (target.closest("#rh-actas-nueva")) {
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
    const row = (ke.target as HTMLElement | null)?.closest?.("tr[data-rh-actas-row]");
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
    const msg =
      typeof error === "object" && error !== null && "status" in error && (error as { status?: number }).status === 401
        ? "Tu sesión expiró. Inicia sesión nuevamente."
        : "No se pudieron cargar las actas guardadas.";
    showEmpleadosToast(container, msg, "error");
  });
}
