import { getSemanasPermitidas, lunesDeSemanaIso } from "../../horasExtra/supervisor/renderHorasExtraSolicitudPage.ts";

function formatIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Resuelve el lunes ISO (YYYY-MM-DD) para un número de semana cercano a la semana actual. */
export function semanaInicioIsoFromNumero(semana: string, semanaActual: number): string | undefined {
  const n = Number.parseInt(semana, 10);
  if (Number.isNaN(n) || n < 1 || n > 53) return undefined;

  const hoy = new Date();
  let anio = hoy.getFullYear();
  if (Math.abs(n - semanaActual) > 26) {
    anio = n > semanaActual ? anio - 1 : anio + 1;
  }

  return formatIsoLocal(lunesDeSemanaIso(anio, n));
}

export function semanasPermitidasParaFiltro(semanaActual: number): readonly number[] {
  return getSemanasPermitidas(semanaActual);
}
