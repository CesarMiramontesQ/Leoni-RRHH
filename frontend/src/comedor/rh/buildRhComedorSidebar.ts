import type {
  ComedorEstadisticasApi,
  ComedorProyeccionesApi,
  ComedorResumenDiarioApiItem,
} from "../../api/comedor.ts";
import type { ComedorRhSemanaPlatilloPorSemana, ComedorSidebarDataset } from "./types.ts";

function dateToIso(value: Date): string {
  const y = String(value.getFullYear()).padStart(4, "0");
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map((part) => Number.parseInt(part, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value);
  out.setDate(out.getDate() + days);
  return out;
}

function mondayOf(value: Date): Date {
  const out = new Date(value);
  const weekday = (out.getDay() + 6) % 7;
  out.setDate(out.getDate() - weekday);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatWeekShortDate(value: Date): string {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(value)
    .replace(".", "");
}

/** Lunes de la semana actual (ISO local). */
export function getCurrentWeekStartIso(): string {
  return dateToIso(mondayOf(new Date()));
}

/** Rango ISO [desde, hasta] para las últimas N semanas terminando en el lunes de la semana actual. */
export function rhComedorResumenRangeForWeeks(weekCount: number): { desdeIso: string; hastaIso: string } {
  const weekStartIso = getCurrentWeekStartIso();
  const weekStart = isoToDate(weekStartIso);
  const desde = addDays(weekStart, -7 * Math.max(0, weekCount - 1));
  const hasta = addDays(weekStart, 6);
  return { desdeIso: dateToIso(desde), hastaIso: dateToIso(hasta) };
}

/** Agrupa filas diarias del resumen RH en las 4 semanas calendario que terminan en `currentWeekStartIso` (lunes). */
export function buildRhPlatillosPorSemana(
  items: readonly ComedorResumenDiarioApiItem[],
  currentWeekStartIso: string,
): readonly ComedorRhSemanaPlatilloPorSemana[] {
  const currentMonday = isoToDate(currentWeekStartIso);
  const weekStarts: Date[] = [0, 1, 2, 3].map((i) => addDays(currentMonday, -21 + i * 7));
  const bucket = new Map<string, { caseras: number; saludables: number }>();
  for (const ws of weekStarts) {
    bucket.set(dateToIso(ws), { caseras: 0, saludables: 0 });
  }
  for (const row of items) {
    const mondayIso = dateToIso(mondayOf(isoToDate(row.fecha)));
    const cell = bucket.get(mondayIso);
    if (!cell) continue;
    cell.caseras += Number.isFinite(row.caseras) ? Math.max(0, row.caseras) : 0;
    cell.saludables += Number.isFinite(row.saludables) ? Math.max(0, row.saludables) : 0;
  }
  return weekStarts.map((ws) => {
    const iso = dateToIso(ws);
    const c = bucket.get(iso)!;
    const end = addDays(ws, 6);
    const label = `${formatWeekShortDate(ws)}–${formatWeekShortDate(end)}`;
    return {
      weekStartIso: iso,
      label,
      caseras: c.caseras,
      saludables: c.saludables,
      total: c.caseras + c.saludables,
    };
  });
}

export function mapProyeccionesToSidebar(
  proyecciones: ComedorProyeccionesApi,
  estadisticas: ComedorEstadisticasApi,
): ComedorSidebarDataset {
  const weeklyOccupancy = Object.entries(proyecciones.ultimas_4_semanas)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4)
    .map(([_week, values], idx) => {
      const total = Math.max(1, values.normal + values.dieta);
      const percent = Math.round((values.dieta / total) * 100);
      return { label: `Semana ${idx + 1}`, percent };
    });

  const total = Math.max(1, estadisticas.total_registros);
  const saludablePercent = Math.round((estadisticas.dieta / total) * 100);
  const regularPercent = Math.max(0, 100 - saludablePercent);

  return {
    alerts: [],
    weeklyOccupancy,
    dietDistribution: { saludablePercent, regularPercent },
    externalCodesCard: {
      titulo: "Códigos externos",
      mensaje: "Consulta y rastrea credenciales temporales de personal externo.",
      ctaLabel: "Listado de códigos externos",
      ctaRoute: "#/comedor/codigos-externos",
    },
  };
}
