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

/** Días de vacaciones según clasificación del colaborador, excluyendo descansos TRESS. */
export function calcularDiasVacacionesSolicitados(
  fechaInicio: string,
  fechaFin: string,
  administrativo: boolean,
  descansos: ReadonlySet<string> = new Set(),
): number {
  if (!fechasOrdenValidas(fechaInicio, fechaFin)) return 0;
  if (administrativo) {
    if (rangoIncluyeFinDeSemana(fechaInicio, fechaFin)) return 0;
  }
  const { fechasEfectivas } = resumirRangoSinDescansos(fechaInicio, fechaFin, descansos);
  if (administrativo) {
    return fechasEfectivas.filter((iso) => {
      const dt = parseLocalDate(iso);
      if (!dt) return false;
      const dow = dt.getDay();
      return dow >= 1 && dow <= 5;
    }).length;
  }
  return fechasEfectivas.length;
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

export type TramoFechaIso = { fechaInicio: string; fechaFin: string };
export type ResumenRangoSinDescansos = {
  fechasEfectivas: string[];
  fechasExcluidas: string[];
  tramos: TramoFechaIso[];
};

export function avanzarHastaReunirDias(
  fechaInicio: string,
  cantidad: number,
  descansos: ReadonlySet<string> = new Set(),
  soloLunesViernes = false,
): string[] {
  const start = parseLocalDate(fechaInicio);
  if (!start || cantidad < 1 || descansos.has(fechaInicio)) return [];
  const fechas: string[] = [];
  const cursor = new Date(start.getTime());
  let guard = 0;
  while (fechas.length < cantidad && guard <= 365) {
    const iso = dateToIso(cursor);
    const diaPermitido = !soloLunesViernes || (cursor.getDay() >= 1 && cursor.getDay() <= 5);
    if (diaPermitido && !descansos.has(iso)) fechas.push(iso);
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return fechas.length === cantidad ? fechas : [];
}

function partirTramoPorSemanas(tramo: TramoFechaIso): TramoFechaIso[] {
  const start = parseLocalDate(tramo.fechaInicio);
  const end = parseLocalDate(tramo.fechaFin);
  if (!start || !end) return [];
  const result: TramoFechaIso[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const sunday = new Date(cursor.getTime());
    const daysUntilSunday = (7 - sunday.getDay()) % 7;
    sunday.setDate(sunday.getDate() + daysUntilSunday);
    const chunkEnd = sunday < end ? sunday : end;
    result.push({ fechaInicio: dateToIso(cursor), fechaFin: dateToIso(chunkEnd) });
    cursor.setTime(chunkEnd.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export function resumirRangoSinDescansos(
  fechaInicio: string,
  fechaFin: string,
  descansos: ReadonlySet<string>,
): ResumenRangoSinDescansos {
  const start = parseLocalDate(fechaInicio);
  const end = parseLocalDate(fechaFin);
  if (!start || !end || end < start) {
    return { fechasEfectivas: [], fechasExcluidas: [], tramos: [] };
  }
  const fechasEfectivas: string[] = [];
  const fechasExcluidas: string[] = [];
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const iso = dateToIso(cursor);
    (descansos.has(iso) ? fechasExcluidas : fechasEfectivas).push(iso);
    cursor.setDate(cursor.getDate() + 1);
  }
  const consecutivos: TramoFechaIso[] = [];
  for (const iso of fechasEfectivas) {
    const last = consecutivos[consecutivos.length - 1];
    if (last && sumarDiasIso(last.fechaFin, 1) === iso) last.fechaFin = iso;
    else consecutivos.push({ fechaInicio: iso, fechaFin: iso });
  }
  return {
    fechasEfectivas,
    fechasExcluidas,
    tramos: consecutivos.flatMap(partirTramoPorSemanas),
  };
}

export function calcularRangoMatrimonio(
  fechaReferencia: string,
  descansos: ReadonlySet<string> = new Set(),
): { fechaInicio: string; fechaFin: string } | null {
  const fechas = avanzarHastaReunirDias(
    fechaReferencia,
    MATRIMONIO_DIAS_FIJOS,
    descansos,
  );
  return fechas.length === MATRIMONIO_DIAS_FIJOS
    ? { fechaInicio: fechas[0]!, fechaFin: fechas[fechas.length - 1]! }
    : null;
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
  descansos: ReadonlySet<string> = new Set(),
): { fechaInicio: string; fechaFin: string } | null {
  if (!fechaReferencia.trim()) return null;
  const anchor = parseLocalDate(fechaReferencia);
  if (!anchor || descansos.has(fechaReferencia)) return null;
  let cursor = new Date(anchor.getTime());
  while (administrativo && (cursor.getDay() === 0 || cursor.getDay() === 6)) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const inicioIso = dateToIso(cursor);
  const fechas = avanzarHastaReunirDias(
    inicioIso,
    DEFUNCION_DIAS_FIJOS,
    descansos,
    administrativo,
  );
  return fechas.length === DEFUNCION_DIAS_FIJOS
    ? { fechaInicio: fechas[0]!, fechaFin: fechas[fechas.length - 1]! }
    : null;
}

export function esRangoDefuncionValido(
  fechaInicio: string,
  fechaFin: string,
  administrativo: boolean,
  descansos: ReadonlySet<string> = new Set(),
): boolean {
  const esperado = calcularRangoDefuncion(fechaInicio, administrativo, descansos);
  if (!esperado) return false;
  return esperado.fechaInicio === fechaInicio && esperado.fechaFin === fechaFin;
}

export function esRangoMatrimonioValido(
  fechaInicio: string,
  fechaFin: string,
  descansos: ReadonlySet<string> = new Set(),
): boolean {
  const esperado = calcularRangoMatrimonio(fechaInicio, descansos);
  return esperado?.fechaInicio === fechaInicio && esperado.fechaFin === fechaFin;
}

export const MENSAJE_MATRIMONIO_DOS_DIAS =
  "Matrimonio solo permite solicitar exactamente 2 días consecutivos (fecha fin = día siguiente al inicio).";

export const MENSAJE_DEFUNCION_TRES_DIAS =
  "Defunción solo permite solicitar exactamente 3 días. Para administrativos son 3 días hábiles; si el rango cruza fin de semana, se ajustan los días hábiles más cercanos.";

export const PATERNIDAD_DIAS_HABILES = 7;

export function calcularRangoPaternidad(
  fechaReferencia: string,
  descansos: ReadonlySet<string> = new Set(),
): { fechaInicio: string; fechaFin: string } | null {
  if (!fechaReferencia.trim()) return null;
  const anchor = parseLocalDate(fechaReferencia);
  if (!anchor || descansos.has(fechaReferencia)) return null;
  let cursor = new Date(anchor.getTime());
  while (cursor.getDay() === 0 || cursor.getDay() === 6) {
    cursor.setDate(cursor.getDate() + 1);
  }
  const inicioIso = dateToIso(cursor);
  const fechas = avanzarHastaReunirDias(
    inicioIso,
    PATERNIDAD_DIAS_HABILES,
    descansos,
    true,
  );
  return fechas.length === PATERNIDAD_DIAS_HABILES
    ? { fechaInicio: fechas[0]!, fechaFin: fechas[fechas.length - 1]! }
    : null;
}

export function esRangoPaternidadValido(
  fechaInicio: string,
  fechaFin: string,
  descansos: ReadonlySet<string> = new Set(),
): boolean {
  const esperado = calcularRangoPaternidad(fechaInicio, descansos);
  if (!esperado) return false;
  return esperado.fechaInicio === fechaInicio && esperado.fechaFin === fechaFin;
}

export const MENSAJE_PATERNIDAD_SIETE_DIAS_HABILES =
  "Paternidad solo permite solicitar exactamente 7 días hábiles. Si la fecha de inicio cae en fin de semana, se ajustan los días hábiles más cercanos.";

export const MENSAJE_VACACIONES_ADMIN_FIN_DE_SEMANA =
  "Los colaboradores administrativos solo pueden solicitar vacaciones de lunes a viernes.";

export const MENSAJE_PERMISO_SIN_GOCE_ADMIN_FIN_DE_SEMANA =
  "Los colaboradores administrativos solo pueden solicitar permiso sin goce de sueldo de lunes a viernes.";

export const MENSAJE_HOME_OFFICE_FIN_DE_SEMANA =
  "Home Office solo puede solicitarse en días entre semana (lunes a viernes).";

export const MENSAJE_HOME_OFFICE_SOLO_ADMINISTRATIVO =
  "Home Office no está disponible para este colaborador: requiere clasificación Administrativo y que su área tenga regla de home office configurada.";

export const MENSAJE_HOME_OFFICE_UN_DIA =
  "Home Office solo permite solicitar un día (fecha inicio y fin iguales).";

/** La regla del área (días/periodo) no se muestra al empleado: el mensaje es genérico. */
export const MENSAJE_HOME_OFFICE_MES_LIMITE =
  "Ya existe una solicitud de Home Office activa en el periodo permitido para el área.";

export const HOME_OFFICE_RESUMEN_BASE =
  "Home Office: un solo día por solicitud, entre semana (lunes a viernes). La frecuencia permitida depende del área del colaborador.";

/**
 * Anticipación mínima para vacaciones y home office: la fecha de inicio debe ser al
 * menos mañana. Espejo de `DIAS_ANTICIPACION_MINIMA` en `app/services/solicitud_service.py`.
 * RH (modo operativo) queda exento y sigue registrando cualquier fecha.
 */
export const SOLICITUD_DIAS_ANTICIPACION_MINIMA = 1;

export const MENSAJE_ANTICIPACION_MINIMA =
  "Se solicita con al menos un día de anticipación: hoy y fechas pasadas no están disponibles.";

export function tipoRequiereAnticipacionMinima(tipo: string): boolean {
  return tipo === "vacaciones" || tipo === "home_office";
}

/** Primera fecha seleccionable (ISO) a partir de `hoyIso`. */
export function fechaMinimaSolicitudIso(hoyIso: string): string {
  return sumarDiasIso(hoyIso, SOLICITUD_DIAS_ANTICIPACION_MINIMA);
}

/** `true` si no hay fecha mínima o si `fechaInicioIso >= fechaMinimaIso` (comparación ISO). */
export function fechaInicioCumpleAnticipacion(
  fechaInicioIso: string,
  fechaMinimaIso: string | null,
): boolean {
  if (!fechaMinimaIso || !fechaInicioIso) return true;
  return fechaInicioIso >= fechaMinimaIso;
}
