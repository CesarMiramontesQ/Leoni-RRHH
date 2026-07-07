import { describe, expect, it } from "vitest";
import {
  buildSupervisorIncidenciasChart,
  SUPERVISOR_INC_CHART_OTROS_TIPO,
} from "./buildSupervisorIncidenciasChart.ts";
import type { RhIncidenciaTablaFila } from "../../incidencias/rh/types.ts";

function fila(partial: Partial<RhIncidenciaTablaFila> & Pick<RhIncidenciaTablaFila, "empleado_id" | "tipo">): RhIncidenciaTablaFila {
  return {
    id: 1,
    empleado_nombre_raw: partial.empleado_nombre_raw ?? "Colaborador",
    foto_url: null,
    numero_folio: "INC-1",
    area: "Producción",
    supervisor_id: "99",
    supervisor_nombre: "Supervisor",
    fecha: "2026-05-01",
    estado: "abierto",
    prioridad: "media",
    ...partial,
  };
}

describe("buildSupervisorIncidenciasChart", () => {
  it("agrupa por colaborador y tipo excluyendo al supervisor", () => {
    const data = buildSupervisorIncidenciasChart(
      [
        fila({ id: 1, empleado_id: "10", empleado_nombre_raw: "LÓPEZ, ANA MARÍA", tipo: "retardo" }),
        fila({ id: 2, empleado_id: "10", empleado_nombre_raw: "LÓPEZ, ANA MARÍA", tipo: "retardo" }),
        fila({ id: 3, empleado_id: "10", empleado_nombre_raw: "LÓPEZ, ANA MARÍA", tipo: "falta_injustificada" }),
        fila({ id: 4, empleado_id: "20", empleado_nombre_raw: "PÉREZ, LUIS", tipo: "indisciplina" }),
        fila({ id: 5, empleado_id: "99", empleado_nombre_raw: "Yo Supervisor", tipo: "retardo" }),
      ],
      "99",
    );

    expect(data.view).toBe("bars");
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0]?.empleado_nombre).toBe("LÓPEZ, ANA MARÍA");
    expect(data.rows[0]?.empleado_nombre_corto).toBe("Ana López");
    expect(data.rows[0]?.total).toBe(3);
    expect(data.rows[0]?.byTipo.retardo).toBe(2);
    expect(data.tipos).toContain("retardo");
  });

  it("agrega el no_empleado entre paréntesis en las etiquetas", () => {
    const data = buildSupervisorIncidenciasChart(
      [
        fila({ id: 1, empleado_id: "10", no_empleado: "1234", empleado_nombre_raw: "LÓPEZ, ANA MARÍA", tipo: "retardo" }),
        fila({ id: 2, empleado_id: "10", no_empleado: null, empleado_nombre_raw: "LÓPEZ, ANA MARÍA", tipo: "retardo" }),
      ],
      null,
    );

    expect(data.rows[0]?.no_empleado).toBe("1234");
    expect(data.rows[0]?.empleado_nombre).toBe("LÓPEZ, ANA MARÍA (1234)");
    expect(data.rows[0]?.empleado_nombre_corto).toBe("Ana López (1234)");
  });

  it("colapsa tipos poco frecuentes en otros", () => {
    const filas: RhIncidenciaTablaFila[] = [];
    let id = 1;
    const tipos = ["retardo", "falta_injustificada", "indisciplina", "dano_equipo", "seguridad", "calidad", "tipo_raro"];
    for (const tipo of tipos) {
      filas.push(
        fila({
          id: id++,
          empleado_id: "10",
          empleado_nombre_raw: "Empleado A",
          tipo,
        }),
      );
    }
    const data = buildSupervisorIncidenciasChart(filas, null);
    expect(data.tipos.length).toBeLessThanOrEqual(6);
    expect(data.tipos).toContain(SUPERVISOR_INC_CHART_OTROS_TIPO);
    expect(data.rows[0]?.byTipo[SUPERVISOR_INC_CHART_OTROS_TIPO]).toBe(2);
  });

  it("usa heatmap cuando hay más de 15 colaboradores", () => {
    const filas: RhIncidenciaTablaFila[] = Array.from({ length: 16 }, (_, i) =>
      fila({
        id: i + 1,
        empleado_id: String(100 + i),
        empleado_nombre_raw: `Empleado ${i}`,
        tipo: "retardo",
      }),
    );
    const data = buildSupervisorIncidenciasChart(filas, null);
    expect(data.view).toBe("heatmap");
    expect(data.rows).toHaveLength(16);
  });

  it("recorta a top N conservando totales globales (gerente)", () => {
    const filas: RhIncidenciaTablaFila[] = [];
    let id = 1;
    for (let i = 0; i < 10; i += 1) {
      const count = 10 - i;
      for (let j = 0; j < count; j += 1) {
        filas.push(
          fila({
            id: id++,
            empleado_id: String(100 + i),
            empleado_nombre_raw: `Empleado ${i}`,
            tipo: "retardo",
          }),
        );
      }
    }

    const data = buildSupervisorIncidenciasChart(filas, null, { maxEmployees: 8, forceView: "bars" });

    expect(data.rows).toHaveLength(8);
    expect(data.top_n).toBe(8);
    expect(data.total_colaboradores).toBe(10);
    expect(data.total_incidencias).toBe(55);
    expect(data.view).toBe("bars");
    expect(data.rows[0]?.total).toBe(10);
    expect(data.rows[7]?.total).toBe(3);
  });

  it("devuelve estructura vacía sin incidencias de equipo", () => {
    const data = buildSupervisorIncidenciasChart([], "99");
    expect(data.rows).toEqual([]);
    expect(data.tipos).toEqual([]);
    expect(data.view).toBe("bars");
  });
});
