import type { ClasificacionEmpleadoResponse } from "../api/usuarios.ts";

function normalizeClasificacionText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase();
}

/** Alineado con `_tipo_clasificacion_dashboard` del backend (catálogo `clasificacion_empleado`). */
export function esEmpleadoAdministrativo(
  clasificacion: ClasificacionEmpleadoResponse | null | undefined,
): boolean {
  if (!clasificacion) return false;
  for (const raw of [clasificacion.significado, clasificacion.descripcion]) {
    if (!raw?.trim()) continue;
    const n = normalizeClasificacionText(raw);
    if (n === "a" || n === "administrativo" || n.includes("administrat")) return true;
  }
  return false;
}
