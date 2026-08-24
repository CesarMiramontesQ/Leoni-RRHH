/**
 * Listado inicial del modal «Asignar comedor»: empleados activos sin comedor en turnos.
 *
 * El endpoint ya trae a todos; el modal no puede pintar cientos de filas de golpe, así que
 * se guardan en memoria, se muestran con tope y la búsqueda filtra esa lista (no el
 * directorio completo) para que la alerta «Ver y asignar» muestre quién falta.
 */
import type {
  ComedorRhEmpleadoBusquedaApi,
  ComedorRhEmpleadoSinComedorApi,
} from "../../api/comedor.ts";
import { filtrarEmpleadosComedor } from "../../comedor/rh/filtrarEmpleadosComedor.ts";
import type { ComedorEmployeeOption } from "../../comedor/rh/types.ts";

export type FiltradoEmpleadosSinComedor = {
  items: ComedorRhEmpleadoBusquedaApi[];
  total: number;
  truncated: boolean;
};

function toNoEmpleado(value: string | number): number {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

export function mapEmpleadosSinComedorABusqueda(
  items: readonly ComedorRhEmpleadoSinComedorApi[],
): ComedorRhEmpleadoBusquedaApi[] {
  return items.map((item) => ({
    empleado_id: item.empleado_id,
    no_empleado: toNoEmpleado(item.no_empleado),
    nombre: item.nombre,
    area: null,
    comedor_id: null,
  }));
}

function aOpcion(empleado: ComedorRhEmpleadoBusquedaApi): ComedorEmployeeOption {
  return {
    id: String(empleado.empleado_id),
    nombre: empleado.nombre,
    numero: String(empleado.no_empleado),
    area: empleado.area ?? "",
    avatarUrl: null,
  };
}

export function filtrarEmpleadosSinComedor(
  empleados: readonly ComedorRhEmpleadoBusquedaApi[],
  query: string,
  limite: number,
): FiltradoEmpleadosSinComedor {
  const tope = Math.max(0, limite);
  const coincidencias = filtrarEmpleadosComedor(
    empleados.map(aOpcion),
    query,
  );
  const ids = new Set(coincidencias.map((opcion) => opcion.id));
  const filtrados = empleados.filter((empleado) => ids.has(String(empleado.empleado_id)));
  const items = filtrados.slice(0, tope);
  return {
    items,
    total: filtrados.length,
    truncated: filtrados.length > tope,
  };
}
