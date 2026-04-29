import type { ComedorPanelState, ComedorRhProximosRegistrosPage } from "../../comedor/rh/types.ts";
import {
  renderComedorReservationsFiltersToolbar,
  type ComedorTableFiltersState,
} from "./comedorReservationsTable.ts";
import { escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

function th(label: string): string {
  return `<th scope="col" class="sticky top-0 z-20 bg-leoni-blue px-3 py-2 text-left text-xs font-semibold text-white sm:px-4 sm:text-sm">${escapeComedorHtml(label)}</th>`;
}

function formatFechaServicio(iso: string): string {
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
  if (k === "casera") return "Casera";
  if (k === "saludable") return "Saludable";
  return raw;
}

function estadoAccesoBadge(estado: string): string {
  const k = estado.trim().toUpperCase();
  if (k === "ACCEDIDO") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900">${escapeComedorHtml("Accedido")}</span>`;
  }
  if (k === "PENDIENTE") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">${escapeComedorHtml("Pendiente")}</span>`;
  }
  if (k === "EXPIRADO") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">${escapeComedorHtml("Cancelado")}</span>`;
  }
  return `<span class="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">${escapeComedorHtml(estado)}</span>`;
}

function proximosSubtitle(filters: ComedorTableFiltersState): string {
  if (filters.statusFilter === "confirmado") return "Desde hoy: solo accedidos, ordenados por fecha.";
  if (filters.statusFilter === "cancelado") return "Desde hoy: accesos cancelados/expirados, ordenados por fecha.";
  return "Desde hoy: pendientes y accedidos, ordenados por fecha.";
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
        class="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue"
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
          <h2 class="text-base font-semibold text-text-primary">Próximas reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-busy="true">
          <div class="animate-pulse p-4 sm:p-5">
            <div class="h-10 rounded bg-slate-100"></div>
            <div class="mt-3 h-10 rounded bg-slate-100"></div>
            <div class="mt-3 h-10 rounded bg-slate-100"></div>
          </div>
        </section>
      </div>`;
  }

  if (state === "error") {
    return `
      <div class="mt-2 flex flex-col gap-3">
        ${toolbar}
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-semibold text-text-primary">Próximas reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
          <p class="font-semibold">No fue posible cargar los próximos registros.</p>
          <p class="mt-1">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
          <button type="button" data-comedor-rh-futuros-retry class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
            Reintentar
          </button>
        </section>
      </div>`;
  }

  if (!data || data.items.length === 0) {
    return `
      <div class="mt-2 flex flex-col gap-3">
        ${toolbar}
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-base font-semibold text-text-primary">Próximas reservas y asistencias</h2>
          ${pageSizeSelect}
        </div>
        <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
          <p class="px-4 py-12 text-center text-sm text-slate-500">${escapeComedorHtml(proximosEmptyMessage(filters))}</p>
        </section>
      </div>`;
  }

  const rows = data.items
    .map(
      (row) => `
      <tr class="hover:bg-slate-50">
        <td class="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-800 sm:px-4">${escapeComedorHtml(formatFechaServicio(row.fecha_servicio))}</td>
        <td class="min-w-0 px-3 py-2.5 sm:px-4">
          <p class="truncate text-sm font-semibold text-slate-900">${escapeComedorHtml(row.empleado_nombre)}</p>
          <p class="truncate text-xs text-slate-500">${escapeComedorHtml(row.no_empleado)}</p>
        </td>
        <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.area || "—")}</td>
        <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(row.comedor_nombre || "—")}</td>
        <td class="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(tipoComidaLabel(row.tipo_comida))}</td>
        <td class="whitespace-nowrap px-3 py-2.5 sm:px-4">${estadoAccesoBadge(row.estado_acceso)}</td>
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
          <h2 class="text-base font-semibold text-text-primary">Próximas reservas y asistencias</h2>
          <p class="mt-0.5 text-xs text-text-muted">${escapeComedorHtml(proximosSubtitle(filters))}</p>
        </div>
        ${pageSizeSelect}
      </div>
      <section class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5" aria-label="Próximos registros de comedor">
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-left">
            <thead class="border-b border-leoni-blue-light shadow-sm">
              <tr>
                ${th("Fecha servicio")}
                ${th("Empleado")}
                ${th("Área")}
                ${th("Comedor")}
                ${th("Tipo de comida")}
                ${th("Estado")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
          </table>
        </div>
        <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-4">
          <p class="text-xs text-slate-500 sm:text-sm">Mostrando <span class="font-semibold text-slate-700">${data.items.length}</span> de <span class="font-semibold text-slate-700">${data.total}</span></p>
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
