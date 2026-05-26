import type { KpiResponse } from "../../api/reportes.ts";
import type { UsuarioResumen } from "../../api/empleados.ts";
import type {
  RhSolicitudesAnalyticsData,
  SolicitudRankingRow,
} from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import type { IncidenciaTendenciaPorTipo } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import type { RhIncidenciasEstadisticasData } from "../../incidencias/rh/types.ts";
import type {
  RhDashComedorAsistenciaDia,
  RhDashComedorSemanaFutura,
} from "../../comedor/rh/buildRhDashboardComedorCharts.ts";

export type RhDashboardPeriodDays = 7 | 30 | 90;

export const RH_DASHBOARD_PERIOD_STORAGE_KEY = "rh-dashboard-period";

export const RH_DASHBOARD_PERIOD_OPTIONS: readonly { days: RhDashboardPeriodDays; label: string }[] = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
] as const;

export const DEFAULT_RH_DASHBOARD_PERIOD: RhDashboardPeriodDays = 30;

/** Mensaje unificado cuando una gráfica no tiene datos en el periodo activo. */
export const RH_DASH_PERIOD_EMPTY_MSG = "No hay datos disponibles para este período";

/** Mensaje para gráficas de plantilla (sin filtro de periodo). */
export const RH_DASH_EMPLEADOS_EMPTY_MSG = "No hay datos de plantilla para mostrar";

export type RhDashboardActasKpis = {
  en_proceso: number;
  pendientes_firma: number;
};

export type RhDashboardLaboralesKpis = {
  solicitudes_pendientes: number;
  solicitudes_cambios: number;
  solicitudes_aprobadas: number;
  vacaciones_urgentes: number;
  incidencias_total: number;
  incidencias_seguridad: number;
  incidencias_calidad: number;
  variacion_incidencias_pct: number | null;
};

export type RhDashboardAnalyticsPayload = {
  periodDays: RhDashboardPeriodDays;
  periodLabel: string;
  fechaInicio: string;
  fechaFin: string;
  globalKpis: KpiResponse | null;
  laborales: {
    kpis: RhDashboardLaboralesKpis | null;
    solicitudesAnalytics: RhSolicitudesAnalyticsData | null;
    /** Top empleados con incidencias de retardo en el periodo seleccionado. */
    empleadosRetardosRanking: readonly SolicitudRankingRow[];
    incidenciasEstadisticas: RhIncidenciasEstadisticasData | null;
    incidenciasTendenciaPorTipo: IncidenciaTendenciaPorTipo | null;
    actas: RhDashboardActasKpis | null;
    errors: string[];
  };
  comedor: {
    asistenciaDiaria: readonly RhDashComedorAsistenciaDia[] | null;
    registrosFuturosPorSemana: readonly RhDashComedorSemanaFutura[] | null;
    errors: string[];
  };
  empleados: {
    resumen: UsuarioResumen | null;
    errors: string[];
  };
};

export type RhDashboardAnalyticsLoadResult = {
  payload: RhDashboardAnalyticsPayload;
  partialFailure: boolean;
};
