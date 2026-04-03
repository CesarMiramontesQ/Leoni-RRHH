import type { LiderDashboardPayload } from "./types.ts";
import { buildLiderDashboardMock } from "./mock.ts";

const MOCK_DELAY_MS = 340;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Sustituir por fetchWithAuth cuando exista endpoint dedicado. */
export async function fetchLiderDashboard(): Promise<LiderDashboardPayload | null> {
  try {
    if (MOCK_DELAY_MS > 0) {
      await delay(MOCK_DELAY_MS);
    }
    return buildLiderDashboardMock(new Date());
  } catch {
    return null;
  }
}
