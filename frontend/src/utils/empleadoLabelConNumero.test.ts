import { describe, expect, it } from "vitest";
import { empleadoLabelConNumero, empleadoLabelCorto } from "./empleadoLabelConNumero.ts";

describe("empleadoLabelConNumero", () => {
  it("combina nombre y número entre paréntesis", () => {
    expect(empleadoLabelConNumero("Ana López", "1234")).toBe("Ana López (1234)");
    expect(empleadoLabelConNumero("Ana López", 1234)).toBe("Ana López (1234)");
  });

  it("devuelve solo el número cuando falta el nombre", () => {
    expect(empleadoLabelConNumero(null, "1234")).toBe("1234");
    expect(empleadoLabelConNumero("   ", 1234)).toBe("1234");
  });

  it("devuelve solo el nombre cuando falta el número", () => {
    expect(empleadoLabelConNumero("Ana López", null)).toBe("Ana López");
    expect(empleadoLabelConNumero("Ana López", "  ")).toBe("Ana López");
  });

  it("cae a 'Sin nombre' cuando no hay datos", () => {
    expect(empleadoLabelConNumero(null, null)).toBe("Sin nombre");
    expect(empleadoLabelConNumero("", undefined)).toBe("Sin nombre");
  });
});

describe("empleadoLabelCorto", () => {
  it("reduce 'APELLIDOS, NOMBRES' a nombre corto con número", () => {
    expect(empleadoLabelCorto("PÉREZ GARCÍA, JUAN CARLOS", "5")).toBe("Juan Pérez (5)");
    expect(empleadoLabelCorto("LÓPEZ, ANA MARÍA", 1002)).toBe("Ana López (1002)");
  });

  it("devuelve solo el número cuando falta el nombre", () => {
    expect(empleadoLabelCorto(null, "1002")).toBe("1002");
    expect(empleadoLabelCorto("   ", 1002)).toBe("1002");
  });

  it("mantiene nombres sin coma tomando los dos primeros tokens", () => {
    expect(empleadoLabelCorto("Ana López", "1001")).toBe("Ana López (1001)");
  });
});
