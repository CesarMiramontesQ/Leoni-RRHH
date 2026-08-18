import { describe, expect, it } from "vitest";
import { buildLiderIncidenciasTressChart } from "./buildLiderIncidenciasTressChart.ts";
import type { FaltasRetardosEstadisticasResponse } from "../../api/faltasRetardos.ts";

type TopItem = FaltasRetardosEstadisticasResponse["empleados_con_mas_eventos"][number];

function top(
  empleado_id: number,
  nombre: string,
  porTipo: Record<string, number>,
  no_empleado: string | null = String(empleado_id),
): TopItem {
  const por_tipo = Object.entries(porTipo).map(([tipo, total]) => ({
    tipo: tipo as TopItem["por_tipo"][number]["tipo"],
    total,
  }));
  return {
    empleado_id,
    no_empleado,
    nombre,
    total: por_tipo.reduce((n, t) => n + t.total, 0),
    por_tipo,
  };
}

describe("buildLiderIncidenciasTressChart", () => {
  it("arma una fila por colaborador con su desglose por tipo", () => {
    const data = buildLiderIncidenciasTressChart(
      [top(10, "LÓPEZ, ANA MARÍA", { retardo: 2, falta_injustificada: 1 })],
      { excludeEmpleadoId: "99", totalEventos: 3, totalColaboradores: 1, maxEmployees: 10 },
    );

    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]?.empleado_id).toBe("10");
    expect(data.rows[0]?.empleado_nombre_corto).toBe("Ana López (10)");
    expect(data.rows[0]?.total).toBe(3);
    expect(data.rows[0]?.byTipo).toEqual({ retardo: 2, falta_injustificada: 1 });
    expect(data.tipos).toEqual(["falta_injustificada", "retardo"]);
    expect(data.view).toBe("bars");
  });

  it("excluye al propio líder y descuenta su aporte de los totales", () => {
    const data = buildLiderIncidenciasTressChart(
      [top(99, "Yo Líder", { retardo: 4 }), top(10, "LÓPEZ, ANA", { retardo: 2 })],
      { excludeEmpleadoId: "99", totalEventos: 6, totalColaboradores: 2, maxEmployees: 10 },
    );

    expect(data.rows.map((r) => r.empleado_id)).toEqual(["10"]);
    expect(data.total_incidencias).toBe(2);
    expect(data.total_colaboradores).toBe(1);
  });

  it("ordena por total descendente y recorta a maxEmployees", () => {
    const data = buildLiderIncidenciasTressChart(
      [
        top(10, "ANA", { retardo: 1 }),
        top(20, "BETO", { retardo: 5 }),
        top(30, "CARLA", { retardo: 3 }),
      ],
      { excludeEmpleadoId: null, totalEventos: 9, totalColaboradores: 3, maxEmployees: 2 },
    );

    expect(data.rows.map((r) => r.empleado_id)).toEqual(["20", "30"]);
    expect(data.top_n).toBe(2);
    expect(data.total_colaboradores).toBe(3);
    expect(data.total_incidencias).toBe(9);
  });

  it("sin colaboradores devuelve una gráfica vacía, no una fila fantasma", () => {
    const data = buildLiderIncidenciasTressChart([], {
      excludeEmpleadoId: "99",
      totalEventos: 0,
      totalColaboradores: 0,
      maxEmployees: 10,
    });

    expect(data.rows).toEqual([]);
    expect(data.tipos).toEqual([]);
    expect(data.total_incidencias).toBe(0);
  });

  it("descarta los tipos en cero que el API manda por completitud", () => {
    const data = buildLiderIncidenciasTressChart(
      [top(10, "ANA", { retardo: 2, suspension: 0 })],
      { excludeEmpleadoId: null, totalEventos: 2, totalColaboradores: 1, maxEmployees: 10 },
    );

    expect(data.rows[0]?.byTipo).toEqual({ retardo: 2 });
    expect(data.tipos).toEqual(["retardo"]);
  });
});
