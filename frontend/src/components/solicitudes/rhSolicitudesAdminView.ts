import { SD_COPY } from "../../solicitudes/rh/solicitudDetalleCopy.ts";
import { SR_COPY } from "../../solicitudes/rh/solicitudResueltaCopy.ts";
import type {
  RhSolicitudesAdminViewModel,
  RhSolicitudEstadoCodigo,
  RhSolicitudFilterState,
  RhSolicitudTablaFila,
  RhSolicitudTipoCodigo,
} from "../../solicitudes/rh/types.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const FIELD_FOCUS =
  "outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-leoni-blue focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2";

/** Contenedor de cada filtro: crece y reparte espacio; en móvil 1 col, sm ~2 cols, lg fila fluida con el botón. */
const RH_SOL_FILTERS_FIELD_WRAP =
  "min-w-0 w-full flex-1 basis-full sm:basis-[calc(50%-0.5rem)] lg:min-w-[12.5rem] lg:basis-0";

const SELECT_CHEVRON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" class="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end text-gray-500 sm:size-4">
  <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
</svg>`;

function fmtFechaCorta(iso: string): string {
  const p = iso.trim().split("-");
  if (p.length !== 3) return iso;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function fmtPeriodo(row: RhSolicitudTablaFila): string {
  if (row.periodo_etiqueta?.trim()) return row.periodo_etiqueta.trim();
  const a = fmtFechaCorta(row.fecha_inicio);
  const b = fmtFechaCorta(row.fecha_fin);
  if (row.fecha_inicio === row.fecha_fin) return a;
  return `${a} – ${b}`;
}

function badgeTipo(t: RhSolicitudTipoCodigo): string {
  if (t === "vacaciones") {
    return `<span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-900">Vacaciones</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-900">Home Office</span>`;
}

function badgeEstado(e: RhSolicitudEstadoCodigo): string {
  switch (e) {
    case "pending":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
        <span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>Pendiente</span>`;
    case "approved":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
        <span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>Aprobado</span>`;
    case "rejected":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
        <span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>Rechazado</span>`;
    case "changes_requested":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900">
        <span class="size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true"></span>Cambios solicitados</span>`;
    case "cancelled":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        <span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>Cancelado</span>`;
    case "overridden":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
        <span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>Override</span>`;
    default:
      return `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">${escapeHtml(e)}</span>`;
  }
}

