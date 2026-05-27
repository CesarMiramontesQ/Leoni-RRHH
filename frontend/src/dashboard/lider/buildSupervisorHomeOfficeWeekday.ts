import { rhIsoLocalDate } from "../rh/calendarMonthGrid.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import type { SupervisorHomeOfficeWeekdayChartData, SupervisorHomeOfficeWeekdaySlot } from "./types.ts";

const WEEKDAY_SLOTS: readonly { weekday: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { weekday: 1, label: "Lunes" },
  { weekday: 2, label: "Martes" },
  { weekday: 3, label: "Miércoles" },
  { weekday: 4, label: "Jueves" },
  { weekday: 5, label: "Viernes" },
];

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

/** 1 = lunes … 5 = viernes; null si sábado o domingo. */
function isoWeekdayLaboral(iso: string): 1 | 2 | 3 | 4 | 5 | null {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  if (day < 1 || day > 5) return null;
  return day as 1 | 2 | 3 | 4 | 5;
}

/**
 * Cuenta días laborales (lun–vie) con home office aprobado en solicitudes del equipo del supervisor.
 * `rows` debe ser solo colaboradores bajo su mando (sin el propio supervisor), estado aprobado.
 */
export function buildSupervisorHomeOfficeWeekdayChart(
  rows: readonly RhSolicitudTablaFila[],
): SupervisorHomeOfficeWeekdayChartData {
  const counts = new Map<1 | 2 | 3 | 4 | 5, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
  ]);

  let solicitudesHo = 0;

  for (const row of rows) {
    if (row.tipo !== "home_office") continue;
    solicitudesHo += 1;
    for (const iso of eachIsoDayInclusive(row.fecha_inicio, row.fecha_fin)) {
      const wd = isoWeekdayLaboral(iso);
      if (wd == null) continue;
      counts.set(wd, (counts.get(wd) ?? 0) + 1);
    }
  }

  const days: SupervisorHomeOfficeWeekdaySlot[] = WEEKDAY_SLOTS.map((slot) => ({
    weekday: slot.weekday,
    label: slot.label,
    count: counts.get(slot.weekday) ?? 0,
  }));

  const totalDiasHo = days.reduce((sum, d) => sum + d.count, 0);

  let diaMasSolicitado: string | null = null;
  let peakCount = 0;
  for (const d of days) {
    if (d.count > peakCount) {
      peakCount = d.count;
      diaMasSolicitado = d.label;
    }
  }
  if (peakCount === 0) diaMasSolicitado = null;

  const concentracionPct =
    totalDiasHo > 0 && peakCount > 0 ? Math.round((peakCount / totalDiasHo) * 100) : null;

  return {
    days,
    total_dias_ho: totalDiasHo,
    solicitudes_ho: solicitudesHo,
    dia_mas_solicitado: diaMasSolicitado,
    concentracion_dia_principal_pct: concentracionPct,
  };
}
