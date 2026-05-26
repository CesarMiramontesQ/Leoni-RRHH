import type {
  EmpleadoDistribucionItem,
  EmpleadosClasificacionTipo,
  EmpleadosPorClasificacionAreaSerie,
} from "../../api/usuarios.ts";
import type { SolicitudRankingRow } from "../../solicitudes/rh/computeSolicitudesAnalytics.ts";

const AREA_CHART_TOP_N = 8;

export function buildEmpleadosPorAreaRanking(
  items: readonly EmpleadoDistribucionItem[] | undefined,
): SolicitudRankingRow[] {
  if (!items?.length) return [];
  const sorted = [...items].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
  if (sorted.length <= AREA_CHART_TOP_N) {
    return sorted.map((row) => ({ label: row.label, total: row.total }));
  }
  const top = sorted.slice(0, AREA_CHART_TOP_N);
  const rest = sorted.slice(AREA_CHART_TOP_N);
  const otrosTotal = rest.reduce((sum, row) => sum + row.total, 0);
  return [...top.map((row) => ({ label: row.label, total: row.total })), { label: "Otros", total: otrosTotal }];
}

export function findEmpleadosSeriePorClasificacion(
  series: readonly EmpleadosPorClasificacionAreaSerie[] | undefined,
  tipo: EmpleadosClasificacionTipo,
): EmpleadosPorClasificacionAreaSerie | undefined {
  return series?.find((s) => s.tipo === tipo);
}

export function empleadosPorAreaTieneDatos(ranking: readonly SolicitudRankingRow[]): boolean {
  return ranking.some((row) => row.total > 0);
}
