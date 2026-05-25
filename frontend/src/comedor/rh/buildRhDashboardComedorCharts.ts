import type { ComedorResumenDiarioApiItem, ComedorRhSemanaRegistrosFuturosApiItem } from "../../api/comedor.ts";

export type RhDashComedorAsistenciaDia = {
  fecha: string;
  label: string;
  pct: number;
};

export type RhDashComedorSemanaFutura = {
  semanaInicio: string;
  label: string;
  total: number;
};

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map((p) => Number.parseInt(p, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatIsoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value);
  out.setDate(out.getDate() + days);
  return out;
}

function etiquetaFechaCorta(iso: string): string {
  const d = parseIsoLocal(iso);
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(d)
    .replace(".", "");
}

function etiquetaSemanaRango(inicioIso: string): string {
  const inicio = parseIsoLocal(inicioIso);
  const fin = addDays(inicio, 6);
  const a = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(inicio)
    .replace(".", "");
  const b = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" })
    .format(fin)
    .replace(".", "");
  return `${a} – ${b}`;
}

/** Serie de % asistencia (accedidos / registros) por día en el periodo, hasta hoy inclusive. */
export function buildAsistenciaDiariaSerie(
  resumen: readonly ComedorResumenDiarioApiItem[],
  fechaInicio: string,
  fechaFin: string,
  hoyIso: string,
): RhDashComedorAsistenciaDia[] {
  const porFecha = new Map(
    resumen.map((r) => {
      const registros =
        Number.isFinite(r.registros) && r.registros > 0
          ? r.registros
          : Math.max(0, r.caseras) + Math.max(0, r.saludables);
      const asistencias = Math.max(0, r.asistencias ?? 0);
      const pct =
        registros > 0 ? Math.min(100, Math.round((asistencias / registros) * 100)) : 0;
      return [r.fecha, { registros, asistencias, pct }] as const;
    }),
  );

  const finEfectivo = fechaFin <= hoyIso ? fechaFin : hoyIso;
  if (fechaInicio > finEfectivo) return [];

  const out: RhDashComedorAsistenciaDia[] = [];
  let cursor = parseIsoLocal(fechaInicio);
  const end = parseIsoLocal(finEfectivo);
  while (cursor <= end) {
    const iso = formatIsoLocal(cursor);
    const cell = porFecha.get(iso);
    out.push({
      fecha: iso,
      label: etiquetaFechaCorta(iso),
      pct: cell?.pct ?? 0,
    });
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function asistenciaDiariaTieneDatos(
  serie: readonly RhDashComedorAsistenciaDia[] | null | undefined,
): boolean {
  return (serie?.length ?? 0) > 0;
}

/** Mapea respuesta API a puntos de gráfica (orden ascendente por semana). */
export function mapRegistrosFuturosPorSemana(
  items: readonly ComedorRhSemanaRegistrosFuturosApiItem[],
): RhDashComedorSemanaFutura[] {
  return [...items]
    .sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio))
    .map((row) => ({
      semanaInicio: row.semana_inicio,
      label: etiquetaSemanaRango(row.semana_inicio),
      total: Math.max(0, row.total),
    }));
}

export function registrosFuturosTieneDatos(
  semanas: readonly RhDashComedorSemanaFutura[] | null | undefined,
): boolean {
  return (semanas?.length ?? 0) > 0 && semanas.some((s) => s.total > 0);
}
