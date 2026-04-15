import type {
  ReporteComedorEmpleadoRow,
  ReporteComedorFiltersDataset,
  ReporteComedorFiltersQuery,
  ReporteComedorKpi,
  ReporteComedorTableResponse,
} from "./types.ts";

const FILTERS_DATASET: ReporteComedorFiltersDataset = {
  departamentos: [
    { id: "todos", label: "Todos los departamentos" },
    { id: "produccion", label: "Producción" },
    { id: "calidad", label: "Calidad" },
    { id: "logistica", label: "Logística" },
    { id: "mantenimiento", label: "Mantenimiento" },
  ],
  turnos: [
    { id: "todos", label: "Todos los turnos" },
    { id: "manana", label: "Mañana" },
    { id: "tarde", label: "Tarde" },
    { id: "noche", label: "Noche" },
  ],
  fechaInicioIso: "2023-10-01",
  fechaFinIso: "2023-10-31",
};

const EMPLEADOS: readonly ReporteComedorEmpleadoRow[] = [
  {
    id: "emp-8842",
    nombre: "Mateo Rodríguez",
    noEmpleado: "LE-8842",
    area: "Producción",
    departamentoId: "produccion",
    turnoId: "manana",
    avatarUrl: null,
    diasMes: "22/24",
    menu: "normal",
    activo: true,
    ultimaAsistencia: "Hoy, 12:42 PM",
    asistenciaSemanal: [52, 89, 72, 90, 95, 0, 0],
    preferenciaDietaPercent: 31,
    comentarios: [
      {
        id: "c-1",
        titulo: "Alergia: Mariscos",
        detalle: "Requiere sustitución por proteína vegetal.",
        tono: "alerta",
      },
      {
        id: "c-2",
        titulo: "Nota de nutrición",
        detalle: "Plan con control de carbohidratos refinados.",
        tono: "nota",
      },
    ],
  },
  {
    id: "emp-1920",
    nombre: "Sofía Villalobos",
    noEmpleado: "LE-1920",
    area: "Calidad",
    departamentoId: "calidad",
    turnoId: "manana",
    avatarUrl: null,
    diasMes: "18/24",
    menu: "dieta",
    activo: true,
    ultimaAsistencia: "Hoy, 12:45 PM",
    asistenciaSemanal: [43, 82, 68, 88, 92, 0, 0],
    preferenciaDietaPercent: 75,
    comentarios: [
      {
        id: "c-3",
        titulo: "Alergia: Frutos secos",
        detalle: "Evitar trazas y aderezos con nueces.",
        tono: "alerta",
      },
      {
        id: "c-4",
        titulo: "Nota de nutrición",
        detalle: "Aumentar proteína magra en comida principal.",
        tono: "nota",
      },
    ],
  },
  {
    id: "emp-7751",
    nombre: "Andrés Duarte",
    noEmpleado: "LE-7751",
    area: "Logística",
    departamentoId: "logistica",
    turnoId: "tarde",
    avatarUrl: null,
    diasMes: "20/24",
    menu: "normal",
    activo: true,
    ultimaAsistencia: "Ayer, 09:11 PM",
    asistenciaSemanal: [69, 74, 71, 80, 77, 0, 0],
    preferenciaDietaPercent: 22,
    comentarios: [
      {
        id: "c-5",
        titulo: "Alergia: Ninguna registrada",
        detalle: "Sin restricciones alimenticias activas.",
        tono: "nota",
      },
    ],
  },
  {
    id: "emp-8224",
    nombre: "Elena Solís",
    noEmpleado: "LE-8224",
    area: "Producción",
    departamentoId: "produccion",
    turnoId: "noche",
    avatarUrl: null,
    diasMes: "23/24",
    menu: "dieta",
    activo: false,
    ultimaAsistencia: "Lunes, 11:13 PM",
    asistenciaSemanal: [70, 68, 0, 0, 0, 0, 0],
    preferenciaDietaPercent: 61,
    comentarios: [
      {
        id: "c-6",
        titulo: "Seguimiento RH",
        detalle: "Ausencia por incapacidad con retorno planificado.",
        tono: "alerta",
      },
    ],
  },
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function toCurrencyMx(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

function firstThreeDayLabelsByConsumption(filtered: readonly ReporteComedorEmpleadoRow[]): string {
  if (filtered.length === 0) return "Sin datos";
  const totals = [0, 0, 0, 0, 0, 0, 0];
  for (const row of filtered) {
    row.asistenciaSemanal.forEach((value, index) => {
      totals[index] = (totals[index] ?? 0) + value;
    });
  }
  const topIndexes = totals
    .map((total, index) => ({ total, index }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 2)
    .map((entry) => entry.index);
  const labels = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  return topIndexes.map((index) => labels[index]).join(" / ");
}

function applyFilters(query: ReporteComedorFiltersQuery): readonly ReporteComedorEmpleadoRow[] {
  return EMPLEADOS.filter((row) => {
    if (query.departamentoId !== "todos" && row.departamentoId !== query.departamentoId) return false;
    if (query.turnoId !== "todos" && row.turnoId !== query.turnoId) return false;
    return true;
  });
}

export async function fetchReporteComedorFiltersMock(): Promise<ReporteComedorFiltersDataset> {
  await delay(120);
  return FILTERS_DATASET;
}

export async function fetchReporteComedorKpisMock(
  query: ReporteComedorFiltersQuery,
): Promise<readonly ReporteComedorKpi[]> {
  await delay(180);
  const filtered = applyFilters(query);
  const promedioAsistencia =
    filtered.length === 0 ?
      0
    : Math.round(
        filtered.reduce((acc, current) => {
          const weeklyAverage =
            current.asistenciaSemanal.reduce((sum, day) => sum + day, 0) / current.asistenciaSemanal.length;
          return acc + weeklyAverage;
        }, 0) / filtered.length,
      );
  const costoEstimado = filtered.length * 3650;
  return [
    {
      id: "total_empleados",
      label: "Total empleados registrados",
      valor: String(filtered.length),
      secundario: "+2.4% vs mes anterior",
      icono: "empleados",
    },
    {
      id: "promedio_asistencia",
      label: "Promedio asistencia mensual",
      valor: `${promedioAsistencia}%`,
      secundario: "Meta: 90%",
      icono: "asistencia",
    },
    {
      id: "dias_mayor_consumo",
      label: "Días con mayor consumo",
      valor: firstThreeDayLabelsByConsumption(filtered),
      secundario: "Pico de demanda semanal",
      icono: "consumo",
    },
    {
      id: "costo_estimado",
      label: "Costo estimado mensual",
      valor: toCurrencyMx(costoEstimado),
      secundario: "Basado en reservas confirmadas",
      icono: "costo",
    },
  ];
}

export async function fetchReporteComedorEmpleadosMock(
  query: ReporteComedorFiltersQuery,
): Promise<ReporteComedorTableResponse> {
  await delay(220);
  return { empleados: applyFilters(query) };
}
