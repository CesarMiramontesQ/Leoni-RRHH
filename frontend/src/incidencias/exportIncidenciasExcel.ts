import * as XLSX from "xlsx";
import { labelTipoIncidenciaUi } from "./rh/tipoIncidenciaDisplay.ts";
import type { RhIncidenciaTablaFila } from "./rh/types.ts";
import { fmtTablaCelda } from "../ui/uiUtils.ts";
import { formatNombreEmpleadoIncidenciasUi } from "../utils/nombreEmpleadoDisplay.ts";

export type IncidenciasExcelExportOptions = {
  rows: readonly RhIncidenciaTablaFila[];
  filename?: string;
};

function nombreEmpleadoExport(raw: string): string {
  const f = formatNombreEmpleadoIncidenciasUi(raw).trim();
  return f || raw.trim() || "—";
}

function tipoExport(row: RhIncidenciaTablaFila): string {
  const raw = (row.tipo_incidencia ?? row.tipo_texto ?? row.tipo).trim() || String(row.tipo);
  return labelTipoIncidenciaUi(raw);
}

/** Filas listas para `json_to_sheet` (columnas visibles del listado). */
export function buildIncidenciasExcelRows(
  rows: readonly RhIncidenciaTablaFila[],
): Record<string, string>[] {
  return rows.map((row) => ({
    "No empleado": fmtTablaCelda(row.no_empleado),
    Nombre: nombreEmpleadoExport(row.empleado_nombre_raw),
    Tipo: tipoExport(row),
    Detalle: fmtTablaCelda(row.detalle),
    Área: fmtTablaCelda(row.area),
    "Subárea": fmtTablaCelda(row.subarea),
  }));
}

/** Descarga `incidencias.xlsx` (o nombre indicado) con los registros indicados. */
export function downloadIncidenciasExcel(options: IncidenciasExcelExportOptions): void {
  const { rows, filename = "incidencias.xlsx" } = options;
  const sheetRows = buildIncidenciasExcelRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Incidencias");
  XLSX.writeFile(workbook, filename);
}
