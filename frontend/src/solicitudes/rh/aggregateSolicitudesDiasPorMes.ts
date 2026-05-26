import { calcularDiasSolicitadosInclusive } from "./rhNewRequestDays.ts";
import { getCalendarMonthRange } from "./aggregateSolicitudesPersonasDia.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./types.ts";

export type SolicitudDiasMesCategoria = "vacaciones" | "home_office" | "con_goce" | "sin_goce";

export type SolicitudDiasPorMesBucket = Record<SolicitudDiasMesCategoria, number>;

export type SolicitudDiasPorMesSerie = {
  periodos: readonly string[];
  vacaciones: readonly number[];
  home_office: readonly number[];
  con_goce: readonly number[];
  sin_goce: readonly number[];
  totales: readonly number[];
};

const TIPOS_CON_GOCE = new Set<RhSolicitudTipoCodigo>([
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
]);

const ESTADOS_APROBADOS = new Set<RhSolicitudEstadoCodigo>(["approved", "overridden"]);

function parseLocalDate(iso: string): Date | null {
  const p = iso.trim().split("-");
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function isoFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyBucket(): SolicitudDiasPorMesBucket {
  return { vacaciones: 0, home_office: 0, con_goce: 0, sin_goce: 0 };
}

function categoriaDias(tipo: RhSolicitudTipoCodigo): SolicitudDiasMesCategoria | null {
  if (tipo === "vacaciones") return "vacaciones";
  if (tipo === "home_office") return "home_office";
  if (tipo === "permiso_sin_goce_sueldo") return "sin_goce";
  if (TIPOS_CON_GOCE.has(tipo)) return "con_goce";
  return null;
}

function rangoMes(periodo: string): { startIso: string; endIso: string } | null {
  const [y, m] = periodo.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return null;
  return getCalendarMonthRange(y, m - 1);
}

/**
 * Suma días naturales solicitados (aprobados) por mes calendario y categoría.
 * Los días de una solicitud se reparten al mes donde cae cada día del periodo.
 */
export function aggregateSolicitudesDiasPorMes(
  rows: readonly RhSolicitudTablaFila[],
  periodos: readonly string[],
): SolicitudDiasPorMesSerie {
  const porMes = new Map<string, SolicitudDiasPorMesBucket>();
  for (const periodo of periodos) {
    porMes.set(periodo, emptyBucket());
  }

  for (const row of rows) {
    if (!ESTADOS_APROBADOS.has(row.estado)) continue;
    const cat = categoriaDias(row.tipo);
    if (!cat) continue;

    const rowStart = parseLocalDate(row.fecha_inicio);
    const rowEnd = parseLocalDate(row.fecha_fin);
    if (!rowStart || !rowEnd || rowEnd.getTime() < rowStart.getTime()) continue;

    for (const periodo of periodos) {
      const mes = rangoMes(periodo);
      if (!mes) continue;
      const mesStart = parseLocalDate(mes.startIso);
      const mesEnd = parseLocalDate(mes.endIso);
      if (!mesStart || !mesEnd) continue;

      const clipStart = rowStart.getTime() < mesStart.getTime() ? mesStart : rowStart;
      const clipEnd = rowEnd.getTime() > mesEnd.getTime() ? mesEnd : rowEnd;
      if (clipEnd.getTime() < clipStart.getTime()) continue;

      const dias = calcularDiasSolicitadosInclusive(
        isoFromLocalDate(clipStart),
        isoFromLocalDate(clipEnd),
      );
      if (dias <= 0) continue;

      const bucket = porMes.get(periodo) ?? emptyBucket();
      bucket[cat] += dias;
      porMes.set(periodo, bucket);
    }
  }

  const vacaciones: number[] = [];
  const home_office: number[] = [];
  const con_goce: number[] = [];
  const sin_goce: number[] = [];
  const totales: number[] = [];

  for (const periodo of periodos) {
    const b = porMes.get(periodo) ?? emptyBucket();
    vacaciones.push(b.vacaciones);
    home_office.push(b.home_office);
    con_goce.push(b.con_goce);
    sin_goce.push(b.sin_goce);
    totales.push(b.vacaciones + b.home_office + b.con_goce + b.sin_goce);
  }

  return { periodos, vacaciones, home_office, con_goce, sin_goce, totales };
}

export function diasPorMesTieneDatos(serie: SolicitudDiasPorMesSerie): boolean {
  return serie.totales.some((n) => n > 0);
}
