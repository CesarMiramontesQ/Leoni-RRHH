import type { EmpleadoDashboardPayload } from "./types.ts";
import { buildEmpleadoDashboardMock } from "./mock.ts";

const MOCK_DELAY_MS = 320;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Sustituir por fetchWithAuth cuando exista GET dashboard empleado. */
export async function fetchEmpleadoDashboard(): Promise<EmpleadoDashboardPayload | null> {
  try {
    if (MOCK_DELAY_MS > 0) {
      await delay(MOCK_DELAY_MS);
    }
    return buildEmpleadoDashboardMock(new Date());
  } catch {
    return null;
  }
}
