import type { SolicitudDetalleAccion } from "./solicitudDetalleTypes.ts";
import type { RhSolicitudEstadoCodigo, RhSolicitudTablaFila } from "./types.ts";

const MOCK_ACTION_MS = 620;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isoHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SolicitudDetalleDecisionPayload = {
  solicitudId: number;
  accion: SolicitudDetalleAccion;
  comentario_interno: string | null;
};

/**
 * Simula PATCH de decisión. Devuelve la fila actualizada para reemplazo en memoria (mock).
 */
export async function ejecutarDecisionSolicitudMock(
  payload: SolicitudDetalleDecisionPayload,
  filaActual: RhSolicitudTablaFila,
): Promise<{ ok: true; fila: RhSolicitudTablaFila } | { ok: false; message: string }> {
  await delay(MOCK_ACTION_MS);
  if (filaActual.id !== payload.solicitudId) {
    return { ok: false, message: "Identificador inconsistente." };
  }
  if (filaActual.estado !== "pending") {
    return { ok: false, message: "La solicitud ya no está pendiente." };
  }

  let estado: RhSolicitudEstadoCodigo;
  let fecha_aprobacion: string | null = filaActual.fecha_aprobacion;

  switch (payload.accion) {
    case "aprobar":
      estado = "approved";
      fecha_aprobacion = isoHoyLocal();
      break;
    case "cambios":
      estado = "changes_requested";
      fecha_aprobacion = null;
      break;
    case "rechazar":
      estado = "rejected";
      fecha_aprobacion = null;
      break;
    default:
      return { ok: false, message: "Acción no válida." };
  }

  const fila: RhSolicitudTablaFila = {
    ...filaActual,
    estado,
    fecha_aprobacion,
  };

  console.info("[RH] Decisión solicitud (mock)", {
    ...payload,
    comentario_interno: payload.comentario_interno ? "(presente)" : null,
  });

  return { ok: true, fila };
}
