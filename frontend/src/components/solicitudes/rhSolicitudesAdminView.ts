import { SD_COPY } from "../../solicitudes/rh/solicitudDetalleCopy.ts";
import { calcularDiasSolicitadosInclusive } from "../../solicitudes/rh/rhNewRequestDays.ts";
import { SR_COPY } from "../../solicitudes/rh/solicitudResueltaCopy.ts";
import {
  type RequestFilterKey,
  solicitudesUsaFiltroEmpleadoTexto,
} from "../../solicitudes/solicitudesPageFilterConfig.ts";
import type {
  RhSolicitudesAdminViewModel,
  RhSolicitudEstadoCodigo,
  RhSolicitudFilterState,
  RhSolicitudTablaFila,
  RhSolicitudTipoCodigo,
} from "../../solicitudes/rh/types.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import {
  rhListadoTablaClasesLayoutScroll,
  rhListadoTablaUsaScrollVerticalViewport,
} from "../../utils/rhListadoTablaLayout.ts";
import { renderRhIncidenciasChartsSection } from "../incidencias/rhIncidenciasAnalyticsSection.ts";
import { renderRhFaltasRetardosMetricasSection } from "../faltasRetardos/rhFaltasRetardosMetricasSection.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import type { FaltasRetardosMetricasViewModel } from "../../faltasRetardos/rh/types.ts";
import { renderRhSolicitudesAnalyticsSection } from "./rhSolicitudesAnalyticsSection.ts";
import { escapeHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_LABEL,
  RH_SOLICITUDES_BTN_PRIMARY,
  RH_SOLICITUDES_BTN_SECONDARY,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
} from "../../ui/uiTokens.ts";

type SolicitudesRenderScope = "main" | "personal" | "equipo";

/** Cabecera de tabla (sticky + estilos finos vía `.rh-sol-th` en style.css). */
const TABLE_TH =
  "rh-sol-th sticky top-0 z-20 whitespace-nowrap border-b border-[rgba(148,163,184,0.28)] px-3 py-3 text-left text-[13px] font-semibold tracking-tight text-[#334155] sm:px-4";

const ACT_ICON_BTN =
  "rh-sol-act-btn inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-[rgba(148,163,184,0.35)] bg-white text-slate-600 shadow-[0_2px_8px_rgba(15,23,42,0.05)] transition-[background,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(219,234,254,0.45)] hover:text-[#002147] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[rgba(148,163,184,0.35)] disabled:hover:bg-white disabled:hover:text-slate-400";

function scopeAttr(scope: SolicitudesRenderScope): string {
  return `data-rh-sol-scope="${scope}"`;
}

function scopeId(base: string, scope: SolicitudesRenderScope): string {
  return scope === "main" ? base : `${base}-${scope}`;
}

/** Resumen bajo el subtítulo (solo datos ya cargados en el view-model). */
function renderSolicitudesHeaderMeta(vm: RhSolicitudesAdminViewModel): string {
  const badges: string[] = [];
  if (vm.table && vm.tableStatus !== "loading" && vm.tableStatus !== "error") {
    badges.push(
      `<span class="rh-sol-header__badge rh-sol-header__badge--total"><span class="tabular-nums">${escapeHtml(String(vm.table.total))}</span><span class="rh-sol-header__badge-text">solicitudes</span></span>`,
    );
  }
  if (vm.stats && vm.statsStatus === "ready") {
    badges.push(
      `<span class="rh-sol-header__badge rh-sol-header__badge--pending"><span class="tabular-nums">${escapeHtml(String(vm.stats.pendientes))}</span><span class="rh-sol-header__badge-text">pendientes</span></span>`,
    );
  }
  if (badges.length === 0) return "";
  return `<div class="rh-sol-header__stats mt-3 flex flex-wrap items-center gap-2" role="status" aria-live="polite">${badges.join("")}</div>`;
}

const SOL_FILTER_CONTROL =
  "rh-sol-filter-input min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]";

function fmtPeriodo(row: RhSolicitudTablaFila): string {
  if (row.periodo_etiqueta?.trim()) return row.periodo_etiqueta.trim();
  const a = fmtFechaCorta(row.fecha_inicio);
  const b = fmtFechaCorta(row.fecha_fin);
  if (row.fecha_inicio === row.fecha_fin) return a;
  return `${a} – ${b}`;
}

function badgeTipo(t: RhSolicitudTipoCodigo): string {
  if (t === "vacaciones") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--vacaciones inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Vacaciones</span>`;
  }
  if (t === "home_office") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--ho inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Home Office</span>`;
  }
  if (t === "matrimonio") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--goce inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Matrimonio</span>`;
  }
  if (t === "incapacidad_interna") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--goce inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Incapacidad interna</span>`;
  }
  if (t === "defuncion") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--goce inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Defunción</span>`;
  }
  if (t === "permiso_sin_goce_sueldo") {
    return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--goce inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Permiso sin goce</span>`;
  }
  return `<span class="rh-sol-badge-tipo rh-sol-badge-tipo--goce inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold">Paternidad</span>`;
}

