import { describe, expect, it } from "vitest";
import { esEmpleadoAdministrativo } from "./empleadoClasificacion.ts";

describe("esEmpleadoAdministrativo", () => {
  it("acepta código A y texto Administrativo", () => {
    expect(
      esEmpleadoAdministrativo({
        clasificacion_id: 1,
        descripcion: "A",
        significado: "Administrativo",
        estatus_id: 1,
      }),
    ).toBe(true);
    expect(
      esEmpleadoAdministrativo({
        clasificacion_id: 2,
        descripcion: "Administrativo",
        significado: null,
        estatus_id: 1,
      }),
    ).toBe(true);
  });

  it("rechaza directo, indirecto o sin clasificación", () => {
    expect(
      esEmpleadoAdministrativo({
        clasificacion_id: 3,
        descripcion: "D",
        significado: "Directo",
        estatus_id: 1,
      }),
    ).toBe(false);
    expect(esEmpleadoAdministrativo(null)).toBe(false);
  });
});
