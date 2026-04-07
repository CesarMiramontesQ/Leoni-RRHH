import { formatNombreEmpleadoUi } from "../../utils/nombreEmpleadoDisplay.ts";
import type { RhSolicitudFilterOptions, RhSolicitudTablaFila } from "./types.ts";

function areaIdFromLabel(label: string): string {
  return `area:${label}`;
}

/**
 * Catálogos para selects, derivados del dataset (mock) o de endpoints dedicados.
 */
export function buildRhSolicitudFilterOptions(rows: readonly RhSolicitudTablaFila[]): RhSolicitudFilterOptions {
  const areas = new Map<string, string>();
  const sups = new Map<string, string>();

  for (const r of rows) {
    if (r.area.trim()) areas.set(r.area, r.area);
    const sid = r.supervisor_id;
    const rawName = r.supervisor_nombre.trim();
    const label = formatNombreEmpleadoUi(rawName) || rawName || "Sin supervisor";
    sups.set(sid, label);
  }

  const areaList = [...areas.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([label]) => ({ id: areaIdFromLabel(label), label }));

  const supList = [...sups.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .map(([id, label]) => ({ id, label }));

  return {
    areas: areaList,
    supervisores: supList,
    tipos: [
      { id: "vacaciones", label: "Vacaciones" },
      { id: "home_office", label: "Home Office" },
    ],
    estados: [
      { id: "pending", label: "Pendiente" },
      { id: "approved", label: "Aprobado" },
      { id: "rejected", label: "Rechazado" },
      { id: "changes_requested", label: "Cambios solicitados" },
      { id: "cancelled", label: "Cancelado" },
      { id: "overridden", label: "Aprobado (override)" },
    ],
  };
}

export function areaLabelFromFilterId(areaId: string): string {
  if (!areaId.startsWith("area:")) return "";
  return areaId.slice("area:".length);
}
