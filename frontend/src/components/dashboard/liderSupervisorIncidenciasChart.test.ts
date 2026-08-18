import { describe, expect, it } from "vitest";
import { renderSupervisorIncidenciasChartCard } from "./liderSupervisorIncidenciasChart.ts";
import type { SupervisorIncidenciasChartData } from "../../dashboard/lider/types.ts";

function data(partial: Partial<SupervisorIncidenciasChartData> = {}): SupervisorIncidenciasChartData {
  return {
    rows: [
      {
        empleado_id: "10",
        no_empleado: "553",
        empleado_nombre: "LÓPEZ, ANA (553)",
        empleado_nombre_corto: "Ana López (553)",
        total: 3,
        byTipo: { incapacidad: 2, suspension: 1 },
      },
    ],
    tipos: ["incapacidad", "suspension"],
    view: "heatmap",
    ...partial,
  };
}

describe("renderSupervisorIncidenciasChartCard", () => {
  it("etiqueta los tipos de la página Incidencias en vez de mostrar el código crudo", () => {
    const html = renderSupervisorIncidenciasChartCard(data());

    expect(html).toContain("Incapacidad");
    expect(html).toContain("Suspensión");
    expect(html).not.toContain(">suspension<");
  });

  it("el subtítulo es solo el alcance: periodo y tipos, sin coletillas", () => {
    const html = renderSupervisorIncidenciasChartCard(
      data({ total_incidencias: 42, total_colaboradores: 17, top_n: 10 }),
    );
    const subtitulo = /class="mt-1 text-sm text-text-muted">([^<]*)</.exec(html)?.[1];

    expect(subtitulo).toBe("Faltas, retardos, incapacidades y suspensiones del último año.");
  });

  it("el total sigue viviendo en su propia línea, no en el subtítulo", () => {
    const html = renderSupervisorIncidenciasChartCard(
      data({ total_incidencias: 42, total_colaboradores: 17, top_n: 10 }),
    );

    expect(html).toContain("42 incidencias en total");
  });
});
