import { describe, expect, it } from "vitest";
import {
  buildEmpleadosDirectoIndirectoPorAreaComparativo,
  buildEmpleadosPorAreaRanking,
  findEmpleadosSeriePorClasificacion,
} from "./buildEmpleadosDashboardCharts.ts";

describe("buildEmpleadosDashboardCharts", () => {
  it("agrupa áreas sobrantes en Otros", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      label: `Área ${i}`,
      total: 10 - i,
    }));
    const ranking = buildEmpleadosPorAreaRanking(items);
    expect(ranking).toHaveLength(9);
    expect(ranking[8]?.label).toBe("Otros");
    expect(ranking[8]?.total).toBe(3);
  });

  it("combina directos e indirectos por área con top N y Otros", () => {
    const directItems = Array.from({ length: 6 }, (_, i) => ({
      label: `Área ${i}`,
      total: 10 - i,
    }));
    const indirectItems = [
      { label: "Área 0", total: 3 },
      { label: "Área extra", total: 7 },
    ];
    const rows = buildEmpleadosDirectoIndirectoPorAreaComparativo(directItems, indirectItems);
    expect(rows.find((r) => r.label === "Área 0")).toEqual({ label: "Área 0", directo: 10, indirecto: 3 });
    expect(rows.find((r) => r.label === "Área extra")).toEqual({
      label: "Área extra",
      directo: 0,
      indirecto: 7,
    });
  });

  it("localiza serie por tipo de clasificación", () => {
    const series = [
      {
        tipo: "directo" as const,
        clasificacion_id: 1,
        clasificacion_descripcion: "Directo",
        por_area: [{ label: "Producción", total: 5 }],
      },
    ];
    expect(findEmpleadosSeriePorClasificacion(series, "directo")?.por_area[0]?.total).toBe(5);
    expect(findEmpleadosSeriePorClasificacion(series, "indirecto")).toBeUndefined();
  });
});
