import { describe, expect, it } from "vitest";
import { aggregateEmpleadosRetardosTop } from "./aggregateEmpleadosRetardosTop.ts";

describe("aggregateEmpleadosRetardosTop", () => {
  it("ordena por total descendente y limita a 5", () => {
    const rows = Array.from({ length: 7 }, (_, i) => ({
      empleado_id: i + 1,
      no_empleado: `E${i + 1}`,
      nombre: `Empleado ${i + 1}`,
      total: i + 1,
    }));
    const ranking = aggregateEmpleadosRetardosTop(rows);
    expect(ranking).toHaveLength(5);
    expect(ranking[0]).toEqual({ label: "Empleado 7", total: 7 });
    expect(ranking[4]).toEqual({ label: "Empleado 3", total: 3 });
  });

  it("excluye empleados sin retardos y usa no_empleado si falta nombre", () => {
    const ranking = aggregateEmpleadosRetardosTop([
      { empleado_id: 1, no_empleado: "1001", nombre: "Ana López", total: 3 },
      { empleado_id: 2, no_empleado: "1002", nombre: null, total: 2 },
      { empleado_id: 3, no_empleado: null, nombre: null, total: 0 },
    ]);
    expect(ranking).toEqual([
      { label: "Ana López", total: 3 },
      { label: "1002", total: 2 },
    ]);
  });
});
