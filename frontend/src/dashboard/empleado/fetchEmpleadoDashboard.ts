import type { EmpleadoDashboardPayload } from "./types.ts";

/**
 * Fuente de dashboard personal.
 * Mientras el endpoint dedicado no este disponible, retornamos null para que
 * la vista renderice estado vacio controlado sin datos simulados.
 */
export async function fetchEmpleadoDashboard(): Promise<EmpleadoDashboardPayload | null> {
  return null;
}
