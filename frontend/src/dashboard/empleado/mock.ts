import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import type { EmpleadoCalendarDayEntry, EmpleadoDashboardPayload } from "./types.ts";

function ymd(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function buildDemoDayEntries(year: number, monthIndex: number): Record<string, EmpleadoCalendarDayEntry> {
  const out: Record<string, EmpleadoCalendarDayEntry> = {};
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  const put = (day: number, e: EmpleadoCalendarDayEntry): void => {
    if (day >= 1 && day <= dim) out[ymd(year, monthIndex, day)] = e;
  };

  put(3, { meal: true, vacation: true });
  put(7, { meal: true, home_office: true });
  put(12, { vacation: true });
  put(18, { meal: true });
  put(22, { home_office: true });
  put(25, { meal: true, vacation: true, home_office: true });

  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() === monthIndex) {
    const iso = rhIsoLocalDate(today);
    out[iso] = { ...(out[iso] ?? {}), meal: true, home_office: true };
  }

  return out;
}

export function buildEmpleadoDashboardMock(now: Date = new Date()): EmpleadoDashboardPayload {
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();

  return {
    vacation_available_days: 15,
    retardos_anio: 2,
    pending_requests: 2,
    pending_request_types: ["vacation", "homeOffice"],
    calendar: {
      initial_year: y,
      initial_month_index: m,
      day_entries: buildDemoDayEntries(y, m),
      selected_iso_date: dim >= 10 ? ymd(y, m, 10) : null,
    },
  };
}

export function emptyEmpleadoDashboardPayload(now: Date = new Date()): EmpleadoDashboardPayload {
  const y = now.getFullYear();
  const mo = now.getMonth();
  return {
    vacation_available_days: null,
    retardos_anio: null,
    pending_requests: null,
    pending_request_types: [],
    calendar: {
      initial_year: y,
      initial_month_index: mo,
      day_entries: {},
      selected_iso_date: null,
    },
  };
}
