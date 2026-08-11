import { describe, expect, it } from "vitest";

import { normalizarPageSizeReporte } from "./comedor.ts";

describe("normalizarPageSizeReporte", () => {
  it("respeta los tamaños que el backend acepta", () => {
    for (const n of [5, 10, 50, 500, 1000]) {
      expect(normalizarPageSizeReporte(n)).toBe(n);
    }
  });

  it("deja pasar el lote grande de la descarga del tablero", () => {
    // El bug: aquí se recortaba a 50 y el tablero se quedaba con 50 de 12 855 filas.
    expect(normalizarPageSizeReporte(1000)).toBe(1000);
  });

  it("baja al permitido inmediato inferior en vez de mandar un valor que da 409", () => {
    expect(normalizarPageSizeReporte(137)).toBe(50);
    expect(normalizarPageSizeReporte(999)).toBe(500);
    expect(normalizarPageSizeReporte(5000)).toBe(1000);
  });

  it("nunca baja de la página mínima", () => {
    expect(normalizarPageSizeReporte(1)).toBe(5);
    expect(normalizarPageSizeReporte(0)).toBe(5);
    expect(normalizarPageSizeReporte(-10)).toBe(5);
  });
});
