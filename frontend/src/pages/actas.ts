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
  FILTER_FIELD_WRAP,
  SELECT_CHEVRON,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";

/** Misma cabecera de tabla que Solicitudes (`.rh-sol-th` + estilos en style.css). */
const ACTAS_TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-3 text-left text-[13px] font-semibold tracking-tight text-[#334155] sm:px-4";

/** Input de filtro alineado a Solicitudes. */
const ACTAS_FILTER_CONTROL =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

/** Botón icono acciones (mismo patrón que columna Acciones en Solicitudes). */
const ACTAS_ACT_ICON_BTN =
  "rh-sol-act-btn inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(148,163,184,0.35)] bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.45)] hover:text-[#002147] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2";

type ActasTableData = {
  items: ActaTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

type ActasKpiMetricId = "todas" | ActaEstadoCodigo;

type ActasStatCard = {
  id: ActasKpiMetricId;
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

function dot(cls: string): string {
  return `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
}

/** Badges tipo acta: píldora + punto (gradientes en style.css, mismo lenguaje que Solicitudes). */
function badgeTipo(tipo: ActaTipoCodigo): string {
  const base =
    "rh-sol-badge-acta-tipo inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  const text = escapeHtml(labelTipo(tipo));
  if (tipo === "suspension") {
    return `<span class="${base} rh-sol-badge-acta-tipo--susp">${dot("bg-red-400")}${text}</span>`;
  }
  if (tipo === "administrativa") {
    return `<span class="${base} rh-sol-badge-acta-tipo--admin">${dot("bg-blue-500")}${text}</span>`;
  }
  return `<span class="${base} rh-sol-badge-acta-tipo--amon">${dot("bg-amber-500")}${text}</span>`;
}

/** Estados homologados a clases `rh-sol-badge-estado--*` usadas en Solicitudes. */
function badgeEstado(estado: ActaEstadoCodigo): string {
  const base =
    "rh-sol-badge-estado inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (estado) {
    case "abierta":
      return `<span class="${base} rh-sol-badge-estado--changes">${dot("bg-sky-500")}Abierta</span>`;
    case "en_proceso":
      return `<span class="${base} rh-sol-badge-estado--pending">${dot("bg-amber-400")}En proceso</span>`;
    case "firmada":
      return `<span class="${base} rh-sol-badge-estado--approved">${dot("bg-emerald-500")}Aprobada</span>`;
    case "anulada":
      return `<span class="${base} rh-sol-badge-estado--cancelled">${dot("bg-slate-400")}Anulada</span>`;
    default:
      return escapeHtml(estado);
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
  estado: ActaListItem["estado"],
): ActaEstadoCodigo {
  if (estado === "cancelled") return "anulada";
  if (estado === "pending_sign" || estado === "draft") return "en_proceso";
  if (estado === "signed" || estado === "archived") return "firmada";
  return "en_proceso";
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
  const ini = inicialesDesdeNombreDisplay(name);
  const foto = row.foto_url?.trim();
  const fallback = `<span class="rh-sol-avatar-fallback flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" title="${escapeHtml(name)}">${escapeHtml(ini)}</span>`;
  const avatar = foto
    ? `<span class="relative shrink-0">
        <img src="${escapeHtml(foto)}" alt="" width="40" height="40" decoding="async" loading="lazy" class="rh-sol-avatar-img size-10 rounded-full object-cover ring-1 ring-[rgba(148,163,184,0.35)]" />
      </span>`
    : fallback;
  return `
    <div class="rh-sol-empleado-celda flex min-w-0 items-center gap-3">
      ${avatar}
      <div class="min-w-0">
        <p class="text-sm font-semibold leading-snug text-[#0f172a]">${escapeHtml(name)}</p>
        <p class="mt-0.5 truncate text-xs tabular-nums text-[#64748b]">${escapeHtml(row.empleado_id)}</p>
      </div>
    </div>`;
}

function renderActasHeaderMeta(allRows: readonly ActaTablaFila[], loading: boolean): string {
  if (loading) return "";
  const total = allRows.length;
  const enProceso = allRows.filter((r) => r.estado === "en_proceso").length;
  return `<div class="rh-sol-header__stats mt-3 flex flex-wrap items-center gap-2" role="status" aria-live="polite">
    <span class="rh-sol-header__badge rh-sol-header__badge--total"><span class="tabular-nums">${escapeHtml(String(total))}</span><span class="rh-sol-header__badge-text">actas</span></span>
    <span class="rh-sol-header__badge rh-sol-header__badge--acta-abiertas"><span class="tabular-nums">${escapeHtml(String(enProceso))}</span><span class="rh-sol-header__badge-text">en proceso</span></span>
  </div>`;
}

function iconActaVer(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
}

function renderActasAccionesCelda(row: ActaTablaFila): string {
  const b = ACTAS_ACT_ICON_BTN;
  const folioEsc = escapeHtml(row.folio);
  return `<div class="rh-sol-actions flex flex-wrap items-center justify-end gap-1">
    <a href="#/actas/${row.id}" data-rh-actas-open="${row.id}" class="${b}" title="Ver detalle" aria-label="Ver detalle del acta ${folioEsc}">${iconActaVer()}</a>
  </div>`;
}

function renderStatsCards(rows: readonly ActaTablaFila[], filters: ActasFilterState, loading: boolean): string {
  if (loading) {
    const skel = `
      <div class="rh-sol-kpi-skel animate-pulse rounded-[14px] border border-[rgba(148,163,184,0.2)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-24 rounded-md bg-slate-200/90"></div>
          <div class="h-9 w-16 rounded-md bg-slate-200/90"></div>
        </div>
        <div class="mt-3 h-8 w-20 rounded-md bg-slate-100/90"></div>
      </div>`;
    return `<section class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4" aria-busy="true">${skel.repeat(4)}</section>`;
  }

  const iconReloj = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
  const iconProceso = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>`;
  const iconCheck = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
  const iconArchivo = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`;

  const cardsData: readonly ActasStatCard[] = [
    {
      id: "todas",
      titulo: "Todas las actas",
      microcopy: "Registros en el listado",
      valor: rows.length,
      toneClass: "rh-sol-kpi-card--inc-abiertas",
      icon: iconReloj,
    },
    {
      id: "en_proceso",
      titulo: "En proceso",
      microcopy: "Pendientes de seguimiento",
      valor: rows.filter((row) => row.estado === "en_proceso").length,
      toneClass: "rh-sol-kpi-card--inc-investigacion",
      icon: iconProceso,
    },
    {
      id: "firmada",
      titulo: "Aprobadas",
      microcopy: "Aprobación RH",
      valor: rows.filter((row) => row.estado === "firmada").length,
      toneClass: "rh-sol-kpi-card--aprobadas",
      icon: iconCheck,
    },
    {
      id: "anulada",
      titulo: "Anuladas",
      microcopy: "Canceladas",
      valor: rows.filter((row) => row.estado === "anulada").length,
      toneClass: "rh-sol-kpi-card--acta-cerrada",
      icon: iconArchivo,
    },
  ];

  const cards = cardsData
    .map((card) => {
      const selected = card.id === "todas" ? filters.estado === "" : filters.estado === card.id;
      const ring = selected ? " ring-2 ring-[#1e40af]/35 ring-offset-2" : "";
      return `
      <button
        type="button"
        data-rh-actas-metric="${card.id}"
        aria-pressed="${selected ? "true" : "false"}"
        aria-label="Filtrar actas por estado ${escapeHtml(card.titulo)}"
        class="rh-sol-kpi-card ${card.toneClass} w-full rounded-[14px] border p-4 text-left sm:p-5${ring}"
      >
        <div class="flex items-center gap-3 sm:gap-3.5">
          <div class="rh-sol-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_rgba(15,23,42,0.06)]" aria-hidden="true">${card.icon}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">${escapeHtml(card.titulo)}</p>
                <p class="mt-0.5 text-xs leading-snug text-[#64748b]">${escapeHtml(card.microcopy)}</p>
              </div>
              <p class="rh-sol-kpi-card__value shrink-0 text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl">${escapeHtml(String(card.valor))}</p>
            </div>
          </div>
        </div>
      </button>`;
    })
    .join("");

  return `<section class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${cards}</section>`;
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
    <label for="${id}" class="${RH_LISTADO_LABEL}">${escapeHtml(label)}</label>
    <div class="grid grid-cols-1">
      <select
        id="${id}"
        data-rh-actas-filter="${field}"
        class="${RH_LISTADO_SELECT} rh-sol-filter-select col-start-1 row-start-1 min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 pr-8 pl-3 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${FIELD_FOCUS}"
      >
        ${optionsHtml}
      </select>
      ${SELECT_CHEVRON}
    </div>
  </div>`;
}

function renderActasFilters(filters: ActasFilterState, loading: boolean, filteredTotal: number | null): string {
  if (loading) {
    const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-24 max-w-full rounded bg-slate-200"></div>
      <div class="h-8 w-full rounded-md bg-slate-100"></div>
    </div>`;
    const slots = [1, 2, 3, 4, 5].map(() => `<div class="${FILTER_FIELD_WRAP}">${cell}</div>`).join("");
    return `
      <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-hidden="true" aria-busy="true" aria-label="Cargando filtros">
        <div class="mb-3 h-4 w-40 animate-pulse rounded-md bg-slate-200/80"></div>
        <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
          ${slots}
        </div>
      </section>`;
  }

  const countHtml =
    filteredTotal !== null
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeHtml(String(filteredTotal))}</span> actas</p>`
      : "";

  const clearBtn = hasActiveFilters(filters)
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
      <button type="button" data-rh-actas-clear-filters class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto">
        Limpiar filtros
      </button>
    </div>`
    : "";

  const wrap = FILTER_FIELD_WRAP;
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros de actas">
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Filtros de búsqueda</h2>
        ${countHtml}
      </div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        <div class="${wrap}">
          <div class="min-w-0">
            <label for="rh-actas-f-empleado" class="${RH_LISTADO_LABEL}">Empleado</label>
            <input
              id="rh-actas-f-empleado"
              type="search"
              value="${escapeHtml(filters.empleado_busqueda)}"
              placeholder="Buscar por nombre o número de empleado"
              data-rh-actas-empleado-busqueda
              autocomplete="off"
              enterkeyhint="search"
              class="${ACTAS_FILTER_CONTROL} ${FIELD_FOCUS}"
            />
          </div>
        </div>
        <div class="${wrap}">${renderSelectFilter("rh-actas-f-sup", "Supervisor", "supervisor", filters.supervisor_id, ACTAS_SUPERVISORES, "Todos los supervisores")}</div>
        <div class="${wrap}">${renderSelectFilter("rh-actas-f-tipo", "Tipo", "tipo", filters.tipo, ACTAS_TIPOS, "Todos los tipos")}</div>
        <div class="${wrap}">${renderSelectFilter("rh-actas-f-estado", "Estado", "estado", filters.estado, ACTAS_ESTADOS, "Todos los estados")}</div>
        <div class="${wrap}">${renderSelectFilter("rh-actas-f-periodo", "Periodo", "periodo", filters.periodo, ACTAS_PERIODOS, "Últimos 30 días")}</div>
        ${clearBtn}
      </div>
    </section>`;
}

function renderActasEmptyState(filters: ActasFilterState): string {
  const showClear = hasActiveFilters(filters);
  return `
    <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="Listado de actas">
      <div class="rh-sol-empty px-4 py-12 sm:px-6" role="status">
        <p class="rh-sol-empty__title text-center text-sm font-semibold text-[#0f172a]">No se encontraron actas</p>
        <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">Intenta ajustar los filtros o crea una nueva acta administrativa.</p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          ${showClear ? `<button type="button" data-rh-actas-clear-filters class="${RH_LISTADO_BTN_GHOST}">Limpiar filtros</button>` : ""}
          <button type="button" id="rh-actas-nueva-empty" class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-btn-primary">
            <span aria-hidden="true">+</span> Nueva acta administrativa
          </button>
        </div>
      </div>
    </section>`;
}

function renderActasTable(table: ActasTableData, filters: ActasFilterState, loading: boolean): string {
  if (loading) {
    const skRow = `<tr class="rh-sol-loading-row">${`<td class="px-3 py-3 sm:px-4"><div class="h-4 animate-pulse rounded-md bg-slate-200/80"></div></td>`.repeat(8)}</tr>`;
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="Listado de actas">
        <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
          <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando actas…
        </div>
        <div class="overflow-x-auto px-2 pb-3 sm:px-3">
          <table class="min-w-[1080px] w-full text-left">
            <thead class="rh-sol-thead"><tr>
              ${["Empleado", "Folio", "Área", "Tipo", "Fecha", "Estado", "Supervisor", "Acciones"]
                .map((lab) => `<th scope="col" class="${ACTAS_TABLE_TH}${lab === "Acciones" ? " text-right" : ""}">${escapeHtml(lab)}</th>`)
                .join("")}
            </tr></thead>
            <tbody class="divide-y divide-slate-100/80">${skRow.repeat(4)}</tbody>
          </table>
        </div>
      </section>`;
  }

  if (table.total === 0) return renderActasEmptyState(filters);

  const th = (label: string, alignRight = false) =>
    `<th scope="col" class="${ACTAS_TABLE_TH}${alignRight ? " text-right" : ""}">${escapeHtml(label)}</th>`;

  const rows = table.items
    .map(
      (row) => `
      <tr
        class="rh-sol-data-row rh-sol-data-row--interactive cursor-pointer transition-colors"
        tabindex="0"
        role="button"
        data-rh-actas-row="1"
        data-rh-actas-id="${row.id}"
      >
        <td class="px-3 py-3 align-middle sm:px-4">${celdaEmpleado(row)}</td>
        <td class="whitespace-nowrap px-3 py-3 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">
          <a
            href="#/actas/${row.id}"
            data-rh-actas-open="${row.id}"
            class="rounded font-semibold text-[#1e40af] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2"
          >${escapeHtml(row.folio)}</a>
        </td>
        <td class="max-w-40 px-3 py-3 align-middle text-sm text-slate-700 sm:px-4"><span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span></td>
        <td class="px-3 py-3 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
        <td class="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha))}</td>
        <td class="px-3 py-3 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
        <td class="max-w-48 px-3 py-3 align-middle text-sm text-slate-600 sm:px-4"><span class="block truncate" title="${escapeHtml(row.supervisor_nombre)}">${escapeHtml(row.supervisor_nombre)}</span></td>
        <td class="whitespace-nowrap px-3 py-3 align-middle text-right sm:px-4" data-rh-actas-stop-row-nav="1">${renderActasAccionesCelda(row)}</td>
      </tr>`,
    )
    .join("");

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
        class="${RH_LISTADO_SURFACE} rounded-[14px] p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:border-[rgba(100,116,139,0.35)]"
        data-rh-actas-row="1"
        data-rh-actas-id="${row.id}"
        role="button"
        tabindex="0"
      >
        <div class="flex items-start justify-between gap-2">
          ${celdaEmpleado(row)}
          ${badgeEstado(row.estado)}
        </div>
        <div class="mt-2">${badgeTipo(row.tipo)}</div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#64748b]">
          <div><dt class="font-medium">Folio</dt><dd class="mt-0.5 text-sm font-semibold text-[#0f172a]">${escapeHtml(row.folio)}</dd></div>
          <div><dt class="font-medium">Fecha</dt><dd class="mt-0.5 text-sm font-semibold text-[#0f172a]">${escapeHtml(fmtFechaCorta(row.fecha))}</dd></div>
          <div class="col-span-2"><dt class="font-medium">Área</dt><dd class="mt-0.5 truncate text-sm text-[#0f172a]" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</dd></div>
          <div class="col-span-2"><dt class="font-medium">Supervisor</dt><dd class="mt-0.5 truncate text-sm text-[#0f172a]" title="${escapeHtml(row.supervisor_nombre)}">${escapeHtml(row.supervisor_nombre)}</dd></div>
        </dl>
        <div class="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-3" data-rh-actas-stop-row-nav="1">${renderActasAccionesCelda(row)}</div>
      </article>`,
    )
    .join("");

  const footer = `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${table.total}</span> actas
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="rh-actas-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="rh-actas-page-size" data-rh-actas-page-size class="rh-sol-filter-select min-h-[38px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[rgba(100,116,139,0.45)] sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-actas-page="${table.page - 1}" ${table.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-actas-page="${table.page + 1}" ${table.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;

  return `
    <section class="rh-sol-table-section ${sectionLayoutCls} ${RH_LISTADO_SURFACE}" aria-label="Listado de actas">
      <div class="space-y-3 md:hidden">${mobileCards}</div>
      <div class="hidden md:block ${bodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[1080px] w-full text-left">
          <thead class="rh-sol-thead">
            <tr>
              ${th("Empleado")}
              ${th("Folio")}
              ${th("Área")}
              ${th("Tipo")}
              ${th("Fecha")}
              ${th("Estado")}
              ${th("Supervisor")}
              ${th("Acciones", true)}
            </tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80 bg-white">${rows}</tbody>
        </table>
      </div>
      ${footer}
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
    : `<header class="mb-3 shrink-0">
        <h2 class="text-base font-semibold tracking-tight text-[#0f172a] sm:text-lg">Listado de actas</h2>
        <p class="mt-1 text-xs leading-snug text-[#64748b] sm:text-sm">${escapeHtml(String(table.total))} actas encontradas</p>
      </header>`;

  const filteredTotal = loading ? null : table.total;

  return `
    <div id="rh-actas-root" class="rh-actas-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Actas disciplinarias</h1>
            <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">${escapeHtml("Registro y seguimiento de actas disciplinarias del personal.")}</p>
            ${renderActasHeaderMeta(allRows, loading)}
          </div>
          <div class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-2.5">
            <button
              type="button"
              id="rh-actas-export"
              class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary order-2 w-full sm:w-auto sm:shrink-0 md:order-1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-slate-600" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Exportar actas
            </button>
            <button
              type="button"
              id="rh-actas-nueva"
              class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary order-1 w-full sm:w-auto sm:shrink-0 md:order-2"
            >
              <span aria-hidden="true">+</span> Nueva acta administrativa
            </button>
          </div>
        </div>
      </section>
      <div class="shrink-0">${renderStatsCards(allRows, filters, loading)}</div>
      <div class="shrink-0">${renderActasFilters(filters, loading, filteredTotal)}</div>
      <div class="flex min-h-0 flex-1 flex-col">
        ${listadoHeading}
        ${renderActasTable(table, filters, loading)}
      </div>
    </div>`;
}

export function mountActas(container: HTMLElement): void {
  const actasMainClass = "pt-0 pb-5 sm:pb-6";
  const actasPageShellClass =
    "rh-dashboard-page relative flex min-h-[calc(100dvh-11rem)] flex-col -mx-4 px-4 pb-5 pt-8 sm:-mx-6 sm:px-6 sm:pb-6 sm:pt-10 lg:-mx-8 lg:px-8";

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
    mainHtml: `<div id="rh-actas-page" class="${actasPageShellClass}">
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
              estado: "en_proceso",
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
    const metric = target.closest<HTMLButtonElement>("[data-rh-actas-metric]");
    if (metric) {
      const value = metric.getAttribute("data-rh-actas-metric");
      if (value === "todas") {
        state.estado = "";
        state.page = 1;
        paint();
        return;
      }
      if (value === "en_proceso" || value === "firmada" || value === "anulada") {
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
    if (target.closest("[data-rh-actas-stop-row-nav]")) {
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
