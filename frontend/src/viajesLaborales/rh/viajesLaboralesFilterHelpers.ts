import type { ViajeLaboralEstado } from "../../api/viajesLaborales.ts";
import type { ViajesLaboralesListFilters } from "./types.ts";

export const RH_VL_FILTER_FIELDS = [
  "busqueda",
  "destino",
  "estado",
  "fecha_inicio",
  "fecha_fin",
] as const;

const ESTADO_LABELS: Record<ViajeLaboralEstado, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
};

export function labelViajeLaboralEstado(estado: ViajeLaboralEstado | ""): string {
  if (!estado) return "";
  return ESTADO_LABELS[estado];
}

export function filtrosViajesLaboralesActivos(f: ViajesLaboralesListFilters): boolean {
  return Boolean(
    f.busqueda.trim() ||
      f.destino.trim() ||
      f.estado ||
      f.fecha_inicio.trim() ||
      f.fecha_fin.trim(),
  );
}

export function fechasRangoViajesListo(f: ViajesLaboralesListFilters): boolean {
  const ini = f.fecha_inicio.trim();
  const fin = f.fecha_fin.trim();
  if (!ini || !fin) return false;
  return fin >= ini;
}

export function readViajesLaboralesFiltersFromDom(
  root: ParentNode,
  current: ViajesLaboralesListFilters,
): ViajesLaboralesListFilters {
  const next = { ...current };
  for (const field of RH_VL_FILTER_FIELDS) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-rh-vl-filter-field="${field}"]`,
    );
    if (!el) continue;
    next[field] = el.value as never;
  }
  return next;
}

export function cloneViajesLaboralesListFilters(
  f: ViajesLaboralesListFilters,
): ViajesLaboralesListFilters {
  return { ...f };
}

export function emptyViajesLaboralesListFilters(): ViajesLaboralesListFilters {
  return { busqueda: "", destino: "", estado: "", fecha_inicio: "", fecha_fin: "" };
}
