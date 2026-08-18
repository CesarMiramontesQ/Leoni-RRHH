/**
 * La tarjeta «Incidencias por colaborador» sale de la página Incidencias
 * (`#/faltas-retardos`), no de «Seguridad y Calidad» (`#/incidencias`).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FaltasRetardosEstadisticasParams } from "../../api/faltasRetardos.ts";

const llamadas: FaltasRetardosEstadisticasParams[] = [];
let respuestaEquipo: unknown = null;
let equipoFalla = false;

vi.mock("../../api/faltasRetardos.ts", () => ({
  getFaltasRetardosEstadisticas: async (params: FaltasRetardosEstadisticasParams) => {
    llamadas.push(params);
    if (params.tipo === "retardo") return { retardo: 12 };
    if (equipoFalla) throw new Error("500");
    return respuestaEquipo;
  },
}));
vi.mock("../../api/solicitudes.ts", () => ({ getSolicitudesRows: async () => [] }));
vi.mock("../../api/comedor.ts", () => ({ getComedorEquipoReservasMes: async () => [] }));
vi.mock("../../api/empleados.ts", () => ({ getEmpleadosResumen: async () => null }));
vi.mock("../../api/dashboardKpis.ts", () => ({ fetchDashboardKpis: async () => null }));
// Seguridad y Calidad sigue alimentando la tarjeta «Incidencias activas», que no cambia.
vi.mock("../../api/incidencias.ts", () => ({
  fetchAllIncidenciasForExport: async () => [],
  getIncidenciasRows: async () => [],
}));
vi.mock("../../auth/jwt.ts", () => ({
  getEmpleadoIdFromAccessToken: () => "77",
  getRolFromAccessToken: () => "supervisor",
  getEffectiveGestorNavRol: () => "supervisor",
}));

function estadisticas(empleados: unknown[], totales?: { eventos?: number; colaboradores?: number }) {
  return {
    retardo: 0,
    total_eventos: totales?.eventos ?? 0,
    total_colaboradores_con_eventos: totales?.colaboradores ?? empleados.length,
    empleados_con_mas_eventos: empleados,
  };
}

describe("fetchLiderDashboard — incidencias por colaborador", () => {
  beforeEach(() => {
    llamadas.length = 0;
    respuestaEquipo = estadisticas([]);
    equipoFalla = false;
    vi.resetModules();
  });

  it("pide el último año sin vacaciones ni permisos con goce", async () => {
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    await fetchLiderDashboard();

    const equipo = llamadas.find((p) => p.tipos != null);
    expect(equipo).toBeDefined();
    expect([...(equipo?.tipos ?? [])]).toEqual([
      "falta_justificada",
      "falta_injustificada",
      "retardo",
      "incapacidad",
      "suspension",
    ]);
    const dias =
      (Date.parse(`${equipo?.fecha_fin}T00:00:00`) -
        Date.parse(`${equipo?.fecha_inicio}T00:00:00`)) /
      86_400_000;
    expect(dias).toBeGreaterThanOrEqual(364);
    expect(dias).toBeLessThanOrEqual(365);
  });

  it("arma la gráfica con el ranking que devuelve el API", async () => {
    respuestaEquipo = estadisticas(
      [
        {
          empleado_id: 10,
          no_empleado: "553",
          nombre: "LÓPEZ, ANA",
          total: 3,
          por_tipo: [{ tipo: "retardo", total: 3 }],
        },
      ],
      { eventos: 3, colaboradores: 1 },
    );
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    const chart = payload?.supervisor_incidencias_chart;
    expect(chart?.rows.map((r) => r.empleado_id)).toEqual(["10"]);
    expect(chart?.rows[0]?.byTipo).toEqual({ retardo: 3 });
    expect(chart?.top_n).toBe(10);
  });

  it("una respuesta sin ranking deja la gráfica vacía, no tumba el dashboard", async () => {
    respuestaEquipo = { retardo: 0 };
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(payload).not.toBeNull();
    expect(payload?.supervisor_incidencias_chart?.rows).toEqual([]);
  });

  it("si el endpoint falla el resto del dashboard sigue cargando", async () => {
    equipoFalla = true;
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(payload).not.toBeNull();
    expect(payload?.supervisor_incidencias_chart).toBeNull();
  });
});
