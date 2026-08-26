import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";
import {
  listPeriodosEnRango,
  tendenciaAgrupacionForRango,
  type RhDashboardTendenciaAgrupacion,
} from "../../dashboard/rh/filterRowsByPeriod.ts";
import { FALTA_RETARDO_TIPOS, labelFaltaRetardoTipo } from "./constants.ts";
import type { FaltasRetardosEstadisticasData } from "./types.ts";
import type { FaltasRetardosEstadisticasParams } from "../../api/faltasRetardos.ts";

export type FaltaRetardoPeriodoTipoBucket = {
  periodo: string;
  tipo: FaltaRetardoTipo;
  total: number;
};

export type FaltaRetardoTendenciaTipoSerie = {
  tipo: FaltaRetardoTipo;
  label: string;
  valores: readonly number[];
};

/**
 * Tipos que la tendencia no grafica. Las vacaciones son la mayoría de los eventos:
 * su línea aplasta la escala del eje Y y el resto queda pegado al cero. Siguen
 * contando en las barras por tipo y por empleado de la misma sección.
 */
export const FALTA_RETARDO_TIPOS_FUERA_DE_TENDENCIA: ReadonlySet<FaltaRetardoTipo> = new Set([
  "vacaciones",
]);

export type FaltaRetardoTendenciaPorTipo = {
  agrupacion: RhDashboardTendenciaAgrupacion;
  periodos: readonly string[];
  series: readonly FaltaRetardoTendenciaTipoSerie[];
};

function isPeriodoMes(periodo: string): boolean {
  return /^\d{4}-\d{2}$/.test(periodo.trim());
}

function isPeriodoDia(periodo: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(periodo.trim());
}

export function buildFaltasRetardosTendenciaPorTipo(
  buckets: readonly FaltaRetardoPeriodoTipoBucket[],
  periodosCanon: readonly string[],
  agrupacion: RhDashboardTendenciaAgrupacion,
): FaltaRetardoTendenciaPorTipo | null {
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

  const grid = new Map<FaltaRetardoTipo, Map<string, number>>();
  for (const { periodo, tipo, total } of buckets) {
    const p = periodo.trim();
    if (!p || total <= 0 || FALTA_RETARDO_TIPOS_FUERA_DE_TENDENCIA.has(tipo)) continue;
    let row = grid.get(tipo);
    if (!row) {
      row = new Map();
      grid.set(tipo, row);
    }
    row.set(p, (row.get(p) ?? 0) + total);
  }

  const series: FaltaRetardoTendenciaTipoSerie[] = FALTA_RETARDO_TIPOS.filter((tipo) => grid.has(tipo)).map(
    (tipo) => ({
      tipo,
      label: labelFaltaRetardoTipo(tipo),
      valores: periodos.map((p) => grid.get(tipo)?.get(p) ?? 0),
    }),
  );

  const hasData = series.some((s) => s.valores.some((v) => v > 0));
  if (!hasData) return null;

  return { agrupacion, periodos, series };
}

export function faltasRetardosTendenciaPorTipoTieneDatos(
  t: FaltaRetardoTendenciaPorTipo | null,
): boolean {
  if (!t) return false;
  return t.series.some((s) => s.valores.some((v) => v > 0));
}

export function buildFaltasRetardosTendenciaFromEstadisticas(
  data: FaltasRetardosEstadisticasData,
  filters: Pick<FaltasRetardosEstadisticasParams, "fecha_inicio" | "fecha_fin">,
): FaltaRetardoTendenciaPorTipo | null {
  const agrupacion =
    data.tendencia_agrupacion ??
    tendenciaAgrupacionForRango(filters.fecha_inicio ?? "", filters.fecha_fin ?? "");
  const fi = (filters.fecha_inicio ?? "").trim();
  const ff = (filters.fecha_fin ?? "").trim();
  const periodosCanon = fi && ff ? listPeriodosEnRango(fi, ff, agrupacion) : [];
  return buildFaltasRetardosTendenciaPorTipo(data.eventos_por_periodo_y_tipo ?? [], periodosCanon, agrupacion);
}
