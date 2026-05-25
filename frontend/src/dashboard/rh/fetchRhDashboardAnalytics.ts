import { getActasDashboardMetricas } from "../../api/actas.ts";
import {
  getComedorEstadisticas,
  getComedorProyecciones,
  getComedorRhResumenDiario,
} from "../../api/comedor.ts";
import { getEmpleadosResumen } from "../../api/empleados.ts";
import { fetchIncidenciasEstadisticas } from "../../api/incidencias.ts";
import { getDashboardKpis } from "../../api/reportes.ts";
import { getSolicitudesRows } from "../../api/solicitudes.ts";
import {
  buildRhPlatillosPorSemana,
  getCurrentWeekStartIso,
  mapProyeccionesToSidebar,
  rhComedorResumenRangeForWeeks,
} from "../../comedor/rh/buildRhComedorSidebar.ts";
import { aggregateEmpleadosRetardosTop } from "../../incidencias/rh/aggregateEmpleadosRetardosTop.ts";
import { buildIncidenciasTendenciaPorTipo } from "../../incidencias/rh/buildIncidenciasTendenciaPorTipo.ts";
import { emptyRhIncidenciaListFilters } from "../../incidencias/rh/types.ts";
import { computeSolicitudesAnalytics } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";
import type {
  RhDashboardAnalyticsLoadResult,
  RhDashboardAnalyticsPayload,
  RhDashboardPeriodDays,
} from "./analyticsTypes.ts";
import {
  countVacacionesUrgentes,
  filterSolicitudRowsByPeriod,
  isoLocalToday,
  listPeriodosEnRango,
  periodRangeIso,
  tendenciaAgrupacionForPeriod,
} from "./filterRowsByPeriod.ts";

function emptyPayload(periodDays: RhDashboardPeriodDays): RhDashboardAnalyticsPayload {
  const { fechaInicio, fechaFin } = periodRangeIso(periodDays);
  return {
    periodDays,
    periodLabel: `${periodDays} días`,
    fechaInicio,
    fechaFin,
    globalKpis: null,
    laborales: {
      kpis: null,
      solicitudesAnalytics: null,
      empleadosRetardosRanking: [],
      incidenciasEstadisticas: null,
      incidenciasTendenciaPorTipo: null,
      actas: null,
      errors: [],
    },
    comedor: { kpis: null, sidebar: null, errors: [] },
    empleados: { resumen: null, errors: [] },
  };
}

