import type { ComedorPanelState, ComedorRhProximosRegistrosPage } from "../../comedor/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import {
  renderComedorReservationsFiltersToolbar,
  type ComedorTableFiltersState,
} from "./comedorReservationsTable.ts";
import { COMEDOR_TABLE_TH, escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

function th(label: string): string {
  return `<th scope="col" class="${COMEDOR_TABLE_TH}">${escapeComedorHtml(label)}</th>`;
}

export function formatFechaServicioRhRegistro(iso: string): string {
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(y, m - 1, d))
    .replace(".", "");
}

function tipoComidaLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k === "casera") return "Opción A";
  if (k === "saludable") return "Opción B";
  return raw;
}

export function tipoComidaBadgeRhRegistro(raw: string): string {
  const label = tipoComidaLabel(raw);
  const k = raw.trim().toLowerCase();
  const base =
    "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  if (k === "saludable") {
    return `<span class="${base} border-emerald-200/90 bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeComedorHtml(label)}</span>`;
  }
  if (k === "casera") {
    return `<span class="${base} border-sky-200/90 bg-linear-to-r from-sky-50 to-blue-50 text-sky-950"><span class="size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true"></span>${escapeComedorHtml(label)}</span>`;
  }
  return `<span class="${base} border-slate-200 bg-slate-50 text-slate-800">${escapeComedorHtml(label)}</span>`;
}

