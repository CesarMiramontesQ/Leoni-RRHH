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

/** Archivo o imagen de evidencia (solo presentación / mock). */
export type RhIncidenciaEvidenciaItem = {
  id: string;
  kind: "imagen" | "pdf" | "otro";
  nombre: string;
  tamano_mb?: number;
  thumb_url?: string | null;
};

/** Persona ligada al incidente en vista detalle (solo presentación / mock). */
export type RhIncidenciaPersonaInvolucrada = {
  nombre: string;
  puesto: string;
  rol: "testigo" | "afectado" | "involucrado";
  foto_url?: string | null;
};

/** Fila lista para tabla (mock o adapter de API). */
export type RhIncidenciaTablaFila = {
  id: number;
  /** Identificador del colaborador (mock/API); usado en búsqueda por texto. */
  empleado_id: string;
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
  /** Texto de tipo tal como en base de datos (columna `tipo`). */
  tipo_texto?: string;
  no_empleado?: string | null;
  semana_id?: number | null;
  numero_semana?: number | null;
  categoria?: string | null;
  detalle?: string | null;
  descuento_porcentaje?: number | null;
  estatus_id?: number | null;
  subarea?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  descripcion?: string;
  lugar?: string;
  /** ISO datetime local (p. ej. mock); no usar como fecha principal de la incidencia. */
  fecha_hora_iso?: string;
  /** Puesto del colaborador (si el backend lo envía). */
  puesto?: string | null;
  puesto_empleado?: string;
  /** Nombre del supervisor directo si difiere de `supervisor_nombre`. */
  supervisor_directo?: string | null;
  /** Código visible tipo “LNE-88293”. */
  id_empleado_display?: string;
  evidencias?: RhIncidenciaEvidenciaItem[];
  personal_involucrado?: RhIncidenciaPersonaInvolucrada[];
  sla_horas_objetivo?: number;
  /** Segundos simulados desde apertura (solo UI). */
  sla_segundos_transcurridos?: number;
};

export type RhIncidenciaResumenKpi = {
  abiertas: number;
  en_investigacion: number;
  resueltas: number;
  criticas: number;
};

/** Filtros del listado (consulta servidor); valores en string para inputs HTML. */
export type RhIncidenciaListFilters = {
  tipo: string;
  empleado_id: string;
  no_empleado: string;
  nombre: string;
  fecha: string;
  semana_id: string;
  numero_semana: string;
  categoria: string;
  estatus_id: string;
  area: string;
  subarea: string;
  fecha_inicio: string;
  fecha_fin: string;
};

export function emptyRhIncidenciaListFilters(): RhIncidenciaListFilters {
  return {
    tipo: "",
    empleado_id: "",
    no_empleado: "",
    nombre: "",
    fecha: "",
    semana_id: "",
    numero_semana: "",
    categoria: "",
    estatus_id: "",
    area: "",
    subarea: "",
    fecha_inicio: "",
    fecha_fin: "",
  };
}

/** @deprecated Vista anterior (mock); conservado por compatibilidad con datasets locales. */
export type RhIncidenciaFilterState = {
  /** Vista no-RH: filtro por área (select). */
  area_id: string;
  /** Vista RH: búsqueda libre por nombre, id o folio. */
  empleado_busqueda: string;
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

export type RhIncidenciasUiConfig = {
  /** `rh`: input de empleado en lugar de área, sin botón de filtros avanzados. */
  modoFiltros: "rh" | "estandar";
  /** Filtro por supervisor en la barra (solo rol `rh`; gerente/supervisor comparten el resto con RH). */
  mostrarFiltroSupervisor: boolean;
};

export type RhIncidenciasAdminViewModel = {
  resumen: RhIncidenciaResumenKpi | null;
  resumenStatus: "loading" | "ready" | "error";
  filterOptions: RhIncidenciaFilterOptions;
  /** Valores de `tipo` distintos desde API (alcance por rol). */
  tiposRegistrados: readonly string[];
  /** Borrador de filtros (inputs). */
  filterDraft: RhIncidenciaListFilters;
  /** Filtros enviados al backend en la última carga. */
  appliedFilters: RhIncidenciaListFilters;
  ui: RhIncidenciasUiConfig;
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
