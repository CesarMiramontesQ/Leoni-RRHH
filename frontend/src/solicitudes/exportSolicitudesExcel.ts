import * as XLSX from "xlsx";
import { formatNombreEmpleadoUi } from "../utils/nombreEmpleadoDisplay.ts";
import { fmtFechaCorta } from "../ui/uiUtils.ts";
import { calcularDiasSolicitadosInclusive } from "./rh/rhNewRequestDays.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila, RhSolicitudTipoCodigo } from "./rh/types.ts";

const TIPO_LABELS: Record<RhSolicitudTipoCodigo, string> = {
  vacaciones: "Vacaciones",
  home_office: "Home Office",
  permiso_sin_goce_sueldo: "Permiso sin goce de sueldo",
  matrimonio: "Matrimonio (goce)",
  incapacidad_interna: "Incapacidad interna (goce)",
  defuncion: "Defunción (goce)",
  paternidad: "Paternidad (goce)",
};

const ESTADO_LABELS: Record<RhSolicitudEstadoCodigo, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  changes_requested: "Cambios solicitados",
  cancelled: "Cancelado",
  overridden: "Aprobado (override)",
};

export type SolicitudesExcelLayout = "gestor" | "empleado";

export type SolicitudesExcelExportOptions = {
  layout: SolicitudesExcelLayout;
  rows: readonly RhSolicitudTablaFila[];
  /** Vista partida supervisor/gerente: columna extra con el bloque de origen. */
  includeSeccionColumn?: boolean;
  /** Etiqueta por fila cuando `includeSeccionColumn` (misma longitud que `rows` tras filtrar). */
  seccionPorFila?: readonly string[];
  filename?: string;
};

function fmtPeriodo(row: RhSolicitudTablaFila): string {
  if (row.periodo_etiqueta?.trim()) return row.periodo_etiqueta.trim();
  const a = fmtFechaCorta(row.fecha_inicio);
  const b = fmtFechaCorta(row.fecha_fin);
  if (row.fecha_inicio === row.fecha_fin) return a;
  return `${a} – ${b}`;
}

function fmtFolio(numeroFolio: string): string {
  return numeroFolio.startsWith("#") ? numeroFolio : `#${numeroFolio}`;
}

function empleadoDisplay(row: RhSolicitudTablaFila): string {
  return formatNombreEmpleadoUi(row.empleado_nombre_raw) || row.empleado_nombre_raw.trim() || "Sin nombre";
}

/** Filas listas para `json_to_sheet` según columnas visibles de la tabla. */
export function buildSolicitudesExcelRows(
  rows: readonly RhSolicitudTablaFila[],
  layout: SolicitudesExcelLayout,
  seccionPorFila?: readonly string[],
): Record<string, string | number>[] {
  if (layout === "empleado") {
    return rows.map((row) => ({
      Folio: fmtFolio(row.numero_folio),
      Tipo: TIPO_LABELS[row.tipo],
      Inicio: fmtFechaCorta(row.fecha_inicio),
      Fin: fmtFechaCorta(row.fecha_fin),
      Días: calcularDiasSolicitadosInclusive(row.fecha_inicio, row.fecha_fin),
      Estatus: ESTADO_LABELS[row.estado],
      Creación: fmtFechaCorta(row.fecha_solicitud),
    }));
  }

  return rows.map((row, index) => {
    const base: Record<string, string | number> = {
      Empleado: empleadoDisplay(row),
      Número: fmtFolio(row.numero_folio),
      Área: row.area.trim() || "—",
      Tipo: TIPO_LABELS[row.tipo],
      "Fecha solicitud": fmtFechaCorta(row.fecha_solicitud),
      "Periodo solicitado": fmtPeriodo(row),
      Estado: ESTADO_LABELS[row.estado],
    };
    if (seccionPorFila?.[index]) {
      return { Sección: seccionPorFila[index], ...base };
    }
    return base;
  });
}

/** Descarga `solicitudes.xlsx` (o nombre indicado) con los registros indicados. */
export function downloadSolicitudesExcel(options: SolicitudesExcelExportOptions): void {
  const {
    layout,
    rows,
    includeSeccionColumn = false,
    seccionPorFila,
    filename = "solicitudes.xlsx",
  } = options;

  const secciones =
    includeSeccionColumn && seccionPorFila && seccionPorFila.length === rows.length ? seccionPorFila : undefined;

  const sheetRows = buildSolicitudesExcelRows(rows, layout, secciones);
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Solicitudes");
  XLSX.writeFile(workbook, filename);
}
