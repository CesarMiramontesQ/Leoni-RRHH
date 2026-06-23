import {
  cloneFaltasRetardosListFilters,
  emptyFaltasRetardosListFilters,
  type FaltasRetardosListFilters,
} from "./types.ts";

export const RH_FR_FILTER_FIELDS = [
  "busqueda",
  "tipo",
  "fecha_inicio",
  "fecha_fin",
] as const satisfies readonly (keyof FaltasRetardosListFilters)[];

export function readFaltasRetardosFiltersFromDom(
  root: ParentNode,
  current: FaltasRetardosListFilters,
): FaltasRetardosListFilters {
  const next = cloneFaltasRetardosListFilters(current);
  for (const field of RH_FR_FILTER_FIELDS) {
    const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-rh-fr-filter-field="${field}"]`,
    );
    if (el) {
      const value = el.value;
      if (field === "tipo") {
        next.tipo = value as FaltasRetardosListFilters["tipo"];
      } else {
        next[field] = value;
      }
    }
  }
  return next;
}

export function filtrosFaltasRetardosActivos(f: FaltasRetardosListFilters): boolean {
  return (
    f.busqueda.trim().length > 0 ||
    f.tipo.trim().length > 0 ||
    f.fecha_inicio.trim().length > 0 ||
    f.fecha_fin.trim().length > 0
  );
}

export function fechasRangoFaltasRetardosListo(f: FaltasRetardosListFilters): boolean {
  const ini = f.fecha_inicio.trim();
  const fin = f.fecha_fin.trim();
  if (!ini && !fin) return false;
  if (ini && fin) return fin >= ini;
  return true;
}

export { emptyFaltasRetardosListFilters, cloneFaltasRetardosListFilters };
