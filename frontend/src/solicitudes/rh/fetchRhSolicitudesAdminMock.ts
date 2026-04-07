import { buildRhSolicitudFilterOptions } from "./buildRhSolicitudFilterOptions.ts";
import { computeRhSolicitudStats } from "./computeRhSolicitudStats.ts";
import { filterRhSolicitudRows, paginateRhSolicitudes } from "./filterAndPaginateRhSolicitudes.ts";
import { RH_SOLICITUDES_MOCK_FILAS } from "./mockDataset.ts";
import type {
  RhSolicitudFilterState,
  RhSolicitudesAdminViewModel,
  RhSolicitudTablaFila,
} from "./types.ts";

const MOCK_DELAY_MS = 380;

function isoHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Ajuste demo: marca algunas aprobadas con fecha de hoy para que el KPI sea visible. */
function patchMockAprobacionesHoy(rows: RhSolicitudTablaFila[]): RhSolicitudTablaFila[] {
  const hoy = isoHoyLocal();
  let usadas = 0;
  return rows.map((r) => {
    if (usadas >= 3) return r;
    if (r.estado !== "approved" && r.estado !== "overridden") return r;
    usadas += 1;
    return { ...r, fecha_aprobacion: hoy };
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchRhSolicitudesMockResult =
  | { ok: true; rows: RhSolicitudTablaFila[]; filterOptions: RhSolicitudesAdminViewModel["filterOptions"] }
  | { ok: false; message: string };

/**
 * Simula carga desde backend. Sustituir por `fetch` real manteniendo el mismo shape.
 */
export async function fetchRhSolicitudesAdminDatasetMock(
  simulateError = false,
): Promise<FetchRhSolicitudesMockResult> {
  await delay(MOCK_DELAY_MS);
  if (simulateError) {
    return { ok: false, message: "No se pudieron cargar las solicitudes. Intente de nuevo." };
  }
  const rows = patchMockAprobacionesHoy([...RH_SOLICITUDES_MOCK_FILAS]);
  return {
    ok: true,
    rows,
    filterOptions: buildRhSolicitudFilterOptions(rows),
  };
}

export function buildRhSolicitudesAdminViewModel(
  rows: readonly RhSolicitudTablaFila[],
  filterOptions: RhSolicitudesAdminViewModel["filterOptions"],
  filters: RhSolicitudFilterState,
): RhSolicitudesAdminViewModel {
  const stats = computeRhSolicitudStats(rows);
  const filtered = filterRhSolicitudRows(rows, filters);
  const table = paginateRhSolicitudes(filtered, filters);
  const tableStatus = table.total === 0 ? "empty" : "ready";
  return {
    stats,
    statsStatus: "ready",
    filterOptions,
    filters,
    tableStatus,
    table,
    tableErrorMessage: undefined,
  };
}
