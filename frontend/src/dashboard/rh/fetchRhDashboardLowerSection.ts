import type { RhLowerSectionPayload } from "./lowerSectionTypes.ts";
import { buildRhLowerSectionMock } from "./lowerSectionMock.ts";

const MOCK_DELAY_MS = 280;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Fuente de la sección inferior del dashboard RH (alertas, calendario, resumen, eventos).
 * Sustituir por `fetchWithAuth` cuando exista endpoint dedicado.
 */
export async function fetchRhDashboardLowerSection(): Promise<RhLowerSectionPayload | null> {
  try {
    if (MOCK_DELAY_MS > 0) {
      await delay(MOCK_DELAY_MS);
    }
    return buildRhLowerSectionMock(new Date());
  } catch {
    return null;
  }
}
