import type { ComedorCalendarMonth, ComedorPanelState } from "../../comedor/rh/types.ts";
import {
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_SOLICITUDES_BTN_PRIMARY,
} from "../../ui/uiTokens.ts";
import { renderComedorCalendar } from "./comedorCalendar.ts";

type ComedorProximaReservaRow = {
  id: number;
  fecha_servicio: string;
  tipo_comida: string;
  estado_acceso: string;
};

export type ComedorDashboardEmpleadoViewState = {
  calendarState: ComedorPanelState;
  calendar: ComedorCalendarMonth | null;
  calendarError: string | null;
  proximasState: ComedorPanelState;
  proximas: readonly ComedorProximaReservaRow[];
  proximasError: string | null;
  editingReservaId: number | null;
  editTipoComida: string;
  isSavingEdition: boolean;
};

function renderHeader(): string {
  return `
    <section class="${RH_LISTADO_SURFACE} rh-sol-hero-card p-4 sm:p-6">
      <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div class="rh-sol-hero__copy min-w-0 flex-1">
          <h1 class="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-tight text-[#0f172a]">Comedor</h1>
        </div>
        <div class="flex w-full shrink-0 sm:w-auto sm:justify-end">
          <button type="button" data-comedor-nuevo class="${RH_SOLICITUDES_BTN_PRIMARY} w-full sm:w-auto">
            Agregar comida
          </button>
        </div>
      </div>
    </section>`;
}

function tipoComidaLabel(tipo: string): string {
  const map: Record<string, string> = {
    casera: "Opción A",
    saludable: "Opción B",
  };
  return map[tipo] ?? tipo;
}

function estadoLabel(estado: string): string {
  const map: Record<string, string> = {
    PENDIENTE: "Pendiente",
    ACCEDIDO: "Accedido",
    EXPIRADO: "Expirado",
  };
  return map[estado] ?? estado;
}

function formatFechaLarga(isoYmd: string): string {
  const [y, m, d] = isoYmd.split("-").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return isoYmd;
  const value = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
  ] as const;
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ] as const;
  return `${dias[value.getDay()]} ${value.getDate()} de ${meses[value.getMonth()]} ${value.getFullYear()}`;
}

function renderProximas(state: ComedorDashboardEmpleadoViewState): string {
  if (state.proximasState === "loading") {
    return `<section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p class="text-sm text-slate-500">Cargando próximas asistencias...</p>
    </section>`;
  }
  if (state.proximasState === "error") {
    return `<section class="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
      <p class="text-sm text-red-700">${state.proximasError ?? "No fue posible cargar tus próximas asistencias."}</p>
      <button type="button" data-comedor-retry-proximas class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">Reintentar</button>
    </section>`;
  }
  if (state.proximas.length === 0) {
    return `<section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 class="text-sm font-semibold text-slate-800">Próximas asistencias</h3>
      <p class="mt-2 text-sm text-slate-500">No tienes registros próximos.</p>
    </section>`;
  }
  return `<section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div class="px-4 py-3 sm:px-6">
      <h3 class="text-sm font-semibold text-gray-900">Próximos registros</h3>
    </div>
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
        <thead>
          <tr class="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <th class="px-4 py-3 font-semibold sm:px-6">Fecha</th>
            <th class="px-4 py-3 font-semibold sm:px-6">Tipo de comida</th>
            <th class="px-4 py-3 font-semibold sm:px-6">Estado</th>
            <th class="px-4 py-3 text-right font-semibold sm:px-6">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white">
          ${state.proximas
            .map(
              (item) => `<tr>
                <td class="whitespace-nowrap px-4 py-3 text-gray-900 sm:px-6">${formatFechaLarga(item.fecha_servicio)}</td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700 sm:px-6">${tipoComidaLabel(item.tipo_comida)}</td>
                <td class="whitespace-nowrap px-4 py-3 text-gray-700 sm:px-6">${estadoLabel(item.estado_acceso)}</td>
                <td class="whitespace-nowrap px-4 py-3 text-right sm:px-6">
                  <div class="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      data-comedor-edit-acceso-id="${item.id}"
                      class="inline-flex items-center rounded-md border border-leoni-blue/30 bg-leoni-blue/5 px-2.5 py-1 text-xs font-semibold text-leoni-blue hover:bg-leoni-blue/10"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      data-comedor-cancel-acceso-id="${item.id}"
                      class="inline-flex items-center rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${renderEditModal(state)}
  </section>`;
}

function renderEditModal(state: ComedorDashboardEmpleadoViewState): string {
  if (state.editingReservaId == null) return "";
  const disableAttr = state.isSavingEdition ? "disabled" : "";
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
      <h4 class="text-base font-semibold text-gray-900">Editar tipo de comida</h4>
      <p class="mt-1 text-sm text-gray-500">Selecciona el nuevo tipo para este registro.</p>
      <div class="mt-4">
        <label class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de comida</label>
        <select
          data-comedor-edit-tipo-comida
          class="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:border-leoni-blue focus:outline-none"
          ${disableAttr}
        >
          <option value="casera" ${state.editTipoComida === "casera" ? "selected" : ""}>Opción A</option>
          <option value="saludable" ${state.editTipoComida === "saludable" ? "selected" : ""}>Opción B</option>
        </select>
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-comedor-edit-cancel class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" ${disableAttr}>Cerrar</button>
        <button type="button" data-comedor-edit-save class="rounded-md bg-leoni-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-leoni-blue-light disabled:opacity-70" ${disableAttr}>
          ${state.isSavingEdition ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  </div>`;
}

export function renderComedorDashboardEmpleado(state: ComedorDashboardEmpleadoViewState): string {
  return `
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT} flex min-h-0 flex-1 flex-col gap-5 sm:gap-6">
      ${renderHeader()}
      ${renderComedorCalendar(state.calendarState, state.calendar, state.calendarError)}
      ${renderProximas(state)}
    </div>`;
}
