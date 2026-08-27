/**
 * La tarjeta «Incidencias activas» (Seguridad y Calidad) solo necesita un número.
 * Antes se paginaba TODO el histórico del subárbol de 10 en 10 y en serie: en un
 * gerente con 550 personas eran 14+ requests antes de pintar nada (~10 s en prod).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const llamadasPagina: Array<{ page: number; pageSize: number | undefined }> = [];
let exportLlamado = false;
let rowsLlamado = false;
let totalRespuesta = 183;
let paginaFalla = false;

vi.mock("../../api/incidencias.ts", () => ({
  fetchIncidenciasListPage: async (_f: unknown, page: number, pageSize?: number) => {
    llamadasPagina.push({ page, pageSize });
    if (paginaFalla) throw { status: 500, detail: "boom" };
    return { items: [], total: totalRespuesta, page, page_size: pageSize ?? 10 };
  },
  fetchAllIncidenciasForExport: async () => {
    exportLlamado = true;
    return [];
  },
  getIncidenciasRows: async () => {
    rowsLlamado = true;
    return [];
  },
}));
vi.mock("../../api/faltasRetardos.ts", () => ({
  getFaltasRetardosEstadisticas: async () => ({ retardo: 0, empleados_con_mas_eventos: [] }),
}));
vi.mock("../../api/solicitudes.ts", () => ({ getSolicitudesRows: async () => [] }));
vi.mock("../../api/comedor.ts", () => ({ getComedorEquipoReservasMes: async () => [] }));
vi.mock("../../api/empleados.ts", () => ({ getEmpleadosResumen: async () => null }));
vi.mock("../../api/dashboardKpis.ts", () => ({ fetchDashboardKpis: async () => null }));

let rol = "gerente";
vi.mock("../../auth/jwt.ts", () => ({
  getEmpleadoIdFromAccessToken: () => "59",
  getRolFromAccessToken: () => rol,
  getEffectiveGestorNavRol: () => rol,
}));

describe("fetchLiderDashboard — incidencias activas", () => {
  beforeEach(() => {
    llamadasPagina.length = 0;
    exportLlamado = false;
    rowsLlamado = false;
    totalRespuesta = 183;
    paginaFalla = false;
    rol = "gerente";
    vi.resetModules();
  });

  it("gerente: una sola request de una fila y usa el total del listado", async () => {
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(payload?.team.team_active_incidents).toBe(183);
    expect(llamadasPagina).toEqual([{ page: 1, pageSize: 1 }]);
    expect(exportLlamado).toBe(false);
    expect(rowsLlamado).toBe(false);
  });

  it("supervisor: mismo camino, sin paginar filas", async () => {
    rol = "supervisor";
    totalRespuesta = 7;
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(payload?.team.team_active_incidents).toBe(7);
    expect(llamadasPagina).toEqual([{ page: 1, pageSize: 1 }]);
    expect(rowsLlamado).toBe(false);
  });

  it("si el listado falla, la tarjeta queda en 0 y el dashboard carga", async () => {
    paginaFalla = true;
    const { fetchLiderDashboard } = await import("./fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(payload).not.toBeNull();
    expect(payload?.team.team_active_incidents).toBe(0);
  });
});
