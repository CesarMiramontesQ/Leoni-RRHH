import { filaCoincideBusquedaTextoEmpleado } from "../../utils/empleadoTextoBusqueda.ts";
import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { areaLabelFromFilterId } from "./buildRhSolicitudFilterOptions.ts";
import type { RhSolicitudFilterState, RhSolicitudesTableData, RhSolicitudTablaFila } from "./types.ts";

function rowMatchesNoEmpleado(row: RhSolicitudTablaFila, consulta: string): boolean {
  const q = formatNoEmpleadoDisplay(consulta);
  if (!q) return true;
  const rowNo = formatNoEmpleadoDisplay(row.empleado_no_empleado);
  if (!rowNo) return false;
  return rowNo === q || rowNo.includes(q);
}

function rowMatchesFechaSolicitud(row: RhSolicitudTablaFila, fechaInicio: string, fechaFin: string): boolean {
  const fi = fechaInicio.trim();
  const ff = fechaFin.trim();
  if (!fi && !ff) return true;
  const f = row.fecha_solicitud.trim().slice(0, 10);
  if (!f) return false;
  if (fi && f < fi) return false;
  if (ff && f > ff) return false;
  return true;
}

function matchesFilters(row: RhSolicitudTablaFila, f: RhSolicitudFilterState): boolean {
  if (f.tipo && row.tipo !== f.tipo) return false;
  if (f.estado && row.estado !== f.estado) return false;
  const qNoEmp = f.no_empleado.trim();
  if (qNoEmp) {
    if (!rowMatchesNoEmpleado(row, qNoEmp)) return false;
  } else {
    const qEmp = f.empleado_busqueda.trim();
    if (qEmp) {
      if (!filaCoincideBusquedaTextoEmpleado(row, qEmp)) return false;
    } else if (f.empleado_id && row.empleado_id !== f.empleado_id) {
      return false;
    }
  }
  if (f.supervisor_id && row.supervisor_id !== f.supervisor_id) return false;
  if (f.area_id) {
    const want = areaLabelFromFilterId(f.area_id);
    if (!want || row.area !== want) return false;
  }
  if (!rowMatchesFechaSolicitud(row, f.fecha_inicio, f.fecha_fin)) return false;
  return true;
}

export function filterRhSolicitudRows(
  rows: readonly RhSolicitudTablaFila[],
  f: RhSolicitudFilterState,
): RhSolicitudTablaFila[] {
  return rows.filter((r) => matchesFilters(r, f));
}

export function paginateRhSolicitudes(
  filtered: readonly RhSolicitudTablaFila[],
  f: RhSolicitudFilterState,
): RhSolicitudesTableData {
  const total = filtered.length;
  const page = Math.max(1, f.page);
  const page_size = Math.max(1, f.page_size);
  const start = (page - 1) * page_size;
  const items = filtered.slice(start, start + page_size);
  return { items, total, page, page_size };
}
