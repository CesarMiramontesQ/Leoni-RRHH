import { getActasDashboardMetricas } from "../../api/actas.ts";
import {
  getComedorRhRegistrosFuturosPorSemana,
  getComedorRhResumenDiario,
} from "../../api/comedor.ts";
import {
  buildAsistenciaDiariaSerie,
  mapRegistrosFuturosPorSemana,
} from "../../comedor/rh/buildRhDashboardComedorCharts.ts";
import { getEmpleadosResumen } from "../../api/empleados.ts";
import { fetchIncidenciasEstadisticas } from "../../api/incidencias.ts";
import { getDashboardKpis } from "../../api/reportes.ts";
import { getSolicitudesRows } from "../../api/solicitudes.ts";
import {
  canAccessActasPage,
  canAccessComedorRhPage,
  canAccessEmpleadosPage,
  canAccessRhIncidenciasPage,
  canAccessRhSolicitudesAdminPage,
} from "../../auth/jwt.ts";
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

function fetchErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (e && typeof e === "object" && "detail" in e) {
    const detail = (e as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

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
    comedor: { asistenciaDiaria: null, registrosFuturosPorSemana: null, errors: [] },
    empleados: { resumen: null, errors: [] },
  };
}

export async function fetchRhDashboardAnalytics(
  periodDays: RhDashboardPeriodDays,
): Promise<RhDashboardAnalyticsLoadResult> {
  const { fechaInicio, fechaFin } = periodRangeIso(periodDays);
  const todayIso = isoLocalToday();
  const tendenciaAgrupacion = tendenciaAgrupacionForPeriod(periodDays);
  const incFilters = {
    ...emptyRhIncidenciaListFilters(),
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
  };

  const incFiltersRetardo = { ...incFilters, tipo: "retardo" };

  const loadSolicitudes = canAccessRhSolicitudesAdminPage();
  const loadIncidencias = canAccessRhIncidenciasPage();
  const loadActas = canAccessActasPage();
  const loadComedor = canAccessComedorRhPage();

  const [
    globalKpisResult,
    solicitudesResult,
    incidenciasResult,
    retardosEstadisticasResult,
    actasResult,
    comedorSidebarResult,
  ] = await Promise.all([
    getDashboardKpis().then((v) => ({ ok: true as const, v })).catch((e: unknown) => ({
      ok: false as const,
      err: fetchErrorMessage(e, "KPIs globales no disponibles"),
    })),
    loadSolicitudes
      ? getSolicitudesRows()
          .then((rows) => ({ ok: true as const, rows }))
          .catch((e: unknown) => ({
            ok: false as const,
            err: fetchErrorMessage(e, "Solicitudes no disponibles"),
          }))
      : Promise.resolve({ ok: true as const, rows: [] as Awaited<ReturnType<typeof getSolicitudesRows>> }),
    loadIncidencias
      ? fetchIncidenciasEstadisticas(incFilters, { tendencia_agrupacion: tendenciaAgrupacion })
          .then((v) => ({ ok: true as const, v }))
          .catch((e: unknown) => ({
            ok: false as const,
            err: fetchErrorMessage(e, "Estadísticas de incidencias no disponibles"),
          }))
      : Promise.resolve({ ok: false as const, err: "", skipped: true as const }),
    loadIncidencias
      ? fetchIncidenciasEstadisticas(incFiltersRetardo)
          .then((v) => ({ ok: true as const, v }))
          .catch((e: unknown) => ({
            ok: false as const,
            err: fetchErrorMessage(e, "Ranking de retardos no disponible"),
          }))
      : Promise.resolve({ ok: false as const, err: "", skipped: true as const }),
    loadActas
      ? getActasDashboardMetricas()
          .then((v) => ({ ok: true as const, v }))
          .catch((e: unknown) => ({
            ok: false as const,
            err: fetchErrorMessage(e, "Métricas de actas no disponibles"),
          }))
      : Promise.resolve({ ok: false as const, err: "", skipped: true as const }),
    loadComedor
      ? (async () => {
          try {
            const [resumenRh, futurosSemana] = await Promise.all([
              getComedorRhResumenDiario(fechaInicio, fechaFin),
              getComedorRhRegistrosFuturosPorSemana(8),
            ]);
            const asistenciaDiaria = buildAsistenciaDiariaSerie(
              resumenRh,
              fechaInicio,
              fechaFin,
              todayIso,
            );
            const registrosFuturosPorSemana = mapRegistrosFuturosPorSemana(futurosSemana);
            return {
              ok: true as const,
              asistenciaDiaria,
              registrosFuturosPorSemana,
            };
          } catch (e: unknown) {
            return {
              ok: false as const,
              err: fetchErrorMessage(e, "Datos de comedor no disponibles"),
            };
          }
        })()
      : Promise.resolve({ ok: false as const, err: "", skipped: true as const }),
  ]);

  const laboralesErrors: string[] = [];
  const comedorErrors: string[] = [];

  let solicitudesAnalytics = null;
  let empleadosRetardosRanking: RhDashboardAnalyticsPayload["laborales"]["empleadosRetardosRanking"] =
    [];
  let laboralesKpis = null;
  let incidenciasEstadisticas = incidenciasResult.ok ? incidenciasResult.v : null;
  let incidenciasTendenciaPorTipo: RhDashboardAnalyticsPayload["laborales"]["incidenciasTendenciaPorTipo"] =
    null;
  if (incidenciasResult.ok) {
    try {
      const periodosCanon = listPeriodosEnRango(fechaInicio, fechaFin, tendenciaAgrupacion);
      incidenciasTendenciaPorTipo = buildIncidenciasTendenciaPorTipo(
        incidenciasResult.v.incidencias_por_periodo_y_tipo ?? [],
        periodosCanon,
        tendenciaAgrupacion,
      );
    } catch (e: unknown) {
      laboralesErrors.push(
        e instanceof Error ? e.message : "Tendencia de incidencias no disponible",
      );
    }
  }

  if (retardosEstadisticasResult.ok) {
    empleadosRetardosRanking = aggregateEmpleadosRetardosTop(
      retardosEstadisticasResult.v.empleados_con_mas_incidencias,
    );
  } else if (!("skipped" in retardosEstadisticasResult)) {
    laboralesErrors.push(retardosEstadisticasResult.err);
  }

  if (solicitudesResult.ok) {
    try {
      const filtered = filterSolicitudRowsByPeriod(solicitudesResult.rows, fechaInicio, fechaFin);
      solicitudesAnalytics = computeSolicitudesAnalytics(filtered);
    } catch (e: unknown) {
      laboralesErrors.push(
        e instanceof Error ? e.message : "Analítica de solicitudes no disponible",
      );
    }
    laboralesKpis = solicitudesAnalytics
      ? {
          solicitudes_pendientes: solicitudesAnalytics.kpis.pendientes,
          solicitudes_cambios: solicitudesAnalytics.kpis.cambios_solicitados,
          solicitudes_aprobadas: solicitudesAnalytics.kpis.aprobadas,
          vacaciones_urgentes: countVacacionesUrgentes(solicitudesResult.rows, todayIso),
          incidencias_total: 0,
          incidencias_seguridad: 0,
          incidencias_calidad: 0,
          variacion_incidencias_pct: null,
        }
      : {
          solicitudes_pendientes: 0,
          solicitudes_cambios: 0,
          solicitudes_aprobadas: 0,
          vacaciones_urgentes: countVacacionesUrgentes(solicitudesResult.rows, todayIso),
          incidencias_total: 0,
          incidencias_seguridad: 0,
          incidencias_calidad: 0,
          variacion_incidencias_pct: null,
        };
  } else if (loadSolicitudes) {
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
  } else if (!("skipped" in incidenciasResult)) {
    laboralesErrors.push(incidenciasResult.err);
  }

  let actas = null;
  if (actasResult.ok) {
    actas = {
      en_proceso: actasResult.v.en_proceso,
      pendientes_firma: actasResult.v.pendientes_firma,
    };
  } else if (!("skipped" in actasResult)) {
    laboralesErrors.push(actasResult.err);
  }

  let asistenciaDiaria: RhDashboardAnalyticsPayload["comedor"]["asistenciaDiaria"] = null;
  let registrosFuturosPorSemana: RhDashboardAnalyticsPayload["comedor"]["registrosFuturosPorSemana"] =
    null;
  if (comedorSidebarResult.ok) {
    asistenciaDiaria = comedorSidebarResult.asistenciaDiaria;
    registrosFuturosPorSemana = comedorSidebarResult.registrosFuturosPorSemana;
  } else if (!("skipped" in comedorSidebarResult)) {
    comedorErrors.push(comedorSidebarResult.err);
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
      asistenciaDiaria,
      registrosFuturosPorSemana,
      errors: comedorErrors,
    },
    empleados: { resumen: null, errors: [] },
  };

  if (!globalKpisResult.ok) {
    /* global KPIs optional; no block */
  }

  const partialFailure = laboralesErrors.length > 0 || comedorErrors.length > 0;

  return { payload, partialFailure };
}

export type RhDashboardEmpleadosSlice = RhDashboardAnalyticsPayload["empleados"];

/** Resumen de plantilla: no depende del periodo del dashboard. */
export async function fetchRhDashboardEmpleados(): Promise<RhDashboardEmpleadosSlice> {
  if (!canAccessEmpleadosPage()) {
    return { resumen: null, errors: [] };
  }
  try {
    const v = await getEmpleadosResumen();
    return { resumen: v, errors: [] };
  } catch (e: unknown) {
    return {
      resumen: null,
      errors: [fetchErrorMessage(e, "Resumen de empleados no disponible")],
    };
  }
}