export async function fetchRhDashboardAnalytics(
  periodDays: RhDashboardPeriodDays,
): Promise<RhDashboardAnalyticsLoadResult> {
  const { fechaInicio, fechaFin } = periodRangeIso(periodDays);
  const todayIso = isoLocalToday();
  const weekStartIso = getCurrentWeekStartIso();
  const tendenciaAgrupacion = tendenciaAgrupacionForPeriod(periodDays);
  const incFilters = {
    ...emptyRhIncidenciaListFilters(),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
  };

  const incFiltersRetardo = { ...incFilters, tipo: "retardo" };

  const [
    globalKpisResult,
    solicitudesResult,
    incidenciasResult,
    retardosEstadisticasResult,
    actasResult,
    comedorSidebarResult,
    empleadosResult,
  ] = await Promise.all([
    getDashboardKpis().then((v) => ({ ok: true as const, v })).catch((e: unknown) => ({
      ok: false as const,
      err: e instanceof Error ? e.message : "KPIs globales no disponibles",
    })),
    getSolicitudesRows()
      .then((rows) => ({ ok: true as const, rows }))
      .catch((e: unknown) => ({
        ok: false as const,
        err: e instanceof Error ? e.message : "Solicitudes no disponibles",
      })),
    fetchIncidenciasEstadisticas(incFilters, { tendencia_agrupacion: tendenciaAgrupacion })
      .then((v) => ({ ok: true as const, v }))
      .catch((e: unknown) => ({
        ok: false as const,
        err: e instanceof Error ? e.message : "Estadísticas de incidencias no disponibles",
      })),
    fetchIncidenciasEstadisticas(incFiltersRetardo)
      .then((v) => ({ ok: true as const, v }))
      .catch((e: unknown) => ({
        ok: false as const,
        err: e instanceof Error ? e.message : "Ranking de retardos no disponible",
      })),
    getActasDashboardMetricas()
      .then((v) => ({ ok: true as const, v }))
      .catch((e: unknown) => ({
        ok: false as const,
        err: e instanceof Error ? e.message : "Métricas de actas no disponibles",
      })),
    (async () => {
      try {
        const { desdeIso, hastaIso } = rhComedorResumenRangeForWeeks(4);
        const [proyecciones, estadisticas, resumenRh] = await Promise.all([
          getComedorProyecciones(),
          getComedorEstadisticas(weekStartIso),
          getComedorRhResumenDiario(desdeIso, hastaIso),
        ]);
        const base = mapProyeccionesToSidebar(proyecciones, estadisticas);
        const sidebar = {
          ...base,
          rhPlatillosPorSemana: buildRhPlatillosPorSemana(resumenRh, weekStartIso),
        };
        const hoyRows = await getComedorRhResumenDiario(todayIso, todayIso).catch(() => []);
        const hoy = hoyRows.find((r) => r.fecha === todayIso);
        const caserasHoy = Math.max(0, hoy?.caseras ?? 0);
        const saludablesHoy = Math.max(0, hoy?.saludables ?? 0);
        const totalReg = Math.max(1, estadisticas.total_registros);
        const pctDieta = Math.round((estadisticas.dieta / totalReg) * 100);
        const semActual = estadisticas.total_registros;
        const semProx =
          Number.isFinite(proyecciones.promedio_semanal) && proyecciones.promedio_semanal > 0
            ? Math.round(proyecciones.promedio_semanal)
            : null;
        return {
          ok: true as const,
          sidebar,
          kpis: {
            almuerzos_hoy: caserasHoy + saludablesHoy,
            caseras_hoy: caserasHoy,
            saludables_hoy: saludablesHoy,
            pct_dieta_periodo: pctDieta,
            semana_actual: semActual,
            semana_proxima: semProx,
          },
        };
      } catch (e: unknown) {
        return {
          ok: false as const,
          err: e instanceof Error ? e.message : "Datos de comedor no disponibles",
        };
      }
    })(),
    getEmpleadosResumen()
      .then((v) => ({ ok: true as const, v }))
      .catch((e: unknown) => ({
        ok: false as const,
        err: e instanceof Error ? e.message : "Resumen de empleados no disponible",
      })),
  ]);

  const laboralesErrors: string[] = [];
  const comedorErrors: string[] = [];
  const empleadosErrors: string[] = [];

  let solicitudesAnalytics = null;
  let empleadosRetardosRanking: RhDashboardAnalyticsPayload["laborales"]["empleadosRetardosRanking"] =
    [];
  let laboralesKpis = null;
  let incidenciasEstadisticas = incidenciasResult.ok ? incidenciasResult.v : null;
  let incidenciasTendenciaPorTipo: RhDashboardAnalyticsPayload["laborales"]["incidenciasTendenciaPorTipo"] =
    null;
  if (incidenciasResult.ok) {
    const periodosCanon = listPeriodosEnRango(fechaInicio, fechaFin, tendenciaAgrupacion);
    incidenciasTendenciaPorTipo = buildIncidenciasTendenciaPorTipo(
      incidenciasResult.v.incidencias_por_periodo_y_tipo,
      periodosCanon,
      tendenciaAgrupacion,
    );
  }

  if (retardosEstadisticasResult.ok) {
    empleadosRetardosRanking = aggregateEmpleadosRetardosTop(
      retardosEstadisticasResult.v.empleados_con_mas_incidencias,
    );
  } else {
    laboralesErrors.push(retardosEstadisticasResult.err);
  }

  if (solicitudesResult.ok) {
    const filtered = filterSolicitudRowsByPeriod(solicitudesResult.rows, fechaInicio, fechaFin);
    solicitudesAnalytics = computeSolicitudesAnalytics(filtered);
    laboralesKpis = {
      solicitudes_pendientes: solicitudesAnalytics.kpis.pendientes,
      solicitudes_cambios: solicitudesAnalytics.kpis.cambios_solicitados,
      solicitudes_aprobadas: solicitudesAnalytics.kpis.aprobadas,
      vacaciones_urgentes: countVacacionesUrgentes(solicitudesResult.rows, todayIso),
      incidencias_total: 0,
      incidencias_seguridad: 0,
      incidencias_calidad: 0,
      variacion_incidencias_pct: null,
    };
  } else {
    laboralesErrors.push(solicitudesResult.err);
  }

  if (incidenciasResult.ok) {
    const inc = incidenciasResult.v;
    if (laboralesKpis) {
      laboralesKpis = {
        ...laboralesKpis,
        incidencias_total: inc.total_incidencias,
        incidencias_seguridad: inc.incidencias_seguridad,
        incidencias_calidad: inc.incidencias_calidad,
        variacion_incidencias_pct: inc.variacion_total_pct ?? null,
      };
    } else {
      laboralesKpis = {
        solicitudes_pendientes: 0,
        solicitudes_cambios: 0,
        solicitudes_aprobadas: 0,
        vacaciones_urgentes: 0,
        incidencias_total: inc.total_incidencias,
        incidencias_seguridad: inc.incidencias_seguridad,
        incidencias_calidad: inc.incidencias_calidad,
        variacion_incidencias_pct: inc.variacion_total_pct ?? null,
      };
    }
  } else {
    laboralesErrors.push(incidenciasResult.err);
  }

  let actas = null;
  if (actasResult.ok) {
    actas = {
      en_proceso: actasResult.v.en_proceso,
      pendientes_firma: actasResult.v.pendientes_firma,
    };
  } else {
    laboralesErrors.push(actasResult.err);
  }

  let comedorKpis = null;
  let comedorSidebar = null;
  if (comedorSidebarResult.ok) {
    comedorKpis = comedorSidebarResult.kpis;
    comedorSidebar = comedorSidebarResult.sidebar;
  } else {
    comedorErrors.push(comedorSidebarResult.err);
  }

  let empleadosResumen = null;
  if (empleadosResult.ok) {
    empleadosResumen = empleadosResult.v;
  } else {
    empleadosErrors.push(empleadosResult.err);
  }

  const payload: RhDashboardAnalyticsPayload = {
    ...emptyPayload(periodDays),
    globalKpis: globalKpisResult.ok ? globalKpisResult.v : null,
    laborales: {
      kpis: laboralesKpis,
      solicitudesAnalytics,
      empleadosRetardosRanking,
      incidenciasEstadisticas,
      incidenciasTendenciaPorTipo,
      actas,
      errors: laboralesErrors,
    },
    comedor: {
      kpis: comedorKpis,
      sidebar: comedorSidebar,
      errors: comedorErrors,
    },
    empleados: {
      resumen: empleadosResumen,
      errors: empleadosErrors,
    },
  };

  if (!globalKpisResult.ok) {
    /* global KPIs optional; no block */
  }

  const partialFailure =
    laboralesErrors.length > 0 || comedorErrors.length > 0 || empleadosErrors.length > 0;

  return { payload, partialFailure };
}
