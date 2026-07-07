/**
 * Contexto informativo por empleado (vacaciones / HO) para el modal RH.
 */

import { getEmpleadoHomeOfficeDisponibilidad } from "../../api/empleados.ts";
import { getEmpleadoVacacionesDisponiblesSolicitud } from "../../api/vista360.ts";
import { HOME_OFFICE_RESUMEN_BASE } from "./rhNewRequestDays.ts";

export type RhEmpleadoRequestContext = {
  diasVacacionesDisponibles: number | null;
  /** Texto para la tarjeta informativa en modo Home Office. */
  homeOfficeResumen: string;
  /** null sin empleado o sin fecha de referencia; false si ya hay HO activo en el mes. */
  homeOfficePuedeSolicitarMes: boolean | null;
};

const HOME_OFFICE_RESUMEN_SIN_EMPLEADO =
  "Selecciona un colaborador administrativo para solicitar Home Office.";

export type FetchRhEmpleadoRequestContextOpts = {
  fechaReferencia?: string;
  excluirSolicitudId?: number;
};

export async function fetchRhEmpleadoRequestContext(
  empleadoId: number | null,
  opts: FetchRhEmpleadoRequestContextOpts = {},
): Promise<RhEmpleadoRequestContext> {
  if (empleadoId == null) {
    return {
      diasVacacionesDisponibles: null,
      homeOfficeResumen: HOME_OFFICE_RESUMEN_SIN_EMPLEADO,
      homeOfficePuedeSolicitarMes: null,
    };
  }

  const fechaRef = opts.fechaReferencia?.trim() ?? "";
  // Fuente del saldo = TRESS (datos-analisis) menos comprometidos. Si el servicio externo
  // no responde (503), se deja null → estado "no disponible" (el submit lo bloquea).
  const saldoPromise = getEmpleadoVacacionesDisponiblesSolicitud(empleadoId)
    .then((r) => r.dias_disponibles)
    .catch(() => null);
  const hoPromise =
    fechaRef ?
      getEmpleadoHomeOfficeDisponibilidad(empleadoId, fechaRef, opts.excluirSolicitudId)
    : Promise.resolve(null);

  const [saldo, hoDisp] = await Promise.all([saldoPromise, hoPromise]);
  const puedeMes = hoDisp?.puede_solicitar ?? null;
  let homeOfficeResumen = HOME_OFFICE_RESUMEN_BASE;
  if (puedeMes === false) {
    homeOfficeResumen =
      "Ya hay una solicitud de Home Office activa en el mes seleccionado. Solo se permite un día por mes.";
  }

  return {
    diasVacacionesDisponibles: saldo,
    homeOfficeResumen,
    homeOfficePuedeSolicitarMes: puedeMes,
  };
}
