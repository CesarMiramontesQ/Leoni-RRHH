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

export type EmpleadosDirectoIndirectoAreaRow = {
  label: string;
  directo: number;
  indirecto: number;
};

/** Top N áreas unificadas con conteos directo/indirecto; el resto se agrupa en «Otros». */
export function buildEmpleadosDirectoIndirectoPorAreaComparativo(
  directItems: readonly EmpleadoDistribucionItem[] | undefined,
  indirectItems: readonly EmpleadoDistribucionItem[] | undefined,
): EmpleadosDirectoIndirectoAreaRow[] {
  const byLabel = new Map<string, { directo: number; indirecto: number }>();

  for (const item of directItems ?? []) {
    const entry = byLabel.get(item.label) ?? { directo: 0, indirecto: 0 };
    entry.directo += item.total;
    byLabel.set(item.label, entry);
  }
  for (const item of indirectItems ?? []) {
    const entry = byLabel.get(item.label) ?? { directo: 0, indirecto: 0 };
    entry.indirecto += item.total;
    byLabel.set(item.label, entry);
  }

  const merged = Array.from(byLabel.entries())
    .map(([label, counts]) => ({ label, directo: counts.directo, indirecto: counts.indirecto }))
    .sort(
      (a, b) =>
        b.directo + b.indirecto - (a.directo + a.indirecto) ||
        a.label.localeCompare(b.label, "es"),
    );

  if (merged.length <= AREA_CHART_TOP_N) return merged;

  const top = merged.slice(0, AREA_CHART_TOP_N);
  const rest = merged.slice(AREA_CHART_TOP_N);
  const otrosDirecto = rest.reduce((sum, row) => sum + row.directo, 0);
  const otrosIndirecto = rest.reduce((sum, row) => sum + row.indirecto, 0);
  return [...top, { label: "Otros", directo: otrosDirecto, indirecto: otrosIndirecto }];
}

export function empleadosDirectoIndirectoComparativoTieneDatos(
  rows: readonly EmpleadosDirectoIndirectoAreaRow[],
): boolean {
  return rows.some((row) => row.directo > 0 || row.indirecto > 0);
}
