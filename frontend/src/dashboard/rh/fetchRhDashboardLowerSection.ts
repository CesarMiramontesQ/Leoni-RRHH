import type { RhLowerSectionPayload } from "./lowerSectionTypes.ts";
import { getComedorRhResumenDiario } from "../../api/comedor.ts";
import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getCalendarMonthVisibleRange } from "../../components/dashboard/calendarShared.ts";

type SolicitudDailyCounters = {
  vacAprobadas: number;
  vacPendientes: number;
  hoAprobados: number;
  hoPendientes: number;
};

function parseIsoDateAsUtcDay(isoDate: string): number | null {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return Date.UTC(year, month - 1, day);
}

function isoFromUtcDay(utcDay: number): string {
  return new Date(utcDay).toISOString().slice(0, 10);
}

function emptySolicitudCounters(): SolicitudDailyCounters {
  return {
    vacAprobadas: 0,
    vacPendientes: 0,
    hoAprobados: 0,
    hoPendientes: 0,
  };
}

function aggregateSolicitudesByDay(
  solicitudes: Awaited<ReturnType<typeof getSolicitudesRows>>,
  startIso: string,
  endIso: string,
): Record<string, SolicitudDailyCounters> {
  const out: Record<string, SolicitudDailyCounters> = {};
  const rangeStartUtc = parseIsoDateAsUtcDay(startIso);
  const rangeEndUtc = parseIsoDateAsUtcDay(endIso);
  if (rangeStartUtc === null || rangeEndUtc === null) return out;

  for (const solicitud of solicitudes) {
    const isVacaciones = solicitud.tipo === "vacaciones";
    const isHomeOffice = solicitud.tipo === "home_office";
    if (!isVacaciones && !isHomeOffice) continue;

    const isAprobada = solicitud.estado === "approved";
    const isPendiente = solicitud.estado === "pending";
    if (!isAprobada && !isPendiente) continue;

    const solicitudStartUtc = parseIsoDateAsUtcDay(solicitud.fecha_inicio);
    const solicitudEndUtc = parseIsoDateAsUtcDay(solicitud.fecha_fin);
    if (solicitudStartUtc === null || solicitudEndUtc === null) continue;

    const clippedStartUtc = Math.max(rangeStartUtc, solicitudStartUtc);
    const clippedEndUtc = Math.min(rangeEndUtc, solicitudEndUtc);
    if (clippedStartUtc > clippedEndUtc) continue;

    for (let dayUtc = clippedStartUtc; dayUtc <= clippedEndUtc; dayUtc += 24 * 60 * 60 * 1000) {
      const iso = isoFromUtcDay(dayUtc);
      const bucket = (out[iso] ??= emptySolicitudCounters());
      if (isVacaciones && isAprobada) bucket.vacAprobadas += 1;
      if (isVacaciones && isPendiente) bucket.vacPendientes += 1;
      if (isHomeOffice && isAprobada) bucket.hoAprobados += 1;
      if (isHomeOffice && isPendiente) bucket.hoPendientes += 1;
    }
  }

  return out;
}

/**
 * Fuente de la seccion inferior RH.
 */
export async function fetchRhDashboardLowerSection(): Promise<RhLowerSectionPayload | null> {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const range = getCalendarMonthVisibleRange(year, monthIndex, 1);
  const [resumen, solicitudes] = await Promise.all([
    getComedorRhResumenDiario(range.startIso, range.endIso),
    getSolicitudesRows(100),
  ]);
  const solicitudesByDay = aggregateSolicitudesByDay(solicitudes, range.startIso, range.endIso);
  const dayMetrics: RhLowerSectionPayload["calendar"]["dayMetrics"] = {};

  let totalAlmuerzos = 0;
  let totalOpcionB = 0;
  let totalHomeOffice = 0;

  for (const [iso, counters] of Object.entries(solicitudesByDay)) {
    dayMetrics[iso] = {
      lines: [
        { kind: "vacaciones", text: `Vac Aprobadas: ${counters.vacAprobadas}` },
        { kind: "vacaciones", text: `Vac Pendientes: ${counters.vacPendientes}` },
        { kind: "ho", text: `HO Aprobados: ${counters.hoAprobados}` },
        { kind: "ho", text: `HO Pendientes: ${counters.hoPendientes}` },
      ],
      showWarning: false,
      showAttention: counters.vacPendientes > 0 || counters.hoPendientes > 0,
    };
    totalHomeOffice += counters.hoAprobados + counters.hoPendientes;
  }

  for (const row of resumen) {
    const caseras = Math.max(0, row.caseras ?? 0);
    const saludables = Math.max(0, row.saludables ?? 0);
    const totalDia = caseras + saludables;
    totalAlmuerzos += totalDia;
    totalOpcionB += saludables;
    const current = dayMetrics[row.fecha];
    const lines = current?.lines ?? [];
    lines.unshift(
      { kind: "dieta", text: `${saludables} Opción B` },
      { kind: "normal", text: `${caseras} Opción A` },
    );
    dayMetrics[row.fecha] = {
      lines,
      showWarning: Boolean(current?.showWarning),
      showAttention: Boolean(current?.showAttention),
    };
  }

  const weekdaysInMonth = (() => {
    let count = 0;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const dt = new Date(year, monthIndex, day);
      const weekDay = dt.getDay();
      if (weekDay !== 0 && weekDay !== 6) count += 1;
    }
    return Math.max(1, count);
  })();

  return {
    priority_alerts: [],
    calendar: {
      initialYear: year,
      initialMonthIndex: monthIndex,
      dayMetrics,
      selectedIsoDate: now.toISOString().slice(0, 10),
    },
    weekly_summary: {
      total_almuerzos: totalAlmuerzos,
      menus_dieta: totalOpcionB,
      home_office_total: totalHomeOffice,
      promedio_diario: Math.round(totalAlmuerzos / weekdaysInMonth),
    },
    upcoming_events: [],
  };
}
