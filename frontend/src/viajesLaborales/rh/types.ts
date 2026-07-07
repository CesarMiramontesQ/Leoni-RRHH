import type { ViajeLaboralEstado, ViajeLaboralListItem } from "../../api/viajesLaborales.ts";

export type ViajesLaboralesListFilters = {
  busqueda: string;
  destino: string;
  estado: "" | ViajeLaboralEstado;
  fecha_inicio: string;
  fecha_fin: string;
};

export type ViajesLaboralesTableData = {
  items: ViajeLaboralListItem[];
  total: number;
  page: number;
  page_size: number;
};

export type ViajesLaboralesEstadisticasData = {
  total: number;
  pendientes: number;
  aprobados: number;
  cancelados: number;
};

export type ViajesLaboralesAdminViewModel = {
  filterDraft: ViajesLaboralesListFilters;
  appliedFilters: ViajesLaboralesListFilters;
  estadisticas: ViajesLaboralesEstadisticasData | null;
  estadisticasStatus: "loading" | "ready" | "error";
  estadisticasErrorMessage?: string;
  tableStatus: "loading" | "ready" | "empty" | "error";
  table: ViajesLaboralesTableData | null;
  tableErrorMessage?: string;
  canApprove: boolean;
};

export function emptyViajesLaboralesListFilters(): ViajesLaboralesListFilters {
  return { busqueda: "", destino: "", estado: "", fecha_inicio: "", fecha_fin: "" };
}

export function cloneViajesLaboralesListFilters(
  f: ViajesLaboralesListFilters,
): ViajesLaboralesListFilters {
  return { ...f };
}
