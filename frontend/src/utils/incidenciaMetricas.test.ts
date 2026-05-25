import { describe, expect, it } from "vitest";
import { computeIncidenciaMetricas } from "./incidenciaMetricas.ts";

describe("computeIncidenciaMetricas", () => {
  it("suma total y clasifica retardos y faltas", () => {
    const m = computeIncidenciaMetricas({
      retardo: 2,
      tardanza: 1,
      "Falta Injustificada": 3,
      Seguridad: 4,
    });
    expect(m.total).toBe(10);
    expect(m.retardos).toBe(3);
    expect(m.faltasJustificadas).toBe(3);
  });

  it("devuelve ceros con mapa vacío", () => {
    expect(computeIncidenciaMetricas({})).toEqual({
      total: 0,
      retardos: 0,
      faltasJustificadas: 0,
    });
  });

  it("reconoce falta justificada explícita", () => {
    const m = computeIncidenciaMetricas({ "falta justificada": 2, indisciplina: 1 });
    expect(m.faltasJustificadas).toBe(2);
    expect(m.total).toBe(3);
  });
});
