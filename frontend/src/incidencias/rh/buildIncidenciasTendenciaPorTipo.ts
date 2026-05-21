import { labelTipoIncidenciaUi } from "./tipoIncidenciaDisplay.ts";

export type RhDashboardTendenciaAgrupacion = "dia" | "semana" | "mes";

export type IncidenciaPeriodoTipoBucket = {
  periodo: string;
  tipo: string;
  total: number;
};

export type IncidenciaTendenciaTipoSerie = {
  tipo: string;
  label: string;
  valores: readonly number[];
};

export type IncidenciaTendenciaPorTipo = {
  agrupacion: RhDashboardTendenciaAgrupacion;
  periodos: readonly string[];
  series: readonly IncidenciaTendenciaTipoSerie[];
};

export const INC_TENDENCIA_TIPO_TOP_N = 5;
const OTROS_LABEL = "Otros";

function isPeriodoMes(periodo: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodo.trim());
}

function isPeriodoDia(periodo: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(periodo.trim());
}

function normTipo(tipo: string): string {
  const t = tipo.trim();
  return t.length > 0 ? t : "(sin tipo)";
}

/**
 * Construye datasets alineados a `periodosCanon` del rango del dashboard.
 * Top N tipos por volumen; el resto se agrupa en «Otros».
 */
export function buildIncidenciasTendenciaPorTipo(
  buckets: readonly IncidenciaPeriodoTipoBucket[],
  periodosCanon: readonly string[],
  agrupacion: RhDashboardTendenciaAgrupacion,
  topN = INC_TENDENCIA_TIPO_TOP_N,
): IncidenciaTendenciaPorTipo | null {
  const periodosFromBuckets = [
    ...new Set(
      buckets
        .map((b) => b.periodo.trim())
        .filter((p) =>
          agrupacion === "mes" ? isPeriodoMes(p) : agrupacion === "dia" ? isPeriodoDia(p) : p.length >= 10,
        ),
    ),
  ].sort();
  const periodos = periodosCanon.length > 0 ? [...periodosCanon] : periodosFromBuckets;
  if (periodos.length === 0) return null;

  const tipoTotals = new Map<string, number>();
  const grid = new Map<string, Map<string, number>>();

  for (const { periodo, tipo, total } of buckets) {
    const p = periodo.trim();
    if (!p) continue;
    const t = normTipo(tipo);
    tipoTotals.set(t, (tipoTotals.get(t) ?? 0) + total);
    let row = grid.get(t);
    if (!row) {
      row = new Map();
      grid.set(t, row);
    }
    row.set(p, (row.get(p) ?? 0) + total);
  }

  const topTipos = [...tipoTotals.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, topN)
    .map(([t]) => t);
  const topSet = new Set(topTipos);

  const series: IncidenciaTendenciaTipoSerie[] = topTipos.map((tipo) => ({
    tipo,
    label: labelTipoIncidenciaUi(tipo),
    valores: periodos.map((p) => grid.get(tipo)?.get(p) ?? 0),
  }));

  const otrosTipos = [...tipoTotals.keys()].filter((t) => !topSet.has(t));
  if (otrosTipos.length > 0) {
    series.push({
      tipo: OTROS_LABEL,
      label: OTROS_LABEL,
      valores: periodos.map((p) =>
        otrosTipos.reduce((s, t) => s + (grid.get(t)?.get(p) ?? 0), 0),
      ),
    });
  }

  const hasData = series.some((s) => s.valores.some((v) => v > 0));
  if (!hasData) return null;

  return { agrupacion, periodos, series };
}

export function tendenciaPorTipoTieneDatos(t: IncidenciaTendenciaPorTipo | null): boolean {
  if (!t) return false;
  return t.series.some((s) => s.valores.some((v) => v > 0));
}