function dot(cls: string): string {
  return `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
}

/** Badges de estado (solo vista Solicitudes): píldoras con gradiente suave, sin tocar tokens globales. */
function badgeEstado(e: RhSolicitudEstadoCodigo): string {
  const base =
    "rh-sol-badge-estado inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  switch (e) {
    case "pending":
      return `<span class="${base} rh-sol-badge-estado--pending">${dot("bg-amber-400")}Pendiente</span>`;
    case "approved":
      return `<span class="${base} rh-sol-badge-estado--approved">${dot("bg-emerald-500")}Aprobado</span>`;
    case "rejected":
      return `<span class="${base} rh-sol-badge-estado--rejected">${dot("bg-red-400")}Rechazado</span>`;
    case "changes_requested":
      return `<span class="${base} rh-sol-badge-estado--changes">${dot("bg-sky-500")}Cambios solicitados</span>`;
    case "cancelled":
      return `<span class="${base} rh-sol-badge-estado--cancelled">${dot("bg-slate-400")}Cancelado</span>`;
    case "overridden":
      return `<span class="${base} rh-sol-badge-estado--overridden">${dot("bg-emerald-500")}Override</span>`;
    default:
      return escapeHtml(e);
  }
}

function iconActionVer(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
}

/** Columna Acciones: solo ver (mismo handler que clic en fila cuando aplica). */
function renderAccionesCelda(row: RhSolicitudTablaFila, scope: SolicitudesRenderScope, verActivo: boolean): string {
  const verBtn = verActivo
    ? `<button type="button" class="${ACT_ICON_BTN}" data-rh-sol-ver="${row.id}" ${scopeAttr(scope)} title="Abrir detalle de la solicitud" aria-label="Ver detalle de la solicitud">${iconActionVer()}</button>`
    : `<span class="rh-sol-act-btn rh-sol-act-btn--disabled inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] border border-dashed border-slate-200 bg-slate-50/80 text-slate-300" title="Ver detalle no disponible para este estado" aria-label="Ver detalle no disponible">${iconActionVer()}</span>`;
  return `<div class="rh-sol-actions flex flex-wrap items-center justify-end gap-1">${verBtn}</div>`;
}

function celdaEmpleado(row: RhSolicitudTablaFila): string {
  const name = formatNombreEmpleadoUi(row.empleado_nombre_raw) || "Sin nombre";
  const ini = inicialesDesdeNombreDisplay(name);
  const foto = row.foto_url?.trim();
  const fallback = `<span class="rh-sol-avatar-fallback flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" title="${escapeHtml(name)}">${escapeHtml(ini)}</span>`;
  const avatar = foto
    ? `<span class="relative shrink-0">
        <img src="${escapeHtml(foto)}" alt="" width="40" height="40" decoding="async" loading="lazy" data-rh-sol-avatar class="rh-sol-avatar-img size-10 rounded-full object-cover ring-1 ring-[rgba(148,163,184,0.35)]" />
        <span hidden class="rh-sol-avatar-fallback rh-sol-avatar-fallback--swap flex size-10 items-center justify-center rounded-full border border-[rgba(148,163,184,0.35)] bg-linear-to-br from-[#dbeafe] to-[#eff6ff] text-xs font-bold tracking-tight text-[#082f5f] shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]" title="${escapeHtml(name)}">${escapeHtml(ini)}</span>
      </span>`
    : fallback;
  return `
    <div class="rh-sol-empleado-celda flex min-w-0 items-center gap-3">
      ${avatar}
      <div class="min-w-0">
        <p class="text-sm font-semibold leading-snug text-[#0f172a]">${escapeHtml(name)}</p>
      </div>
    </div>`;
}

function solicitudesEmptyRow(colspan: number, extraHtml: string): string {
  return `<tr><td colspan="${colspan}" class="p-0">
    <div class="rh-sol-empty px-4 py-12 sm:px-6" role="status">
      <p class="rh-sol-empty__title text-center text-sm font-semibold text-[#0f172a]">No se encontraron solicitudes</p>
      <p class="rh-sol-empty__sub mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">Prueba ajustando los filtros o crea una nueva solicitud.</p>
      ${extraHtml}
    </div>
  </td></tr>`;
}

function filtrosActivos(f: RhSolicitudFilterState, keys: readonly RequestFilterKey[]): boolean {
  for (const k of keys) {
    if (k === "type" && f.tipo) return true;
    if (k === "status" && f.estado) return true;
    if (k === "area" && f.area_id) return true;
    if (k === "supervisor" && f.supervisor_id) return true;
    if (k === "employee" && (f.empleado_id || f.empleado_busqueda.trim())) return true;
  }
  return false;
}

/** Chips informativos de filtros activos (solo lectura; limpiar sigue con el botón). */
function renderFilterChipsRow(vm: RhSolicitudesAdminViewModel, keys: readonly RequestFilterKey[]): string {
  const f = vm.filters;
  const opt = vm.filterOptions;
  if (!filtrosActivos(f, keys)) return "";
  const items: string[] = [];
  for (const key of keys) {
    if (key === "type" && f.tipo) {
      const lab = opt.tipos.find((t) => t.id === f.tipo)?.label;
      if (lab) {
        items.push(
          `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip">${escapeHtml(lab)}</span></span>`,
        );
      }
    } else if (key === "area" && f.area_id) {
      const lab = opt.areas.find((a) => a.id === f.area_id)?.label;
      if (lab) {
        items.push(
          `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip">${escapeHtml(lab)}</span></span>`,
        );
      }
    } else if (key === "supervisor" && f.supervisor_id) {
      const lab = opt.supervisores.find((s) => s.id === f.supervisor_id)?.label;
      if (lab) {
        items.push(
          `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip">${escapeHtml(lab)}</span></span>`,
        );
      }
    } else if (key === "status" && f.estado) {
      const lab = opt.estados.find((e) => e.id === f.estado)?.label;
      if (lab) {
        items.push(
          `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip">${escapeHtml(lab)}</span></span>`,
        );
      }
    } else if (key === "employee") {
      if (solicitudesUsaFiltroEmpleadoTexto(vm.ui.role) && f.empleado_busqueda.trim()) {
        const q = f.empleado_busqueda.trim();
        items.push(
          `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip" title="Búsqueda de empleado">${escapeHtml(`Búsqueda: ${q}`)}</span></span>`,
        );
      } else if (f.empleado_id) {
        const lab = opt.empleados.find((e) => e.id === f.empleado_id)?.label;
        if (lab) {
          items.push(
            `<span role="listitem" class="inline-flex"><span class="rh-sol-filters__chip">${escapeHtml(lab)}</span></span>`,
          );
        }
      }
    }
  }
  if (items.length === 0) return "";
  return `<div class="rh-sol-filters__chips mb-3 flex flex-wrap gap-2" role="list" aria-label="Filtros aplicados">${items.join("")}</div>`;
}

/** Filtro de empleado por texto (`rh`, `supervisor`, `gerente`). */
function empleadoTextoBusquedaFilterField(f: RhSolicitudFilterState, scope: SolicitudesRenderScope): string {
  const inputId = scopeId("rh-sol-f-emp-q", scope);
  return `<div class="min-w-0">
  <label for="${inputId}" class="${RH_LISTADO_LABEL}">Empleado</label>
  <div>
    <input
      type="search"
      id="${inputId}"
      name="empleado_busqueda"
      data-rh-sol-empleado-busqueda
      ${scopeAttr(scope)}
      autocomplete="off"
      enterkeyhint="search"
      placeholder="Buscar empleado..."
      value="${escapeHtml(f.empleado_busqueda)}"
      class="${SOL_FILTER_CONTROL} ${FIELD_FOCUS}"
    />
  </div>
</div>`;
}

function selectFilter(
  id: string,
  label: string,
  name: string,
  optionsHtml: string,
  scope: SolicitudesRenderScope,
): string {
  const selectId = scopeId(id, scope);
  return `<div class="min-w-0">
  <label for="${selectId}" class="${RH_LISTADO_LABEL}">${escapeHtml(label)}</label>
  <div class="grid grid-cols-1">
    <select id="${selectId}" name="${name}" data-rh-sol-filter="${name}" ${scopeAttr(scope)} class="${RH_LISTADO_SELECT} rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function iconEmpStatDisponibles(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v18m-6.53-7.11A5.5 5.5 0 0 1 12 7.5v0a5.5 5.5 0 0 1 6.53 6.39 6 6 0 0 1-1.06 2.34m-11 0A6 6 0 0 1 5.47 13.9" /></svg>`;
}

function iconEmpStatTomados(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>`;
}

function iconEmpStatHomeOffice(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M9.75 21V9.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M15.75 21v-6.375c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V21" /></svg>`;
}

function iconEmpStatPendientes(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
}

