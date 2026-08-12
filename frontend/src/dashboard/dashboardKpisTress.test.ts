/**
 * Los KPIs de vacaciones, home office y retardos de los tres dashboards vienen de
 * `GET /api/v1/dashboard/mis-kpis`, no de `/api/v1/solicitudes`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardKpisResponse } from "../api/dashboardKpis.ts";

const KPIS: DashboardKpisResponse = {
  disponible: true,
  vacaciones_disponibles: 8,
  vacaciones_tomadas_ciclo: 16,
  vacaciones_derecho_ciclo: 24,
  ciclo_aniversario: 12,
  ciclo_vence: "2026-02-16",
  home_office_dias_anio: 3,
  retardos_anio: 4,
  anio: 2026,
};

let kpisRespuesta: DashboardKpisResponse | null = KPIS;
const fetchDashboardKpisMock = vi.fn(async () => kpisRespuesta);

vi.mock("../api/dashboardKpis.ts", () => ({
  fetchDashboardKpis: () => fetchDashboardKpisMock(),
}));

/** Solicitudes de vacaciones y HO aprobadas: si el KPI las usara, daría otro número. */
function fila(id: number, tipo: string, fechaInicio: string, fechaFin: string) {
  return {
    id,
    empleado_id: "77",
    empleado_nombre_raw: "PRUEBA, EMPLEADO",
    empleado_no_empleado: "77",
    empleado_puesto: null,
    foto_url: null,
    numero_folio: `#SOL-${id}`,
    area: "Area",
    tipo,
    fecha_solicitud: fechaInicio,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    periodo_etiqueta: null,
    estado: "approved",
    supervisor_id: "1",
  };
}

const SOLICITUDES = [
  fila(1, "vacaciones", "2026-01-05", "2026-01-09"),
  fila(2, "home_office", "2026-08-03", "2026-08-03"),
];

vi.mock("../api/solicitudes.ts", () => ({
  getSolicitudesRows: async () => SOLICITUDES,
}));
vi.mock("../api/comedor.ts", () => ({
  getComedorMisReservasMes: async () => [],
  getComedorEquipoReservasMes: async () => [],
}));
vi.mock("../api/empleados.ts", () => ({ getEmpleadosResumen: async () => null }));
vi.mock("../api/incidencias.ts", () => ({
  fetchAllIncidenciasForExport: async () => [],
  getIncidenciasRows: async () => [],
}));
let rolActual = "empleado";

vi.mock("../auth/jwt.ts", () => ({
  getEmpleadoIdFromAccessToken: () => "77",
  getRolFromAccessToken: () => rolActual,
  getEffectiveGestorNavRol: () => (rolActual === "empleado" ? null : rolActual),
}));
vi.mock("../auth/rhUiMode.ts", () => ({ isRhEmpleadoUiMode: () => false }));

describe("KPIs del dashboard desde las cachés de nómina", () => {
  beforeEach(() => {
    kpisRespuesta = KPIS;
    rolActual = "empleado";
    fetchDashboardKpisMock.mockClear();
    vi.resetModules();
  });

  it("el dashboard de empleado toma los tres KPIs del endpoint", async () => {
    const { fetchEmpleadoDashboardKpis } = await import("./empleado/fetchEmpleadoDashboard.ts");
    const kpis = await fetchEmpleadoDashboardKpis();

    expect(fetchDashboardKpisMock).toHaveBeenCalled();
    expect(kpis?.vacation_available_days).toBe(8);
    // Antes este campo nunca se asignaba y la tarjeta mostraba siempre "0 días".
    expect(kpis?.home_office_dias_anio).toBe(3);
    expect(kpis?.retardos_anio).toBe(4);
  });

  it("la carga principal del dashboard no espera a TRESS", async () => {
    // Los KPIs van en su propia petición: metidos en el Promise.all del dashboard,
    // una BD de nómina caída bloqueaba el render entero (15 s por carga).
    const { fetchEmpleadoDashboard } = await import("./empleado/fetchEmpleadoDashboard.ts");
    const payload = await fetchEmpleadoDashboard();

    expect(fetchDashboardKpisMock).not.toHaveBeenCalled();
    expect(payload).not.toBeNull();
    expect(payload?.vacation_available_days).toBeNull();
    expect(payload?.home_office_dias_anio).toBeNull();
    expect(payload?.retardos_anio).toBeNull();
  });

  it("si nómina no responde los KPIs quedan en null, no en cero", async () => {
    kpisRespuesta = null;
    const { fetchEmpleadoDashboardKpis } = await import("./empleado/fetchEmpleadoDashboard.ts");

    expect(await fetchEmpleadoDashboardKpis()).toBeNull();
  });

  it("el dashboard de supervisor/gerente usa el mismo endpoint", async () => {
    rolActual = "supervisor";
    const { fetchLiderDashboard } = await import("./lider/fetchLiderDashboard.ts");
    const payload = await fetchLiderDashboard();

    expect(fetchDashboardKpisMock).toHaveBeenCalled();
    expect(payload?.personal.vacation_available_days).toBe(8);
    expect(payload?.personal.home_office_dias_anio).toBe(3);
    expect(payload?.personal.retardos_anio).toBe(4);
  });
});
