import type {
  ComedorCalendarDay,
  ComedorCalendarDayTag,
  ComedorCalendarMonth,
  ComedorCreateRequestPayload,
  ComedorKpi,
  ComedorMenuOption,
  ComedorReservationsPage,
  ComedorReservationsQuery,
  ComedorReservationRow,
  ComedorSidebarDataset,
} from "./types.ts";

const KPIS: readonly ComedorKpi[] = [
  {
    id: "reservas_hoy",
    titulo: "Reservas de hoy",
    valor: "342",
    descripcion: "9% vs promedio semanal",
    tendencia: "+12%",
    accentClass: "border-t-leoni-blue",
    progressPercent: 78,
  },
  {
    id: "capacidad_total",
    titulo: "Capacidad total",
    valor: "400",
    descripcion: "Capacidad diaria disponible",
    accentClass: "border-t-sky-500",
    progressPercent: 100,
  },
  {
    id: "ocupacion_actual",
    titulo: "Ocupación actual",
    valor: "85%",
    descripcion: "340 de 400 lugares",
    accentClass: "border-t-emerald-500",
    progressPercent: 85,
  },
  {
    id: "dietas_especiales",
    titulo: "Dietas especiales",
    valor: "62",
    descripcion: "Vegana, keto y sin gluten",
    accentClass: "border-t-violet-500",
    progressPercent: 36,
  },
];

const TEAM_KPIS: readonly ComedorKpi[] = [
  {
    id: "reservas_hoy",
    titulo: "Reservas de hoy",
    valor: "27",
    descripcion: "Equipo + líder con reserva activa",
    tendencia: "+6%",
    accentClass: "border-t-leoni-blue",
    progressPercent: 68,
  },
  {
    id: "ocupacion_actual",
    titulo: "% de uso de comedor",
    valor: "74%",
    descripcion: "Uso acumulado del comedor para tu equipo",
    accentClass: "border-t-emerald-500",
    progressPercent: 74,
  },
];

const SIDEBAR_DATASET: ComedorSidebarDataset = {
  alerts: [
    {
      id: "a1",
      titulo: "Capacidad excedida",
      detalle: "Turno 2 supera en 15 reservas la capacidad.",
      level: "critica",
    },
    {
      id: "a2",
      titulo: "Baja asistencia",
      detalle: "Línea C reporta 22% de ausencias.",
      level: "media",
    },
    {
      id: "a3",
      titulo: "Insumo crítico",
      detalle: "Proteína vegetal con stock para 1 día.",
      level: "info",
    },
  ],
  weeklyOccupancy: [
    { label: "Semana 1", percent: 72 },
    { label: "Semana 2", percent: 81 },
    { label: "Semana 3", percent: 77 },
    { label: "Semana 4", percent: 85 },
  ],
  dietDistribution: {
    saludablePercent: 75,
    regularPercent: 25,
  },
  suggestion: {
    titulo: "Sugerencia IA",
    mensaje:
      "Con base en histórico y tendencias, adelantar el turno 2 quince minutos reduce filas y mejora cobertura.",
    ctaLabel: "Optimizar flujo",
  },
  externalCodesCard: {
    titulo: "Códigos externos",
    mensaje: "Consulta y rastrea credenciales temporales de personal externo.",
    ctaLabel: "Listado de códigos externos",
    ctaRoute: "#/comedor/codigos-externos",
  },
};

const RESERVATIONS: readonly ComedorReservationRow[] = [
  {
    id: 1,
    empleadoNombre: "Carlos Ruiz",
    empleadoNumero: "L4029",
    area: "Producción A",
    turno: "2",
    dieta: "normal",
    status: "confirmado",
    horaReserva: "08:45 AM",
    avatarUrl: null,
  },
  {
    id: 2,
    empleadoNombre: "Elena Soto",
    empleadoNumero: "L8831",
    area: "Logística",
    turno: "1",
    dieta: "dieta",
    status: "confirmado",
    horaReserva: "08:12 AM",
    avatarUrl: null,
  },
  {
    id: 3,
    empleadoNombre: "Marcos Luna",
    empleadoNumero: "L3320",
    area: "Calidad",
    turno: "2",
    dieta: "normal",
    status: "cancelado",
    horaReserva: "07:30 AM",
    avatarUrl: null,
  },
  {
    id: 4,
    empleadoNombre: "Sandra Bello",
    empleadoNumero: "L5512",
    area: "Mantenimiento",
    turno: "3",
    dieta: "normal",
    status: "pendiente",
    horaReserva: "N/A",
    avatarUrl: null,
  },
  {
    id: 5,
    empleadoNombre: "Miguel Cárdenas",
    empleadoNumero: "L2284",
    area: "Producción B",
    turno: "1",
    dieta: "dieta",
    status: "confirmado",
    horaReserva: "06:58 AM",
    avatarUrl: null,
  },
  {
    id: 6,
    empleadoNombre: "Rosa Vela",
    empleadoNumero: "L1002",
    area: "Empaque",
    turno: "3",
    dieta: "normal",
    status: "confirmado",
    horaReserva: "11:05 AM",
    avatarUrl: null,
  },
  {
    id: 7,
    empleadoNombre: "Jorge Nieto",
    empleadoNumero: "L7641",
    area: "Calidad",
    turno: "2",
    dieta: "normal",
    status: "cancelado",
    horaReserva: "09:10 AM",
    avatarUrl: null,
  },
  {
    id: 8,
    empleadoNombre: "Pamela Cruz",
    empleadoNumero: "L8910",
    area: "Compras",
    turno: "1",
    dieta: "dieta",
    status: "confirmado",
    horaReserva: "07:22 AM",
    avatarUrl: null,
  },
  {
    id: 9,
    empleadoNombre: "Diego Lira",
    empleadoNumero: "L1901",
    area: "Mantenimiento",
    turno: "2",
    dieta: "normal",
    status: "pendiente",
    horaReserva: "N/A",
    avatarUrl: null,
  },
  {
    id: 10,
    empleadoNombre: "Ana Del Río",
    empleadoNumero: "L5008",
    area: "Logística",
    turno: "3",
    dieta: "normal",
    status: "confirmado",
    horaReserva: "10:01 AM",
    avatarUrl: null,
  },
  {
    id: 11,
    empleadoNombre: "Nora Treviño",
    empleadoNumero: "L9070",
    area: "Producción A",
    turno: "1",
    dieta: "dieta",
    status: "confirmado",
    horaReserva: "08:03 AM",
    avatarUrl: null,
  },
  {
    id: 12,
    empleadoNombre: "Rubén Salas",
    empleadoNumero: "L4421",
    area: "Calidad",
    turno: "2",
    dieta: "normal",
    status: "cancelado",
    horaReserva: "07:51 AM",
    avatarUrl: null,
  },
];

