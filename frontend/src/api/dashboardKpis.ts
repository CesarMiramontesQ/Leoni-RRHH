import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/dashboard";

/**
 * KPIs personales de nómina del usuario autenticado, desde las cachés en Bono.
 *
 * Los de vacaciones son `null` cuando `disponible` es `false` (empleado sin saldo
 * sincronizado): la UI debe pintar «—», no «0 días».
 *
 * `retardos_anio` **no** sigue a `disponible`: llega aunque el saldo falte. `null` ahí
 * significa que falló su lectura; sin retardos vale 0.
 */
export type DashboardKpisResponse = {
  disponible: boolean;
  vacaciones_disponibles: number | null;
  vacaciones_tomadas_ciclo: number | null;
  vacaciones_derecho_ciclo: number | null;
  ciclo_aniversario: number | null;
  ciclo_vence: string | null;
  home_office_dias_anio: number | null;
  retardos_anio: number | null;
  anio: number;
};

/** `null` si la petición falla: el dashboard se dibuja igual, con los KPIs en «—». */
export async function fetchDashboardKpis(): Promise<DashboardKpisResponse | null> {
  try {
    const res = await fetchWithAuth(`${BASE}/mis-kpis`);
    if (!res.ok) return null;
    return (await res.json()) as DashboardKpisResponse;
  } catch {
    return null;
  }
}
