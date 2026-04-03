/**
 * Número de empleado para UI: sin decimales (truncado hacia cero).
 * Si no es un número finito, devuelve el string recortado sin alterar (p. ej. códigos alfanuméricos).
 */
export function formatNoEmpleadoDisplay(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  const n = Number(s);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return s;
}
