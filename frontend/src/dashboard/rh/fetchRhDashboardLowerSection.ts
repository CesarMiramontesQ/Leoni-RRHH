import type { RhLowerSectionPayload } from "./lowerSectionTypes.ts";
import { getComedorRhResumenDiario } from "../../api/comedor.ts";
import { getCalendarMonthVisibleRange } from "../../components/dashboard/calendarShared.ts";

/**
 * Fuente de la seccion inferior RH.
 */
export async function fetchRhDashboardLowerSection(): Promise<RhLowerSectionPayload | null> {
  const now = new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();
  const range = getCalendarMonthVisibleRange(year, monthIndex, 1);
  const resumen = await getComedorRhResumenDiario(range.startIso, range.endIso);
  const dayMetrics: RhLowerSectionPayload["calendar"]["dayMetrics"] = {};

  let totalAlmuerzos = 0;
  let totalSaludables = 0;
  for (const row of resumen) {
    const caseras = Math.max(0, row.caseras ?? 0);
    const saludables = Math.max(0, row.saludables ?? 0);
    const totalDia = caseras + saludables;
    totalAlmuerzos += totalDia;
    totalSaludables += saludables;
    dayMetrics[row.fecha] = {
      lines: [
        { kind: "normal", text: `${caseras} Caseras` },
        { kind: "dieta", text: `${saludables} Saludables` },
      ],
      showWarning: false,
      showAttention: false,
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
      menus_dieta: totalSaludables,
      home_office_total: 0,
      promedio_diario: Math.round(totalAlmuerzos / weekdaysInMonth),
    },
    upcoming_events: [],
  };
}
