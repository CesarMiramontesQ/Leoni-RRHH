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

/**
 * Convierte a texto lo que venga, sin asumir que ya es una cadena.
 *
 * `no_empleado` viaja como **número** (el backend lo declara `int`), así que llamarle
 * `.trim()` lanzaba `TypeError` y tumbaba la exportación entera: el botón no descargaba
 * nada y no había forma de saber por qué. Los demás campos se pasan por aquí por el mismo
 * motivo: un `null` del backend rompía igual.
 */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
}

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
    Empleado: texto(row.empleado_nombre) || "—",
    "No. empleado": texto(row.no_empleado) || "—",
    Área: texto(row.area) || "—",
    Comedor: texto(row.comedor_nombre) || "—",
    Turno: texto(row.tu_codigo) || "—",
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
