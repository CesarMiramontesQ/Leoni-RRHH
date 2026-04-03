import type {
  RhCalendarDayMetrics,
  RhCalendarDayLine,
  RhLowerSectionPayload,
  RhPriorityAlertChip,
  RhUpcomingEventItem,
  RhWeeklySummaryMetrics,
} from "./lowerSectionTypes.ts";

/** YYYY-MM-DD en hora local */
export function rhIsoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdKey(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${m}-${dd}`;
}

function mergeDayMetrics(
  a: RhCalendarDayMetrics,
  b: RhCalendarDayMetrics,
): RhCalendarDayMetrics {
  const seen = new Set<string>();
  const lines: RhCalendarDayLine[] = [];
  for (const x of [...a.lines, ...b.lines]) {
    const k = `${x.kind}:${x.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    lines.push(x);
  }
  return {
    lines,
    showWarning: Boolean(a.showWarning || b.showWarning),
    showAttention: Boolean(a.showAttention || b.showAttention),
  };
}

function buildDemoDayMetrics(year: number, monthIndex: number): Record<string, RhCalendarDayMetrics> {
  const out: Record<string, RhCalendarDayMetrics> = {};
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const now = new Date();
  const viewingCurrent = now.getFullYear() === year && now.getMonth() === monthIndex;

  const put = (day: number, m: RhCalendarDayMetrics): void => {
    if (day < 1 || day > daysInMonth) return;
    const k = ymdKey(year, monthIndex, day);
    out[k] = out[k] ? mergeDayMetrics(out[k]!, m) : m;
  };

  put(2, {
    showWarning: true,
    lines: [
      { kind: "normal", text: "Norm. 310" },
      { kind: "dieta", text: "Diet. 48" },
    ],
  });

  put(5, {
    showAttention: true,
    lines: [
      { kind: "vacaciones", text: "Vac. (3)" },
      { kind: "ho", text: "HO (52/50)", danger: true },
    ],
  });

  put(14, {
    lines: [
      { kind: "vacaciones", text: "Vac. (12)" },
      { kind: "ho", text: "HO (15/50)" },
    ],
  });

  put(6, {
    lines: [
      { kind: "normal", text: "Norm. 298" },
      { kind: "ho", text: "HO (8/50)" },
    ],
  });

  put(11, {
    lines: [{ kind: "vacaciones", text: "Vac. (4)" }],
  });

  if (viewingCurrent) {
    const td = now.getDate();
    put(td, {
      lines: [
        { kind: "normal", text: "Normal 342", solid: true },
        { kind: "dieta", text: "Dieta 62", solid: true },
        { kind: "ho", text: "HO (28/50)" },
      ],
    });
  }

  return out;
}

const MOCK_ALERTS: RhPriorityAlertChip[] = [
  { id: "contratos", label: "3 contratos por vencer", icon: "document" },
  { id: "ho_limite", label: "2 límite HO superado", icon: "calendar" },
  { id: "inc_sin_seg", label: "5 incidencias sin seguimiento", icon: "bell" },
];

const MOCK_WEEKLY: RhWeeklySummaryMetrics = {
  total_almuerzos: 1680,
  menus_dieta: 210,
  home_office_total: 142,
  promedio_diario: 336,
};

const MOCK_EVENTS: RhUpcomingEventItem[] = [
  {
    id: "ev1",
    title: "Revisión de Vacaciones",
    subtitle: "Mañana, 09:00 AM",
    icon: "umbrella",
  },
  {
    id: "ev2",
    title: "Junta Team Semanal",
    subtitle: "Viernes, 12:00 PM",
    icon: "utensils",
  },
];

export function buildRhLowerSectionMock(now: Date = new Date()): RhLowerSectionPayload {
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();

  return {
    priority_alerts: MOCK_ALERTS,
    calendar: {
      initialYear: y,
      initialMonthIndex: m,
      dayMetrics: buildDemoDayMetrics(y, m),
      selectedIsoDate: dim >= 14 ? ymdKey(y, m, 14) : null,
    },
    weekly_summary: MOCK_WEEKLY,
    upcoming_events: MOCK_EVENTS,
  };
}

/** Payload mínimo para pruebas de vacío / error de red */
export function emptyRhLowerSectionPayload(now: Date = new Date()): RhLowerSectionPayload {
  const y = now.getFullYear();
  const m = now.getMonth();
  return {
    priority_alerts: [],
    calendar: {
      initialYear: y,
      initialMonthIndex: m,
      dayMetrics: {},
      selectedIsoDate: null,
    },
    weekly_summary: {
      total_almuerzos: null,
      menus_dieta: null,
      home_office_total: null,
      promedio_diario: null,
    },
    upcoming_events: [],
  };
}
