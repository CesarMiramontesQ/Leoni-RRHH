import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import {
  cloneFaltasRetardosListFilters,
  emptyFaltasRetardosListFilters,
  type FaltasRetardosListFilters,
} from "./types.ts";

const FALTA_RETARDO_TIPOS: ReadonlySet<FaltaRetardoTipo> = new Set([
  "falta_justificada",
  "falta_injustificada",
  "retardo",
  "incapacidad",
  "suspension",
]);

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtros iniciales tomados del deep-link del hash
 * (`#/faltas-retardos?tipo=...&fecha_inicio=...&fecha_fin=...`). Solo se aceptan
 * valores válidos; el resto queda vacío. Pensado para preaplicar el filtro al
 * navegar desde las gráficas del dashboard.
 */
export function faltasRetardosFiltersFromHash(
  hash: string = typeof window !== "undefined" ? window.location.hash : "",
): FaltasRetardosListFilters {
  const filters = emptyFaltasRetardosListFilters();
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return filters;

  const params = new URLSearchParams(hash.slice(queryIndex + 1));

  const tipo = (params.get("tipo") ?? "").trim();
  if (FALTA_RETARDO_TIPOS.has(tipo as FaltaRetardoTipo)) {
    filters.tipo = tipo as FaltaRetardoTipo;
  }

  const fechaInicio = (params.get("fecha_inicio") ?? "").trim();
  if (FECHA_ISO_RE.test(fechaInicio)) filters.fecha_inicio = fechaInicio;

  const fechaFin = (params.get("fecha_fin") ?? "").trim();
  if (FECHA_ISO_RE.test(fechaFin)) filters.fecha_fin = fechaFin;

  filters.busqueda = (params.get("busqueda") ?? "").trim();

  return filters;
}

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
