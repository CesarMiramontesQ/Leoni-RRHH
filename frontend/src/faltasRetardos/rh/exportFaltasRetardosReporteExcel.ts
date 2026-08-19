import * as XLSX from "xlsx";
import type { FaltasRetardosReporteSemanalResponse } from "../../api/faltasRetardos.ts";

/**
 * Reporte semanal de incidencias: `no_empleado | nombre | Semana N-3 | N-2 | N-1`.
 *
 * Exactamente cinco columnas y un renglón por empleado. Las semanas y las celdas ya
 * vienen resueltas del servidor —ahí vive el cálculo ISO y el reparto de los eventos con
 * rango—; aquí solo se vuelca la cuadrícula, para que la hoja no pueda desfasarse de lo
 * que el backend contó.
 */

export const COL_NO_EMPLEADO = "no_empleado";
export const COL_NOMBRE = "nombre";

/** Cabeceras de la hoja: las dos fijas más una por semana, en orden. */
export function buildReporteHeaders(
  data: FaltasRetardosReporteSemanalResponse,
): string[] {
  return [COL_NO_EMPLEADO, COL_NOMBRE, ...data.semanas.map((s) => s.etiqueta)];
}

/**
 * Matriz lista para `aoa_to_sheet`. Se usa array-of-arrays y no `json_to_sheet` porque
 * dos semanas del mismo número —imposible hoy, pero un objeto las colapsaría en una
 * sola clave— y porque así el orden de las columnas es el del arreglo, sin depender del
 * orden de inserción de las propiedades.
 */
export function buildReporteMatrix(
  data: FaltasRetardosReporteSemanalResponse,
): (string | number)[][] {
  const totalSemanas = data.semanas.length;
  const filas = data.items.map((item) => {
    // Una celda por columna aunque el servidor mandara de menos: la fila nunca queda
    // corta ni se desplaza contra las cabeceras.
    const celdas = Array.from({ length: totalSemanas }, (_, i) => item.semanas[i] ?? "");
    return [item.no_empleado, item.nombre, ...celdas];
  });
  return [buildReporteHeaders(data), ...filas];
}

/** `reporte_incidencias_YYYY-MM-DD.xlsx` con la fecha de generación del servidor. */
export function reporteFilename(data: FaltasRetardosReporteSemanalResponse): string {
  const fecha = (data.generado_en || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  return `reporte_incidencias_${fecha}.xlsx`;
}

export function downloadFaltasRetardosReporteExcel(
  data: FaltasRetardosReporteSemanalResponse,
): void {
  const worksheet = XLSX.utils.aoa_to_sheet(buildReporteMatrix(data));
  // Anchos: el número cabe angosto, el nombre no, y las celdas de semana pueden llevar
  // varios códigos separados por coma.
  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 34 },
    ...data.semanas.map(() => ({ wch: 16 })),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Incidencias");
  XLSX.writeFile(workbook, reporteFilename(data));
}
