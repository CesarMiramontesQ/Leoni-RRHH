import { describe, expect, it } from "vitest";
import { rangoInicialMetricas } from "./rangoInicialMetricas.ts";

describe("rangoInicialMetricas", () => {
  it("va del 1 de enero del año en curso a hoy", () => {
    expect(rangoInicialMetricas(new Date(2026, 7, 18))).toEqual({
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-08-18",
    });
  });

  it("el 1 de enero el rango es ese único día, no queda invertido", () => {
    expect(rangoInicialMetricas(new Date(2026, 0, 1))).toEqual({
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-01-01",
    });
  });

  it("usa la fecha local, no la UTC", () => {
    // 23:30 del 31 de diciembre en México ya es 1 de enero en UTC: con `toISOString`
    // el rango saltaría de año y la página abriría vacía.
    expect(rangoInicialMetricas(new Date(2026, 11, 31, 23, 30))).toEqual({
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-12-31",
    });
  });
});
