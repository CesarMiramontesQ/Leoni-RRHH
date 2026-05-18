import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import type {
  LiderApprovalRequestRow,
  LiderDashboardPayload,
  LiderPersonalStats,
  LiderTeamStats,
  TeamCalendarDayEntry,
  TeamCalendarLine,
} from "./types.ts";

function ymd(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function buildTeamCalendarDemo(year: number, monthIndex: number): Record<string, TeamCalendarDayEntry> {
  const out: Record<string, TeamCalendarDayEntry> = {};
  const put = (day: number, lines: TeamCalendarLine[]): void => {
    const dim = new Date(year, monthIndex + 1, 0).getDate();
    if (day < 1 || day > dim) return;
    out[ymd(year, monthIndex, day)] = { lines };
  };

  put(4, [
    {
      kind: "vacation",
      text: "Vacaciones",
      request_tipo: "vacaciones",
      request_status: "approved",
      owner_id: "1002",
      owner_name: "Ana",
    },
    { kind: "meal", text: "Comida 8" },
  ]);
  put(5, [
    {
      kind: "home_office",
      text: "Home Office",
      request_tipo: "home_office",
      request_status: "pending",
      owner_id: "1003",
      owner_name: "Luis",
    },
    {
      kind: "vacation",
      text: "Vacaciones",
      request_tipo: "vacaciones",
      request_status: "approved",
      owner_id: "1001",
      owner_name: "Mi solicitud",
    },
  ]);
  put(11, [{ kind: "meal", text: "Comida 12" }, { kind: "incident", text: "Inc. equipo" }]);
  put(14, [
    {
      kind: "vacation",
      text: "Vacaciones",
      request_tipo: "vacaciones",
      request_status: "approved",
      owner_id: "1004",
      owner_name: "María",
    },
    {
      kind: "vacation",
      text: "Vacaciones",
      request_tipo: "vacaciones",
      request_status: "pending",
      owner_id: "1005",
      owner_name: "Pedro",
    },
    {
      kind: "home_office",
      text: "Home Office",
      request_tipo: "home_office",
      request_status: "pending",
      owner_id: "1006",
      owner_name: "Carmen",
    },
    { kind: "meal", text: "Comida 6" },
    { kind: "meal", text: "Extra" },
  ]);
  put(18, [
    {
      kind: "home_office",
      text: "Home Office",
      request_tipo: "home_office",
      request_status: "approved",
      owner_id: "1002",
      owner_name: "Ana",
    },
  ]);
  put(22, [
    { kind: "meal", text: "Comida 10" },
    {
      kind: "vacation",
      text: "Vacaciones",
      request_tipo: "vacaciones",
      request_status: "approved",
      owner_id: "1003",
      owner_name: "Luis",
    },
  ]);

  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() === monthIndex) {
    const iso = rhIsoLocalDate(today);
    const existing = out[iso]?.lines ?? [];
    out[iso] = {
      lines: [
        ...existing,
        { kind: "meal", text: "Comida hoy" },
        {
          kind: "vacation",
          text: "Vacaciones",
          request_tipo: "vacaciones",
          request_status: "pending",
          owner_id: "1001",
          owner_name: "Mi solicitud",
        },
      ],
    };
  }

  return out;
}

const MOCK_PERSONAL: LiderPersonalStats = {
  vacation_available_days: 12,
  vacation_used_days: 6,
  home_office_this_month: 2,
  pending_requests: 1,
  pending_request_types: ["vacation"],
};

const MOCK_TEAM: LiderTeamStats = {
  team_active_incidents: 3,
  team_pending_vacation_requests: 4,
  team_pending_home_office_requests: 2,
  team_collaborators_count: 12,
};

const MOCK_APPROVALS: LiderApprovalRequestRow[] = [
  {
    id: "a1",
    collaborator_name: "Alejandro Ruiz García",
    collaborator_initials: "AR",
    request_type: "vacation",
    date_range: "24 may – 28 may 2026",
    detail: "Vacaciones de primavera",
    status: "Pendiente",
  },
  {
    id: "a2",
    collaborator_name: "María López",
    collaborator_initials: "ML",
    request_type: "home_office",
    date_range: "30 may 2026",
    detail: "Home office puntual",
    status: "Pendiente",
  },
  {
    id: "a3",
    collaborator_name: "Luis Hernández",
    collaborator_initials: "LH",
    request_type: "permiso",
    date_range: "2 jun 2026",
    detail: "Permiso personal",
    status: "Pendiente",
  },
];

export function buildLiderDashboardMock(now: Date = new Date()): LiderDashboardPayload {
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = new Date(y, m + 1, 0).getDate();

  return {
    personal: MOCK_PERSONAL,
    team: MOCK_TEAM,
    approval_requests: MOCK_APPROVALS,
    team_calendar: {
      initial_year: y,
      initial_month_index: m,
      day_entries: buildTeamCalendarDemo(y, m),
      selected_iso_date: dim >= 8 ? ymd(y, m, 8) : null,
    },
  };
}

export function emptyLiderDashboardPayload(now: Date = new Date()): LiderDashboardPayload {
  const y = now.getFullYear();
  const mo = now.getMonth();
  return {
    personal: {
      vacation_available_days: null,
      vacation_used_days: null,
      home_office_this_month: null,
      pending_requests: null,
      pending_request_types: [],
    },
    team: {
      team_active_incidents: null,
      team_pending_vacation_requests: null,
      team_pending_home_office_requests: null,
      team_collaborators_count: null,
    },
    approval_requests: [],
    team_calendar: {
      initial_year: y,
      initial_month_index: mo,
      day_entries: {},
      selected_iso_date: null,
    },
  };
}
