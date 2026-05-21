import type { KpiResponse } from "../../api/reportes.ts";
import type { UsuarioResumen } from "../../api/empleados.ts";
import type {
  RhSolicitudesAnalyticsData,
  SolicitudRankingRow,
} from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import type { IncidenciaTendenciaPorTipo } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import type { RhIncidenciasEstadisticasData } from "../../incidencias/rh/types.ts";
import type { ComedorSidebarDataset } from "../../comedor/rh/types.ts";

export type RhDashboardPeriodDays = 7 | 30 | 90;

export const RH_DASHBOARD_PERIOD_STORAGE_KEY = "rh-dashboard-period";

export const RH_DASHBOARD_PERIOD_OPTIONS: readonly { days: RhDashboardPeriodDays; label: string }[] = [
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
] as const;

export const DEFAULT_RH_DASHBOARD_PERIOD: RhDashboardPeriodDays = 30;

export type RhDashboardActasKpis = {
  en_proceso: number;
  pendientes_firma: number;
};

export type RhDashboardComedorKpis = {
  almuerzos_hoy: number;
  caseras_hoy: number;
  saludables_hoy: number;
  pct_dieta_periodo: number | null;
  semana_actual: number | null;
  semana_proxima: number | null;
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
    /** Ranking por líder directo; todas las `pending` vigentes (sin filtro de periodo). */
    supervisoresPendientesRanking: readonly SolicitudRankingRow[];
    incidenciasEstadisticas: RhIncidenciasEstadisticasData | null;
    incidenciasTendenciaPorTipo: IncidenciaTendenciaPorTipo | null;
    actas: RhDashboardActasKpis | null;
    errors: string[];
  };
  comedor: {
    kpis: RhDashboardComedorKpis | null;
    sidebar: ComedorSidebarDataset | null;
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
