/**
 * Contexto informativo por empleado (vacaciones / HO) para el modal RH.
 */

import { getEmpleadoVacaciones } from "../../api/empleados.ts";

export type RhEmpleadoRequestContext = {
  diasVacacionesDisponibles: number | null;
  /** Texto para la tarjeta informativa en modo Home Office. */
  homeOfficeResumen: string;
};

const HOME_OFFICE_RESUMEN =
  "Las solicitudes de Home Office quedan sujetas a políticas del área y calendario laboral del empleado seleccionado.";

export async function fetchRhEmpleadoRequestContext(
  empleadoId: number | null,
): Promise<RhEmpleadoRequestContext> {
  if (empleadoId == null) {
    return {
      diasVacacionesDisponibles: null,
      homeOfficeResumen: "Selecciona un empleado para ver información de Home Office.",
    };
  }

  const saldo = await getEmpleadoVacaciones(empleadoId);
  return {
    diasVacacionesDisponibles: saldo.dias_disponibles,
    homeOfficeResumen: HOME_OFFICE_RESUMEN,
  };
}
