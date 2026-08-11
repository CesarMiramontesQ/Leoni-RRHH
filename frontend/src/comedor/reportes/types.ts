import type { ComedorCodigoExternoApiItem, ComedorResumenDiarioApiItem } from "../../api/comedor.ts";
import type { ComedorPanelState, ComedorRhProximoRegistroRow } from "../rh/types.ts";

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

export type ReporteComedorKpiId =
  | "total_empleados"
  | "promedio_asistencia"
  | "dias_mayor_consumo"
  | "costo_estimado"
  | "total_registros_resumen"
  | "promedio_diario_resumen"
  | "mix_menu_resumen"
  | "empleados_unicos_operativo"
  | "accedidos_operativo"
  | "pendientes_operativo"
  | "cancelados_operativo"
  | "comedores_activos_operativo";

export type ReporteComedorKpi = {
  id: ReporteComedorKpiId;
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

/** Chips rápidos: Hoy, Esta semana, Este mes, Mes anterior, Personalizado */
export type ReporteComedorDatePreset = "today" | "this_week" | "next_week" | "this_month" | "custom";

/** Filtro por tipo de comida solo en la tabla «Próximos registros» (toolbar RH). */
export type ReporteComedorTipoComidaFilter = "todos" | "casera" | "saludable";

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
  /** Mensaje de validación suave (fechas inválidas). */
  dateRangeError: string | null;
  /** Paginación del listado de registros (detalle). */
  reporteDetallePage: number;
  /** Búsqueda local en tab «Por comedor». */
  tabSearchComedor: string;
  /** Búsqueda local en tab «Por empleados». */
  tabSearchEmpleado: string;
  /** Búsqueda local en tab «Por áreas». */
  tabSearchArea: string;
  /** Filtro global por área del empleado (registros operativos / KPIs). `todos` = todas. */
  selectedAreaFilter: "todos" | string;
  /**
   * Ventana de comida (`"10:00-10:30"`), `"sin-horario"` o `"todos"`.
   *
   * Se aplica en `reporteOperativoRowsScoped`, el mismo embudo que comedor y área, para
   * que lo que se ve en pantalla y lo que se descarga sean siempre el mismo corte.
   */
  selectedHorarioFilter: "todos" | string;
  /** KPIs usan resumen diario (RH) o estadísticas semanales (otros roles). */
  kpisModo: "rh_resumen" | "comedor_semana";
  kpisState: ComedorPanelState;
  kpis: readonly ReporteComedorKpi[] | null;
  kpisError: string | null;
  /** Serie para mini tendencia en KPIs (RH, desde resumen diario). */
  rhResumenDiario: readonly ComedorResumenDiarioApiItem[] | null;
  tableState: ComedorPanelState;
  table: ReporteComedorTableResponse | null;
  tableError: string | null;
  tableSortKey: ReporteComedorSortKey;
  tableSortDirection: ReporteComedorSortDirection;
  lastUpdatedLabel: string | null;
  selectedEmpleadoId: string | null;
  /** Dataset completo para agregaciones y tabla de registros (RH). */
  rhAnalyticsState: ComedorPanelState;
  rhAnalyticsRows: readonly ComedorRhProximoRegistroRow[];
  rhAnalyticsError: string | null;
  /** Códigos de personal externo con vigencia que intersecta el periodo del reporte (solo RH). */
  rhCodigosExternosRows: readonly ComedorCodigoExternoApiItem[];
};
