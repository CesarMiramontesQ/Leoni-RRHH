import type { HorasExtraFila } from "../../../api/horasExtra.ts";
import { HE_TABLE_ROW, HE_TABLE_TD, renderHorasExtraEstadoBadge, renderHorasExtraTableStatusRow, renderHorasExtraVerButton } from "../../../horasExtra/shared/horasExtraTableUi.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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
  const sol = fila.solicitud;
  const label = sol.centrocosto_descripcion?.trim() || String(sol.centrocosto_id);
  const area = sol.area_descripcion?.trim() || "Sin área";
  return `
    <div class="min-w-[8rem]">
      <p class="truncate text-sm font-semibold text-text-primary">${escapeHtml(label)}</p>
      <p class="truncate text-xs text-text-secondary">${escapeHtml(area)}</p>
    </div>`;
}

function renderSemanaCell(fila: HorasExtraFila): string {
  const sol = fila.solicitud;
  return `
    <div class="min-w-[6rem]">
      <p class="text-sm font-semibold tabular-nums text-text-primary">${sol.semana}</p>
    </div>`;
}

function renderAccionesCell(fila: HorasExtraFila): string {
  return renderHorasExtraVerButton({
    dataAttr: "he-rh-ver-id",
    solicitudId: fila.solicitud.solicitud_id,
  });
}

function renderFila(fila: HorasExtraFila): string {
  const sol = fila.solicitud;
  const motivo = sol.motivo?.trim() || "—";

  return `
    <tr class="${HE_TABLE_ROW}">
      <td class="${HE_TABLE_TD}">${renderEmpleadoCell(fila)}</td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">${renderCentroCostoCell(fila)}</td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">${renderSemanaCell(fila)}</td>
      <td class="${HE_TABLE_TD} text-sm tabular-nums text-text-primary whitespace-nowrap">${escapeHtml(formatFecha(sol.fecha_solicitud))}</td>
      <td class="${HE_TABLE_TD} text-sm font-semibold tabular-nums text-text-primary whitespace-nowrap">${sol.total_horas.toFixed(2)}</td>
      <td class="max-w-[16rem] ${HE_TABLE_TD}">
        <p class="truncate text-sm text-text-primary" title="${escapeHtml(motivo)}">${escapeHtml(motivo)}</p>
      </td>
      <td class="${HE_TABLE_TD} whitespace-nowrap">${renderHorasExtraEstadoBadge(sol.estado, sol.estado_consolidado)}</td>
      <td class="${HE_TABLE_TD} whitespace-nowrap text-right">${renderAccionesCell(fila)}</td>
    </tr>`;
}

function renderTableBody(vm: HorasExtraPageViewModel): string {
  if (vm.tableStatus === "loading") {
    return renderHorasExtraTableStatusRow(
      8,
      `<p class="text-sm text-text-secondary">Cargando solicitudes…</p>`,
    );
  }

  if (vm.tableStatus === "error") {
    return renderHorasExtraTableStatusRow(
      8,
      `<p class="text-sm font-semibold text-text-primary">No se pudo cargar el listado</p>
       <p class="mt-1 text-sm text-text-secondary">${escapeHtml(vm.tableErrorMessage ?? "Intenta de nuevo más tarde.")}</p>`,
    );
  }

  if (vm.filas.length === 0) {
    return renderHorasExtraTableStatusRow(
      8,
      `<p class="text-sm font-semibold text-text-primary">Sin solicitudes</p>
       <p class="mt-1 text-sm text-text-secondary">No hay solicitudes de horas extra registradas con los filtros actuales.</p>`,
    );
  }

  return vm.filas.map(renderFila).join("");
}

export function renderHorasExtraTableBody(vm: HorasExtraPageViewModel): string {
  return renderTableBody(vm);
}