function celdaEmpleado(row: RhSolicitudTablaFila): string {
  const name = formatNombreEmpleadoUi(row.empleado_nombre_raw) || "Sin nombre";
  const ini = inicialesDesdeNombreDisplay(name);
  const foto = row.foto_url?.trim();
  const avatar = foto
    ? `<img src="${escapeHtml(foto)}" alt="" class="size-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />`
    : `<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(ini)}</span>`;
  return `
    <div class="flex min-w-0 items-center gap-3">
      ${avatar}
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-900">${escapeHtml(name)}</p>
      </div>
    </div>`;
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

function filtrosActivos(f: RhSolicitudFilterState): boolean {
  return Boolean(f.tipo || f.area_id || f.supervisor_id || f.estado);
}

function selectFilter(
  id: string,
  label: string,
  name: string,
  optionsHtml: string,
): string {
  return `<div class="min-w-0">
  <label for="${id}" class="block text-sm/6 font-medium text-gray-900">${escapeHtml(label)}</label>
  <div class="mt-2 grid grid-cols-1">
    <select id="${id}" name="${name}" data-rh-sol-filter="${name}" class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pr-8 pl-3 text-base text-gray-900 sm:text-sm/6 ${FIELD_FOCUS}">
      ${optionsHtml}
    </select>
    ${SELECT_CHEVRON}
  </div>
</div>`;
}

function renderStatCards(vm: RhSolicitudesAdminViewModel): string {
  if (vm.statsStatus === "loading" || vm.stats === null) {
    const skel = `
      <div class="animate-pulse rounded-xl border border-border bg-white p-5 shadow-sm">
        <div class="h-4 w-28 rounded bg-slate-200"></div>
        <div class="mt-4 h-9 w-16 rounded bg-slate-200"></div>
        <div class="mt-4 h-2 w-full rounded-full bg-slate-100"></div>
      </div>`;
    return `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">${skel.repeat(4)}</div>`;
  }

  if (vm.statsStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">No se pudieron calcular las métricas.</div>`;
  }

  const s = vm.stats;
  const cards: { title: string; value: number; bar: string; borderTop: string }[] = [
    {
      title: "Pendientes",
      value: s.pendientes,
      bar: "bg-leoni-blue",
      borderTop: "border-t-leoni-blue",
    },
    {
      title: "Vacaciones",
      value: s.vacaciones,
      bar: "bg-orange-500",
      borderTop: "border-t-orange-500",
    },
    {
      title: "Home Office",
      value: s.home_office,
      bar: "bg-violet-600",
      borderTop: "border-t-violet-600",
    },
    {
      title: "Aprobadas hoy",
      value: s.aprobadas_hoy,
      bar: "bg-emerald-500",
      borderTop: "border-t-emerald-500",
    },
  ];

  const html = cards
    .map(
      (c) => `
    <article class="flex h-full flex-col rounded-xl border border-border border-t-4 ${c.borderTop} bg-white p-5 shadow-sm">
      <h2 class="text-sm font-medium text-text-muted">${escapeHtml(c.title)}</h2>
      <p class="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(String(c.value))}</p>
      <div class="mt-auto pt-5">
        <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="presentation">
          <div class="h-full w-full rounded-full ${c.bar}"></div>
        </div>
      </div>
    </article>`,
    )
    .join("");

  return `<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">${html}</div>`;
}

function renderFilters(vm: RhSolicitudesAdminViewModel): string {
  const f = vm.filters;
  const opt = vm.filterOptions;

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

  const estOpts =
    `<option value="" ${f.estado === "" ? "selected" : ""}>Todos los estados</option>` +
    opt.estados
      .map(
        (e) =>
          `<option value="${escapeHtml(e.id)}" ${f.estado === e.id ? "selected" : ""}>${escapeHtml(e.label)}</option>`,
      )
      .join("");

  const clearVisible = filtrosActivos(f);
  const clearBtn = clearVisible
    ? `<div class="w-full shrink-0 transition-all duration-200 ease-out sm:w-auto">
        <button
          type="button"
          data-rh-sol-clear-filters
          class="inline-flex h-9 w-full min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 ease-out hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2 sm:w-auto"
        >
          Limpiar filtros
        </button>
      </div>`
    : "";

  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-label="Filtros de solicitudes">
      <div class="flex flex-wrap items-end gap-4">
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${selectFilter("rh-sol-f-tipo", "Tipo de solicitud", "tipo", tipoOpts)}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${selectFilter("rh-sol-f-area", "Área", "area", areaOpts)}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${selectFilter("rh-sol-f-sup", "Supervisor", "supervisor", supOpts)}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${selectFilter("rh-sol-f-est", "Estado", "estado", estOpts)}</div>
        ${clearBtn}
      </div>
    </section>`;
}

function renderFiltersSkeleton(): string {
  const cell = `
    <div class="min-w-0 animate-pulse">
      <div class="h-4 w-28 max-w-full rounded bg-slate-200"></div>
      <div class="mt-2 h-9 w-full rounded-md bg-slate-100"></div>
    </div>`;
  return `
    <section class="rounded-xl border border-slate-200/90 bg-white p-4 pt-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6 sm:pt-6" aria-hidden="true" aria-label="Cargando filtros">
      <div class="flex flex-wrap items-end gap-4">
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${cell}</div>
        <div class="${RH_SOL_FILTERS_FIELD_WRAP}">${cell}</div>
      </div>
    </section>`;
}

function renderFiltersSection(vm: RhSolicitudesAdminViewModel): string {
  if (vm.tableStatus === "error" && vm.statsStatus === "error") {
    return "";
  }
  if (vm.statsStatus === "loading") {
    return renderFiltersSkeleton();
  }
  return renderFilters(vm);
}

function renderTable(vm: RhSolicitudesAdminViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-busy="true" aria-label="Solicitudes">
        <div class="flex items-center gap-3 px-4 py-14 text-sm text-text-muted sm:px-6">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          Cargando solicitudes…
        </div>
      </section>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Solicitudes">
        <div class="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-6" role="alert">
          ${escapeHtml(vm.tableErrorMessage ?? "Error al cargar la tabla.")}
        </div>
        <div class="px-4 py-12 text-center text-sm text-slate-500 sm:px-6">Sin datos disponibles.</div>
      </section>`;
  }

  const tbl = vm.table;
  const emptyRow =
    vm.tableStatus === "empty" || !tbl || tbl.total === 0
      ? `<tr><td colspan="7" class="px-4 py-14 text-center text-sm text-slate-500">No hay solicitudes con los filtros actuales.</td></tr>`
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
      <td class="px-4 py-4 align-middle">${celdaEmpleado(row)}</td>
      <td class="whitespace-nowrap px-4 py-4 align-middle text-sm font-medium tabular-nums text-slate-700">${escapeHtml(num)}</td>
      <td class="max-w-40 px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${escapeHtml(row.area)}">${escapeHtml(row.area)}</span>
      </td>
      <td class="px-4 py-4 align-middle">${badgeTipo(row.tipo)}</td>
      <td class="whitespace-nowrap px-4 py-4 align-middle text-sm text-slate-600">${escapeHtml(fmtFechaCorta(row.fecha_solicitud))}</td>
      <td class="max-w-56 px-4 py-4 align-middle text-sm text-slate-700">
        <span class="block truncate" title="${escapeHtml(fmtPeriodo(row))}">${escapeHtml(fmtPeriodo(row))}</span>
      </td>
      <td class="px-4 py-4 align-middle">${badgeEstado(row.estado)}</td>
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
                return `<span class="flex min-h-10 items-center px-2 text-sm text-slate-500">…</span>`;
              }
              const active = x === tbl.page;
              const cls = active
                ? "min-h-10 min-w-10 rounded-lg bg-leoni-blue px-3 text-sm font-bold text-white shadow-md transition hover:bg-leoni-blue-light"
                : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";
              return `<button type="button" data-rh-sol-page="${x}" class="${cls}">${x}</button>`;
            })
            .join("");
          const pageSizeOpts = [5, 10, 25, 50]
            .map((n) => `<option value="${n}" ${n === tbl.page_size ? "selected" : ""}>${n}</option>`)
            .join("");
          return `
      <div class="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <p class="text-sm font-medium text-slate-600">
            Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${tbl.total}</span> solicitudes
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <label for="rh-sol-page-size" class="text-sm font-medium text-slate-600">Registros por página</label>
            <select id="rh-sol-page-size" name="rh-sol-page-size" data-rh-sol-page-size class="rounded-md border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm ${FIELD_FOCUS}">
              ${pageSizeOpts}
            </select>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
          <button type="button" data-rh-sol-page="${tbl.page - 1}" ${tbl.page <= 1 ? "disabled" : ""}
            class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Anterior</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
          </button>
          ${pageButtons}
          <button type="button" data-rh-sol-page="${tbl.page + 1}" ${tbl.page >= totalPages ? "disabled" : ""}
            class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
            <span class="sr-only">Siguiente</span>
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
          </button>
        </div>
      </div>`;
        })()
      : tbl
        ? `
      <div class="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-500 sm:px-6">
        Mostrando 0 de 0 solicitudes
      </div>`
        : "";

  return `
    <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Listado de solicitudes">
      <div class="-mx-4 max-h-[min(72vh,780px)] overflow-auto sm:mx-0">
        <span class="sr-only">En pantallas pequeñas puedes desplazar la tabla horizontalmente.</span>
        <table class="min-w-[880px] w-full text-left">
          <thead class="border-b border-leoni-blue-light shadow-sm">
            <tr class="text-white">
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Empleado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Número</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Área</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Tipo</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Fecha solicitud</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Periodo solicitado</th>
              <th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-4 py-3 text-left text-sm font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
        </table>
      </div>
      ${footer}
    </section>`;
}

/** HTML principal de la vista RH (sin el shell). */
export function renderRhSolicitudesAdminView(vm: RhSolicitudesAdminViewModel): string {
  return `
    <div id="rh-solicitudes-root" class="space-y-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p class="max-w-2xl text-sm text-text-muted">Gestión y aprobación de vacaciones y home office</p>
        <div class="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          <button
            type="button"
            id="rh-sol-export"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-leoni-blue/40 hover:bg-slate-50 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5 text-slate-500" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar solicitudes
          </button>
          <button
            type="button"
            id="rh-sol-nueva"
            class="inline-flex items-center gap-2 rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-leoni-blue-light focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">+</span> Nueva solicitud
          </button>
        </div>
      </div>

      <div id="rh-sol-stats">${renderStatCards(vm)}</div>
      <div id="rh-sol-filters">${renderFiltersSection(vm)}</div>
      <div id="rh-sol-table">${renderTable(vm)}</div>
    </div>`;
}
