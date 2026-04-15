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
import { escapeHtml, fmtFechaCorta, paginationRange } from "../../ui/uiUtils.ts";
import {
  FIELD_FOCUS,
  SELECT_CHEVRON,
  FILTER_FIELD_WRAP,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_GHOST,
  badgePending,
  badgeApproved,
  badgeRejected,
  badgeCancelled,
  badgeChangesRequested,
  badgeOverridden,
} from "../../ui/uiTokens.ts";

function fmtPeriodo(row: RhSolicitudTablaFila): string {
  if (row.periodo_etiqueta?.trim()) return row.periodo_etiqueta.trim();
  const a = fmtFechaCorta(row.fecha_inicio);
  const b = fmtFechaCorta(row.fecha_fin);
  if (row.fecha_inicio === row.fecha_fin) return a;
  return `${a} – ${b}`;
}

function badgeTipo(t: RhSolicitudTipoCodigo): string {
  if (t === "vacaciones") {
    return `<span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-900">Vacaciones</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-900">Home Office</span>`;
}

function badgeEstado(e: RhSolicitudEstadoCodigo): string {
  switch (e) {
    case "pending":           return badgePending("Pendiente");
    case "approved":          return badgeApproved("Aprobado");
    case "rejected":          return badgeRejected("Rechazado");
    case "changes_requested": return badgeChangesRequested("Cambios solicitados");
    case "cancelled":         return badgeCancelled("Cancelado");
    case "overridden":        return badgeOverridden("Override");
    default:                  return escapeHtml(e);
  }
}

function celdaEmpleado(row: RhSolicitudTablaFila): string {
  const name = formatNombreEmpleadoUi(row.empleado_nombre_raw) || "Sin nombre";
  const ini = inicialesDesdeNombreDisplay(name);
  const foto = row.foto_url?.trim();
  const avatar = foto
    ? `<img src="${escapeHtml(foto)}" alt="" class="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
    : `<span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>`;
  return `
    <div class="flex min-w-0 items-center gap-2.5">
      ${avatar}
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900">${escapeHtml(name)}</p>
      </div>
    </div>`;
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

/** Filtro de empleado por texto (`rh`, `supervisor`, `gerente`). */
function empleadoTextoBusquedaFilterField(f: RhSolicitudFilterState): string {
  return `<div class="min-w-0">
  <label for="rh-sol-f-emp-q" class="mb-1 block text-xs font-medium text-gray-800">Empleado</label>
  <div>
    <input
      type="search"
      id="rh-sol-f-emp-q"
      name="empleado_busqueda"
      data-rh-sol-empleado-busqueda
      autocomplete="off"
      enterkeyhint="search"
      placeholder="Buscar empleado..."
      value="${escapeHtml(f.empleado_busqueda)}"
      class="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-base text-gray-900 shadow-sm sm:text-sm/6 ${FIELD_FOCUS}"
    />
  </div>
</div>`;
}

function selectFilter(
  id: string,
  label: string,
  name: string,
  optionsHtml: string,
): string {
  return `<div class="min-w-0">
  <label for="${id}" class="mb-1 block text-xs font-medium text-gray-800">${escapeHtml(label)}</label>
  <div class="grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-sol-filter="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-2.5 text-base text-gray-900 sm:text-sm/6 ${FIELD_FOCUS}">
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
      <div class="animate-pulse rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-28 rounded bg-slate-200"></div>
          <div class="h-7 w-12 rounded bg-slate-200"></div>
        </div>
        <div class="mt-1.5 h-3 w-36 rounded bg-slate-100"></div>
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
    <article class="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
      <div class="flex items-start gap-2.5">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-full ${c.iconWrap}" aria-hidden="true">${c.icon}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <h2 class="min-w-0 text-xs font-semibold leading-snug text-text-muted">${escapeHtml(c.title)}</h2>
            <p class="shrink-0 text-xl font-bold tabular-nums tracking-tight text-text-primary sm:text-2xl">${escapeHtml(c.value)}</p>
          </div>
          <p class="mt-0.5 text-xs leading-snug text-text-muted sm:text-sm">${escapeHtml(c.subtitle)}</p>
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
      <div class="animate-pulse rounded-xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-24 rounded bg-slate-200"></div>
          <div class="h-7 w-14 rounded bg-slate-200"></div>
        </div>
      </div>`;
    return `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${skel.repeat(4)}</div>`;
  }

  if (vm.statsStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron calcular las métricas.</div>`;
  }

  const s = vm.stats;
  const cards: { title: string; value: number; borderTop: string }[] = [
    {
      title: "Pendientes",
      value: s.pendientes,
      borderTop: "border-t-leoni-blue",
    },
    {
      title: "Vacaciones",
      value: s.vacaciones,
      borderTop: "border-t-orange-500",
    },
    {
      title: "Home Office",
      value: s.home_office,
      borderTop: "border-t-violet-600",
    },
    {
      title: "Aprobadas hoy",
      value: s.aprobadas_hoy,
      borderTop: "border-t-emerald-500",
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="flex h-full flex-col justify-center rounded-xl border border-border border-t-4 ${c.borderTop} bg-white p-3 shadow-sm sm:p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="min-w-0 text-xs font-medium text-text-muted sm:text-sm">${escapeHtml(c.title)}</h2>
        <p class="shrink-0 text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">${escapeHtml(String(c.value))}</p>
      </div>
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${html}</div>`;
}

function renderFilters(vm: RhSolicitudesAdminViewModel): string {
  const f = vm.filters;
  const opt = vm.filterOptions;
  const keys = vm.ui.visibleFilterKeys;
  const wrapCls = FILTER_FIELD_WRAP;

  const tipoOpts =
    `<option value="" ${f.tipo === "" ? "selected" : ""}>Todos los tipos</option>` +
    opt.tipos
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

  const estOpts =
    `<option value="" ${f.estado === "" ? "selected" : ""}>Todos los estados</option>` +
    opt.estados
      .map(
        (e) =>
          `<option value="${escapeHtml(e.id)}" ${f.estado === e.id ? "selected" : ""}>${escapeHtml(e.label)}</option>`,
      )
      .join("");

  const fields: string[] = [];
  for (const key of keys) {
    if (key === "type") {
      fields.push(
        `<div class="${wrapCls}">${selectFilter("rh-sol-f-tipo", "Tipo de solicitud", "tipo", tipoOpts)}</div>`,
      );
    } else if (key === "area") {
      fields.push(`<div class="${wrapCls}">${selectFilter("rh-sol-f-area", "Área", "area", areaOpts)}</div>`);
    } else if (key === "supervisor") {
      fields.push(`<div class="${wrapCls}">${selectFilter("rh-sol-f-sup", "Supervisor", "supervisor", supOpts)}</div>`);
    } else if (key === "employee") {
      const empField = solicitudesUsaFiltroEmpleadoTexto(vm.ui.role)
        ? empleadoTextoBusquedaFilterField(f)
        : selectFilter("rh-sol-f-emp", "Empleado", "empleado", empOpts);
      fields.push(`<div class="${wrapCls}">${empField}</div>`);
    } else if (key === "status") {
      fields.push(`<div class="${wrapCls}">${selectFilter("rh-sol-f-est", "Estado", "estado", estOpts)}</div>`);
    }
  }

  const clearVisible = filtrosActivos(f, keys);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 sm:w-auto xl:ml-1">
        <button
          type="button"
          data-rh-sol-clear-filters
          class="${BTN_GHOST} w-full sm:w-auto"
        >
          Limpiar filtros
        </button>
      </div>`
    : "";

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-label="Filtros de solicitudes">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${fields.join("")}
        ${clearBtn}
      </div>
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
    <section class="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 sm:p-4" aria-hidden="true" aria-label="Cargando filtros">
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap xl:gap-x-2 xl:overflow-x-auto xl:pb-0.5">
        ${slots}
      </div>
    </section>`;
}

function renderFiltersSection(vm: RhSolicitudesAdminViewModel): string {
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
  return renderFilters(vm);
}

function renderEmpleadoSolicitudesTableFooter(tbl: NonNullable<RhSolicitudesAdminViewModel["table"]>): string {
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
        ? "min-h-8 min-w-8 rounded-lg bg-leoni-blue px-2 text-xs font-bold text-white shadow-sm transition hover:bg-leoni-blue-light sm:px-2.5 sm:text-sm"
        : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
      return `<button type="button" data-rh-sol-page="${x}" class="${cls}">${x}</button>`;
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
            <label for="rh-sol-emp-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="rh-sol-emp-page-size" name="rh-sol-emp-page-size" data-rh-sol-page-size class="rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-sol-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-sol-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
}

function renderEmpleadoSolicitudesTable(vm: RhSolicitudesAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-busy="true" aria-label="Tus solicitudes">
        <div class="flex items-center gap-2.5 px-3 py-8 text-sm text-text-muted sm:px-4">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando solicitudes…
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Tus solicitudes">
        <div class="border-b border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800 sm:px-4" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? "Error al cargar la tabla.")}
        </div>
        <div class="px-3 py-8 text-center text-sm text-slate-500 sm:px-4">Sin datos disponibles.</div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0
      ? `<tr><td colspan="8" class="px-3 py-10 text-center text-sm text-slate-500 sm:px-4">No hay solicitudes con los filtros actuales.</td></tr>`
      : "";

  const rows =
    tbl && tbl.items.length > 0
      ? tbl.items
          .map((row) => {
            const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
            const dias = String(calcularDiasSolicitadosInclusive(row.fecha_inicio, row.fecha_fin));
            const pending = row.estado === "pending";
            const resueltaConsulta =
              row.estado === "approved" || row.estado === "rejected" || row.estado === "overridden";
            const clickable = pending || resueltaConsulta;
            const trClickCls = clickable
              ? "cursor-pointer hover:bg-slate-100/90 focus-within:bg-slate-50/90"
              : "";
            const trDataAttrs = pending
              ? ` tabindex="0" role="button" data-rh-sol-row-pending="1" data-rh-sol-id="${row.id}" title="${escapeHtml(SD_COPY.tituloFilaPendiente)}"`
              : resueltaConsulta
                ? ` tabindex="0" role="button" data-rh-sol-row-resuelta="1" data-rh-sol-id="${row.id}" title="${escapeHtml(SR_COPY.tituloFilaResuelta)}"`
                : "";
            const verBtn = clickable
              ? `<button type="button" class="rounded-lg px-2 py-1 text-xs font-semibold text-leoni-blue underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2" data-rh-sol-ver="${row.id}">Ver</button>`
              : `<span class="text-xs text-slate-400">—</span>`;
            return `
    <tr class="transition-colors hover:bg-slate-50/90 ${trClickCls}"${trDataAttrs}>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeHtml(num)}</td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_inicio))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_fin))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm font-medium tabular-nums text-slate-800 sm:px-4">${escapeHtml(dias)}</td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_solicitud))}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-right sm:px-4">${verBtn}</td>
    </tr>`;
          })
          .join("")
      : emptyRow;

  const footer =
    tbl && tbl.total > 0
      ? renderEmpleadoSolicitudesTableFooter(tbl)
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
    <section class="${sectionLayoutCls} rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Tus solicitudes">
      <div class="${tablaBodyWrapCls}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[720px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr class="text-white">
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Folio</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Tipo</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Inicio</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Fin</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Días</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Estatus</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Creación</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-right text-xs font-semibold sm:px-4 sm:text-sm">Detalle</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}

function renderTable(vm: RhSolicitudesAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-busy="true" aria-label="Solicitudes">
        <div class="flex items-center gap-2.5 px-3 py-8 text-sm text-text-muted sm:px-4">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando solicitudes…
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="shrink-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Solicitudes">
        <div class="border-b border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800 sm:px-4" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? "Error al cargar la tabla.")}
        </div>
        <div class="px-3 py-8 text-center text-sm text-slate-500 sm:px-4">Sin datos disponibles.</div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyExtraEmpTexto =
    solicitudesUsaFiltroEmpleadoTexto(vm.ui.role) && vm.filters.empleado_busqueda.trim()
      ? `<span class="mt-2 block text-xs text-slate-400">Prueba con otro nombre, identificador o folio.</span>`
      : "";
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0
      ? `<tr><td colspan="7" class="px-3 py-10 text-center text-sm text-slate-500 sm:px-4">No hay solicitudes con los filtros actuales.${emptyExtraEmpTexto}</td></tr>`
      : "";

  const rows =
    tbl && tbl.items.length > 0
      ? tbl.items
          .map((row) => {
            const num = row.numero_folio.startsWith("#") ? row.numero_folio : `#${row.numero_folio}`;
            const pending = row.estado === "pending";
            const resueltaConsulta =
              row.estado === "approved" || row.estado === "rejected" || row.estado === "overridden";
            const clickable = pending || resueltaConsulta;
            const trClickCls = clickable
              ? "cursor-pointer hover:bg-slate-100/90 focus-within:bg-slate-50/90"
              : "";
            const trDataAttrs = pending
              ? ` tabindex="0" role="button" data-rh-sol-row-pending="1" data-rh-sol-id="${row.id}" title="${escapeHtml(SD_COPY.tituloFilaPendiente)}"`
              : resueltaConsulta
                ? ` tabindex="0" role="button" data-rh-sol-row-resuelta="1" data-rh-sol-id="${row.id}" title="${escapeHtml(SR_COPY.tituloFilaResuelta)}"`
                : "";
            return `
    <tr class="transition-colors hover:bg-slate-50/90 ${trClickCls}"${trDataAttrs}>
      <td class="px-3 py-2.5 align-middle sm:px-4">${celdaEmpleado(row)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm font-medium tabular-nums text-slate-700 sm:px-4">${escapeHtml(num)}</td>
      <td class="max-w-40 px-3 py-2.5 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span>
      </td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeTipo(row.tipo)}</td>
      <td class="whitespace-nowrap px-3 py-2.5 align-middle text-sm text-slate-600 sm:px-4">${escapeHtml(fmtFechaCorta(row.fecha_solicitud))}</td>
      <td class="max-w-56 px-3 py-2.5 align-middle text-sm text-slate-700 sm:px-4">
        <span class="block truncate" title="${escapeHtml(fmtPeriodo(row))}">${escapeHtml(fmtPeriodo(row))}</span>
      </td>
      <td class="px-3 py-2.5 align-middle sm:px-4">${badgeEstado(row.estado)}</td>
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
                ? "min-h-8 min-w-8 rounded-lg bg-leoni-blue px-2 text-xs font-bold text-white shadow-sm transition hover:bg-leoni-blue-light sm:px-2.5 sm:text-sm"
                : "min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:px-2.5 sm:text-sm";
              return `<button type="button" data-rh-sol-page="${x}" class="${cls}">${x}</button>`;
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
            <label for="rh-sol-page-size" class="text-xs font-medium text-slate-600 sm:text-sm">Registros por página</label>
            <select id="rh-sol-page-size" name="rh-sol-page-size" data-rh-sol-page-size class="rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-xs font-medium text-slate-800 shadow-sm sm:text-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end">
          <button type="button" data-rh-sol-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-sol-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
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

  return `
    <section class="${sectionLayoutClsGestor} rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Listado de solicitudes">
      <div class="${tablaBodyWrapClsGestor}">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[880px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr class="text-white">
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Empleado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Número</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Área</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Tipo</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Fecha solicitud</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Periodo solicitado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold sm:px-4 sm:text-sm">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
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
            class="${BTN_PRIMARY} shrink-0"
          >
            <span aria-hidden="true">+</span> Nueva solicitud
          </button>`
      : "";
    return `
    <div id="rh-solicitudes-root" class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <header class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h1 class="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">Solicitudes</h1>
          <p class="mt-0.5 max-w-2xl text-xs leading-snug text-text-muted sm:text-sm">Consulta, seguimiento y registro de tus solicitudes</p>
        </div>
        ${nuevaBtn}
      </header>
      <div id="rh-sol-emp-stats" class="shrink-0">${renderEmployeePersonalStatCards(vm)}</div>
      <div id="rh-sol-filters" class="shrink-0">${renderFiltersSection(vm)}</div>
      <div id="rh-sol-table" class="flex min-h-0 flex-1 flex-col">${renderEmpleadoSolicitudesTable(vm)}</div>
    </div>`;
  }

  const exportBtn = vm.ui.showExportButton
    ? `<button
            type="button"
            id="rh-sol-export"
            class="${BTN_SECONDARY}"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar solicitudes
          </button>`
    : "";

  const nuevaGestorBtn = vm.ui.showNewRequestButton
    ? `<button
            type="button"
            id="rh-sol-nueva"
            class="${BTN_PRIMARY}"
          >
            <span aria-hidden="true">+</span> Nueva solicitud
          </button>`
    : "";
  const toolbarGestor =
    vm.ui.showGestorToolbar && (vm.ui.showExportButton || vm.ui.showNewRequestButton)
      ? `<div class="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-2.5">${exportBtn}${nuevaGestorBtn}</div>`
      : "";

  return `
    <div id="rh-solicitudes-root" class="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <div class="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4">
        <p class="min-w-0 max-w-2xl text-xs leading-snug text-text-muted sm:max-w-none sm:text-sm">Gestión y aprobación de vacaciones y home office</p>
        ${toolbarGestor}
      </div>

      <div id="rh-sol-stats" class="shrink-0">${renderStatCards(vm)}</div>
      <div id="rh-sol-filters" class="shrink-0">${renderFiltersSection(vm)}</div>
      <div id="rh-sol-table" class="flex min-h-0 flex-1 flex-col">${renderTable(vm)}</div>
    </div>`;
}