function dot(cls: string): string {
  return `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
}

export function estadoAccesoBadgeRhRegistro(estado: string): string {
  const k = estado.trim().toUpperCase();
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  if (k === "ACCEDIDO") {
    return `<span class="${base} border-emerald-200/90 bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-900">${dot("bg-emerald-500")}${escapeComedorHtml("Accedido")}</span>`;
  }
  if (k === "PENDIENTE") {
    return `<span class="${base} border-amber-200/90 bg-linear-to-r from-amber-50 to-yellow-50 text-amber-950">${dot("bg-amber-400")}${escapeComedorHtml("Pendiente")}</span>`;
  }
  if (k === "EXPIRADO") {
    return `<span class="${base} border-red-200/90 bg-linear-to-r from-red-50 to-rose-50 text-red-900">${dot("bg-red-400")}${escapeComedorHtml("Cancelado")}</span>`;
  }
  return `<span class="${base} border-slate-200 bg-slate-50 text-slate-800">${escapeComedorHtml(estado)}</span>`;
}

function proximosSubtitle(filters: ComedorTableFiltersState): string {
  const tipoTxt =
    filters.tipoComidaFilter === "casera"
      ? " tipo Opción A"
      : filters.tipoComidaFilter === "saludable"
        ? " tipo Opción B"
        : "";
  if (filters.statusFilter === "confirmado") return `Desde hoy: solo accedidos${tipoTxt}, ordenados por fecha.`;
  if (filters.statusFilter === "cancelado") return `Desde hoy: accesos cancelados/expirados${tipoTxt}, ordenados por fecha.`;
  return `Desde hoy: pendientes y accedidos${tipoTxt}, ordenados por fecha.`;
}

function proximosEmptyMessage(filters: ComedorTableFiltersState): string {
  if (filters.statusFilter !== "todos" || filters.search.trim()) {
    return "No hay registros que coincidan con tu búsqueda o filtro.";
  }
  return "No hay registros futuros desde hoy.";
}

export function renderComedorRhProximosRegistrosTable(
  state: ComedorPanelState,
  data: ComedorRhProximosRegistrosPage | null,
  errorMessage: string | null,
  filters: ComedorTableFiltersState,
): string {
  const pageSize = data?.page_size ?? 10;
  const pageSizeSelect = `
    <label class="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <span class="font-medium">Registros por página</span>
      <select
        data-comedor-rh-futuros-page-size
        class="min-h-10 rounded-[10px] border border-[rgba(148,163,184,0.35)] bg-white px-2.5 py-2 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
      >
        <option value="10" ${pageSize === 10 ? "selected" : ""}>10</option>
        <option value="50" ${pageSize === 50 ? "selected" : ""}>50</option>
      </select>
    </label>`;

  const toolbar = renderComedorReservationsFiltersToolbar(filters, "rh-futuros");

  if (state === "loading") {
    return `
      <div class="mt-2 flex flex-col gap-3">
        ${toolbar}
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="${RH_LISTADO_SURFACE} overflow-hidden" aria-busy="true">
          <div class="animate-pulse p-4 sm:p-5">
            <div class="h-10 rounded-lg bg-slate-100"></div>
            <div class="mt-3 h-10 rounded-lg bg-slate-100"></div>
            <div class="mt-3 h-10 rounded-lg bg-slate-100"></div>
          </div>
        </section>
      </div>`;
  }

  if (state === "error") {
    return `
      <div class="mt-2 flex flex-col gap-3">
        ${toolbar}
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="rh-sol-table-error-fallback rounded-2xl border border-red-200/90 px-4 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <p class="font-semibold text-red-900">No fue posible cargar los próximos registros.</p>
          <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
          <button type="button" data-comedor-rh-futuros-retry class="mt-3 inline-flex min-h-10 items-center rounded-[10px] border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2">
            Reintentar
          </button>
        </section>
      </div>`;
  }

  const itemsFiltradosPorTipo =
    filters.tipoComidaFilter && filters.tipoComidaFilter !== "todos"
      ? (data?.items ?? []).filter(
          (row) => (row.tipo_comida || "").trim().toLowerCase() === filters.tipoComidaFilter,
        )
      : (data?.items ?? []);

  if (!data || itemsFiltradosPorTipo.length === 0) {
    return `
      <div class="mt-2 flex flex-col gap-3">
        ${toolbar}
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="${RH_LISTADO_SURFACE} overflow-hidden">
          <div class="rh-sol-empty px-4 py-12 sm:px-6" role="status">
            <p class="text-center text-sm font-semibold text-[#0f172a]">${escapeComedorHtml(proximosEmptyMessage(filters))}</p>
            <p class="mx-auto mt-2 max-w-md text-center text-xs leading-relaxed text-[#64748b]">Prueba ajustando la búsqueda o el filtro de estado.</p>
          </div>
        </section>
      </div>`;
  }

  const rows = itemsFiltradosPorTipo
    .map(
      (row) => `
      <tr class="rh-comedor-data-row transition-colors">
        <td class="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-800 sm:px-4">${escapeComedorHtml(formatFechaServicioRhRegistro(row.fecha_servicio))}</td>
        <td class="min-w-0 px-3 py-3 sm:px-4">
          <p class="truncate text-sm font-semibold leading-snug text-[#0f172a]">${escapeComedorHtml(row.empleado_nombre)}</p>
          <p class="truncate text-xs font-medium tabular-nums text-[#64748b]">${escapeComedorHtml(row.no_empleado)}</p>
        </td>
        <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.area || "—")}</td>
        <td class="whitespace-nowrap px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.comedor_nombre || "—")}</td>
        <td class="whitespace-nowrap px-3 py-3 sm:px-4">${tipoComidaBadgeRhRegistro(row.tipo_comida)}</td>
        <td class="whitespace-nowrap px-3 py-3 sm:px-4">${estadoAccesoBadgeRhRegistro(row.estado_acceso)}</td>
      </tr>`,
    )
    .join("");

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));
  const pageButtons = paginationRange(totalPages, data.page)
    .map((entry) => {
      if (entry === "ellipsis") {
        return '<span class="flex min-h-10 items-center px-2 text-sm text-slate-500">…</span>';
      }
      const active = entry === data.page;
      return `<button type="button" data-comedor-rh-futuros-page="${entry}" class="${
        active
          ? "min-h-10 min-w-10 rounded-lg bg-leoni-blue px-3 text-sm font-bold text-white shadow-md transition hover:bg-leoni-blue-light"
          : "min-h-10 min-w-10 rounded-lg px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
      }">${entry}</button>`;
    })
    .join("");

  return `
    <div class="mt-2 flex flex-col gap-3">
      ${toolbar}
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-base font-semibold tracking-tight text-[#0f172a]">Reservas y asistencias</h2>
          <p class="mt-0.5 text-xs text-[#64748b]">${escapeComedorHtml(proximosSubtitle(filters))}</p>
        </div>
        ${pageSizeSelect}
      </div>
      <section class="rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden" aria-label="Próximos registros de comedor">
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-left">
            <thead class="rh-sol-thead">
              <tr>
                ${th("Fecha servicio")}
                ${th("Empleado")}
                ${th("Área")}
                ${th("Comedor")}
                ${th("Tipo de comida")}
                ${th("Estado")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90 bg-white">${rows}</tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-4">
          <p class="text-xs text-slate-500 sm:text-sm">Mostrando <span class="font-semibold text-slate-700">${itemsFiltradosPorTipo.length}</span> de <span class="font-semibold text-slate-700">${data.total}</span></p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-comedor-rh-futuros-page="${data.page - 1}" ${data.page <= 1 ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
              Anterior
            </button>
            <div class="flex items-center gap-1">${pageButtons}</div>
            <button type="button" data-comedor-rh-futuros-page="${data.page + 1}" ${data.page >= totalPages ? "disabled" : ""} class="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2">
              Siguiente
            </button>
          </div>
        </footer>
      </section>
    </div>`;
}
