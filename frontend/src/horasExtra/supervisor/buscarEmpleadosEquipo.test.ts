import { describe, expect, it } from "vitest";

import type { HorasExtraEmpleadoOption } from "../../api/horasExtraSolicitud.ts";
import {
  BUSQUEDA_EQUIPO_MAX_RESULTADOS,
  BUSQUEDA_EQUIPO_MIN_CHARS,
  buscarEmpleadosEquipo,
} from "./buscarEmpleadosEquipo.ts";

function emp(id: number, nombre: string, no_empleado: string): HorasExtraEmpleadoOption {
  return {
    id,
    no_empleado,
    nombre,
    centrocosto_id: null,
    area_id: null,
    subarea_id: null,
    area_descripcion: null,
    centrocosto_descripcion: null,
    turno: null,
  };
}

const EQUIPO = [
  emp(1, "José Pérez López", "1144"),
  emp(2, "Maria Perez", "2201"),
  emp(3, "Juan Ramírez", "1150"),
  emp(4, "Ana Torres", "3001"),
];

describe("buscarEmpleadosEquipo", () => {
  it("exige el mínimo de caracteres antes de buscar", () => {
    expect(BUSQUEDA_EQUIPO_MIN_CHARS).toBe(2);
    expect(buscarEmpleadosEquipo(EQUIPO, "j")).toEqual({ items: [], estado: "minimo" });
    expect(buscarEmpleadosEquipo(EQUIPO, "  ")).toEqual({ items: [], estado: "minimo" });
  });

  it("coincide por nombre ignorando acentos y mayúsculas", () => {
    const r = buscarEmpleadosEquipo(EQUIPO, "PEREZ");
    expect(r.estado).toBe("ok");
    expect(r.items.map((e) => e.id)).toEqual([1, 2]);
    expect(buscarEmpleadosEquipo(EQUIPO, "ramirez").items.map((e) => e.id)).toEqual([3]);
  });

  it("coincide por prefijo del número de empleado", () => {
    expect(buscarEmpleadosEquipo(EQUIPO, "11").items.map((e) => e.id)).toEqual([1, 3]);
    expect(buscarEmpleadosEquipo(EQUIPO, "1144").items.map((e) => e.id)).toEqual([1]);
    // "44" no es prefijo de 1144
    expect(buscarEmpleadosEquipo(EQUIPO, "44")).toEqual({ items: [], estado: "sin_coincidencias" });
  });

  it("acota a un tope y avisa que hay más", () => {
    const muchos = Array.from({ length: BUSQUEDA_EQUIPO_MAX_RESULTADOS + 5 }, (_, i) =>
      emp(100 + i, `Operador ${i}`, String(5000 + i)),
    );
    const r = buscarEmpleadosEquipo(muchos, "operador");
    expect(r.items).toHaveLength(BUSQUEDA_EQUIPO_MAX_RESULTADOS);
    expect(r.estado).toBe("truncado");
  });
});
