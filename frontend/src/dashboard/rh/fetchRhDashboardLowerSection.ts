import type { RhLowerSectionPayload } from "./lowerSectionTypes.ts";
import { getComedorRhResumenDiario } from "../../api/comedor.ts";
import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getCalendarMonthVisibleRange } from "../../components/dashboard/calendarShared.ts";

type SolicitudDailyCounters = {
  vacAprobadas: number;
  vacPendientes: number;
  hoAprobados: number;
  hoPendientes: number;
  sinGoceAprobados: number;
  sinGocePendientes: number;
  goceAprobados: number;
  gocePendientes: number;
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
    sinGoceAprobados: 0,
    sinGocePendientes: 0,
    goceAprobados: 0,
    gocePendientes: 0,
  };
}

const TIPOS_GOCE_RH = new Set([
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
]);

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
    const t = solicitud.tipo;
    const isVacaciones = t === "vacaciones";
    const isHomeOffice = t === "home_office";
    const isSinGoce = t === "permiso_sin_goce_sueldo";
    const isGoceRh = TIPOS_GOCE_RH.has(t);
    if (!isVacaciones && !isHomeOffice && !isSinGoce && !isGoceRh) continue;

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
      if (isSinGoce && isAprobada) bucket.sinGoceAprobados += 1;
      if (isSinGoce && isPendiente) bucket.sinGocePendientes += 1;
      if (isGoceRh && isAprobada) bucket.goceAprobados += 1;
      if (isGoceRh && isPendiente) bucket.gocePendientes += 1;
    }
  }

  return out;
}

/**
 * Fuente de la sección inferior RH (calendario). Ya no se usa en `#/`; conservada para reutilización.
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
        { kind: "sin_goce", text: `Sin goce aprob.: ${counters.sinGoceAprobados}` },
        { kind: "sin_goce", text: `Sin goce pend.: ${counters.sinGocePendientes}` },
        { kind: "goce_sueldo", text: `Con goce aprob.: ${counters.goceAprobados}` },
        { kind: "goce_sueldo", text: `Con goce pend.: ${counters.gocePendientes}` },
      ],
      showWarning: false,
      showAttention:
        counters.vacPendientes > 0 ||
        counters.hoPendientes > 0 ||
        counters.sinGocePendientes > 0 ||
        counters.gocePendientes > 0,
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
    lines.unshift({ kind: "normal", text: `${totalDia} comidas` });
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
