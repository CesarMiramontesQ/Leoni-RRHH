import { areaLabelFromFilterId } from "./buildRhSolicitudFilterOptions.ts";
import type { RhSolicitudFilterState, RhSolicitudesTableData, RhSolicitudTablaFila } from "./types.ts";

function matchesFilters(row: RhSolicitudTablaFila, f: RhSolicitudFilterState): boolean {
  if (f.tipo && row.tipo !== f.tipo) return false;
  if (f.estado && row.estado !== f.estado) return false;
  if (f.supervisor_id && row.supervisor_id !== f.supervisor_id) return false;
  if (f.area_id) {
    const want = areaLabelFromFilterId(f.area_id);
    if (!want || row.area !== want) return false;
  }
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
