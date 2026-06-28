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

/** Suma días calendario a una fecha ISO `YYYY-MM-DD`. Cadena vacía si la entrada es inválida. */
export function sumarDiasIso(fechaIso: string, dias: number): string {
  const dt = parseLocalDate(fechaIso);
  if (!dt || !Number.isFinite(dias)) return "";
  dt.setDate(dt.getDate() + dias);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const MATRIMONIO_DIAS_FIJOS = 2;
export const DEFUNCION_DIAS_FIJOS = 3;

function dateToIso(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Suma N días hábiles (lun–vie) inclusive desde fechaIso. */
export function sumarDiasHabilesInclusive(fechaIso: string, diasHabiles: number): string {
  const start = parseLocalDate(fechaIso);
  if (!start || diasHabiles < 1) return "";
  let cursor = new Date(start.getTime());
  let acum = 1;
  while (acum < diasHabiles) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) acum += 1;
  }
  return dateToIso(cursor);
}

export function calcularRangoDefuncion(
  fechaReferencia: string,
  administrativo: boolean,
): { fechaInicio: string; fechaFin: string } | null {
  if (!fechaReferencia.trim()) return null;
  if (!administrativo) {
    const fin = sumarDiasIso(fechaReferencia, DEFUNCION_DIAS_FIJOS - 1);
    return fin ? { fechaInicio: fechaReferencia, fechaFin: fin } : null;
  }
  const finCal = sumarDiasIso(fechaReferencia, DEFUNCION_DIAS_FIJOS - 1);
  if (
    finCal &&
    !rangoIncluyeFinDeSemana(fechaReferencia, finCal) &&
    calcularDiasLaboralesInclusive(fechaReferencia, finCal) === DEFUNCION_DIAS_FIJOS
  ) {
    return { fechaInicio: fechaReferencia, fechaFin: finCal };
  }
  const anchor = parseLocalDate(fechaReferencia);
  if (!anchor) return null;
  let cursor = new Date(anchor.getTime());
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const inicioIso = dateToIso(cursor);
  const finIso = sumarDiasHabilesInclusive(inicioIso, DEFUNCION_DIAS_FIJOS);
  if (!finIso) return null;
  return { fechaInicio: inicioIso, fechaFin: finIso };
}

export function esRangoDefuncionValido(
  fechaInicio: string,
  fechaFin: string,
  administrativo: boolean,
): boolean {
  const esperado = calcularRangoDefuncion(fechaInicio, administrativo);
  if (!esperado) return false;
  return esperado.fechaInicio === fechaInicio && esperado.fechaFin === fechaFin;
}

export function esRangoMatrimonioValido(fechaInicio: string, fechaFin: string): boolean {
  if (!fechasOrdenValidas(fechaInicio, fechaFin)) return false;
  return calcularDiasSolicitadosInclusive(fechaInicio, fechaFin) === MATRIMONIO_DIAS_FIJOS;
}

export const MENSAJE_MATRIMONIO_DOS_DIAS =
  "Matrimonio solo permite solicitar exactamente 2 días consecutivos (fecha fin = día siguiente al inicio).";

export const MENSAJE_DEFUNCION_TRES_DIAS =
  "Defunción solo permite solicitar exactamente 3 días. Para administrativos son 3 días hábiles; si el rango cruza fin de semana, se ajustan los días hábiles más cercanos.";

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
