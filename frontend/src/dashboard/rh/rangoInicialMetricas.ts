/**
 * Rango con el que abre la página de Métricas: el año en curso, del 1 de enero a hoy.
 *
 * Antes los filtros arrancaban vacíos y cada bloque resolvía el «sin fecha» a su manera
 * —solicitudes y Seguridad y Calidad mostraban todo el histórico, mientras faltas y
 * retardos se acotaba solo a los últimos seis meses por el default del backend—, así que
 * la pantalla comparaba periodos distintos sin decirlo. Fijarlo aquí los alinea y, de
 * paso, lo deja visible en los campos de fecha.
 */
import { rhIsoLocalDate } from "./calendarMonthGrid.ts";

export type RangoMetricas = { fecha_inicio: string; fecha_fin: string };

export function rangoInicialMetricas(hoy: Date = new Date()): RangoMetricas {
  return {
    // Fecha local en ambos extremos: `toISOString` adelantaría el día —y el 31 de
    // diciembre por la noche, el año entero— para husos al oeste de UTC.
    fecha_inicio: rhIsoLocalDate(new Date(hoy.getFullYear(), 0, 1)),
    fecha_fin: rhIsoLocalDate(hoy),
  };
}
