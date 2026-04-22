import type { RhOperationalMetricsPayload } from "./metricsTypes.ts";

/**
 * Fuente de metricas operativas RH.
 * Retorna null hasta integrar endpoint real para evitar datos de negocio simulados.
 */
export async function fetchRhDashboardMetrics(): Promise<RhOperationalMetricsPayload | null> {
  return null;
}
