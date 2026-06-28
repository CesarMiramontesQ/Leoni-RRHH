import { describe, expect, it } from "vitest";
import {
  calcularDiasLaboralesInclusive,
  calcularDiasVacacionesSolicitados,
  rangoIncluyeFinDeSemana,
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
});
