import { describe, expect, it } from "vitest";
import {
  buildAsistenciaDiariaSerie,
  mapRegistrosFuturosPorSemana,
} from "./buildRhDashboardComedorCharts.ts";

describe("buildRhDashboardComedorCharts", () => {
  it("calcula porcentaje de asistencia por día en el periodo", () => {
    const serie = buildAsistenciaDiariaSerie(
      [
        { fecha: "2026-05-20", caseras: 2, saludables: 0, registros: 4, asistencias: 3 },
        { fecha: "2026-05-22", caseras: 1, saludables: 1, registros: 2, asistencias: 2 },
      ],
      "2026-05-20",
      "2026-05-22",
      "2026-05-22",
    );
    expect(serie).toHaveLength(3);
    expect(serie[0]?.pct).toBe(75);
    expect(serie[1]?.pct).toBe(0);
    expect(serie[2]?.pct).toBe(100);
  });

  it("ordena semanas futuras ascendente", () => {
    const semanas = mapRegistrosFuturosPorSemana([
      { semana_inicio: "2026-06-09", total: 5 },
      { semana_inicio: "2026-06-02", total: 12 },
    ]);
    expect(semanas[0]?.total).toBe(12);
    expect(semanas[1]?.total).toBe(5);
    expect(semanas[0]?.label).toContain("–");
  });
});
