/**
 * Cálculo de días para el modal de nueva solicitud RH.
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

/** True si el rango inclusive incluye sábado o domingo. */
export function rangoIncluyeFinDeSemana(fechaInicio: string, fechaFin: string): boolean {
  const a = parseLocalDate(fechaInicio);
  const b = parseLocalDate(fechaFin);
  if (!a || !b || b.getTime() < a.getTime()) return false;
  const cur = new Date(a.getTime());
  while (cur.getTime() <= b.getTime()) {
    const dow = cur.getDay();
    if (dow === 0 || dow === 6) return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

/** Lunes–viernes inclusivos en el rango. 0 si el orden es inválido. */
export function calcularDiasLaboralesInclusive(fechaInicio: string, fechaFin: string): number {
  const a = parseLocalDate(fechaInicio);
  const b = parseLocalDate(fechaFin);
  if (!a || !b || b.getTime() < a.getTime()) return 0;
  let total = 0;
  const cur = new Date(a.getTime());
  while (cur.getTime() <= b.getTime()) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5) total += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}

/** Días de vacaciones según clasificación del colaborador. */
export function calcularDiasVacacionesSolicitados(
  fechaInicio: string,
  fechaFin: string,
  administrativo: boolean,
): number {
  if (!fechasOrdenValidas(fechaInicio, fechaFin)) return 0;
  if (administrativo) {
    if (rangoIncluyeFinDeSemana(fechaInicio, fechaFin)) return 0;
    return calcularDiasLaboralesInclusive(fechaInicio, fechaFin);
  }
  return calcularDiasSolicitadosInclusive(fechaInicio, fechaFin);
}

export const MENSAJE_VACACIONES_ADMIN_FIN_DE_SEMANA =
  "Los colaboradores administrativos solo pueden solicitar vacaciones de lunes a viernes.";

export const MENSAJE_PERMISO_SIN_GOCE_ADMIN_FIN_DE_SEMANA =
  "Los colaboradores administrativos solo pueden solicitar permiso sin goce de sueldo de lunes a viernes.";

export const MENSAJE_HOME_OFFICE_FIN_DE_SEMANA =
  "Home Office solo puede solicitarse en días entre semana (lunes a viernes).";

export const MENSAJE_HOME_OFFICE_SOLO_ADMINISTRATIVO =
  "Home Office solo está disponible para colaboradores con clasificación Administrativo.";

export const MENSAJE_HOME_OFFICE_UN_DIA =
  "Home Office solo permite solicitar un día (fecha inicio y fin iguales).";

export const MENSAJE_HOME_OFFICE_MES_LIMITE =
  "Ya existe una solicitud de Home Office activa en el mes seleccionado. Solo se permite un día por mes.";

export const HOME_OFFICE_RESUMEN_BASE =
  "Home Office: un solo día por solicitud y máximo uno por mes calendario. Solo colaboradores administrativos, entre semana (lunes a viernes).";
