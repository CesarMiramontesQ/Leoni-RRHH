/**
 * Envío de nueva solicitud desde el modal RH (en nombre de otro empleado).
 * La API actual crea siempre para el usuario autenticado; este adaptador queda listo para un endpoint RH.
 */

export type RhNuevaSolicitudPayload = {
  empleado_id: number;
  tipo: "vacaciones" | "home_office";
  fecha_inicio: string;
  fecha_fin: string;
  comentarios: string | null;
};

const MOCK_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Simula éxito. Integración: POST con `empleado_id` cuando el backend lo exponga.
 */
export async function enviarRhNuevaSolicitudMock(payload: RhNuevaSolicitudPayload): Promise<void> {
  await delay(MOCK_DELAY_MS);
  if (import.meta.env.DEV) {
    console.info("[RH] Nueva solicitud (mock)", payload);
  }
}
