import type { DescansosLoadState } from "../../solicitudes/rh/descansosEmpleado.ts";

export const MENSAJE_FECHA_EN_DESCANSO =
  "Ese día el colaborador descansa; elige otra fecha.";

/**
 * Error de la fecha de servicio cuando cae en un descanso ya conocido.
 *
 * Solo bloquea con evidencia: un set vacío es «todavía no sé», no «no descansa».
 */
export function errorFechaEnDescanso(
  fecha: string,
  descansos: ReadonlySet<string>,
): string | null {
  if (!fecha) return null;
  return descansos.has(fecha) ? MENSAJE_FECHA_EN_DESCANSO : null;
}

/**
 * Meses que el calendario debe exigir cargados antes de dejar elegir un día.
 *
 * `null` = sin restricción. A diferencia del formulario de solicitudes, aquí el fallo
 * **degrada**: si no se pudieron consultar los descansos (turno sin caché, patrón no
 * interpretable, BD caída) se deja registrar la comida en vez de dejar sin comer a
 * quien nómina tiene mal capturado. Sin beneficiario (`idle`) tampoco hay nada que
 * exigir: el set vacío deshabilitaría el calendario entero.
 */
export function mesesCargadosParaCalendario(
  state: DescansosLoadState,
  meses: ReadonlySet<string>,
): ReadonlySet<string> | null {
  if (state === "error" || state === "idle") return null;
  return meses;
}
