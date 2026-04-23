import { getSolicitudAprobaciones, getSolicitudById } from "../../api/solicitudes.ts";
import type { SolicitudResueltaDetalleVm } from "./solicitudResueltaTypes.ts";
import { mapTablaFilaToSolicitudResuelta } from "./mapTablaFilaToSolicitudResuelta.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

export type FetchSolicitudResueltaDetalleResult =
  | { ok: true; data: SolicitudResueltaDetalleVm }
  | { ok: false; message: string };

/**
 * Carga detalle de solicitud resuelta: fila de tabla + GET solicitud y aprobaciones (historial real).
 */
export async function fetchSolicitudResueltaDetalle(
  solicitudId: number,
  getFilaById: (id: number) => RhSolicitudTablaFila | undefined,
  soloLectura = false,
  sesionEmpleadoDirectoryId?: number | null,
): Promise<FetchSolicitudResueltaDetalleResult> {
  const fila = getFilaById(solicitudId);
  if (!fila) {
    return { ok: false, message: "not_found" };
  }
  const fid = Number.parseInt(fila.empleado_id, 10);
  const sesionEsCreador =
    sesionEmpleadoDirectoryId != null &&
    Number.isFinite(fid) &&
    fid === sesionEmpleadoDirectoryId;
  const baseVm = mapTablaFilaToSolicitudResuelta(fila, { soloLectura, sesionEsCreador });
  if (!baseVm) {
    return { ok: false, message: "not_resolved" };
  }

  const settled = await Promise.allSettled([getSolicitudById(solicitudId), getSolicitudAprobaciones(solicitudId)]);
  const sol = settled[0].status === "fulfilled" ? settled[0].value : undefined;
  const apr = settled[1].status === "fulfilled" ? settled[1].value : undefined;

  if (!sol) {
    return { ok: true, data: baseVm };
  }

  const data = mapTablaFilaToSolicitudResuelta(fila, {
    soloLectura,
    sesionEsCreador,
    solicitudApi: sol,
    aprobaciones: apr ?? [],
  });
  if (!data) {
    return { ok: false, message: "not_resolved" };
  }
  return { ok: true, data };
}
