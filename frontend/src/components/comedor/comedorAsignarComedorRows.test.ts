import { describe, expect, it } from "vitest";
import {
  filtrarEmpleadosSinComedor,
  mapEmpleadosSinComedorABusqueda,
} from "./comedorAsignarComedorRows.ts";
import type { ComedorRhEmpleadoSinComedorApi } from "../../api/comedor.ts";

function item(
  id: number,
  nombre: string,
  noEmpleado: number,
): ComedorRhEmpleadoSinComedorApi {
  return { empleado_id: id, nombre, no_empleado: noEmpleado };
}

describe("mapEmpleadosSinComedorABusqueda", () => {
  it("convierte el listado de sin comedor en filas de búsqueda, sin comedor asignado", () => {
    const rows = mapEmpleadosSinComedorABusqueda([
      item(10, "ANA LOPEZ", 553),
      item(11, "JOSE RAMIREZ", 1819),
    ]);
    expect(rows).toEqual([
      {
        empleado_id: 10,
        no_empleado: 553,
        nombre: "ANA LOPEZ",
        area: null,
        comedor_id: null,
      },
      {
        empleado_id: 11,
        no_empleado: 1819,
        nombre: "JOSE RAMIREZ",
        area: null,
        comedor_id: null,
      },
    ]);
  });
});

describe("filtrarEmpleadosSinComedor", () => {
  const pendientes = mapEmpleadosSinComedorABusqueda([
    item(10, "ANA LÓPEZ", 553),
    item(11, "JOSÉ RAMÍREZ", 1819),
    item(12, "LUIS COLMENERO", 3723),
  ]);

  it("sin búsqueda muestra a todos los pendientes, con tope", () => {
    const r = filtrarEmpleadosSinComedor(pendientes, "", 2);
    expect(r.total).toBe(3);
    expect(r.items.map((e) => e.empleado_id)).toEqual([10, 11]);
    expect(r.truncated).toBe(true);
  });

  it("filtra por nombre o número entre los que no tienen comedor", () => {
    const porNombre = filtrarEmpleadosSinComedor(pendientes, "ramirez", 25);
    expect(porNombre.items.map((e) => e.empleado_id)).toEqual([11]);
    expect(porNombre.truncated).toBe(false);

    const porNumero = filtrarEmpleadosSinComedor(pendientes, "37", 25);
    expect(porNumero.items.map((e) => e.empleado_id)).toEqual([12]);
  });
});
