/**
 * Envío de nueva solicitud desde el modal RH (en nombre de otro empleado).
 * Actualmente la API crea para el usuario autenticado.
 */

import { createSolicitud, type SolicitudesFetchError } from "../../api/solicitudes.ts";

export type RhNuevaSolicitudPayload = {
  empleado_id: number;
  tipo: "vacaciones" | "home_office";
  fecha_inicio: string;
  fecha_fin: string;
  comentarios: string | null;
};

/**
 * Crea una solicitud real vía API.
 * Nota: `empleado_id` se mantiene por compatibilidad de UI, pero el backend usa el usuario autenticado.
 */
export async function enviarRhNuevaSolicitud(payload: RhNuevaSolicitudPayload): Promise<void> {
  await createSolicitud({
    tipo: payload.tipo,
    fecha_inicio: payload.fecha_inicio,
    fecha_fin: payload.fecha_fin,
    comentarios: payload.comentarios,
  });
}

export function isSolicitudesFetchError(error: unknown): error is SolicitudesFetchError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    "detail" in error &&
    typeof (error as SolicitudesFetchError).detail === "string"
  );
}
