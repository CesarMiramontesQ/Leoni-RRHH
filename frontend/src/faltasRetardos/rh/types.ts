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
  eventos_por_mes: { periodo: string; total: number }[];
  eventos_por_periodo_y_tipo?: { periodo: string; tipo: FaltaRetardoTipo; total: number }[];
  tendencia_agrupacion?: "dia" | "semana" | "mes" | null;
  eventos_por_tipo: { tipo: FaltaRetardoTipo; total: number; porcentaje: number }[];
  empleados_con_mas_eventos: {
    empleado_id: number;
    no_empleado: string | null;
    nombre: string | null;
    total: number;
    por_tipo: { tipo: FaltaRetardoTipo; total: number }[];
  }[];
};

export type FaltasRetardosMetricasViewModel = {
  estadisticas: FaltasRetardosEstadisticasData | null;
  estadisticasStatus: "loading" | "ready" | "error";
  estadisticasErrorMessage?: string;
  tendenciaFiltros: { fecha_inicio: string; fecha_fin: string };
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
