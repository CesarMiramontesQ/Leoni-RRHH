/** Tipos de la vista Horas Extra — preparados para integración con API futura. */

export type HorasExtraTabId = "todos" | "pendientes" | "aprobados" | "rechazados";

export type HorasExtraTab = {
  id: HorasExtraTabId;
  label: string;
  count: number;
};

export type HorasExtraSummaryDeltaTone = "success" | "danger" | "warning" | "neutral";

export type HorasExtraSummaryCard = {
  id: string;
  label: string;
  value: string;
  deltaLabel?: string;
  deltaTone?: HorasExtraSummaryDeltaTone;
  footer: string;
};

export type HorasExtraPageViewModel = {
  semanaLabel: string;
  selectedCount: number;
  summaryCards: readonly HorasExtraSummaryCard[];
  tabs: readonly HorasExtraTab[];
  activeTabId: HorasExtraTabId;
  totalRegistros: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
};
