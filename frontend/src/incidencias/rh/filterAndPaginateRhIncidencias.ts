import { areaLabelFromFilterId } from "./buildRhIncidenciaFilterOptions.ts";
import type {
  RhIncidenciaFilterState,
  RhIncidenciasTableData,
  RhIncidenciaTablaFila,
} from "./types.ts";

function parseLocalDate(iso: string): Date | null {
  const p = iso.trim().split("-");
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function dentroDePeriodo(fechaIso: string, periodo: RhIncidenciaFilterState["periodo"]): boolean {
  if (periodo === "all") return true;
  const d = parseLocalDate(fechaIso);
  if (!d) return true;
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  const lim = new Date(hoy);
  const dias = periodo === "30d" ? 30 : periodo === "90d" ? 90 : 365;
  lim.setDate(lim.getDate() - dias);
  lim.setHours(0, 0, 0, 0);
  return d.getTime() >= lim.getTime();
}

function matchesFilters(row: RhIncidenciaTablaFila, f: RhIncidenciaFilterState): boolean {
  if (f.tipo && row.tipo !== f.tipo) return false;
  if (f.estado && row.estado !== f.estado) return false;
  if (f.supervisor_id && row.supervisor_id !== f.supervisor_id) return false;
  if (f.area_id) {
    const want = areaLabelFromFilterId(f.area_id);
    if (!want || row.area !== want) return false;
  }
  if (!dentroDePeriodo(row.fecha, f.periodo)) return false;
  return true;
}

export function filterRhIncidenciaRows(
  rows: readonly RhIncidenciaTablaFila[],
  f: RhIncidenciaFilterState,
): RhIncidenciaTablaFila[] {
  return rows.filter((r) => matchesFilters(r, f));
}

export function paginateRhIncidencias(
  filtered: readonly RhIncidenciaTablaFila[],
  f: RhIncidenciaFilterState,
): RhIncidenciasTableData {
  const total = filtered.length;
  const page = Math.max(1, f.page);
  const page_size = Math.max(1, f.page_size);
  const start = (page - 1) * page_size;
  const items = filtered.slice(start, start + page_size);
  return { items, total, page, page_size };
}
