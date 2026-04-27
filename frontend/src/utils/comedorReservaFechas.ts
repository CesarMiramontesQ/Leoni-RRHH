/**
 * Alineado con `primer_lunes_reserva_comedor_permitido` en backend (semana calendario lunes–domingo).
 */
export function primerLunesReservaComedorPermitido(ref: Date = new Date()): Date {
  const hoy = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const weekday = (hoy.getDay() + 6) % 7;
  const lunesActual = new Date(hoy);
  lunesActual.setDate(hoy.getDate() - weekday);
  const permitido = new Date(lunesActual);
  permitido.setDate(lunesActual.getDate() + 7);
  return permitido;
}

export function primerLunesReservaComedorPermitidoIso(ref: Date = new Date()): string {
  const d = primerLunesReservaComedorPermitido(ref);
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma años a una fecha ISO (zona local, mediodía para evitar solapes DST). */
export function addYearsToIsoString(isoYmd: string, years: number): string {
  const [y, m, d] = isoYmd.split("-").map((x) => Number.parseInt(x, 10));
  const t = new Date(y, m - 1, d, 12, 0, 0, 0);
  t.setFullYear(t.getFullYear() + years);
  const yy = String(t.getFullYear()).padStart(4, "0");
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function etiquetaTipoComida(tipo: string): string {
  const map: Record<string, string> = {
    casera: "Casera",
    saludable: "Saludable",
  };
  return map[tipo] ?? tipo;
}
