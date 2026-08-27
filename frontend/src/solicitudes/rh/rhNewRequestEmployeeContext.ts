/**
 * Contexto informativo por empleado (vacaciones / HO) para el modal RH.
 */

import { getEmpleadoHomeOfficeDisponibilidad } from "../../api/empleados.ts";
import { getEmpleadoVacacionesDisponiblesSolicitud } from "../../api/vista360.ts";
import { HOME_OFFICE_RESUMEN_BASE, MENSAJE_HOME_OFFICE_MES_LIMITE } from "./rhNewRequestDays.ts";

export type RhEmpleadoRequestContext = {
  diasVacacionesDisponibles: number | null;
  /** Texto para la tarjeta informativa en modo Home Office. */
  homeOfficeResumen: string;
  /** null sin empleado; false si ya hay HO activo en el periodo de la regla del área. */
  homeOfficePuedeSolicitarMes: boolean | null;
  /**
   * Elegibilidad de HO (Administrativo + área con regla activa), resuelta por el backend.
   * null sin empleado o si la consulta falló. Gobierna si el tipo HO se ofrece.
   */
  homeOfficeElegible: boolean | null;
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
      homeOfficeElegible: null,
    };
  }

  // Sin fecha aún (el usuario no eligió tipo/fecha) se consulta con hoy: lo que importa
  // en ese momento es `elegible`, que decide si el tipo HO se ofrece siquiera.
  const fechaRef =
    opts.fechaReferencia?.trim() || new Date().toLocaleDateString("sv-SE");
  // Fuente del saldo = TRESS (datos-analisis) menos comprometidos. Si el servicio externo
  // no responde (503), se deja null → estado "no disponible" (el submit lo bloquea).
  const saldoPromise = getEmpleadoVacacionesDisponiblesSolicitud(empleadoId)
    .then((r) => r.dias_disponibles)
    .catch(() => null);
  const hoPromise = getEmpleadoHomeOfficeDisponibilidad(
    empleadoId,
    fechaRef,
    opts.excluirSolicitudId,
  ).catch(() => null);

  const [saldo, hoDisp] = await Promise.all([saldoPromise, hoPromise]);
  const elegible = hoDisp?.elegible ?? null;
  const puedeMes = hoDisp?.puede_solicitar ?? null;
  let homeOfficeResumen = HOME_OFFICE_RESUMEN_BASE;
  if (elegible === true && puedeMes === false) {
    homeOfficeResumen = MENSAJE_HOME_OFFICE_MES_LIMITE;
  }

  return {
    diasVacacionesDisponibles: saldo,
    homeOfficeResumen,
    homeOfficePuedeSolicitarMes: puedeMes,
    homeOfficeElegible: elegible,
  };
}
