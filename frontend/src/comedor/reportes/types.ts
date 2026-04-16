import type { ComedorPanelState } from "../rh/types.ts";

export type ReporteComedorDepartamentoOption = {
  id: string;
  label: string;
};

export type ReporteComedorTurnoOption = {
  id: string;
  label: string;
};

export type ReporteComedorFiltersDataset = {
  departamentos: readonly ReporteComedorDepartamentoOption[];
  turnos: readonly ReporteComedorTurnoOption[];
  fechaInicioIso: string;
  fechaFinIso: string;
};

export type ReporteComedorKpi = {
  id: "total_empleados" | "promedio_asistencia" | "dias_mayor_consumo" | "costo_estimado";
  label: string;
  valor: string;
  secundario: string;
  icono: "empleados" | "asistencia" | "consumo" | "costo";
};

export type ReporteComedorMenuBadge = "normal" | "dieta";

export type ReporteComedorComentario = {
  id: string;
  titulo: string;
  detalle: string;
  tono: "alerta" | "nota";
};

export type ReporteComedorEmpleadoRow = {
  id: string;
  nombre: string;
  noEmpleado: string;
  area: string;
  departamentoId: string;
  turnoId: string;
  avatarUrl: string | null;
  diasMes: string;
  menu: ReporteComedorMenuBadge;
  activo: boolean;
  ultimaAsistencia: string;
  asistenciaSemanal: readonly number[];
  preferenciaDietaPercent: number;
  comentarios: readonly ReporteComedorComentario[];
};

export type ReporteComedorTableResponse = {
  empleados: readonly ReporteComedorEmpleadoRow[];
};

export type ReporteComedorFiltersQuery = {
  departamentoId: string;
  turnoId: string;
  fechaInicioIso: string;
  fechaFinIso: string;
};

export type ReporteComedorDatePreset = "last_7" | "last_30" | "this_month" | "previous_month" | "custom";

export type ReporteComedorSortKey = "nombre" | "dias_mes" | "menu" | "estado";

export type ReporteComedorSortDirection = "asc" | "desc";

export type ReporteComedorViewState = {
  filtersDataset: ReporteComedorFiltersDataset;
  draftDepartamentoId: string;
  draftTurnoId: string;
  draftFechaInicioIso: string;
  draftFechaFinIso: string;
  draftDatePreset: ReporteComedorDatePreset;
  selectedDepartamentoId: string;
  selectedTurnoId: string;
  selectedFechaInicioIso: string;
  selectedFechaFinIso: string;
  kpisState: ComedorPanelState;
  kpis: readonly ReporteComedorKpi[] | null;
  kpisError: string | null;
  tableState: ComedorPanelState;
  table: ReporteComedorTableResponse | null;
  tableError: string | null;
  tableSearch: string;
  tableSortKey: ReporteComedorSortKey;
  tableSortDirection: ReporteComedorSortDirection;
  lastUpdatedLabel: string | null;
  selectedEmpleadoId: string | null;
};
