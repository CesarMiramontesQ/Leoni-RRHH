import {
  formatNombreEmpleadoIncidenciasUi,
  formatNombreEmpleadoUi,
} from "./nombreEmpleadoDisplay.ts";

/** Normaliza texto para búsqueda insensible a acentos y mayúsculas. */
export function normalizeTextoBusquedaEmpleado(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type CamposBusquedaEmpleadoFila = {
  empleado_nombre_raw: string;
  numero_folio: string;
  empleado_id?: string | null;
};

/**
 * Cadena agregada para `includes`: nombre crudo, nombre UI, id, folio (con/sin #).
 * Correo u otros campos se pueden añadir cuando existan en la fila/API.
 */
export function textoNormalizadoHaystackEmpleado(row: CamposBusquedaEmpleadoFila): string {
  const nombreUi = formatNombreEmpleadoUi(row.empleado_nombre_raw) || "";
  const nombreIncidenciasUi = formatNombreEmpleadoIncidenciasUi(row.empleado_nombre_raw) || "";
  const folio = row.numero_folio.trim();
  const folioSinHash = folio.startsWith("#") ? folio.slice(1) : folio;
  const partes = [
    row.empleado_nombre_raw,
    nombreUi,
    nombreIncidenciasUi,
    row.empleado_id,
    folio,
    folioSinHash,
  ].filter((x) => x != null && String(x).trim() !== "");
  return normalizeTextoBusquedaEmpleado(partes.join(" "));
}

export function filaCoincideBusquedaTextoEmpleado(
  row: CamposBusquedaEmpleadoFila,
  consultaCruda: string,
): boolean {
  const q = normalizeTextoBusquedaEmpleado(consultaCruda);
  if (!q) return true;
  return textoNormalizadoHaystackEmpleado(row).includes(q);
}
