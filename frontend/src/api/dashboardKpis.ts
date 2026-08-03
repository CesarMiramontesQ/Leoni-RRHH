import { fetchWithAuth } from "./http.ts";

const BASE = "/api/v1/dashboard";

/**
 * KPIs personales de nómina (TRESS) del usuario autenticado.
 *
 * Los numéricos son `null` cuando `disponible` es `false` (datos-analisis caída o sin
 * configurar): la UI debe pintar «—», no «0 días».
 */
export type DashboardKpisResponse = {
  disponible: boolean;
  vacaciones_disponibles: number | null;
  vacaciones_tomadas_ciclo: number | null;
  vacaciones_derecho_ciclo: number | null;
  ciclo_aniversario: number | null;
  ciclo_vence: string | null;
  home_office_dias_anio: number | null;
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
