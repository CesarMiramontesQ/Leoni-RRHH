import { describe, expect, it } from "vitest";

import { hashParamNumero, hashSinQuery } from "./hashQuery.ts";

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
