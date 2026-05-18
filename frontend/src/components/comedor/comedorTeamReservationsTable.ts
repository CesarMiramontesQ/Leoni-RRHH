import type {
  ComedorPanelState,
  ComedorSupervisorTableSegment,
  ComedorTeamReservationsPage,
} from "../../comedor/rh/types.ts";
import { RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { COMEDOR_TABLE_TH, escapeComedorHtml, paginationRange } from "./comedorUiUtils.ts";

type TeamTableFiltersState = {
  search: string;
  supervisorSegment: ComedorSupervisorTableSegment;
  showSupervisorSegment: boolean;
};

function iconChevronLeft(): string {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0" aria-hidden="true"><path d="M12.5 15.5 7 10l5.5-5.5" /></svg>`;
}

function iconChevronRight(): string {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" /></svg>`;
}

/** Lupa — identificación rápida del buscador */
function iconSearch(): string {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" class="size-[18px] shrink-0 opacity-90" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m17 17-3.55-3.55m1.05-4.45a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z" /></svg>`;
}

/** Flecha del select — discreta, alineada al accent */
function iconSelectChevron(): string {
  return `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m6 8 4 4 4-4" /></svg>`;
}

/** Etiquetas de filtros: caps compactas, sin competir con el contenido */
function filterFieldLabel(): string {
  return "mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500";
}

/** Altura y estados homogéneos (focus corporativo leoni-blue) */
function filterControlBase(): string {
  return [
    "h-11 w-full rounded-lg border border-slate-200/90 bg-white text-sm text-[#0f172a]",
    "shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
    "transition-[border-color,box-shadow,background-color] duration-150",
    "placeholder:text-slate-400",
    "hover:border-slate-300 hover:bg-[#fafbfc] hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
    "focus:border-leoni-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-leoni-blue/25 focus:shadow-[0_1px_4px_rgba(37,99,235,0.14)]",
  ].join(" ");
}

function estadoBadge(estado: string): string {
  const key = estado.trim().toUpperCase();
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  const dot = (cls: string) => `<span class="size-1.5 shrink-0 rounded-full ${cls}" aria-hidden="true"></span>`;
  if (key === "ACCEDIDO") {
    return `<span class="${base} border-emerald-200/90 bg-linear-to-r from-emerald-50 to-teal-50 text-emerald-900">${dot("bg-emerald-500")}Accedido</span>`;
  }
  if (key === "PENDIENTE") {
    return `<span class="${base} border-amber-200/90 bg-linear-to-r from-amber-50 to-yellow-50 text-amber-950">${dot("bg-amber-400")}Pendiente</span>`;
  }
  return `<span class="${base} border-slate-200 bg-slate-50 text-slate-700">${dot("bg-slate-400")}Sin dato</span>`;
}

function th(label: string, extra = ""): string {
  return `<th scope="col" class="${COMEDOR_TABLE_TH} ${extra}">${escapeComedorHtml(label)}</th>`;
}

function emptyStatusMessage(filters: TeamTableFiltersState): string {
  if (filters.showSupervisorSegment) {
    if (filters.supervisorSegment === "personal") {
      return "No tienes registros próximos en vista personal. Prueba «Registros de equipo» o crea una reserva.";
    }
    return "No hay registros próximos de tu equipo en esta vista. Ajusta la búsqueda o el alcance.";
  }
  return "No hay registros próximos del equipo.";
}

export function renderComedorTeamReservationsTable(
  state: ComedorPanelState,
  tableData: ComedorTeamReservationsPage | null,
  filters: TeamTableFiltersState,
  errorMessage: string | null,
): string {
  const segmentBlock = filters.showSupervisorSegment
    ? `<div class="w-full min-w-0 sm:w-[min(100%,16rem)] sm:shrink-0">
         <label for="comedor-equipo-tabla-segmento" class="${filterFieldLabel()}">Alcance</label>
         <div class="group relative">
           <select
             id="comedor-equipo-tabla-segmento"
             data-comedor-table-segment
             class="${filterControlBase()} cursor-pointer appearance-none px-3.5 pr-10"
             aria-label="Filtrar por alcance del listado"
           >
             <option value="personal" ${filters.supervisorSegment === "personal" ? "selected" : ""}>Mis registros</option>
             <option value="equipo" ${filters.supervisorSegment === "equipo" ? "selected" : ""}>Registros de equipo</option>
           </select>
           <span class="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 transition-colors duration-150 group-focus-within:text-leoni-blue" aria-hidden="true">${iconSelectChevron()}</span>
         </div>
       </div>`
    : "";

  const toolbar = `
    <section class="${RH_LISTADO_SURFACE} rh-sol-filters-card border border-slate-200/75 shadow-[0_1px_3px_rgba(15,23,42,0.04)]" aria-label="Filtros del listado de reservas">
      <div class="px-3 pb-6 pt-6 sm:px-4">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6 lg:gap-8">
          ${segmentBlock}
          <div class="min-w-0 flex-1">
            <label for="comedor-equipo-tabla-busqueda" class="${filterFieldLabel()}">Buscar por empleado</label>
            <div class="group relative">
              <span class="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-slate-400 transition-colors duration-150 group-focus-within:text-leoni-blue" aria-hidden="true">${iconSearch()}</span>
              <input
                id="comedor-equipo-tabla-busqueda"
                type="search"
                value="${escapeComedorHtml(filters.search)}"
                data-comedor-search
                placeholder="Nombre del colaborador…"
                autocomplete="off"
                class="${filterControlBase()} pl-10 pr-3.5"
              />
            </div>
          </div>
        </div>
      </div>
    </section>`;

  if (state === "loading") {
    return `<div class="flex flex-col gap-5">${toolbar}<section class="${RH_LISTADO_SURFACE} overflow-hidden"><div class="animate-pulse px-3 py-4 sm:px-4"><div class="h-11 rounded-lg bg-slate-100"></div></div></section></div>`;
  }
  if (state === "error") {
    return `<div class="flex flex-col gap-5">${toolbar}<section class="rounded-2xl border border-red-200/90 bg-white px-3 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)] sm:px-4">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</section></div>`;
  }
  if (state === "empty" || !tableData || tableData.items.length === 0) {
    return `<div class="flex flex-col gap-5">${toolbar}<section class="${RH_LISTADO_SURFACE} overflow-hidden"><div class="rh-sol-empty px-3 py-12 text-center text-sm leading-relaxed text-[#64748b] sm:px-4" role="status">${escapeComedorHtml(emptyStatusMessage(filters))}</div></section></div>`;
  }

  const rows = tableData.items
    .map(
      (item) => `<tr class="rh-comedor-data-row transition-colors">
        <td class="px-3 py-3 text-sm font-semibold text-[#0f172a] sm:px-4">${escapeComedorHtml(item.empleadoNombre)}</td>
        <td class="px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(item.tipoComida)}</td>
        <td class="px-3 py-3 text-sm text-slate-700 sm:px-4">${escapeComedorHtml(item.fecha)}</td>
        <td class="px-3 py-3 sm:px-4">${estadoBadge(item.estado)}</td>
        <td class="px-3 py-3 text-right sm:px-4">
          ${
            item.canManage
              ? `<div class="inline-flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  data-comedor-edit-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-[10px] border border-[rgba(37,99,235,0.35)] bg-[rgba(219,234,254,0.35)] px-2.5 py-1.5 text-xs font-semibold text-[#002147] shadow-sm transition hover:bg-[rgba(219,234,254,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
                >
                  Editar
                </button>
                <button
                  type="button"
                  data-comedor-cancel-acceso-id="${item.id}"
                  class="inline-flex items-center rounded-[10px] border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
                >
                  Cancelar
                </button>
              </div>`
              : '<span class="text-xs font-medium text-slate-400">—</span>'
          }
        </td>
      </tr>`,
    )
    .join("");

  const totalPages = Math.max(1, Math.ceil(tableData.total / tableData.pageSize));
  const pageButtons = paginationRange(totalPages, tableData.page)
    .map((entry) => {
      if (entry === "ellipsis") return '<span class="px-2 text-slate-500">…</span>';
      const active = entry === tableData.page;
      return `<button type="button" data-comedor-page="${entry}" class="${active ? "min-h-10 rounded-lg bg-leoni-blue px-3 py-2 text-sm font-bold text-white shadow-md" : "min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-leoni-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"}">${entry}</button>`;
    })
    .join("");

  const prevDisabled = tableData.page <= 1;
  const nextDisabled = tableData.page >= totalPages;

  return `
    <div class="flex flex-col gap-5">
      ${toolbar}
      <section class="rh-sol-table-section ${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-[720px] w-full text-left">
            <thead class="rh-sol-thead">
              <tr>
                ${th("Nombre del Empleado")}
                ${th("Tipo de Comida")}
                ${th("Fecha")}
                ${th("Estado")}
                ${th("Acciones", "text-right")}
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100/90 bg-white">${rows}</tbody>
          </table>
        </div>
        <footer class="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
          <p class="order-2 text-center text-[13px] tabular-nums text-slate-600 sm:order-1 sm:text-left">
            Página <span class="font-semibold text-slate-800">${tableData.page}</span> de <span class="font-semibold text-slate-800">${totalPages}</span>
            <span class="mx-2 text-slate-300 max-sm:hidden" aria-hidden="true">·</span>
            <span class="max-sm:block max-sm:text-center">${escapeComedorHtml(String(tableData.total))} registro${tableData.total === 1 ? "" : "s"}</span>
          </p>
          <div class="order-1 flex items-center justify-center gap-2 sm:order-2 sm:justify-end">
            <button
              type="button"
              data-comedor-page="${tableData.page - 1}"
              ${prevDisabled ? "disabled" : ""}
              class="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              aria-label="Ir a la página anterior"
            >
              ${iconChevronLeft()}
              <span class="hidden sm:inline">Anterior</span>
            </button>
            <div class="flex max-w-[min(100vw-8rem,20rem)] items-center gap-1 overflow-x-auto pb-px sm:max-w-none">${pageButtons}</div>
            <button
              type="button"
              data-comedor-page="${tableData.page + 1}"
              ${nextDisabled ? "disabled" : ""}
              class="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-leoni-blue disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2"
              aria-label="Ir a la página siguiente"
            >
              <span class="hidden sm:inline">Siguiente</span>
              ${iconChevronRight()}
            </button>
          </div>
        </footer>
      </section>
    </div>`;
}
