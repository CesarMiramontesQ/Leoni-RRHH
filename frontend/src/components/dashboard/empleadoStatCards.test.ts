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
      { mostrarHomeOffice: true },
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
    const html = renderEmpleadoStatCards(payload({ home_office_dias_anio: 3 }), {
      mostrarHomeOffice: true,
    });
    expect(html).toContain("Este año");
    expect(html).not.toContain("Este mes");
  });

  /**
   * Home Office solo lo pueden solicitar los administrativos: el backend rechaza al
   * resto en `_validar_creacion_home_office`. A un operativo la tarjeta le enseñaba un
   * 0 permanente de algo que nunca podrá pedir, así que no se le muestra.
   */
  describe("tarjeta de Home Office según clasificación", () => {
    it("no se muestra a quien no es administrativo", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ home_office_dias_anio: 0 }), {
        mostrarHomeOffice: false,
      });
      expect(html).not.toContain("Home Office tomados");
      expect(html).not.toContain("Este año");
    });

    it("se muestra a los administrativos", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({ home_office_dias_anio: 2 }), {
        mostrarHomeOffice: true,
      });
      expect(html).toContain("Home Office tomados");
      expect(html).toContain("2 días");
    });

    it("sin decir nada no se muestra: quien no sabe la clasificación no debe enseñarla", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      expect(renderEmpleadoStatCards(payload({ home_office_dias_anio: 5 }))).not.toContain(
        "Home Office tomados",
      );
    });

    it("las otras tres tarjetas se reparten el ancho, sin dejar hueco", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const sinHo = renderEmpleadoStatCards(payload({}), { mostrarHomeOffice: false });
      const conHo = renderEmpleadoStatCards(payload({}), { mostrarHomeOffice: true });
      expect(sinHo).toContain("xl:grid-cols-3");
      expect(conHo).toContain("xl:grid-cols-4");
      expect(sinHo.match(/<article/g) ?? []).toHaveLength(3);
      expect(conHo.match(/<article/g) ?? []).toHaveLength(4);
    });

    it("ocultarla no se lleva por delante vacaciones, retardos ni solicitudes", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(
        payload({ vacation_available_days: 8, retardos_anio: 4, pending_requests: 2 }),
        { mostrarHomeOffice: false },
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
      const html = renderEmpleadoStatCards(payload({}), {
        kpisCargando: true,
        mostrarHomeOffice: true,
      });
      // Tres tarjetas vienen de las cachés de nómina: disponibles, retardos y home office.
      expect(html.match(/animate-pulse/g) ?? []).toHaveLength(3);
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain("—");
    });

    it("sin la tarjeta de home office son dos los esqueletos de nómina", async () => {
      const { renderEmpleadoStatCards } = await import("./empleadoPersonalDashboard.ts");
      const html = renderEmpleadoStatCards(payload({}), {
        kpisCargando: true,
        mostrarHomeOffice: false,
      });
      expect(html.match(/animate-pulse/g) ?? []).toHaveLength(2);
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
