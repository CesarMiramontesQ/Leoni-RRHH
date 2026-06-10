import type { HorasExtraFila } from "../../../api/horasExtra.ts";
import { badgeApproved, badgePending, badgeRejected } from "../../../ui/uiTokens.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

function estadoBadge(estado: HorasExtraFila["simulado"]["estado_aprobacion"]): string {
  if (estado === "aprobado") return badgeApproved("Aprobado");
  if (estado === "rechazado") return badgeRejected("Rechazado");
  return badgePending("Pendiente");
}

function difCasetaClass(valor: number): string {
  if (valor === 0) return "text-text-muted";
  if (valor <= 0.75) return "font-semibold text-amber-700";
  return "font-semibold text-red-700";
}

function renderEmpleadoCell(fila: HorasExtraFila): string {
  const display = formatNombreEmpleadoUi(fila.empleado.nombre) || fila.empleado.nombre;
  const initials = inicialesDesdeNombreDisplay(display);
  const puesto = fila.empleado.puesto_nombre?.trim();
  const sub = puesto ? `${escapeHtml(fila.empleado.no_empleado)} · ${escapeHtml(puesto)}` : escapeHtml(fila.empleado.no_empleado);

  return `
    <div class="flex min-w-[12rem] items-center gap-2.5">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-leoni-blue-light text-xs font-semibold text-white">${escapeHtml(initials)}</span>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-text-primary">${escapeHtml(display)}</p>
        <p class="truncate text-xs text-text-secondary">${sub}</p>
      </div>
    </div>`;
}

function renderCentroCostoCell(fila: HorasExtraFila): string {
  const id = fila.empleado.centrocosto_id;
  return `
    <div class="min-w-[7rem]">
      <p class="text-sm font-semibold tabular-nums text-text-primary">${escapeHtml(String(id))}</p>
      <p class="text-xs text-text-secondary">Centro de costo</p>
    </div>`;
}

function renderFila(fila: HorasExtraFila): string {
  const sim = fila.simulado;
  const difFmt = sim.dif_caseta === 0 ? "0.00" : `+${sim.dif_caseta.toFixed(2)}`;

  return `
    <tr class="border-b border-slate-100 transition hover:bg-slate-50/70">
      <td class="px-3 py-3">${renderEmpleadoCell(fila)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderCentroCostoCell(fila)}</td>
      <td class="px-3 py-3 text-sm tabular-nums text-text-primary whitespace-nowrap">${sim.semana}</td>
      <td class="px-3 py-3 text-sm tabular-nums text-text-primary whitespace-nowrap">${sim.horas_dobles.toFixed(2)}</td>
      <td class="px-3 py-3 text-sm tabular-nums text-text-primary whitespace-nowrap">${sim.horas_descanso_trabajado.toFixed(2)}</td>
      <td class="px-3 py-3 text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap">${sim.total_horas_extra.toFixed(2)}</td>
      <td class="px-3 py-3 text-sm tabular-nums whitespace-nowrap ${difCasetaClass(sim.dif_caseta)}">${difFmt}</td>
      <td class="px-3 py-3 whitespace-nowrap">${estadoBadge(sim.estado_aprobacion)}</td>
    </tr>`;
}

function renderTableBody(vm: HorasExtraPageViewModel): string {
  if (vm.tableStatus === "loading") {
    return `
      <tr>
        <td colspan="8" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm text-text-secondary">Cargando colaboradores…</p>
        </td>
      </tr>`;
  }

  if (vm.tableStatus === "error") {
    return `
      <tr>
        <td colspan="8" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm font-semibold text-text-primary">No se pudo cargar el listado</p>
          <p class="mt-1 text-sm text-text-secondary">${escapeHtml(vm.tableErrorMessage ?? "Intenta de nuevo más tarde.")}</p>
        </td>
      </tr>`;
  }

  if (vm.filas.length === 0) {
    return `
      <tr>
        <td colspan="8" class="px-4 py-16 text-center sm:px-5">
          <p class="text-sm font-semibold text-text-primary">Sin registros</p>
          <p class="mt-1 text-sm text-text-secondary">No hay empleados activos con centro de costo asignado.</p>
        </td>
      </tr>`;
  }

  return vm.filas.map(renderFila).join("");
}

export function renderHorasExtraTableBody(vm: HorasExtraPageViewModel): string {
  return renderTableBody(vm);
}
