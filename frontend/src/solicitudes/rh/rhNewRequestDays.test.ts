import { describe, expect, it } from "vitest";
import {
  calcularDiasLaboralesInclusive,
  calcularDiasVacacionesSolicitados,
  esRangoMatrimonioValido,
  rangoIncluyeFinDeSemana,
  sumarDiasIso,
} from "./rhNewRequestDays.ts";

describe("rhNewRequestDays — vacaciones administrativas", () => {
  it("detecta fin de semana en el rango", () => {
    expect(rangoIncluyeFinDeSemana("2026-05-04", "2026-05-08")).toBe(false);
    expect(rangoIncluyeFinDeSemana("2026-05-08", "2026-05-11")).toBe(true);
  });

  it("cuenta solo días laborales para administrativo", () => {
    expect(calcularDiasLaboralesInclusive("2026-05-04", "2026-05-08")).toBe(5);
    expect(calcularDiasVacacionesSolicitados("2026-05-04", "2026-05-08", true)).toBe(5);
    expect(calcularDiasVacacionesSolicitados("2026-05-08", "2026-05-11", true)).toBe(0);
  });

  it("rechaza Home Office en fin de semana", () => {
    expect(rangoIncluyeFinDeSemana("2026-06-06", "2026-06-06")).toBe(true);
    expect(rangoIncluyeFinDeSemana("2026-06-02", "2026-06-02")).toBe(false);
  });

  it("matrimonio exige exactamente 2 días consecutivos", () => {
    expect(esRangoMatrimonioValido("2026-05-04", "2026-05-05")).toBe(true);
    expect(esRangoMatrimonioValido("2026-05-04", "2026-05-04")).toBe(false);
    expect(esRangoMatrimonioValido("2026-05-04", "2026-05-06")).toBe(false);
    expect(sumarDiasIso("2026-05-04", 1)).toBe("2026-05-05");
  });
});
