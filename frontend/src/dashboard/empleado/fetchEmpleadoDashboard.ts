import { getSolicitudesRows } from "../../api/solicitudes.ts";
import { getComedorMisReservasMes } from "../../api/comedor.ts";
import { getEmpleadoIdFromAccessToken, getRolFromAccessToken } from "../../auth/jwt.ts";
import { etiquetaTipoComida } from "../../utils/comedorReservaFechas.ts";
import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import { emptyEmpleadoDashboardPayload } from "./mock.ts";
import { SOLICITUD_ESTADO_API } from "./solicitudCalendarioConsts.ts";
import type { EmpleadoCalendarDayEntry, EmpleadoDashboardPayload, SolicitudEstadoCalendarioEmpleado } from "./types.ts";

type CalendarMonthFetchTarget = {
  year: number;
  monthIndex: number;
  visibleStartIso?: string;
  visibleEndIso?: string;
};

/** Días locales YYYY-MM-DD desde fecha_inicio hasta fecha_fin (inclusive), mismo criterio que el grid del calendario. */
function eachIsoDayInclusive(fechaInicio: string, fechaFin: string): string[] {
  const a = fechaInicio.slice(0, 10);
  const b = fechaFin.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return [];
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const start = new Date(y1!, m1! - 1, d1!);
  const end = new Date(y2!, m2! - 1, d2!);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const out: string[] = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
    out.push(rhIsoLocalDate(cur));
  }
  return out;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function computeVisibleRange(year: number, monthIndex: number): { startIso: string; endIso: string } {
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, monthIndex, 1 - startOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return {
    startIso: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`,
    endIso: `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`,
  };
}

function monthsCoveredByIsoRange(startIso: string, endIso: string): Array<{ year: number; month: number }> {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [];
  const out: Array<{ year: number; month: number }> = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

/**
 * Dashboard personal (rol `empleado`): KPIs siguen sin endpoint dedicado;
 * el calendario marca solicitudes propias pendientes (amarillo) y aprobadas (verde).
 */
export async function fetchEmpleadoDashboard(target?: CalendarMonthFetchTarget): Promise<EmpleadoDashboardPayload | null> {
  if (getRolFromAccessToken() !== "empleado") return null;

  const now = new Date();
  const referenceDate =
    target ? new Date(target.year, target.monthIndex, 1) : now;
  const base = emptyEmpleadoDashboardPayload(referenceDate);
  const myId = getEmpleadoIdFromAccessToken();
  const visibleRange = computeVisibleRange(base.calendar.initial_year, base.calendar.initial_month_index);
  const rangeStartIso = target?.visibleStartIso ?? visibleRange.startIso;
  const rangeEndIso = target?.visibleEndIso ?? visibleRange.endIso;
  const monthsToLoad = monthsCoveredByIsoRange(rangeStartIso, rangeEndIso);

  try {
    const [rows, reservasPorMes] = await Promise.all([
      getSolicitudesRows(100),
      Promise.all(
        monthsToLoad.map(({ year, month }) => getComedorMisReservasMes(year, month).catch(() => [])),
      ),
    ]);
    const comedorReservas = reservasPorMes
      .flat()
      .filter((reserva) => {
        const iso = reserva.fecha_servicio.slice(0, 10);
        return iso >= rangeStartIso && iso <= rangeEndIso;
      });
    const relevant = rows.filter((r) => {
      if (r.estado !== SOLICITUD_ESTADO_API.APROBADO && r.estado !== SOLICITUD_ESTADO_API.PENDIENTE) return false;
      if (myId != null && r.empleado_id !== myId) return false;
      const startIso = r.fecha_inicio.slice(0, 10);
      const endIso = r.fecha_fin.slice(0, 10);
      if (endIso < rangeStartIso || startIso > rangeEndIso) return false;
      return true;
    });

    const day_entries: Record<string, EmpleadoCalendarDayEntry> = { ...base.calendar.day_entries };
    for (const reserva of comedorReservas) {
      const iso = reserva.fecha_servicio.slice(0, 10);
      day_entries[iso] = {
        ...day_entries[iso],
        meal: etiquetaTipoComida(reserva.tipo_comida),
      };
    }
    for (const row of relevant) {
      const estado: SolicitudEstadoCalendarioEmpleado =
        row.estado === SOLICITUD_ESTADO_API.APROBADO ? SOLICITUD_ESTADO_API.APROBADO : SOLICITUD_ESTADO_API.PENDIENTE;
      for (const iso of eachIsoDayInclusive(row.fecha_inicio, row.fecha_fin)) {
        if (iso < rangeStartIso || iso > rangeEndIso) continue;
        const prev = day_entries[iso]?.solicitudes_empleado ?? [];
        if (prev.some((e) => e.solicitud_id === row.id)) continue;
        day_entries[iso] = {
          ...day_entries[iso],
          solicitudes_empleado: [...prev, { solicitud_id: row.id, estado, tipo: row.tipo }],
        };
      }
    }

    return {
      ...base,
      calendar: {
        ...base.calendar,
        day_entries,
      },
    };
  } catch {
    return null;
  }
}
