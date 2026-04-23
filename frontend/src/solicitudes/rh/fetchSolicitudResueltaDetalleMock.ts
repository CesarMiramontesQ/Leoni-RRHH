import { mapTablaFilaToSolicitudResuelta } from "./mapTablaFilaToSolicitudResuelta.ts";
import type { SolicitudResueltaDetalleVm } from "./solicitudResueltaTypes.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

const MOCK_MS = 340;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Simula GET de detalle de solicitud resuelta. Sustituir por API real.
 */
export async function fetchSolicitudResueltaDetalleMock(
  solicitudId: number,
  getFilaById: (id: number) => RhSolicitudTablaFila | undefined,
  simulateError = false,
  soloLectura = false,
): Promise<{ ok: true; data: SolicitudResueltaDetalleVm } | { ok: false; message: string }> {
  await delay(MOCK_MS);
  if (simulateError) {
    return { ok: false, message: "Error de red simulado." };
  }
  const fila = getFilaById(solicitudId);
  if (!fila) {
    return { ok: false, message: "not_found" };
  }
  const data = mapTablaFilaToSolicitudResuelta(fila, { soloLectura });
  if (!data) {
    return { ok: false, message: "not_resolved" };
  }
  return { ok: true, data };
}
