/**
 * Cálculo de días para el modal de nueva solicitud RH.
 * Punto de extensión: sustituir por días hábiles / reglas de negocio cuando existan en API.
 */

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

/** Días naturales inclusivos entre fechas ISO `YYYY-MM-DD`. 0 si faltan datos o el orden es inválido. */
export function calcularDiasSolicitadosInclusive(fechaInicio: string, fechaFin: string): number {
  const a = parseLocalDate(fechaInicio);
  const b = parseLocalDate(fechaFin);
  if (!a || !b) return 0;
  if (b.getTime() < a.getTime()) return 0;
  const diffMs = b.getTime() - a.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}

export function fechasOrdenValidas(fechaInicio: string, fechaFin: string): boolean {
  const a = parseLocalDate(fechaInicio);
  const b = parseLocalDate(fechaFin);
  if (!a || !b) return false;
  return b.getTime() >= a.getTime();
}
