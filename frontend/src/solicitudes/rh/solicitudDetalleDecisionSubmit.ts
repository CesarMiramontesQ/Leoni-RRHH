import {
  approveSolicitud,
  mapSolicitudApiItemToRhTablaFila,
  rejectSolicitud,
  requestChangesSolicitud,
  type SolicitudesFetchError,
} from "../../api/solicitudes.ts";
import type { SolicitudDetalleAccion } from "./solicitudDetalleTypes.ts";
import { SD_COPY } from "./solicitudDetalleCopy.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

export type SolicitudDetalleDecisionPayload = {
  solicitudId: number;
  accion: SolicitudDetalleAccion;
  comentario_interno: string | null;
};

function isFetchError(e: unknown): e is SolicitudesFetchError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    "detail" in e &&
    typeof (e as SolicitudesFetchError).detail === "string"
  );
}

/**
 * Persiste aprobación o rechazo vía API. «Cambios» no tiene endpoint en backend aún.
 */
export async function ejecutarDecisionSolicitudSubmit(
  payload: SolicitudDetalleDecisionPayload,
  filaActual: RhSolicitudTablaFila,
): Promise<{ ok: true; fila: RhSolicitudTablaFila } | { ok: false; message: string }> {
  if (filaActual.id !== payload.solicitudId) {
    return { ok: false, message: "Identificador inconsistente." };
  }
  if (filaActual.estado !== "pending") {
    return { ok: false, message: "La solicitud ya no está pendiente." };
  }

  const nivel = filaActual.nivel_actual ?? 1;
  const comentario = payload.comentario_interno;

  try {
    const item =
      payload.accion === "aprobar"
        ? await approveSolicitud(payload.solicitudId, { nivel, comentario })
        : payload.accion === "cambios"
          ? await requestChangesSolicitud(payload.solicitudId, {
              nivel,
              comentario: (comentario ?? "").trim(),
            })
        : await rejectSolicitud(payload.solicitudId, { nivel, comentario });
    return { ok: true, fila: mapSolicitudApiItemToRhTablaFila(item) };
  } catch (e: unknown) {
    if (isFetchError(e)) {
      return { ok: false, message: e.detail || SD_COPY.errorProcesar };
    }
    return { ok: false, message: SD_COPY.errorProcesar };
  }
}
