/** Tipos de la vista Horas Extra — sincronizados con API. */

import type { HorasExtraFila, HorasExtraTabFiltro } from "../../api/horasExtra.ts";
import type { AreaResponse } from "../../api/usuarios.ts";

export type HorasExtraTabId = HorasExtraTabFiltro;

export type HorasExtraSummaryDeltaTone = "success" | "danger" | "warning" | "neutral";

export type HorasExtraSummaryCard = {
  id: string;
  label: string;
  value: string;
  deltaLabel?: string;
  deltaTone?: HorasExtraSummaryDeltaTone;
  footer: string;
};

export type HorasExtraTableStatus = "loading" | "ready" | "error" | "empty";

export type HorasExtraFilters = {
  area_id: string;
  centrocosto_id: string;
  estado: HorasExtraTabId;
  semana_inicio: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export type HorasExtraCentroCostoOption = {
  id: number;
  label: string;
};

export type HorasExtraFilterOptions = {
  areas: readonly AreaResponse[];
  centrosCosto: readonly HorasExtraCentroCostoOption[];
};

export type HorasExtraPageViewModel = {
  semanaActual: number;
  semanaLabel: string;
  summaryCards: readonly HorasExtraSummaryCard[];
  filters: HorasExtraFilters;
  filterOptions: HorasExtraFilterOptions;
  filtersStatus: "loading" | "ready";
  estadoCounts: Record<HorasExtraTabId, number>;
  filas: readonly HorasExtraFila[];
  totalRegistros: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  tableStatus: HorasExtraTableStatus;
  tableErrorMessage?: string;
};

export const EMPTY_HORAS_EXTRA_FILTERS: HorasExtraFilters = {
  area_id: "",
  centrocosto_id: "",
  estado: "todos",
  semana_inicio: "",
  fecha_inicio: "",
  fecha_fin: "",
};

export const EMPTY_HORAS_EXTRA_FILTER_OPTIONS: HorasExtraFilterOptions = {
  areas: [],
  centrosCosto: [],
};
