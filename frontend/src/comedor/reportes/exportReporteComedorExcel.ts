import * as XLSX from "xlsx";
import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";
import { formatFechaServicioRhRegistro } from "../../components/comedor/comedorRhProximosRegistrosTable.ts";
import {
  agregarPlatillosPorHorario,
  horarioLabelDeFila,
  totalesPlatillos,
} from "./planeacionPlatillos.ts";

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
  if (k === "REPETIDO") return "Repetido";
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
    Turno: (row.tu_codigo ?? "").trim() || "—",
    "Horario de comida": horarioLabelDeFila(row),
    Tipo: tipoComidaLabel(row.tipo_comida),
    Estado: estadoAccesoLabel(row.estado_acceso),
  }));
}

/**
 * Plan de producción: platillos por comedor, día y horario.
 *
 * Es la hoja que usa planeación de comedor. Cuenta solo las reservas vigentes —ni
 * canceladas ni segundas entradas— y separa las dos opciones de menú, que es lo que
 * determina cuánto se prepara de cada una. Cierra con un renglón de totales.
 */
export function buildPlaneacionPlatillosExcelRows(
  rows: readonly ComedorRhProximoRegistroRow[],
): Record<string, string | number>[] {
  const buckets = agregarPlatillosPorHorario(rows);
  const filas: Record<string, string | number>[] = buckets.map((b) => ({
    Comedor: b.comedor,
    "Fecha servicio": formatFechaServicioRhRegistro(b.fechaIso),
    "Horario de comida": b.horarioLabel,
    "Opción A": b.opcionA,
    "Opción B": b.opcionB,
    "Total platillos": b.total,
  }));
  if (filas.length === 0) return filas;

  const t = totalesPlatillos(buckets);
  filas.push({
    Comedor: "TOTAL",
    "Fecha servicio": "",
    "Horario de comida": "",
    "Opción A": t.opcionA,
    "Opción B": t.opcionB,
    "Total platillos": t.total,
  });
  return filas;
}

/**
 * Descarga `reporte-comedor.xlsx` (o nombre indicado) con dos hojas.
 *
 * Van en el mismo archivo y no en dos descargas porque son el mismo corte visto de dos
 * formas: quien planea produce con la primera y verifica un caso puntual en la segunda,
 * y separarlas obligaría a cuadrar dos archivos que pueden venir de rangos distintos.
 */
export function downloadReporteComedorExcel(options: ReporteComedorExcelExportOptions): void {
  const { rows, filename = "reporte-comedor.xlsx" } = options;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildPlaneacionPlatillosExcelRows(rows)),
    "Planeación platillos",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(buildReporteComedorExcelRows(rows)),
    "Detalle",
  );
  XLSX.writeFile(workbook, filename);
}
