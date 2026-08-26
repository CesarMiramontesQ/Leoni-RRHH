import type { HorasExtraEmpleadoOption } from "../../api/horasExtraSolicitud.ts";
import { normalizeTextoBusquedaEmpleado } from "../../utils/empleadoTextoBusqueda.ts";

/** Caracteres mínimos antes de mostrar coincidencias. */
export const BUSQUEDA_EQUIPO_MIN_CHARS = 2;
/** Tope de coincidencias mostradas; por encima se pide acotar la búsqueda. */
export const BUSQUEDA_EQUIPO_MAX_RESULTADOS = 15;

export type BusquedaEquipoEstado = "minimo" | "ok" | "truncado" | "sin_coincidencias";

export type BusquedaEquipoResultado = {
  items: HorasExtraEmpleadoOption[];
  estado: BusquedaEquipoEstado;
};

/**
 * Filtra en cliente la lista de `/opciones` (el subárbol completo del registrante):
 * nombre sin acentos/mayúsculas, o número de empleado por prefijo.
 */
export function buscarEmpleadosEquipo(
  empleados: readonly HorasExtraEmpleadoOption[],
  consulta: string,
): BusquedaEquipoResultado {
  const q = normalizeTextoBusquedaEmpleado(consulta);
  if (q.length < BUSQUEDA_EQUIPO_MIN_CHARS) return { items: [], estado: "minimo" };

  const esNumero = /^\d+$/.test(q);
  const coincidencias = empleados.filter((e) =>
    esNumero
      ? String(e.no_empleado).startsWith(q)
      : normalizeTextoBusquedaEmpleado(e.nombre).includes(q),
  );
  if (!coincidencias.length) return { items: [], estado: "sin_coincidencias" };
  if (coincidencias.length > BUSQUEDA_EQUIPO_MAX_RESULTADOS) {
    return { items: coincidencias.slice(0, BUSQUEDA_EQUIPO_MAX_RESULTADOS), estado: "truncado" };
  }
  return { items: coincidencias, estado: "ok" };
}
