/**
 * Contratos de la vista administrativa de incidencias (rol RH).
 */

export type RhIncidenciaEstadoCodigo = "abierto" | "en_investigacion" | "cerrado";

export type RhIncidenciaPrioridadCodigo = "baja" | "media" | "alta" | "critica";

export type RhIncidenciaTipoCodigo =
  | "falta_injustificada"
  | "retardo"
  | "indisciplina"
  | "dano_equipo";

/** Fila lista para tabla (mock o adapter de API). */
export type RhIncidenciaTablaFila = {
  id: number;
  empleado_nombre_raw: string;
  foto_url: string | null;
  numero_folio: string;
  area: string;
  supervisor_id: string;
  supervisor_nombre: string;
  tipo: RhIncidenciaTipoCodigo;
  /** ISO `YYYY-MM-DD`. */
  fecha: string;
  estado: RhIncidenciaEstadoCodigo;
  prioridad: RhIncidenciaPrioridadCodigo;
};

export type RhIncidenciaResumenKpi = {
  abiertas: number;
  en_investigacion: number;
  resueltas: number;
  criticas: number;
};

export type RhIncidenciaFilterState = {
  area_id: string;
  supervisor_id: string;
  tipo: "" | RhIncidenciaTipoCodigo;
  estado: "" | RhIncidenciaEstadoCodigo;
  periodo: "30d" | "90d" | "365d" | "all";
  page: number;
  page_size: number;
};

export type RhIncidenciaFilterOptions = {
  areas: ReadonlyArray<{ id: string; label: string }>;
  supervisores: ReadonlyArray<{ id: string; label: string }>;
  tipos: ReadonlyArray<{ id: RhIncidenciaTipoCodigo; label: string }>;
  estados: ReadonlyArray<{ id: RhIncidenciaEstadoCodigo; label: string }>;
  periodos: ReadonlyArray<{ id: RhIncidenciaFilterState["periodo"]; label: string }>;
};

export type RhIncidenciasTableData = {
  items: RhIncidenciaTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

export type RhIncidenciasTableStatus = "loading" | "ready" | "empty" | "error";

export type RhIncidenciasAdminViewModel = {
  resumen: RhIncidenciaResumenKpi | null;
  resumenStatus: "loading" | "ready" | "error";
  filterOptions: RhIncidenciaFilterOptions;
  filters: RhIncidenciaFilterState;
  tableStatus: RhIncidenciasTableStatus;
  table: RhIncidenciasTableData | null;
  tableErrorMessage?: string;
};

/** Alias en inglés para integración (mapa 1:1 con dominio en español). */
export type IncidentStatus = "open" | "investigating" | "resolved";
export type IncidentPriority = "low" | "medium" | "high" | "critical";
export type IncidentType =
  | "unjustified_absence"
  | "late_arrival"
  | "indiscipline"
  | "equipment_damage";

export type IncidentSummary = {
  open: number;
  investigating: number;
  resolved: number;
  critical: number;
};

export function resumenKpiToIncidentSummary(k: RhIncidenciaResumenKpi): IncidentSummary {
  return {
    open: k.abiertas,
    investigating: k.en_investigacion,
    resolved: k.resueltas,
    critical: k.criticas,
  };
}
