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
        retardos_anio: 0,
      }),
    );
    expect(html).toContain("0 días");
  });

  it("pinta los días de vacaciones recibidos", async () => {
    const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
    const html = renderEmpleadoStatCards(payload({ vacation_available_days: 8, retardos_anio: 4 }));
    expect(html).toContain("8 días");
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
        payload({ vacation_available_days: 8, retardos_anio: 0 }),
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

  /**
   * La tarjeta de Home Office se retiró del dashboard personal (empleado, supervisor y
   * gerente). Los retardos, que sí aplican a todos, se quedan en su sitio.
   */
  describe("sin tarjeta de Home Office", () => {
    it("no se pinta para nadie", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ retardos_anio: 3 }));
      expect(html).not.toContain("Home Office");
      expect(html).not.toContain("Este año");
    });

    it("quedan tres tarjetas y se reparten el ancho", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({}));
      expect(html.match(/<article/g) ?? []).toHaveLength(3);
      expect(html).toContain("xl:grid-cols-3");
    });

    it("conserva vacaciones, retardos y solicitudes en proceso", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(
        payload({ vacation_available_days: 8, retardos_anio: 4, pending_requests: 2 }),
      );
      expect(html).toContain("Vacaciones disponibles");
      expect(html).toContain("Acumulados este año");
      expect(html).toContain("Solicitudes pendientes");
      expect(html).toContain("8 días");
    });
  });

  describe("mientras se esperan los KPIs de nómina", () => {
    it("pinta esqueleto en las tarjetas de TRESS, no «—»", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({}), { kpisCargando: true });
      // Dos tarjetas vienen de las cachés de nómina: disponibles y retardos.
      expect(html.match(/animate-pulse/g) ?? []).toHaveLength(2);
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
