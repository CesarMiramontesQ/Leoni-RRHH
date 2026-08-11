/**
 * Planeación de comedor: cuántos platillos hay que preparar, por comedor, día y horario.
 *
 * Es el corte que necesita el personal de planeación para producir: no le sirve saber que
 * el miércoles van 730 personas, sino que a las 10:00 en Central van 118 de la Opción A y
 * 37 de la B. El horario no está en el registro de acceso —lo resuelve el servidor
 * recorriendo el ciclo del turno de cada persona— y aquí solo se agrupa.
 *
 * Dos reglas de conteo que conviene no cambiar sin pensarlo:
 *
 * - **Solo cuentan las reservas vigentes** (`PENDIENTE` y `ACCEDIDO`). Un acceso cancelado
 *   no se cocina, y `REPETIDO` es una segunda entrada del mismo día, no otro platillo:
 *   contarlo inflaría la producción.
 * - **Las comidas sin horario no se descartan**, se agrupan aparte. Si 40 personas quedan
 *   fuera de horario porque su jornada no está configurada, planeación tiene que verlo;
 *   ocultarlas haría que los totales no cuadren con el detalle y nadie sabría por qué.
 */

import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";

/** Estados que representan un platillo a preparar. */
const ESTADOS_QUE_CUENTAN = new Set(["PENDIENTE", "ACCEDIDO"]);

export const SIN_HORARIO_ID = "sin-horario";
export const SIN_HORARIO_LABEL = "Sin horario";

export type PlatillosPorHorario = {
  comedor: string;
  fechaIso: string;
  /** `"10:00-10:30"`, o `SIN_HORARIO_ID`. */
  horarioId: string;
  horarioLabel: string;
  /** `"10:00"` para ordenar; `null` en el grupo sin horario, que va al final. */
  horaInicio: string | null;
  opcionA: number;
  opcionB: number;
  total: number;
};

export type OpcionHorario = { id: string; label: string };

/** `"10:00:00"` → `"10:00"`. */
function hhmm(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return v ? v.slice(0, 5) : null;
}

/** Identifica la ventana de una fila; `SIN_HORARIO_ID` cuando no tiene. */
export function horarioIdDeFila(row: ComedorRhProximoRegistroRow): string {
  const ini = hhmm(row.hora_inicio_comida);
  const fin = hhmm(row.hora_fin_comida);
  if (!ini || !fin) return SIN_HORARIO_ID;
  return `${ini}-${fin}`;
}

export function horarioLabelDeFila(row: ComedorRhProximoRegistroRow): string {
  const id = horarioIdDeFila(row);
  return id === SIN_HORARIO_ID ? SIN_HORARIO_LABEL : id.replace("-", " – ");
}

/** Cuenta como platillo a preparar. */
export function filaCuentaComoPlatillo(row: ComedorRhProximoRegistroRow): boolean {
  return ESTADOS_QUE_CUENTAN.has((row.estado_acceso ?? "").trim().toUpperCase());
}

/** `casera` es la Opción A y `saludable` la B, igual que en el resto de la pantalla. */
function esOpcionB(row: ComedorRhProximoRegistroRow): boolean {
  return (row.tipo_comida ?? "").trim().toLowerCase() === "saludable";
}

/** Horarios presentes en los datos, para poblar el filtro. Ordenados por hora. */
export function opcionesHorario(
  rows: readonly ComedorRhProximoRegistroRow[],
): OpcionHorario[] {
  const vistos = new Map<string, string>();
  let haySinHorario = false;
  for (const row of rows) {
    const id = horarioIdDeFila(row);
    if (id === SIN_HORARIO_ID) {
      haySinHorario = true;
      continue;
    }
    if (!vistos.has(id)) vistos.set(id, horarioLabelDeFila(row));
  }
  const opciones = [...vistos.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.id.localeCompare(b.id));
  // El grupo sin horario va al final: es la excepción, no una franja más.
  if (haySinHorario) opciones.push({ id: SIN_HORARIO_ID, label: SIN_HORARIO_LABEL });
  return opciones;
}

export function filtrarPorHorario(
  rows: readonly ComedorRhProximoRegistroRow[],
  horarioId: string,
): ComedorRhProximoRegistroRow[] {
  if (!horarioId || horarioId === "todos") return [...rows];
  return rows.filter((row) => horarioIdDeFila(row) === horarioId);
}

/**
 * Agrupa por comedor + día + horario, contando Opción A y B por separado.
 *
 * Orden: comedor, fecha y hora de inicio. Así el Excel se lee como un plan de producción,
 * de arriba abajo, en el orden en que hay que servir.
 */
export function agregarPlatillosPorHorario(
  rows: readonly ComedorRhProximoRegistroRow[],
): PlatillosPorHorario[] {
  const acc = new Map<string, PlatillosPorHorario>();

  for (const row of rows) {
    if (!filaCuentaComoPlatillo(row)) continue;
    const comedor = (row.comedor_nombre ?? "").trim() || "—";
    const fechaIso = (row.fecha_servicio ?? "").slice(0, 10);
    const horarioId = horarioIdDeFila(row);
    const clave = `${comedor}||${fechaIso}||${horarioId}`;

    let bucket = acc.get(clave);
    if (!bucket) {
      bucket = {
        comedor,
        fechaIso,
        horarioId,
        horarioLabel: horarioLabelDeFila(row),
        horaInicio: horarioId === SIN_HORARIO_ID ? null : horarioId.slice(0, 5),
        opcionA: 0,
        opcionB: 0,
        total: 0,
      };
      acc.set(clave, bucket);
    }
    if (esOpcionB(row)) bucket.opcionB += 1;
    else bucket.opcionA += 1;
    bucket.total += 1;
  }

  return [...acc.values()].sort((a, b) => {
    if (a.comedor !== b.comedor) return a.comedor.localeCompare(b.comedor);
    if (a.fechaIso !== b.fechaIso) return a.fechaIso.localeCompare(b.fechaIso);
    // Sin horario siempre al final del día, no intercalado.
    if (a.horaInicio === null) return 1;
    if (b.horaInicio === null) return -1;
    return a.horaInicio.localeCompare(b.horaInicio);
  });
}

/** Totales del corte completo, para el pie de la tabla y del Excel. */
export function totalesPlatillos(
  buckets: readonly PlatillosPorHorario[],
): { opcionA: number; opcionB: number; total: number } {
  return buckets.reduce(
    (acc, b) => ({
      opcionA: acc.opcionA + b.opcionA,
      opcionB: acc.opcionB + b.opcionB,
      total: acc.total + b.total,
    }),
    { opcionA: 0, opcionB: 0, total: 0 },
  );
}
