import { describe, expect, it } from "vitest";
import {
  avanzarHastaReunirDias,
  calcularDiasLaboralesInclusive,
  calcularDiasVacacionesSolicitados,
  calcularRangoMatrimonio,
  calcularRangoDefuncion,
  calcularRangoPaternidad,
  esRangoDefuncionValido,
  esRangoMatrimonioValido,
  esRangoPaternidadValido,
  rangoIncluyeFinDeSemana,
  resumirRangoSinDescansos,
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

  it("excluye descansos TRESS del conteo de vacaciones", () => {
    const descansos = new Set(["2026-07-19", "2026-07-20"]);
    expect(
      calcularDiasVacacionesSolicitados("2026-07-18", "2026-07-21", false, descansos),
    ).toBe(2);
    expect(
      calcularDiasVacacionesSolicitados("2026-07-19", "2026-07-20", false, descansos),
    ).toBe(0);
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

  it("defunción: 3 días calendario para no administrativo", () => {
    expect(calcularRangoDefuncion("2026-05-06", false)).toEqual({
      fechaInicio: "2026-05-06",
      fechaFin: "2026-05-08",
    });
    expect(esRangoDefuncionValido("2026-05-06", "2026-05-08", false)).toBe(true);
    expect(esRangoDefuncionValido("2026-05-06", "2026-05-07", false)).toBe(false);
  });

  it("defunción administrativo ajusta días hábiles si cruza fin de semana", () => {
    expect(calcularRangoDefuncion("2026-05-06", true)).toEqual({
      fechaInicio: "2026-05-06",
      fechaFin: "2026-05-08",
    });
    expect(calcularRangoDefuncion("2026-05-07", true)).toEqual({
      fechaInicio: "2026-05-07",
      fechaFin: "2026-05-11",
    });
    expect(calcularRangoDefuncion("2026-05-09", true)).toEqual({
      fechaInicio: "2026-05-11",
      fechaFin: "2026-05-13",
    });
    expect(esRangoDefuncionValido("2026-05-07", "2026-05-11", true)).toBe(true);
  });

  it("paternidad: 7 días hábiles con ajuste si inicio en fin de semana", () => {
    expect(calcularRangoPaternidad("2026-05-04")).toEqual({
      fechaInicio: "2026-05-04",
      fechaFin: "2026-05-12",
    });
    expect(calcularRangoPaternidad("2026-05-09")).toEqual({
      fechaInicio: "2026-05-11",
      fechaFin: "2026-05-19",
    });
    expect(esRangoPaternidadValido("2026-05-04", "2026-05-12")).toBe(true);
    expect(esRangoPaternidadValido("2026-05-04", "2026-05-11")).toBe(false);
  });

  it("lunes + descanso martes-miércoles produce fin jueves para 2 días efectivos", () => {
    const descansos = new Set(["2026-07-14", "2026-07-15"]);
    expect(avanzarHastaReunirDias("2026-07-13", 2, descansos)).toEqual([
      "2026-07-13",
      "2026-07-16",
    ]);
    expect(calcularRangoMatrimonio("2026-07-13", descansos)).toEqual({
      fechaInicio: "2026-07-13",
      fechaFin: "2026-07-16",
    });
  });

  it("rango libre excluye descansos y detecta cuando queda vacío", () => {
    expect(
      resumirRangoSinDescansos(
        "2026-07-13",
        "2026-07-16",
        new Set(["2026-07-14", "2026-07-15"]),
      ),
    ).toEqual({
      fechasEfectivas: ["2026-07-13", "2026-07-16"],
      fechasExcluidas: ["2026-07-14", "2026-07-15"],
      tramos: [
        { fechaInicio: "2026-07-13", fechaFin: "2026-07-13" },
        { fechaInicio: "2026-07-16", fechaFin: "2026-07-16" },
      ],
    });

    expect(
      resumirRangoSinDescansos(
        "2026-07-14",
        "2026-07-15",
        new Set(["2026-07-14", "2026-07-15"]),
      ).fechasEfectivas,
    ).toEqual([]);
  });
});
