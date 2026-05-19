import * as XLSX from "xlsx";
import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";
import { formatFechaServicioRhRegistro } from "../../components/comedor/comedorRhProximosRegistrosTable.ts";

export type ReporteComedorExcelExportOptions = {
  rows: readonly ComedorRhProximoRegistroRow[];
  filename?: string;
};

function tipoComidaLabel(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (k === "casera") return "Opción A";
  if (k === "saludable") return "Opción B";
  return raw.trim() || "—";
}

function estadoAccesoLabel(estado: string): string {
  const k = estado.trim().toUpperCase();
  if (k === "ACCEDIDO") return "Accedido";
  if (k === "PENDIENTE") return "Pendiente";
  if (k === "EXPIRADO") return "Cancelado";
  return estado.trim() || "—";
}

/** Filas listas para `json_to_sheet` (columnas visibles del listado de detalle). */
export function buildReporteComedorExcelRows(
  rows: readonly ComedorRhProximoRegistroRow[],
): Record<string, string>[] {
  return rows.map((row) => ({
    "Fecha servicio": formatFechaServicioRhRegistro(row.fecha_servicio),
    Empleado: row.empleado_nombre.trim() || "—",
    "No. empleado": row.no_empleado.trim() || "—",
    Área: row.area.trim() || "—",
    Comedor: row.comedor_nombre.trim() || "—",
    Tipo: tipoComidaLabel(row.tipo_comida),
    Estado: estadoAccesoLabel(row.estado_acceso),
  }));
}

/** Descarga `reporte-comedor.xlsx` (o nombre indicado) con los registros indicados. */
export function downloadReporteComedorExcel(options: ReporteComedorExcelExportOptions): void {
  const { rows, filename = "reporte-comedor.xlsx" } = options;
  const sheetRows = buildReporteComedorExcelRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte comedor");
  XLSX.writeFile(workbook, filename);
}