/** Tarjetas KPI personales (rol `empleado`), alineadas al dashboard colaborador. */
function renderEmployeePersonalStatCards(vm: RhSolicitudesAdminViewModel): string {
  if (!vm.ui.showEmployeePersonalStats) return "";

  if (vm.empleadoPersonalStatsStatus === "loading" || vm.empleadoPersonalStats === null) {
    const skel = `
      <div class="rh-sol-kpi-skel animate-pulse rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-28 rounded-md bg-slate-200/90"></div>
          <div class="h-8 w-12 rounded-md bg-slate-200/90"></div>
        </div>
        <div class="mt-2 h-3 w-36 rounded-md bg-slate-100/90"></div>
      </div>`;
    return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">${skel.repeat(4)}</div>`;
  }

  if (vm.empleadoPersonalStatsStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron cargar tus métricas personales.</div>`;
  }

  const s = vm.empleadoPersonalStats;
  const cards: {
    title: string;
    value: string;
    subtitle: string;
    iconWrap: string;
    icon: string;
  }[] = [
    {
      title: "Días disponibles",
      value: String(s.dias_disponibles),
      subtitle: "Saldo de vacaciones",
      iconWrap: "bg-leoni-green/12 text-leoni-green",
      icon: iconEmpStatDisponibles(),
    },
    {
      title: "Días tomados",
      value: String(s.dias_tomados),
      subtitle: "Vacaciones aprobadas",
      iconWrap: "bg-orange-500/12 text-orange-600",
      icon: iconEmpStatTomados(),
    },
    {
      title: "Home office tomados",
      value: String(s.dias_home_office_tomados),
      subtitle: "Días HO aprobados",
      iconWrap: "bg-violet-500/12 text-violet-700",
      icon: iconEmpStatHomeOffice(),
    },
    {
      title: "Solicitudes pendientes",
      value: String(s.solicitudes_pendientes),
      subtitle: "En revisión",
      iconWrap: "bg-amber-500/12 text-amber-700",
      icon: iconEmpStatPendientes(),
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="rh-sol-kpi-card rh-sol-kpi-card--empleado rounded-[14px] border border-[rgba(148,163,184,0.22)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_8px_22px_rgba(15,23,42,0.06)] sm:p-4">
      <div class="flex items-center gap-3">
        <div class="rh-sol-kpi-card__icon rh-sol-kpi-card__icon--empleado flex size-10 shrink-0 items-center justify-center rounded-[12px] ${c.iconWrap}" aria-hidden="true">${c.icon}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <h2 class="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">${escapeHtml(c.title)}</h2>
            <p class="shrink-0 text-xl font-bold tabular-nums tracking-tight text-[#0f172a] sm:text-2xl">${escapeHtml(c.value)}</p>
          </div>
          <p class="mt-1 text-xs leading-snug text-[#64748b] sm:text-[13px]">${escapeHtml(c.subtitle)}</p>
        </div>
      </div>
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">${html}</div>`;
}

function renderStatCards(vm: RhSolicitudesAdminViewModel): string {
  if (!vm.ui.showStatsCards) return "";
  if (vm.statsStatus === "loading" || vm.stats === null) {
    const skel = `
      <div class="rh-sol-kpi-skel animate-pulse rounded-[14px] border border-[rgba(148,163,184,0.2)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-24 rounded-md bg-slate-200/90"></div>
          <div class="h-9 w-16 rounded-md bg-slate-200/90"></div>
        </div>
        <div class="mt-3 h-8 w-20 rounded-md bg-slate-100/90"></div>
      </div>`;
    return `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${skel.repeat(4)}</div>`;
  }

  if (vm.statsStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron calcular las métricas.</div>`;
  }

  const s = vm.stats;
  const iconStatReloj = (): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
  const iconStatVacaciones = (): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>`;
  const iconStatCasa = (): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5M3.75 21V6.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M9.75 21V9.375c0-.621.504-1.125 1.125-1.125h4.125c.621 0 1.125.504 1.125 1.125V21M15.75 21v-6.375c0-.621.504-1.125 1.125-1.125h3.375c.621 0 1.125.504 1.125 1.125V21" /></svg>`;
  const iconStatCheck = (): string =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;

  const cards: {
    title: string;
    subtitle: string;
    value: number;
    icon: () => string;
    accent: "pendiente" | "vacaciones" | "ho" | "aprobadas";
  }[] = [
    {
      title: "Pendientes",
      subtitle: "Por revisar",
      value: s.pendientes,
      icon: iconStatReloj,
      accent: "pendiente",
    },
    {
      title: "Vacaciones",
      subtitle: "En proceso",
      value: s.vacaciones,
      icon: iconStatVacaciones,
      accent: "vacaciones",
    },
    {
      title: "Home Office",
      subtitle: "Registradas",
      value: s.home_office,
      icon: iconStatCasa,
      accent: "ho",
    },
    {
      title: "Aprobadas hoy",
      subtitle: "Últimas gestiones",
      value: s.aprobadas_hoy,
      icon: iconStatCheck,
      accent: "aprobadas",
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="rh-sol-kpi-card rh-sol-kpi-card--${c.accent} rounded-[14px] border p-4 sm:p-5">
      <div class="flex items-center gap-3 sm:gap-3.5">
        <div class="rh-sol-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_rgba(15,23,42,0.06)]" aria-hidden="true">${c.icon()}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">${escapeHtml(c.title)}</p>
              <p class="mt-0.5 text-xs leading-snug text-[#64748b]">${escapeHtml(c.subtitle)}</p>
            </div>
            <p class="rh-sol-kpi-card__value shrink-0 text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl">${escapeHtml(String(c.value))}</p>
          </div>
        </div>
      </div>
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${html}</div>`;
}

function renderFilters(
  vm: RhSolicitudesAdminViewModel,
  scope: SolicitudesRenderScope,
  opts?: { clusterEquipo?: boolean; resultCount?: number | null },
): string {
  const clusterEquipo = Boolean(opts?.clusterEquipo);
  const countHtml =
    opts?.resultCount !== null && opts?.resultCount !== undefined
      ? `<p class="rh-sol-filters__count text-xs font-medium text-[#475569]" aria-live="polite">Mostrando <span class="tabular-nums font-semibold text-[#0f172a]">${escapeHtml(String(opts.resultCount))}</span> solicitudes</p>`
      : "";
  const f = vm.filters;
  const opt = vm.filterOptions;
  const keys = vm.ui.visibleFilterKeys;
  const wrapCls = FILTER_FIELD_WRAP;
  /** Filtros de «Solicitudes del Equipo» (scope `equipo`: supervisor/gerente). */
  const wrapEquipoEmpleado =
    "min-w-0 w-full md:flex-[0_1_48%] md:max-w-[55%] md:min-w-[12rem]";
  const wrapEquipoSelect = "min-w-0 w-full md:min-w-[10rem] md:flex-1";
  const wrapEquipoField = (kind: "empleado" | "select") =>
    kind === "empleado" ? wrapEquipoEmpleado : wrapEquipoSelect;
  const filtersRowCls = clusterEquipo
    ? "rh-sol-filters-equipo-row flex min-w-0 flex-col items-stretch gap-3 md:flex-row md:flex-nowrap md:items-end md:gap-x-3"
    : "flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5";

  const tiposPermitidosEmpleado = new Set<RhSolicitudTipoCodigo>([
    "vacaciones",
    "home_office",
    "permiso_sin_goce_sueldo",
  ]);
  const tiposVisibles =
    vm.ui.variant === "empleado" ?
      opt.tipos.filter((t) => tiposPermitidosEmpleado.has(t.id))
    : opt.tipos;

  const tipoOpts =
    `<option value="" ${f.tipo === "" ? "selected" : ""}>Todos los tipos</option>` +
    tiposVisibles
      .map(
        (t) =>
          `<option value="${escapeHtml(t.id)}" ${f.tipo === t.id ? "selected" : ""}>${escapeHtml(t.label)}</option>`,
      )
      .join("");

  const areaOpts =
    `<option value="" ${f.area_id === "" ? "selected" : ""}>Todas las áreas</option>` +
    opt.areas
      .map(
        (a) =>
          `<option value="${escapeHtml(a.id)}" ${f.area_id === a.id ? "selected" : ""}>${escapeHtml(a.label)}</option>`,
      )
      .join("");

  const supOpts =
    `<option value="" ${f.supervisor_id === "" ? "selected" : ""}>Todos los supervisores</option>` +
    opt.supervisores
      .map(
        (s) =>
          `<option value="${escapeHtml(s.id)}" ${f.supervisor_id === s.id ? "selected" : ""}>${escapeHtml(s.label)}</option>`,
      )
      .join("");

  const empOpts =
    `<option value="" ${f.empleado_id === "" ? "selected" : ""}>Todos los empleados</option>` +
    opt.empleados
      .map(
        (em) =>
          `<option value="${escapeHtml(em.id)}" ${f.empleado_id === em.id ? "selected" : ""}>${escapeHtml(em.label)}</option>`,
      )
      .join("");

  const estadosVisibles =
    vm.ui.variant === "empleado" ? opt.estados.filter((e) => e.id !== "overridden") : opt.estados;

  const estOpts =
    `<option value="" ${f.estado === "" ? "selected" : ""}>Todos los estados</option>` +
    estadosVisibles
      .map(
        (e) =>
          `<option value="${escapeHtml(e.id)}" ${f.estado === e.id ? "selected" : ""}>${escapeHtml(e.label)}</option>`,
      )
      .join("");

  const fields: string[] = [];
  for (const key of keys) {
    if (key === "type") {
      const tipoWrap = clusterEquipo ? wrapEquipoField("select") : wrapCls;
      fields.push(
        `<div class="${tipoWrap}">${selectFilter("rh-sol-f-tipo", "Tipo de solicitud", "tipo", tipoOpts, scope)}</div>`,
      );
    } else if (key === "area") {
      fields.push(`<div class="${wrapCls}">${selectFilter("rh-sol-f-area", "Área", "area", areaOpts, scope)}</div>`);
    } else if (key === "supervisor") {
      fields.push(`<div class="${wrapCls}">${selectFilter("rh-sol-f-sup", "Supervisor", "supervisor", supOpts, scope)}</div>`);
    } else if (key === "employee") {
      const empWrap = clusterEquipo ? wrapEquipoField("empleado") : wrapCls;
      const empField = solicitudesUsaFiltroEmpleadoTexto(vm.ui.role)
        ? empleadoTextoBusquedaFilterField(f, scope)
        : selectFilter("rh-sol-f-emp", "Empleado", "empleado", empOpts, scope);
      fields.push(`<div class="${empWrap}">${empField}</div>`);
    } else if (key === "status") {
      const estadoWrap = clusterEquipo ? wrapEquipoField("select") : wrapCls;
      fields.push(
        `<div class="${estadoWrap}">${selectFilter("rh-sol-f-est", "Estado", "estado", estOpts, scope)}</div>`,
      );
    }
  }

  const clearVisible = filtrosActivos(f, keys);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
        <button
          type="button"
          data-rh-sol-clear-filters
          ${scopeAttr(scope)}
          class="${RH_LISTADO_BTN_GHOST} rh-sol-filters__clear w-full sm:w-auto"
        >
          Limpiar filtros
        </button>
      </div>`
    : "";

  const chipsRow = renderFilterChipsRow(vm, keys);

  const inner = `
      <div class="${filtersRowCls}">
        ${fields.join("")}
        ${clearBtn}
      </div>`;

  if (clusterEquipo) {
    return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros del equipo">
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">Buscar y filtrar equipo</p>
        ${countHtml}
      </div>
      ${chipsRow}
      ${inner}
    </section>`;
  }

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros de solicitudes">
      <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Filtros de búsqueda</h2>
        ${countHtml}
      </div>
      ${chipsRow}
      ${inner}
    </section>`;
}

function renderFiltersSkeleton(visibleCount: number): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="mb-1 h-3 w-24 max-w-full rounded bg-slate-200"></div>
      <div class="h-8 w-full rounded-md bg-slate-100"></div>
    </div>`;
  const wrapCls = FILTER_FIELD_WRAP;
  const slots = Array.from({ length: Math.max(1, visibleCount) }, () => `<div class="${wrapCls}">${cell}</div>`).join(
    "",
  );
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-hidden="true" aria-label="Cargando filtros">
      <div class="mb-3 h-4 w-40 animate-pulse rounded-md bg-slate-200/80"></div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${slots}
      </div>
    </section>`;
}

/** Filtros globales de `#/metricas`: número de empleado, área, rango de fechas y aplicar. */
export function renderMetricasFiltersSection(vm: RhSolicitudesAdminViewModel): string {
  const filtersLoading = vm.tableStatus === "loading";
  if (filtersLoading) {
    return renderFiltersSkeleton(4);
  }

  const f = vm.filters;
  const opt = vm.filterOptions;
  const wrapCls = FILTER_FIELD_WRAP;

  const areaOpts =
    `<option value="" ${f.area_id === "" ? "selected" : ""}>Todas las áreas</option>` +
    opt.areas
      .map(
        (a) =>
          `<option value="${escapeHtml(a.id)}" ${f.area_id === a.id ? "selected" : ""}>${escapeHtml(a.label)}</option>`,
      )
      .join("");

  const noEmpId = "rh-metricas-f-noemp";
  const fiId = "rh-metricas-f-fi";
  const ffId = "rh-metricas-f-ff";

  const fields = `
    <div class="${wrapCls} min-w-[min(100%,10rem)] flex-[1_1_10rem]">
      <label for="${noEmpId}" class="${RH_LISTADO_LABEL}">Número de empleado</label>
      <input
        type="text"
        inputmode="numeric"
        id="${noEmpId}"
        name="no_empleado"
        data-rh-metricas-filter-field="no_empleado"
        autocomplete="off"
        placeholder="Ej. 10042"
        value="${escapeHtml(f.no_empleado)}"
        class="${SOL_FILTER_CONTROL} ${FIELD_FOCUS}"
      />
    </div>
    <div class="${wrapCls} min-w-[min(100%,12rem)] flex-[1_1_12rem]">
      <label for="rh-metricas-f-area" class="${RH_LISTADO_LABEL}">Área</label>
      <div class="grid grid-cols-1">
        <select
          id="rh-metricas-f-area"
          name="area_id"
          data-rh-metricas-filter-field="area_id"
          class="${RH_LISTADO_SELECT} rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${FIELD_FOCUS}"
        >
          ${areaOpts}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>
    <div class="${wrapCls} min-w-[min(100%,11rem)] flex-[1_1_11rem]">
      <label for="${fiId}" class="${RH_LISTADO_LABEL}">Fecha inicial</label>
      <input
        type="date"
        id="${fiId}"
        name="fecha_inicio"
        data-rh-metricas-filter-field="fecha_inicio"
        value="${escapeHtml(f.fecha_inicio)}"
        class="${SOL_FILTER_CONTROL} ${FIELD_FOCUS}"
      />
    </div>
    <div class="${wrapCls} min-w-[min(100%,11rem)] flex-[1_1_11rem]">
      <label for="${ffId}" class="${RH_LISTADO_LABEL}">Fecha final</label>
      <input
        type="date"
        id="${ffId}"
        name="fecha_fin"
        data-rh-metricas-filter-field="fecha_fin"
        value="${escapeHtml(f.fecha_fin)}"
        class="${SOL_FILTER_CONTROL} ${FIELD_FOCUS}"
      />
    </div>`;

  const applyBtn = `<div class="w-full shrink-0 sm:w-auto xl:ml-auto">
      <button
        type="button"
        data-rh-metricas-apply-filters
        class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary min-h-[42px] w-full justify-center sm:w-auto"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M8 4a4 4 0 1 0 2.545 7.086l3.684 3.684a.75.75 0 1 0 1.06-1.06l-3.683-3.685A4 4 0 0 0 8 4ZM5.5 8a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0Z" clip-rule="evenodd" /></svg>
        Aplicar filtros
      </button>
    </div>`;

  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card p-4 sm:p-5" aria-label="Filtros de métricas">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3 xl:flex-nowrap">
        ${fields}
        ${applyBtn}
      </div>
    </section>`;
}

function renderFiltersSection(vm: RhSolicitudesAdminViewModel, scope: SolicitudesRenderScope): string {
  if (vm.ui.metricasFilterBar) return "";
  const statsFallo = vm.ui.showEmployeePersonalStats
    ? vm.empleadoPersonalStatsStatus === "error"
    : vm.statsStatus === "error";
  if (vm.tableStatus === "error" && statsFallo) {
    return "";
  }
  const n = vm.ui.visibleFilterKeys.length;
  const filtersLoading =
    vm.tableStatus === "loading" ||
    (vm.ui.showStatsCards && vm.statsStatus === "loading") ||
    (vm.ui.showEmployeePersonalStats && vm.empleadoPersonalStatsStatus === "loading");
  if (filtersLoading) {
    return renderFiltersSkeleton(n);
  }
  const resultCount =
    vm.table && vm.tableStatus !== "loading" && vm.tableStatus !== "error" ? vm.table.total : null;
  return renderFilters(vm, scope, { clusterEquipo: scope === "equipo", resultCount });
}

function renderEmpleadoSolicitudesTableFooter(
  tbl: NonNullable<RhSolicitudesAdminViewModel["table"]>,
  scope: SolicitudesRenderScope,
): string {
  const totalPages = Math.max(1, Math.ceil(tbl.total / tbl.page_size) || 1);
  const from = (tbl.page - 1) * tbl.page_size + 1;
  const to = Math.min(tbl.page * tbl.page_size, tbl.total);
  const pages = paginationRange(totalPages, tbl.page);
  const pageButtons = pages
    .map((x) => {
      if (x === "ellipsis") {
        return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
      }
      const active = x === tbl.page;
      const cls = active
        ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-rh-sol-page="${x}" ${scopeAttr(scope)} class="${cls}">${x}</button>`;
    })
    .join("");
  const pageSizeOpts = [5, 10, 25, 50]
    .map((n) => `<option value="${n}" ${n === tbl.page_size ? "selected" : ""}>${n}</option>`)
    .join("");
  return `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${tbl.total}</span> solicitudes
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="${scopeId("rh-sol-emp-page-size", scope)}" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="${scopeId("rh-sol-emp-page-size", scope)}" name="${scopeId("rh-sol-emp-page-size", scope)}" data-rh-sol-page-size ${scopeAttr(scope)} class="rh-sol-filter-select min-h-[38px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[rgba(100,116,139,0.45)] sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-sol-page="${tbl.page - 1}" ${scopeAttr(scope)} ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-sol-page="${tbl.page + 1}" ${scopeAttr(scope)} ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
}

function renderEmpleadoSolicitudesTable(vm: RhSolicitudesAdminViewModel, scope: SolicitudesRenderScope): string {
  if (vm.tableStatus === "loading") {
    const skRow = `<tr class="rh-sol-loading-row">${"<td class=\"px-3 py-3 sm:px-4\"><div class=\"h-4 animate-pulse rounded-md bg-slate-200/80\"></div></td>".repeat(8)}</tr>`;
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="Tus solicitudes">
        <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
          <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando solicitudes…
        </div>
        <div class="overflow-x-auto px-2 pb-3 sm:px-3">
          <table class="min-w-[760px] w-full text-left">
            <thead class="rh-sol-thead"><tr>
              ${["Folio", "Tipo", "Inicio", "Fin", "Días", "Estatus", "Creación", "Acciones"]
                .map((lab) => `<th scope="col" class="${TABLE_TH}">${lab}</th>`)
                .join("")}
            </tr></thead>
            <tbody class="divide-y divide-slate-100/80">${skRow.repeat(4)}</tbody>
          </table>
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="Tus solicitudes">
        <div class="border-b border-red-100 bg-linear-to-r from-red-50 to-white px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? "Error al cargar la tabla.")}
        </div>
        <div class="rh-sol-table-error-fallback px-4 py-10 text-center sm:px-5">
          <p class="text-sm font-medium text-[#334155]">No pudimos mostrar el listado.</p>
          <p class="mt-2 text-xs leading-relaxed text-[#64748b]">Intenta recargar la página. Si el error continúa, contacta a soporte.</p>
        </div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0 ? solicitudesEmptyRow(8, "") : "";

  const rows =
    tbl && tbl.items.length > 0
      ? tbl.items
          .map((row) => {
            const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
            const dias = String(calcularDiasSolicitadosInclusive(row.fecha_inicio, row.fecha_fin));
            const pending = row.estado === "pending";
            const cambiosSolicitados = row.estado === "changes_requested";
            const resueltaConsulta =
              row.estado === "approved" || row.estado === "rejected" || row.estado === "overridden";
            const clickable = pending || resueltaConsulta || cambiosSolicitados;
            const trClickCls = clickable ? "rh-sol-data-row--interactive cursor-pointer" : "";
            const trDataAttrs = pending
              ? ` tabindex="0" role="button" data-rh-sol-row-pending="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SD_COPY.tituloFilaPendiente)}"`
              : cambiosSolicitados
                ? ` tabindex="0" role="button" data-rh-sol-row-changes="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SD_COPY.tituloFilaCambiosSolicitados)}"`
                : resueltaConsulta
                  ? ` tabindex="0" role="button" data-rh-sol-row-resuelta="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SR_COPY.tituloFilaResuelta)}"`
                  : "";
            const acciones = renderAccionesCelda(row, scope, clickable);
            return `
    <tr class="rh-sol-data-row transition-colors ${trClickCls}"${trDataAttrs}>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeHtml(num)}</td>
      <td class="px-3 py-3 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_inicio))}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_fin))}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm font-medium tabular-nums text-slate-800 sm:px-4">${escapeHtml(dias)}</td>
      <td class="px-3 py-3 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_solicitud))}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-right sm:px-4">${acciones}</td>
    </tr>`;
          })
          .join("")
      : emptyRow;

  const footer =
    tbl && tbl.total > 0
      ? renderEmpleadoSolicitudesTableFooter(tbl, scope)
      : tbl
        ? `
      <div class="shrink-0 border-t border-slate-100 px-3 py-2.5 text-center text-sm text-slate-500 sm:px-4">
        Mostrando 0 de 0 solicitudes
      </div>`
        : "";

  const visibleRowCount = tbl?.items.length ?? 0;
  const { sectionLayoutCls, bodyWrapCls: tablaBodyWrapCls } = rhListadoTablaClasesLayoutScroll(
    rhListadoTablaUsaScrollVerticalViewport(visibleRowCount),
  );

  return `
    <section class="rh-sol-table-section ${sectionLayoutCls} ${RH_LISTADO_SURFACE}" aria-label="Tus solicitudes">
      <div class="${tablaBodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[760px] w-full text-left">
          <thead class="rh-sol-thead">
            <tr>
              <th scope="col" class="${TABLE_TH}">Folio</th>
              <th scope="col" class="${TABLE_TH}">Tipo</th>
              <th scope="col" class="${TABLE_TH}">Inicio</th>
              <th scope="col" class="${TABLE_TH}">Fin</th>
              <th scope="col" class="${TABLE_TH}">Días</th>
              <th scope="col" class="${TABLE_TH}">Estatus</th>
              <th scope="col" class="${TABLE_TH}">Creación</th>
              <th scope="col" class="${TABLE_TH} text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80 bg-white">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}

function renderTable(vm: RhSolicitudesAdminViewModel, scope: SolicitudesRenderScope): string {
  const hideEmpleadoColumn = scope === "personal";

  if (vm.tableStatus === "loading") {
    const nCols = hideEmpleadoColumn ? 7 : 8;
    const skRow = `<tr class="rh-sol-loading-row">${`<td class="px-3 py-3 sm:px-4"><div class="h-4 animate-pulse rounded-md bg-slate-200/80"></div></td>`.repeat(nCols)}</tr>`;
    const thLabels = hideEmpleadoColumn
      ? ["Número", "Área", "Tipo", "Fecha solicitud", "Periodo solicitado", "Estado", "Acciones"]
      : ["Empleado", "Número", "Área", "Tipo", "Fecha solicitud", "Periodo solicitado", "Estado", "Acciones"];
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-busy="true" aria-label="Solicitudes">
        <div class="flex items-center gap-2.5 border-b border-slate-100/90 px-4 py-3 text-sm text-[#475569] sm:px-5">
          <svg class="size-5 shrink-0 animate-spin text-[#2563eb]" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando solicitudes…
        </div>
        <div class="overflow-x-auto px-2 pb-3 sm:px-3">
          <table class="${hideEmpleadoColumn ? "min-w-[820px]" : "min-w-[920px]"} w-full text-left">
            <thead class="rh-sol-thead"><tr>
              ${thLabels.map((lab) => `<th scope="col" class="${TABLE_TH}${lab === "Acciones" ? " text-right" : ""}">${lab}</th>`).join("")}
            </tr></thead>
            <tbody class="divide-y divide-slate-100/80">${skRow.repeat(4)}</tbody>
          </table>
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="rh-sol-table-section shrink-0 overflow-hidden ${RH_LISTADO_SURFACE}" aria-label="Solicitudes">
        <div class="border-b border-red-100 bg-linear-to-r from-red-50 to-white px-4 py-3 text-sm text-red-800 sm:px-5" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? "Error al cargar la tabla.")}
        </div>
        <div class="rh-sol-table-error-fallback px-4 py-10 text-center sm:px-5">
          <p class="text-sm font-medium text-[#334155]">No pudimos mostrar el listado.</p>
          <p class="mt-2 text-xs leading-relaxed text-[#64748b]">Intenta recargar la página. Si el error continúa, contacta a soporte.</p>
        </div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyExtraEmpTexto =
    solicitudesUsaFiltroEmpleadoTexto(vm.ui.role) && vm.filters.empleado_busqueda.trim()
      ? `<p class="rh-sol-empty__hint mt-3 text-center text-xs text-[#64748b]">Prueba con otro nombre, identificador o folio.</p>`
      : "";
  const colCount = hideEmpleadoColumn ? 7 : 8;
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0 ? solicitudesEmptyRow(colCount, emptyExtraEmpTexto) : "";

  const rows =
    tbl && tbl.items.length > 0
      ? tbl.items
          .map((row) => {
            const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
            const pending = row.estado === "pending";
            const cambiosSolicitados = row.estado === "changes_requested";
            const resueltaConsulta =
              row.estado === "approved" || row.estado === "rejected" || row.estado === "overridden";
            const clickable = pending || resueltaConsulta || cambiosSolicitados;
            const trClickCls = clickable ? "rh-sol-data-row--interactive cursor-pointer" : "";
            const trDataAttrs = pending
              ? ` tabindex="0" role="button" data-rh-sol-row-pending="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SD_COPY.tituloFilaPendiente)}"`
              : cambiosSolicitados
                ? ` tabindex="0" role="button" data-rh-sol-row-changes="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SD_COPY.tituloFilaCambiosSolicitados)}"`
                : resueltaConsulta
                  ? ` tabindex="0" role="button" data-rh-sol-row-resuelta="1" data-rh-sol-id="${row.id}" ${scopeAttr(scope)} title="${escapeHtml(SR_COPY.tituloFilaResuelta)}"`
                  : "";
            const empleadoTd = hideEmpleadoColumn
              ? ""
              : `<td class="px-3 py-3 align-middle sm:px-4">${celdaEmpleado(row)}</td>`;
            const acciones = renderAccionesCelda(row, scope, clickable);
            return `
    <tr class="rh-sol-data-row transition-colors ${trClickCls}"${trDataAttrs}>
      ${empleadoTd}
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeHtml(num)}</td>
      <td class="max-w-40 px-3 py-3 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span>
      </td>
      <td class="px-3 py-3 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_solicitud))}</td>
      <td class="max-w-56 px-3 py-3 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeHtml(fmtPeriodo(row))}">${escapeHtml(fmtPeriodo(row))}</span>
      </td>
      <td class="px-3 py-3 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
      <td class="whitespace-nowrap px-3 py-3 align-middle text-right sm:px-4">${acciones}</td>
    </tr>`;
          })
          .join("")
      : emptyRow;

  const footer =
    tbl && tbl.total > 0
      ? (() => {
          const totalPages = Math.max(1, Math.ceil(tbl.total / tbl.page_size) || 1);
          const from = (tbl.page - 1) * tbl.page_size + 1;
          const to = Math.min(tbl.page * tbl.page_size, tbl.total);
          const pages = paginationRange(totalPages, tbl.page);
          const pageButtons = pages
            .map((x) => {
              if (x === "ellipsis") {
                return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500 sm:text-sm">…</span>`;
              }
              const active = x === tbl.page;
              const cls = active
                ? "min-h-8 min-w-8 rounded-lg bg-[#1e40af] px-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] sm:px-2.5 sm:text-sm"
                : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
              return `<button type="button" data-rh-sol-page="${x}" ${scopeAttr(scope)} class="${cls}">${x}</button>`;
            })
            .join("");
          const pageSizeOpts = [5, 10, 25, 50]
            .map((n) => `<option value="${n}" ${n === tbl.page_size ? "selected" : ""}>${n}</option>`)
            .join("");
          return `
      <div class="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p class="text-xs font-medium text-slate-600 sm:text-sm">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${tbl.total}</span> solicitudes
          </p>
          <div class="flex flex-wrap items-center gap-1.5">
            <label for="${scopeId("rh-sol-page-size", scope)}" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="${scopeId("rh-sol-page-size", scope)}" name="${scopeId("rh-sol-page-size", scope)}" data-rh-sol-page-size ${scopeAttr(scope)} class="rh-sol-filter-select min-h-[38px] rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 hover:border-[rgba(100,116,139,0.45)] sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-sol-page="${tbl.page - 1}" ${scopeAttr(scope)} ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-sol-page="${tbl.page + 1}" ${scopeAttr(scope)} ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
        })()
      : tbl
        ? `
      <div class="shrink-0 border-t border-slate-100 px-3 py-2.5 text-center text-sm text-slate-500 sm:px-4">
        Mostrando 0 de 0 solicitudes
      </div>`
        : "";

  const visibleRowCountGestor = tbl?.items.length ?? 0;
  const { sectionLayoutCls: sectionLayoutClsGestor, bodyWrapCls: tablaBodyWrapClsGestor } =
    rhListadoTablaClasesLayoutScroll(rhListadoTablaUsaScrollVerticalViewport(visibleRowCountGestor));

  const thEmpleado = hideEmpleadoColumn
    ? ""
    : `<th scope="col" class="${TABLE_TH}">Empleado</th>`;

  return `
    <section class="rh-sol-table-section ${sectionLayoutClsGestor} ${RH_LISTADO_SURFACE}" aria-label="Listado de solicitudes">
      <div class="${tablaBodyWrapClsGestor}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="${hideEmpleadoColumn ? "min-w-[820px]" : "min-w-[920px]"} w-full text-left">
          <thead class="rh-sol-thead">
            <tr>
              ${thEmpleado}
              <th scope="col" class="${TABLE_TH}">Número</th>
              <th scope="col" class="${TABLE_TH}">Área</th>
              <th scope="col" class="${TABLE_TH}">Tipo</th>
              <th scope="col" class="${TABLE_TH}">Fecha solicitud</th>
              <th scope="col" class="${TABLE_TH}">Periodo solicitado</th>
              <th scope="col" class="${TABLE_TH}">Estado</th>
              <th scope="col" class="${TABLE_TH} text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="rh-sol-tbody divide-y divide-slate-100/80 bg-white">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}

/** HTML principal de la vista de solicitudes (gestores y empleado; sin el shell). */
export function renderRhSolicitudesAdminView(vm: RhSolicitudesAdminViewModel): string {
  if (vm.ui.variant === "empleado") {
    const nuevaBtn = vm.ui.showNewRequestButton
      ? `<button
            type="button"
            id="rh-sol-nueva"
            class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary w-full shrink-0 sm:w-auto"
          >
            <span aria-hidden="true">+</span> Nueva solicitud
          </button>`
      : "";
    return `
    <div id="rh-solicitudes-root" class="rh-solicitudes-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Solicitudes</h1>
            <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Consulta, seguimiento y registro de tus solicitudes</p>
            ${renderSolicitudesHeaderMeta(vm)}
          </div>
          ${nuevaBtn ? `<div class="rh-sol-header__toolbar flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-nowrap md:items-center md:justify-end">${nuevaBtn}</div>` : ""}
        </div>
      </section>
      <div id="rh-sol-emp-stats" class="shrink-0">${renderEmployeePersonalStatCards(vm)}</div>
      <div id="rh-sol-filters" class="shrink-0">${renderFiltersSection(vm, "main")}</div>
      <div id="rh-sol-table" class="flex min-h-0 flex-1 flex-col">${renderEmpleadoSolicitudesTable(vm, "main")}</div>
    </div>`;
  }

  const exportBtn = vm.ui.showExportButton
    ? `<button
            type="button"
            id="rh-sol-export"
            class="${RH_SOLICITUDES_BTN_SECONDARY} rh-sol-header__btn-secondary order-2 w-full sm:w-auto sm:shrink-0 md:order-1"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4 shrink-0 text-slate-600" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar solicitudes
          </button>`
    : "";

  const nuevaGestorBtn = vm.ui.showNewRequestButton
    ? `<button
            type="button"
            id="rh-sol-nueva"
            class="${RH_SOLICITUDES_BTN_PRIMARY} rh-sol-header__btn-primary order-1 w-full sm:w-auto sm:shrink-0 md:order-2"
          >
            <span aria-hidden="true">+</span> Nueva solicitud
          </button>`
    : "";
  const toolbarGestor =
    vm.ui.showGestorToolbar && (vm.ui.showExportButton || vm.ui.showNewRequestButton)
      ? `<div class="rh-sol-header__toolbar rh-sol-header__toolbar--dual flex w-full shrink-0 flex-col gap-2 md:w-auto md:flex-row md:flex-nowrap md:items-center md:justify-end md:gap-2.5">${exportBtn}${nuevaGestorBtn}</div>`
      : "";

  return `
    <div id="rh-solicitudes-root" class="rh-solicitudes-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Solicitudes</h1>
            <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Gestión y aprobación de solicitudes del personal</p>
            ${renderSolicitudesHeaderMeta(vm)}
          </div>
          ${toolbarGestor}
        </div>
      </section>

      <div id="rh-sol-stats" class="shrink-0">${renderStatCards(vm)}</div>
      <div id="rh-sol-filters" class="shrink-0">${renderFiltersSection(vm, "main")}</div>
      <div id="rh-sol-table" class="flex min-h-0 flex-1 flex-col">${renderTable(vm, "main")}</div>
    </div>`;
}

/** Sección por dominio en `#/metricas` (p. ej. Solicitudes; futuro: Incidencias, Actas). */
function renderMetricasDomainSection(sectionId: string, title: string, bodyHtml: string): string {
  const headingId = `${sectionId}-heading`;
  return `
    <section id="${escapeHtml(sectionId)}" class="flex shrink-0 flex-col gap-4 sm:gap-5" aria-labelledby="${escapeHtml(headingId)}">
      <header class="border-b border-slate-200/90 pb-3">
        <h2 id="${escapeHtml(headingId)}" class="text-base font-semibold text-text-primary sm:text-lg">${escapeHtml(title)}</h2>
      </header>
      ${bodyHtml}
    </section>`;
}

/** Vista `#/metricas`: hero, filtros globales de solicitudes y secciones por dominio. */
export function renderRhMetricasView(
  solicitudesVm: RhSolicitudesAdminViewModel,
  incidenciasVm: RhIncidenciasAdminViewModel,
  faltasRetardosVm: FaltasRetardosMetricasViewModel,
): string {
  const analyticsState =
    solicitudesVm.ui.showPersonasDiaChart ?
      solicitudesVm.tableStatus === "loading" ?
        "loading"
      : "ready"
    : "hidden";

  const metricasFilters = `<div id="rh-metricas-filters" class="shrink-0">${renderMetricasFiltersSection(solicitudesVm)}</div>`;

  return `
    <div id="rh-metricas-root" class="rh-solicitudes-module ${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
        <div class="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-8">
          <div class="rh-sol-hero__copy min-w-0 w-full flex-1 md:max-w-[min(100%,42rem)]">
            <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Metricas area laborales</h1>
            <p class="mt-2 max-w-full text-pretty text-sm leading-relaxed text-[#64748b] sm:text-[15px] sm:leading-relaxed">Analítica y tendencias del personal</p>
          </div>
        </div>
      </section>
      ${metricasFilters}
      ${renderMetricasDomainSection(
        "rh-metricas-seccion-solicitudes",
        "Solicitudes",
        renderRhSolicitudesAnalyticsSection({
          state: analyticsState,
          rows: solicitudesVm.personasDiaChartRows,
        }),
      )}
      ${renderMetricasDomainSection(
        "rh-metricas-seccion-incidencias",
        "Seguridad y Calidad",
        renderRhIncidenciasChartsSection(incidenciasVm),
      )}
      ${renderMetricasDomainSection(
        "rh-metricas-seccion-faltas-retardos",
        "Incidencias",
        renderRhFaltasRetardosMetricasSection(faltasRetardosVm),
      )}
    </div>`;
}

export function renderRhSolicitudesScopedSection(
  vm: RhSolicitudesAdminViewModel,
  options: { scope: Exclude<SolicitudesRenderScope, "main">; title: string; subtitle: string },
): string {
  const tableHtml = vm.ui.variant === "empleado" ? renderEmpleadoSolicitudesTable(vm, options.scope) : renderTable(vm, options.scope);
  const sectionShell =
    options.scope === "personal"
      ? `${RH_LISTADO_SURFACE} border-l-[6px] border-l-[#1e40af] p-4 sm:p-5`
      : `${RH_LISTADO_SURFACE} border-emerald-200/80 border-l-[6px] border-l-emerald-600 bg-linear-to-br from-emerald-50/40 via-white to-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:p-5`;
  const chip =
    options.scope === "personal"
      ? `<span class="ml-2 inline-flex shrink-0 rounded-full border border-[#1e40af]/20 bg-[#eff6ff] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#1e40af]">Personal</span>`
      : `<span class="ml-2 inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">Equipo</span>`;
  const sectionIdAttr =
    options.scope === "personal" ? ` id="rh-sol-seccion-personal"` : ` id="rh-sol-seccion-equipo"`;
  return `
    <section${sectionIdAttr} class="${sectionShell}">
      <header class="mb-4 border-b border-slate-200/90 pb-3">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 class="text-base font-semibold text-text-primary sm:text-lg">${escapeHtml(options.title)}${chip}</h2>
        </div>
        <p class="mt-1.5 text-xs leading-snug text-text-muted sm:text-sm">${escapeHtml(options.subtitle)}</p>
      </header>
      <div class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
        <div class="shrink-0">${renderStatCards(vm)}</div>
        <div class="shrink-0">${renderFiltersSection(vm, options.scope)}</div>
        <div class="flex min-h-0 flex-1 flex-col">${tableHtml}</div>
      </div>
    </section>`;
}

/**
 * Resumen total/pendientes en el hero de la vista partida (supervisor/gerente),
 * solo con datos ya presentes en los view-models de cada bloque.
 */
export function renderSolicitudesSplitHeroMeta(
  personalVm: RhSolicitudesAdminViewModel,
  equipoVm: RhSolicitudesAdminViewModel,
): string {
  const badges: string[] = [];
  const tableOk = (vm: RhSolicitudesAdminViewModel) =>
    vm.table != null && vm.tableStatus !== "loading" && vm.tableStatus !== "error";
  if (tableOk(personalVm) && tableOk(equipoVm)) {
    const total = personalVm.table!.total + equipoVm.table!.total;
    badges.push(
      `<span class="rh-sol-header__badge rh-sol-header__badge--total"><span class="tabular-nums">${escapeHtml(String(total))}</span><span class="rh-sol-header__badge-text">solicitudes</span></span>`,
    );
  }
  if (
    personalVm.statsStatus === "ready" &&
    equipoVm.statsStatus === "ready" &&
    personalVm.stats &&
    equipoVm.stats
  ) {
    const pend = personalVm.stats.pendientes + equipoVm.stats.pendientes;
    badges.push(
      `<span class="rh-sol-header__badge rh-sol-header__badge--pending"><span class="tabular-nums">${escapeHtml(String(pend))}</span><span class="rh-sol-header__badge-text">pendientes</span></span>`,
    );
  }
  if (badges.length === 0) return "";
  return `<div class="rh-sol-header__stats mt-3 flex flex-wrap items-center gap-2" role="status" aria-live="polite">${badges.join("")}</div>`;
}
