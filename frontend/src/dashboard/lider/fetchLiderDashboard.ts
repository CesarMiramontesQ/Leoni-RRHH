import type { LiderDashboardPayload } from "./types.ts";

/**
 * Fuente de dashboard de lider.
 * Mientras el endpoint dedicado no este disponible, retornamos null para evitar
 * datos simulados y dejar que la UI muestre estado vacio.
 */
export async function fetchLiderDashboard(): Promise<LiderDashboardPayload | null> {
  return null;
}
