/**
 * Tarjetas de KPIs del dashboard personal (las comparten empleado, supervisor y gerente
 * vía `renderEmpleadoStatCards`).
 */
import { describe, expect, it, vi } from "vitest";

import type { EmpleadoDashboardPayload } from "../../dashboard/empleado/types.ts";

vi.mock("../../auth/jwt.ts", () => ({ getRolFromAccessToken: () => "empleado" }));

function payload(over: Partial<EmpleadoDashboardPayload>): EmpleadoDashboardPayload {
  return {
    vacation_available_days: null,
    home_office_dias_anio: null,
    retardos_anio: null,
    pending_requests: 0,
    pending_request_types: [],
    calendar: { initial_year: 2026, initial_month_index: 7, day_entries: {} },
    ...over,
  } as EmpleadoDashboardPayload;
}

describe("renderEmpleadoStatCards", () => {
  it("muestra «—» cuando no hay dato de nómina, no «0 días»", async () => {
    const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
    const html = renderEmpleadoStatCards(payload({}));
    expect(html).toContain("—");
    expect(html).not.toContain("0 días");
  });

  it("un cero real sí se muestra como «0 días»", async () => {
    const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
    const html = renderEmpleadoStatCards(
      payload({
        vacation_available_days: 0,
        home_office_dias_anio: 0,
        retardos_anio: 0,
      }),
    );
    expect(html).toContain("0 días");
  });

  it("pinta los días de vacaciones y de home office recibidos", async () => {
    const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
    const html = renderEmpleadoStatCards(
      payload({
        vacation_available_days: 8,
        home_office_dias_anio: 3,
        retardos_anio: 4,
      }),
    );
    expect(html).toContain("8 días");
    expect(html).toContain("3 días");
  });

  describe("tarjeta de retardos", () => {
    it("pinta el conteo del año, sin la unidad «días»", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ retardos_anio: 4 }));
      expect(html).toContain("Retardos");
      expect(html).toContain("Acumulados este año");
      expect(html).toContain(">4<");
      expect(html).not.toContain("4 días");
    });

    it("cero retardos es un dato: se muestra «0», no «—»", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(
        payload({ vacation_available_days: 8, home_office_dias_anio: 3, retardos_anio: 0 }),
      );
      expect(html).toContain(">0<");
      expect(html).not.toContain("—");
    });

    it("ya no existe la tarjeta de vacaciones utilizadas", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ vacation_available_days: 8 }));
      expect(html).not.toContain("Utilizados");
      expect(html).not.toContain("Vacaciones tomadas");
    });
  });

  it("el home office se rotula por año, que es el periodo que consulta el backend", async () => {
    const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
    const html = renderEmpleadoStatCards(payload({ home_office_dias_anio: 3 }));
    expect(html).toContain("Este año");
    expect(html).not.toContain("Este mes");
  });

  describe("mientras se esperan los KPIs de nómina", () => {
    it("pinta esqueleto en las tarjetas de TRESS, no «—»", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({}), { kpisCargando: true });
      // Tres tarjetas vienen de las cachés de nómina: disponibles, retardos y home office.
      expect(html.match(/animate-pulse/g) ?? []).toHaveLength(3);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain("—");
    });

    it("la tarjeta de solicitudes en proceso no espera a nómina", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ pending_requests: 2 }), {
        kpisCargando: true,
      });
      expect(html).toContain("2");
      expect(html).toContain("Solicitudes pendientes");
    });

    it("al llegar sin dato vuelve a «—», no se queda cargando", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({}), { kpisCargando: false });
      expect(html).not.toContain("animate-pulse");
      expect(html).toContain("—");
    });
  });

  it("expone el id del bloque para sustituirlo al llegar los KPIs", async () => {
    const mod = await import("./empleadoPersonalDashboard.ts");
    expect(mod.renderEmpleadoStatCards(payload({}))).toContain(`id="${mod.EMPLEADO_STAT_CARDS_ID}"`);
  });
});
