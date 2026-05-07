/**
 * Envío de nueva solicitud desde el modal (propia o en nombre de otro colaborador autorizado).
 */

import { createSolicitud, type SolicitudesFetchError } from "../../api/solicitudes.ts";

export type RhNuevaSolicitudPayload = {
  empleado_id: number;
  tipo:
    | "vacaciones"
    | "home_office"
    | "matrimonio"
    | "incapacidad_interna"
    | "defuncion"
    | "paternidad"
    | "permiso_sin_goce_sueldo";
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string | null;
  comentarios: string | null;
};

/** Crea la solicitud vía API con `empleado_id` como titular. */
export async function enviarRhNuevaSolicitud(payload: RhNuevaSolicitudPayload): Promise<void> {
  await createSolicitud({
    tipo: payload.tipo,
    fecha_inicio: payload.fecha_inicio,
    fecha_fin: payload.fecha_fin,
    motivo: payload.motivo,
    comentarios: payload.comentarios,
    empleado_id: payload.empleado_id,
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
