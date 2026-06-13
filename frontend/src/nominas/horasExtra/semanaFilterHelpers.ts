import { lunesDeSemanaIso } from "../../horasExtra/supervisor/renderHorasExtraSolicitudPage.ts";

function formatIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map((v) => Number.parseInt(v, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isoWeekNumber(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Lunes ISO (YYYY-MM-DD) para el número de semana en el año de referencia. */
export function semanaInicioDesdeNumero(semana: number, anioReferencia?: number): string {
  const anio = anioReferencia ?? new Date().getFullYear();
  return formatIsoLocal(lunesDeSemanaIso(anio, semana));
}

export function semanaNumeroFromInicio(isoLunes: string): number {
  return isoWeekNumber(parseIsoLocal(isoLunes));
}

export function semanaLabelFromInicio(isoLunes: string): string {
  return `Semana ${semanaNumeroFromInicio(isoLunes)}`;
}

/** Avanza o retrocede una semana desde un lunes ISO. */
export function stepSemanaInicio(isoLunes: string, deltaSemanas: number): string {
  const date = parseIsoLocal(isoLunes);
  date.setDate(date.getDate() + deltaSemanas * 7);
  return formatIsoLocal(date);
}
