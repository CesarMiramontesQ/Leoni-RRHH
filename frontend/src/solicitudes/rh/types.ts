/**
 * Contratos de la vista administrativa de solicitudes (rol RH).
 * Desacoplados del componente de página para futura integración con API.
 */

import type { SolicitudesPageUiConfig } from "../solicitudesPageFilterConfig.ts";

export type RhSolicitudTipoCodigo = "vacaciones" | "home_office";

export type RhSolicitudEstadoCodigo =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested"
  | "cancelled"
  | "overridden";

/** Fila de tabla lista para UI (tras adapter/mapper desde API o mock). */
export type RhSolicitudTablaFila = {
  id: number;
  /** Identificador del colaborador (API / mock); uso en filtros y permisos. */
  empleado_id: string;
  /** Nombre crudo (p. ej. `APELLIDO, NOMBRE`); la UI aplica `formatNombreEmpleadoUi`. */
  empleado_nombre_raw: string;
  foto_url: string | null;
  /** Etiqueta tipo `#SOL-1234` o número de folio. */
  numero_folio: string;
  area: string;
  tipo: RhSolicitudTipoCodigo;
  /** ISO date `YYYY-MM-DD` — fecha de creación de la solicitud. */
  fecha_solicitud: string;
  fecha_inicio: string;
  fecha_fin: string;
  /** Si existe, sustituye el rango automático (p. ej. recurrencia HO). */
  periodo_etiqueta: string | null;
  estado: RhSolicitudEstadoCodigo;
  supervisor_id: string;
  supervisor_nombre: string;
  /** ISO date — día en que pasó a aprobada (mock / futuro campo API). */
  fecha_aprobacion: string | null;
  /** Comentarios del empleado al crear la solicitud (API). */
  comentarios?: string | null;
};

/** Métricas del encabezado (normalmente globales, no filtradas por la tabla). */
export type RhSolicitudRequestStats = {
  pendientes: number;
  vacaciones: number;
  home_office: number;
  aprobadas_hoy: number;
};

/** KPIs personales en la página de solicitudes (variante `empleado`). */
export type RhSolicitudEmpleadoPersonalStats = {
  dias_disponibles: number;
  dias_tomados: number;
  dias_home_office_tomados: number;
  solicitudes_pendientes: number;
};

/** Resumen del colaborador (legado; la vista `empleado` ya no muestra bloque de perfil). */
export type EmpleadoSolicitudesProfileResumen = {
  empleado_id: string;
  nombre_display: string;
  area: string;
  puesto: string;
};

export type RhSolicitudFilterState = {
  tipo: "" | RhSolicitudTipoCodigo;
  area_id: string;
  supervisor_id: string;
  empleado_id: string;
  /** Búsqueda libre de empleado (nombre, id, folio). UI: roles `rh`, `supervisor`, `gerente`; el resto no la escriben. */
  empleado_busqueda: string;
  estado: "" | RhSolicitudEstadoCodigo;
  page: number;
  page_size: number;
};

export type RhSolicitudFilterOptions = {
  areas: ReadonlyArray<{ id: string; label: string }>;
  supervisores: ReadonlyArray<{ id: string; label: string }>;
  empleados: ReadonlyArray<{ id: string; label: string }>;
  tipos: ReadonlyArray<{ id: RhSolicitudTipoCodigo; label: string }>;
  estados: ReadonlyArray<{ id: RhSolicitudEstadoCodigo; label: string }>;
};

export type RhSolicitudesTableData = {
  items: RhSolicitudTablaFila[];
  total: number;
  page: number;
  page_size: number;
};

export type RhSolicitudesTableStatus = "loading" | "ready" | "empty" | "error";

export type RhSolicitudesAdminViewModel = {
  stats: RhSolicitudRequestStats | null;
  statsStatus: "loading" | "ready" | "error";
  empleadoPersonalStats: RhSolicitudEmpleadoPersonalStats | null;
  empleadoPersonalStatsStatus: "loading" | "ready" | "error";
  filterOptions: RhSolicitudFilterOptions;
  filters: RhSolicitudFilterState;
  tableStatus: RhSolicitudesTableStatus;
  table: RhSolicitudesTableData | null;
  tableErrorMessage?: string;
  /** Perfil (no usado en UI actual de `empleado`). */
  profileResumen: EmpleadoSolicitudesProfileResumen | null;
  /** Configuración de UI por rol (filtros visibles, etc.). */
  ui: SolicitudesPageUiConfig;
};
