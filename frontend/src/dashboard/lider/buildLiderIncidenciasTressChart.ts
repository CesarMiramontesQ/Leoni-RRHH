/**
 * Tarjeta «Incidencias por colaborador» del dashboard de líder/gerente.
 *
 * La fuente es la página **Incidencias** (`#/faltas-retardos`, caché
 * `levelup_incidencias_tress`), no «Seguridad y Calidad» (`#/incidencias`). El ranking
 * ya viene resuelto por `GET /faltas-retardos/estadisticas`: el servidor agrupa por
 * colaborador y tipo sobre el alcance del rol, así que aquí solo se le da la forma que
 * consume la gráfica.
 */
import {
  empleadoLabelConNumero,
  empleadoLabelCorto,
} from "../../utils/empleadoLabelConNumero.ts";
import type { FaltasRetardosEstadisticasResponse } from "../../api/faltasRetardos.ts";
import type {
  SupervisorIncidenciasChartData,
  SupervisorIncidenciasChartRow,
  SupervisorIncidenciasChartView,
} from "./types.ts";

type EmpleadoConEventos =
  FaltasRetardosEstadisticasResponse["empleados_con_mas_eventos"][number];

/** Arriba de este número de colaboradores la lectura por barras deja de servir. */
const HEATMAP_EMPLOYEE_THRESHOLD = 15;

export type BuildLiderIncidenciasTressChartOptions = {
  /** Empleado a excluir: el bloque es «del equipo», el líder no se cuenta a sí mismo. */
  excludeEmpleadoId: string | null;
  /** `total_eventos` del alcance, antes de recortar al top. */
  totalEventos: number;
  /** `total_colaboradores_con_eventos` del alcance, antes de recortar al top. */
  totalColaboradores: number;
  /** Colaboradores a graficar. */
  maxEmployees: number;
  forceView?: SupervisorIncidenciasChartView;
};

export function buildLiderIncidenciasTressChart(
  empleados: readonly EmpleadoConEventos[],
  options: BuildLiderIncidenciasTressChartOptions,
): SupervisorIncidenciasChartData {
  const { excludeEmpleadoId, maxEmployees } = options;

  const propios = empleados.filter(
    (e) => excludeEmpleadoId != null && String(e.empleado_id) === excludeEmpleadoId,
  );
  const ajenos = empleados.filter((e) => !propios.includes(e));

  // Los totales llegan calculados sobre todo el alcance, que incluye al líder. Solo se
  // le puede descontar lo que asome en el top pedido; si quedó fuera, su aporte es menor
  // que el del último visible y no hay forma de restarlo sin otra consulta.
  const eventosPropios = propios.reduce((n, e) => n + Math.max(0, e.total), 0);
  const totalIncidencias = Math.max(0, options.totalEventos - eventosPropios);
  const totalColaboradores = Math.max(0, options.totalColaboradores - propios.length);

  const rows: SupervisorIncidenciasChartRow[] = ajenos
    .map((e) => {
      const byTipo: Record<string, number> = {};
      let total = 0;
      for (const { tipo, total: n } of e.por_tipo) {
        if (n <= 0) continue;
        byTipo[tipo] = (byTipo[tipo] ?? 0) + n;
        total += n;
      }
      const nombre = (e.nombre ?? "").trim() || `Empleado ${e.empleado_id}`;
      const noEmpleado = e.no_empleado?.trim() || null;
      return {
        empleado_id: String(e.empleado_id),
        no_empleado: noEmpleado,
        empleado_nombre: empleadoLabelConNumero(nombre, noEmpleado),
        empleado_nombre_corto: empleadoLabelCorto(nombre, noEmpleado),
        _nombreOrden: nombre,
        total,
        byTipo,
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || a._nombreOrden.localeCompare(b._nombreOrden, "es"))
    .slice(0, Math.max(0, maxEmployees))
    .map(({ _nombreOrden, ...row }) => row);

  const tipos = Array.from(new Set(rows.flatMap((row) => Object.keys(row.byTipo)))).sort(
    (a, b) => a.localeCompare(b, "es"),
  );

  const view: SupervisorIncidenciasChartView =
    options.forceView ?? (rows.length > HEATMAP_EMPLOYEE_THRESHOLD ? "heatmap" : "bars");

  return {
    rows,
    tipos,
    view,
    total_incidencias: totalIncidencias,
    total_colaboradores: totalColaboradores,
    top_n: maxEmployees,
  };
}
