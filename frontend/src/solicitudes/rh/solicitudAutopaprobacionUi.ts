import { getAccessTokenPayload, getRolFromAccessToken } from "../../auth/jwt.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

/**
 * Oculta acciones de aprobación/rechazo cuando un supervisor o gerente abre el detalle
 * de una solicitud cuyo solicitante es el mismo usuario en sesión (coherente con API).
 */
export function debeOcultarAccionesAprobacionPorAutopaprobacion(
  fila: RhSolicitudTablaFila,
  rol: string | null,
  idEmpleadoSesion: string | null,
): boolean {
  if (rol !== "supervisor" && rol !== "gerente") return false;
  const sid = (idEmpleadoSesion ?? "").trim();
  if (!sid) return false;
  return fila.empleado_id.trim() === sid;
}

export function debeOcultarAccionesAprobacionPorAutopaprobacionDesdeSesion(
  fila: RhSolicitudTablaFila,
): boolean {
  const payload = getAccessTokenPayload();
  const sub = payload?.sub;
  const idSesion =
    typeof sub === "string" || typeof sub === "number" ? String(sub).trim() : "";
  return debeOcultarAccionesAprobacionPorAutopaprobacion(
    fila,
    getRolFromAccessToken(),
    idSesion || null,
  );
}
