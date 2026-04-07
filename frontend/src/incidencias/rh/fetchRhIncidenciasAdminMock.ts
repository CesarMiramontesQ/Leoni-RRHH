import { buildRhIncidenciaFilterOptions } from "./buildRhIncidenciaFilterOptions.ts";
import { computeRhIncidenciaStats } from "./computeRhIncidenciaStats.ts";
import { filterRhIncidenciaRows, paginateRhIncidencias } from "./filterAndPaginateRhIncidencias.ts";
import { buildRhIncidenciasMockFilas } from "./mockDataset.ts";
import type {
  RhIncidenciaFilterState,
  RhIncidenciasAdminViewModel,
  RhIncidenciaTablaFila,
  RhIncidenciasUiConfig,
} from "./types.ts";

const MOCK_DELAY_MS = 380;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchRhIncidenciasMockResult =
  | { ok: true; rows: RhIncidenciaTablaFila[]; filterOptions: RhIncidenciasAdminViewModel["filterOptions"] }
  | { ok: false; message: string };

export async function fetchRhIncidenciasAdminDatasetMock(
  simulateError = false,
): Promise<FetchRhIncidenciasMockResult> {
  await delay(MOCK_DELAY_MS);
  if (simulateError) {
    return { ok: false, message: "No se pudieron cargar las incidencias. Intente de nuevo." };
  }
  const rows = buildRhIncidenciasMockFilas();
  return {
    ok: true,
    rows,
    filterOptions: buildRhIncidenciaFilterOptions(rows),
  };
}

export function buildRhIncidenciasAdminViewModel(
  rows: readonly RhIncidenciaTablaFila[],
  filterOptions: RhIncidenciasAdminViewModel["filterOptions"],
  filters: RhIncidenciaFilterState,
  ui: RhIncidenciasUiConfig,
): RhIncidenciasAdminViewModel {
  const resumen = computeRhIncidenciaStats(rows);
  const filtered = filterRhIncidenciaRows(rows, filters);
  const table = paginateRhIncidencias(filtered, filters);
  const tableStatus = table.total === 0 ? "empty" : "ready";
  return {
    resumen,
    resumenStatus: "ready",
    filterOptions,
    filters,
    ui,
    tableStatus,
    table,
    tableErrorMessage: undefined,
  };
}
