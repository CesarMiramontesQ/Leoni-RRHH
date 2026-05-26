import type { RhIncidenciaTablaFila } from "../../incidencias/rh/types.ts";
import { extraerPrimerNombreApellido } from "../../utils/comedorNombreCorto.ts";
import type {
  SupervisorIncidenciasChartData,
  SupervisorIncidenciasChartRow,
  SupervisorIncidenciasChartView,
} from "./types.ts";

export const SUPERVISOR_INC_CHART_OTROS_TIPO = "otros";
const MAX_TIPOS_VISIBLES = 5;
const HEATMAP_EMPLOYEE_THRESHOLD = 15;

function resolveTipoIncidencia(fila: RhIncidenciaTablaFila): string {
  const raw = fila.tipo_texto?.trim() || fila.tipo?.trim() || "";
  return raw || SUPERVISOR_INC_CHART_OTROS_TIPO;
}

function countTiposGlobally(rows: SupervisorIncidenciasChartRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const [tipo, n] of Object.entries(row.byTipo)) {
      counts.set(tipo, (counts.get(tipo) ?? 0) + n);
    }
  }
  return counts;
}

/** Conserva los tipos más frecuentes; el resto se agrupa en `otros`. */
function collapseTipos(
  rows: SupervisorIncidenciasChartRow[],
  tipos: string[],
): { rows: SupervisorIncidenciasChartRow[]; tipos: string[] } {
  if (tipos.length <= MAX_TIPOS_VISIBLES) return { rows, tipos };

  const global = countTiposGlobally(rows);
  const ranked = [...tipos].sort((a, b) => (global.get(b) ?? 0) - (global.get(a) ?? 0));
  const keep = new Set(ranked.slice(0, MAX_TIPOS_VISIBLES));

  const nextRows = rows.map((row) => {
    const byTipo: Record<string, number> = {};
    let otros = 0;
    for (const [tipo, count] of Object.entries(row.byTipo)) {
      if (keep.has(tipo)) byTipo[tipo] = count;
      else otros += count;
    }
    if (otros > 0) byTipo[SUPERVISOR_INC_CHART_OTROS_TIPO] = otros;
    return { ...row, byTipo };
  });

  const nextTipos = ranked.filter((t) => keep.has(t));
  if (nextRows.some((r) => (r.byTipo[SUPERVISOR_INC_CHART_OTROS_TIPO] ?? 0) > 0)) {
    nextTipos.push(SUPERVISOR_INC_CHART_OTROS_TIPO);
  }

  return { rows: nextRows, tipos: nextTipos };
}

/**
 * Agrupa incidencias visibles para el supervisor por colaborador y tipo.
 * Excluye al propio supervisor (solo colaboradores bajo su mando).
 */
export function buildSupervisorIncidenciasChart(
  filas: readonly RhIncidenciaTablaFila[],
  excludeEmpleadoId: string | null,
): SupervisorIncidenciasChartData {
  const scoped =
    excludeEmpleadoId != null ? filas.filter((f) => f.empleado_id !== excludeEmpleadoId) : [...filas];

  const byEmployee = new Map<string, { nombre: string; byTipo: Map<string, number> }>();

  for (const fila of scoped) {
    const id = fila.empleado_id;
    const nombre = fila.empleado_nombre_raw.trim() || `Empleado ${id}`;
    const tipo = resolveTipoIncidencia(fila);
    let entry = byEmployee.get(id);
    if (!entry) {
      entry = { nombre, byTipo: new Map() };
      byEmployee.set(id, entry);
    }
    entry.byTipo.set(tipo, (entry.byTipo.get(tipo) ?? 0) + 1);
  }

  const tiposRaw = Array.from(
    new Set(Array.from(byEmployee.values()).flatMap((e) => Array.from(e.byTipo.keys()))),
  ).sort((a, b) => a.localeCompare(b, "es"));

  let rows: SupervisorIncidenciasChartRow[] = Array.from(byEmployee.entries())
    .map(([empleado_id, entry]) => {
      const byTipo: Record<string, number> = {};
      let total = 0;
      for (const [tipo, count] of entry.byTipo) {
        byTipo[tipo] = count;
        total += count;
      }
      const nombre = entry.nombre;
      return {
        empleado_id,
        empleado_nombre: nombre,
        empleado_nombre_corto: extraerPrimerNombreApellido(nombre),
        total,
        byTipo,
      };
    })
    .sort(
      (a, b) => b.total - a.total || a.empleado_nombre.localeCompare(b.empleado_nombre, "es"),
    );

  const collapsed = collapseTipos(rows, tiposRaw);
  rows = collapsed.rows;
  const tipos = collapsed.tipos;

  const view: SupervisorIncidenciasChartView =
    rows.length > HEATMAP_EMPLOYEE_THRESHOLD ? "heatmap" : "bars";

  return { rows, tipos, view };
}
