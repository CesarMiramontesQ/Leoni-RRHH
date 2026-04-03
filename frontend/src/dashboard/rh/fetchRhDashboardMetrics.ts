import type { RhOperationalMetricsPayload } from "./metricsTypes.ts";
import { MOCK_RH_OPERATIONAL_METRICS } from "./metricsMock.ts";

const MOCK_DELAY_MS = 380;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Fuente de métricas operativas RH. Hoy: mock local con latencia breve para skeleton.
 * Sustituir el cuerpo por `fetchWithAuth("/api/v1/...")` cuando exista el endpoint.
 */
export async function fetchRhDashboardMetrics(): Promise<RhOperationalMetricsPayload | null> {
  try {
    if (MOCK_DELAY_MS > 0) {
      await delay(MOCK_DELAY_MS);
    }
    return MOCK_RH_OPERATIONAL_METRICS;
  } catch {
    return null;
  }
}
