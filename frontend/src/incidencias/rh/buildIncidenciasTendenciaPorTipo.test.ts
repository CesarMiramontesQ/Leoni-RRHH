import { describe, expect, it } from "vitest";
import { buildIncidenciasTendenciaPorTipo } from "./buildIncidenciasTendenciaPorTipo.ts";

describe("buildIncidenciasTendenciaPorTipo", () => {
  it("agrupa por dia con ceros en dias sin datos", () => {
    const chart = buildIncidenciasTendenciaPorTipo(
      [
        { periodo: "2026-05-19", tipo: "retardo", total: 1 },
        { periodo: "2026-05-21", tipo: "retardo", total: 2 },
      ],
      ["2026-05-19", "2026-05-20", "2026-05-21"],
      "dia",
    );
    expect(chart?.agrupacion).toBe("dia");
    expect(chart?.series[0]?.valores).toEqual([1, 0, 2]);
  });

  it("agrupa por mes y Otros", () => {
    const buckets = [
      { periodo: "2026-01", tipo: "retardo", total: 2 },
      { periodo: "2026-03", tipo: "indisciplina", total: 4 },
      { periodo: "2026-01", tipo: "dano_equipo", total: 1 },
    ];
    const chart = buildIncidenciasTendenciaPorTipo(
      buckets,
      ["2026-01", "2026-02", "2026-03"],
      "mes",
      2,
    );
    expect(chart?.periodos).toEqual(["2026-01", "2026-02", "2026-03"]);
    const otros = chart?.series.find((s) => s.tipo === "Otros");
    expect(otros?.valores).toEqual([1, 0, 0]);
  });
});
