import { describe, expect, it } from "vitest";
import { buildFaltasRetardosTendenciaPorTipo } from "./buildFaltasRetardosTendenciaPorTipo.ts";

describe("buildFaltasRetardosTendenciaPorTipo", () => {
  it("construye series por tipo alineadas al eje de periodos", () => {
    const chart = buildFaltasRetardosTendenciaPorTipo(
      [
        { periodo: "2026-05", tipo: "retardo", total: 2 },
        { periodo: "2026-06", tipo: "retardo", total: 1 },
        { periodo: "2026-06", tipo: "falta_injustificada", total: 3 },
      ],
      ["2026-05", "2026-06"],
      "mes",
    );
    expect(chart?.series).toHaveLength(2);
    expect(chart?.series.find((s) => s.tipo === "retardo")?.valores).toEqual([2, 1]);
    expect(chart?.series.find((s) => s.tipo === "falta_injustificada")?.valores).toEqual([0, 3]);
  });

  it("omite las vacaciones: aplastan la escala del resto de tipos", () => {
    const chart = buildFaltasRetardosTendenciaPorTipo(
      [
        { periodo: "2026-06", tipo: "vacaciones", total: 400 },
        { periodo: "2026-06", tipo: "retardo", total: 3 },
      ],
      ["2026-06"],
      "mes",
    );
    expect(chart?.series.map((s) => s.tipo)).toEqual(["retardo"]);
  });

  it("retorna null si solo hay vacaciones", () => {
    expect(
      buildFaltasRetardosTendenciaPorTipo([{ periodo: "2026-06", tipo: "vacaciones", total: 5 }], ["2026-06"], "mes"),
    ).toBeNull();
  });

  it("retorna null sin datos en el periodo", () => {
    expect(buildFaltasRetardosTendenciaPorTipo([], ["2026-06"], "mes")).toBeNull();
  });
});
