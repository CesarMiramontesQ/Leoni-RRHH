/** Tipos de la vista Horas Extra — sincronizados con API. */

import type { HorasExtraFila } from "../../api/horasExtra.ts";

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

export type HorasExtraTableStatus = "loading" | "ready" | "error" | "empty";

export type HorasExtraPageViewModel = {
  semanaLabel: string;
  summaryCards: readonly HorasExtraSummaryCard[];
  tabs: readonly HorasExtraTab[];
  activeTabId: HorasExtraTabId;
  filas: readonly HorasExtraFila[];
  totalRegistros: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  tableStatus: HorasExtraTableStatus;
  tableErrorMessage?: string;
};
