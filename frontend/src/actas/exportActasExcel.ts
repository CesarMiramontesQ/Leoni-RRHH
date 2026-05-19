import * as XLSX from "xlsx";
import type { ActaEstadoCodigo, ActaTablaFila, ActaTipoCodigo } from "./actasMockData.ts";
import { fmtFechaCorta } from "../ui/uiUtils.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";

const TIPO_LABELS: Record<ActaTipoCodigo, string> = {
  amonestacion: "Amonestación",
  suspension: "Suspensión",
  administrativa: "Administrativa",
};

const ESTADO_LABELS: Record<ActaEstadoCodigo, string> = {
  abierta: "Abierta",
  en_proceso: "En proceso",
  firmada: "Aprobada",
  anulada: "Anulada",
};

export type ActasExcelExportOptions = {
  rows: readonly ActaTablaFila[];
  filename?: string;
};

function empleadoDisplay(row: ActaTablaFila): string {
  return formatNombreEmpleadoUi(row.empleado_nombre_raw) || row.empleado_nombre_raw.trim() || "—";
}

/** Filas listas para `json_to_sheet` (columnas visibles del listado). */
export function buildActasExcelRows(rows: readonly ActaTablaFila[]): Record<string, string>[] {
  return rows.map((row) => ({
    Empleado: empleadoDisplay(row),
    Folio: row.folio.trim() || "—",
    Área: row.area.trim() || "—",
    Tipo: TIPO_LABELS[row.tipo],
    Fecha: fmtFechaCorta(row.fecha),
    Estado: ESTADO_LABELS[row.estado],
    Supervisor: row.supervisor_nombre.trim() || "—",
  }));
}

/** Descarga `actas.xlsx` (o nombre indicado) con los registros indicados. */
export function downloadActasExcel(options: ActasExcelExportOptions): void {
  const { rows, filename = "actas.xlsx" } = options;
  const sheetRows = buildActasExcelRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Actas");
  XLSX.writeFile(workbook, filename);
}
