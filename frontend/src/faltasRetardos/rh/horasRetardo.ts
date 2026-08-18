/**
 * Presentación de las horas de un retardo (hora programada, entrada y minutos).
 *
 * El backend las envía como "HH:MM" tal como las guarda TRESS, que usa horas >= 24 para
 * decir «al día siguiente»: un turno que entra a las 18:00 y checa a la 01:00 llega como
 * "25:00". Aquí es donde esa convención se traduce a algo legible; conservarla hasta este
 * punto es lo que permite que el backend reste minutos sin casos especiales.
 */

const SIN_DATO = "—";

function partes(hora: string | null | undefined): { h: number; m: number } | null {
  const limpia = (hora ?? "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(limpia)) return null;
  const [h, m] = limpia.split(":").map(Number);
  if (m > 59) return null;
  return { h, m };
}

export function formatHoraRetardo(hora: string | null | undefined): string {
  const p = partes(hora);
  if (!p) return SIN_DATO;
  const dd = (n: number) => String(n).padStart(2, "0");
  if (p.h < 24) return `${dd(p.h)}:${dd(p.m)}`;
  return `${dd(p.h - 24)}:${dd(p.m)} (+1 d)`;
}

export function formatMinutosRetardo(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return SIN_DATO;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/** Celda «Entrada» de la tabla: "06:27 (+27)". Sin hora, un guion. */
export function formatEntradaCelda(row: {
  hora_entrada: string | null | undefined;
  minutos_retardo: number | null | undefined;
}): string {
  const hora = formatHoraRetardo(row.hora_entrada);
  if (hora === SIN_DATO) return SIN_DATO;
  const { minutos_retardo: min } = row;
  if (min === null || min === undefined || !Number.isFinite(min)) return hora;
  return `${hora} (+${min})`;
}
