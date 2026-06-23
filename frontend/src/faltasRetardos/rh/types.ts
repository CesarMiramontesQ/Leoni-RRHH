import type { FaltaRetardoListItem, FaltaRetardoTipo } from "../../api/faltasRetardos.ts";

export type FaltasRetardosListFilters = {
  busqueda: string;
  tipo: "" | FaltaRetardoTipo;
  fecha_inicio: string;
  fecha_fin: string;
};

export type FaltasRetardosTablaFila = FaltaRetardoListItem;

export type FaltasRetardosTableData = {
  items: FaltasRetardosTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

export type FaltasRetardosEstadisticasData = {
  total_eventos: number;
  falta_justificada: number;
  falta_injustificada: number;
  retardo: number;
  incapacidad: number;
  suspension: number;
};

export type FaltasRetardosAdminViewModel = {
  filterDraft: FaltasRetardosListFilters;
  appliedFilters: FaltasRetardosListFilters;
  estadisticas: FaltasRetardosEstadisticasData | null;
  estadisticasStatus: "loading" | "ready" | "error";
  estadisticasErrorMessage?: string;
  tableStatus: "loading" | "ready" | "empty" | "error";
  table: FaltasRetardosTableData | null;
  tableErrorMessage?: string;
};

export function emptyFaltasRetardosListFilters(): FaltasRetardosListFilters {
  return { busqueda: "", tipo: "", fecha_inicio: "", fecha_fin: "" };
}

export function cloneFaltasRetardosListFilters(
  f: FaltasRetardosListFilters,
): FaltasRetardosListFilters {
  return { ...f };
}
