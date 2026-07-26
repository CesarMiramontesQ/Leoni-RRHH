import { describe, expect, it } from "vitest";

import { hashParamNumero, hashParamTexto, hashSinParams, hashSinQuery } from "./hashQuery.ts";

describe("hashSinQuery", () => {
  it("quita el query string del hash", () => {
    expect(hashSinQuery("#/operaciones?area_id=3")).toBe("#/operaciones");
    expect(hashSinQuery("#/talento/dashboard")).toBe("#/talento/dashboard");
    expect(hashSinQuery("")).toBe("");
  });
});

describe("hashParamNumero", () => {
  it("lee un parámetro numérico del deep-link", () => {
    expect(hashParamNumero("area_id", "#/operaciones?area_id=3")).toBe(3);
    expect(hashParamNumero("area_id", "#/operaciones?otro=1&area_id=42")).toBe(42);
  });

  it("devuelve null si falta, no es número o no es positivo", () => {
    expect(hashParamNumero("area_id", "#/operaciones")).toBeNull();
    expect(hashParamNumero("area_id", "#/operaciones?area_id=")).toBeNull();
    expect(hashParamNumero("area_id", "#/operaciones?area_id=abc")).toBeNull();
    expect(hashParamNumero("area_id", "#/operaciones?area_id=0")).toBeNull();
    expect(hashParamNumero("area_id", "#/operaciones?area_id=-3")).toBeNull();
  });
});

describe("hashParamTexto", () => {
  it("lee texto del query del hash", () => {
    expect(hashParamTexto("wizard", "#/pdi-gestion?wizard=1")).toBe("1");
    expect(hashParamTexto("accion", "#/pdi-gestion?accion=Desarrollar%3A%20X")).toBe("Desarrollar: X");
  });

  it("devuelve null si falta o vacío", () => {
    expect(hashParamTexto("wizard", "#/pdi-gestion")).toBeNull();
    expect(hashParamTexto("wizard", "#/pdi-gestion?wizard=")).toBeNull();
  });
});

describe("hashSinParams", () => {
  it("elimina claves y conserva el resto", () => {
    expect(
      hashSinParams(
        ["wizard", "empleado_id"],
        "#/pdi-gestion?area_id=3&wizard=1&empleado_id=9",
      ),
    ).toBe("#/pdi-gestion?area_id=3");
  });

  it("deja solo la ruta si no quedan params", () => {
    expect(hashSinParams(["wizard"], "#/pdi-gestion?wizard=1")).toBe("#/pdi-gestion");
  });
});
