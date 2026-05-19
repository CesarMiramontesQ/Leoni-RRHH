import * as XLSX from "xlsx";
import type { EstadoEmpleadoResponse, UsuarioListItem } from "../api/usuarios.ts";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { formatNoEmpleadoDisplay } from "../utils/noEmpleadoDisplay.ts";

export type EmpleadosExcelExportOptions = {
  rows: readonly UsuarioListItem[];
  filename?: string;
};

function textoAsignacion(val: string | null | undefined): string {
  const t = val?.trim();
  return t ? t : "Sin asignar";
}

function textoLiderMostrar(val: string | null | undefined): string {
  const f = formatNombreEmpleadoUi(val);
  return f || "Sin asignar";
}

function estatusExport(estado: EstadoEmpleadoResponse | null): string {
  return estado?.descripcion?.trim() || "Sin estado";
}

/** Filas listas para `json_to_sheet` (columnas visibles del listado RH). */
export function buildEmpleadosExcelRows(rows: readonly UsuarioListItem[]): Record<string, string>[] {
  return rows.map((row) => {
    const nombre = formatNombreEmpleadoUi(row.nombre) || "Sin nombre";
    const email = row.email?.trim() || "Sin correo";
    return {
      Empleado: nombre,
      Correo: email,
      Número: formatNoEmpleadoDisplay(row.no_empleado),
      Área: textoAsignacion(row.area?.descripcion),
      Puesto: textoAsignacion(row.puesto?.descripcion),
      Líder: textoLiderMostrar(row.lider_nombre),
      Estatus: estatusExport(row.estado),
    };
  });
}

/** Descarga `empleados.xlsx` (o nombre indicado) con los registros indicados. */
export function downloadEmpleadosExcel(options: EmpleadosExcelExportOptions): void {
  const { rows, filename = "empleados.xlsx" } = options;
  const sheetRows = buildEmpleadosExcelRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Empleados");
  XLSX.writeFile(workbook, filename);
}