const MENU_OPTIONS: readonly ComedorMenuOption[] = [
  { id: "normal", label: "Normal" },
  { id: "saludable", label: "Saludable" },
];

/**
 * Mock de alcance para líder (supervisor/gerente): propio + equipo.
 * En API real este recorte lo debe resolver backend con permisos.
 */
const TEAM_SCOPE_EMPLOYEE_NUMBERS: ReadonlySet<string> = new Set([
  "L4029",
  "L8831",
  "L3320",
  "L5512",
  "L2284",
  "L1002",
  "L9070",
]);

function isoLocalDate(year: number, monthIndex: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(monthIndex + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function tagForLoad(load: number, day: number): ComedorCalendarDayTag[] {
  const tags: ComedorCalendarDayTag[] = [];
  if (load >= 88) tags.push({ id: `crit-${day}`, label: `${load}%`, tone: "critico" });
  else tags.push({ id: `norm-${day}`, label: `${load}%`, tone: "normal" });
  if (day % 4 === 0) tags.push({ id: `diet-${day}`, label: "Dieta", tone: "dieta" });
  return tags;
}

function buildCalendarDay(year: number, monthIndex: number, day: number): ComedorCalendarDay {
  const load = 58 + ((day * 11 + monthIndex * 7) % 39);
  return {
    isoDate: isoLocalDate(year, monthIndex, day),
    reservas: 110 + ((day * 17 + monthIndex * 9) % 170),
    tags: tagForLoad(load, day),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export async function fetchComedorKpisMock(): Promise<readonly ComedorKpi[]> {
  await delay(160);
  return KPIS;
}

export async function fetchComedorTeamKpisMock(): Promise<readonly ComedorKpi[]> {
  await delay(160);
  return TEAM_KPIS;
}

export async function fetchComedorMenuOptionsMock(): Promise<readonly ComedorMenuOption[]> {
  await delay(140);
  return MENU_OPTIONS;
}

export async function fetchComedorSidebarMock(): Promise<ComedorSidebarDataset> {
  await delay(120);
  return SIDEBAR_DATASET;
}

export async function fetchComedorCalendarMonthMock(
  year: number,
  monthIndex: number,
): Promise<ComedorCalendarMonth> {
  await delay(150);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const dayMetrics: Record<string, ComedorCalendarDay> = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const entry = buildCalendarDay(year, monthIndex, day);
    dayMetrics[entry.isoDate] = entry;
  }

  return {
    year,
    monthIndex,
    legend: [
      { id: "normal", label: "Normal", dotClass: "bg-leoni-blue" },
      { id: "dieta", label: "Dieta", dotClass: "bg-emerald-500" },
      { id: "critico", label: "Crítico", dotClass: "bg-red-500" },
    ],
    dayMetrics,
  };
}

export async function fetchComedorReservationsMock(
  query: ComedorReservationsQuery,
): Promise<ComedorReservationsPage> {
  await delay(180);
  const search = normalizeSearchText(query.search);
  const filtered = RESERVATIONS.filter((row) => {
    if (query.statusFilter === "todos") return true;
    return row.status === query.statusFilter;
  }).filter((row) => {
    if (!search) return true;
    const haystack = normalizeSearchText(`${row.empleadoNombre} ${row.empleadoNumero}`);
    return haystack.includes(search);
  });

  const total = filtered.length;
  const page = Math.max(1, query.page);
  const pageSize = Math.max(1, query.pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export async function fetchComedorTeamReservationsMock(
  query: ComedorReservationsQuery,
): Promise<ComedorReservationsPage> {
  await delay(180);
  const search = normalizeSearchText(query.search);
  const filtered = RESERVATIONS.filter((row) => TEAM_SCOPE_EMPLOYEE_NUMBERS.has(row.empleadoNumero))
    .filter((row) => {
      if (query.statusFilter === "todos") return true;
      return row.status === query.statusFilter;
    })
    .filter((row) => {
      if (!search) return true;
      const haystack = normalizeSearchText(`${row.empleadoNombre} ${row.empleadoNumero}`);
      return haystack.includes(search);
    });

  const total = filtered.length;
  const page = Math.max(1, query.page);
  const pageSize = Math.max(1, query.pageSize);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export async function createComedorRequestMock(
  _payload: ComedorCreateRequestPayload,
): Promise<{ id: string }> {
  await delay(420);
  return { id: `comedor-${Date.now()}` };
}
