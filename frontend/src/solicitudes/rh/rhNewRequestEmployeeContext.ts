/**
 * Contexto informativo por empleado (vacaciones / HO) para el modal RH.
 * Sustituir por GET dedicado cuando exista en backend.
 */

export type RhEmpleadoRequestContext = {
  diasVacacionesDisponibles: number | null;
  /** Texto para la tarjeta informativa en modo Home Office. */
  homeOfficeResumen: string;
};

const MOCK_VAC_BY_ID = new Map<number, number>([
  [1, 22],
  [2, 15],
  [3, 8],
  [4, 18],
  [5, 12],
]);

function mockVacacionesDisponibles(empleadoId: number): number {
  if (MOCK_VAC_BY_ID.has(empleadoId)) return MOCK_VAC_BY_ID.get(empleadoId)!;
  const seed = empleadoId % 17;
  return 10 + seed;
}

export async function fetchRhEmpleadoRequestContext(empleadoId: number | null): Promise<RhEmpleadoRequestContext> {
  await new Promise((r) => setTimeout(r, 120));
  if (empleadoId == null) {
    return {
      diasVacacionesDisponibles: null,
      homeOfficeResumen: "Selecciona un empleado para ver información de Home Office.",
    };
  }
  return {
    diasVacacionesDisponibles: mockVacacionesDisponibles(empleadoId),
    homeOfficeResumen:
      "Las solicitudes de Home Office quedan sujetas a políticas del área y calendario laboral del empleado seleccionado.",
  };
}
