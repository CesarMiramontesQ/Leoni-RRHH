import { parseEmpleadoDirectoryNumericId } from "../../auth/jwt.ts";
import type { SolicitudesDataScope, SolicitudesPageUiConfig } from "../solicitudesPageFilterConfig.ts";
import { buildRhSolicitudFilterOptions } from "./buildRhSolicitudFilterOptions.ts";
import { computeEmpleadoPersonalSolicitudStats } from "./computeEmpleadoPersonalSolicitudStats.ts";
import { computeRhSolicitudStats } from "./computeRhSolicitudStats.ts";
import { filterRhSolicitudRows, paginateRhSolicitudes } from "./filterAndPaginateRhSolicitudes.ts";
import { fetchRhEmpleadoRequestContext } from "./rhNewRequestEmployeeContext.ts";
import {
  filterMockSolicitudesByEmpleadoId,
  filterMockSolicitudesByLiderScope,
  RH_SOLICITUDES_MOCK_FILAS,
} from "./mockDataset.ts";
import type {
  EmpleadoSolicitudesProfileResumen,
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
  | {
      ok: true;
      rows: RhSolicitudTablaFila[];
      filterOptions: RhSolicitudesAdminViewModel["filterOptions"];
      profileResumen: EmpleadoSolicitudesProfileResumen | null;
      /** Saldo vacaciones mock para KPI «Días disponibles» (solo `empleado_self`). */
      empleadoVacacionesDisponibles: number | null;
    }
  | { ok: false; message: string };

/**
 * Simula carga desde backend. Sustituir por `fetch` real manteniendo el mismo shape.
 * `empleadoId` exige filtrar filas al colaborador cuando `dataScope === "empleado_self"`.
 */
export async function fetchRhSolicitudesAdminDatasetMock(
  simulateError = false,
  dataScope: SolicitudesDataScope = "rh_global",
  empleadoId?: string,
): Promise<FetchRhSolicitudesMockResult> {
  await delay(MOCK_DELAY_MS);
  if (simulateError) {
    return { ok: false, message: "No se pudieron cargar las solicitudes. Intente de nuevo." };
  }
  let rows = patchMockAprobacionesHoy([...RH_SOLICITUDES_MOCK_FILAS]);

  if (dataScope === "lider_equipo") {
    rows = filterMockSolicitudesByLiderScope(rows);
  } else if (dataScope === "empleado_self") {
    const eid = empleadoId?.trim() || "";
    if (!eid) {
      return { ok: false, message: "No se pudo determinar el empleado en sesión." };
    }
    rows = filterMockSolicitudesByEmpleadoId(rows, eid);
  }

  let empleadoVacacionesDisponibles: number | null = null;
  if (dataScope === "empleado_self") {
    const eid = empleadoId?.trim() || "";
    const dirId = parseEmpleadoDirectoryNumericId(eid);
    if (dirId != null) {
      const ctx = await fetchRhEmpleadoRequestContext(dirId);
      empleadoVacacionesDisponibles = ctx.diasVacacionesDisponibles ?? 0;
    } else {
      empleadoVacacionesDisponibles = 0;
    }
  }

  return {
    ok: true,
    rows,
    filterOptions: buildRhSolicitudFilterOptions(rows),
    profileResumen: null,
    empleadoVacacionesDisponibles,
  };
}

export function buildRhSolicitudesAdminViewModel(
  rows: readonly RhSolicitudTablaFila[],
  filterOptions: RhSolicitudesAdminViewModel["filterOptions"],
  filters: RhSolicitudFilterState,
  ui: SolicitudesPageUiConfig,
  profileResumen: EmpleadoSolicitudesProfileResumen | null = null,
  empleadoVacacionesDisponibles: number | null = null,
): RhSolicitudesAdminViewModel {
  const stats = ui.showStatsCards ? computeRhSolicitudStats(rows) : null;
  const empleadoPersonalStats = ui.showEmployeePersonalStats
    ? computeEmpleadoPersonalSolicitudStats(rows, empleadoVacacionesDisponibles)
    : null;
  const filtered = filterRhSolicitudRows(rows, filters);
  const table = paginateRhSolicitudes(filtered, filters);
  const tableStatus = table.total === 0 ? "empty" : "ready";
  return {
    stats,
    statsStatus: "ready",
    empleadoPersonalStats,
    empleadoPersonalStatsStatus: "ready",
    filterOptions,
    filters,
    tableStatus,
    table,
    tableErrorMessage: undefined,
    profileResumen,
    ui,
    personasDiaChartRows: ui.showPersonasDiaChart ? filtered : [],
  };
}
