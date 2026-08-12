/**
 * Tarjetas del bloque «Resumen del equipo» (supervisor y gerente).
 *
 * La de Home Office pendiente se sustituyó por los retardos del año: al supervisor solo
 * se le muestran dos de las cuatro, así que quitar aquella sin poner nada lo dejaba con
 * una sola tarjeta.
 */
import { describe, expect, it, vi } from "vitest";

import type { LiderTeamStats } from "../../dashboard/lider/types.ts";

let rolActual: string | null = "gerente";

vi.mock("../../auth/jwt.ts", () => ({
  getEffectiveGestorNavRol: () => rolActual,
  canSeeDashboardTeamCalendar: () => true,
  canAccessLiderTeamDashboard: () => true,
  getEmpleadoIdFromAccessToken: () => 1,
  getRolFromAccessToken: () => rolActual,
}));

function team(over: Partial<LiderTeamStats> = {}): LiderTeamStats {
  return {
    team_active_incidents: 3,
    team_pending_vacation_requests: 2,
    team_retardos_anio: 17,
    team_collaborators_count: 40,
    ...over,
  };
}

async function render(stats: LiderTeamStats | null) {
  const { renderLiderTeamStatCards } = await import("./liderTeamDashboard.ts");
  return renderLiderTeamStatCards(stats);
}

describe("tarjetas del equipo", () => {
  it("ya no muestra Home Office pendiente", async () => {
    rolActual = "gerente";
    const html = await render(team());
    expect(html).not.toContain("Home Office");
  });

  it("muestra los retardos del año del equipo", async () => {
    rolActual = "gerente";
    const html = await render(team({ team_retardos_anio: 17 }));
    expect(html).toContain("Retardos del equipo");
    expect(html).toContain("Acumulados este año");
    expect(html).toContain(">17<");
  });

  it("cero retardos es un dato: se muestra «0»", async () => {
    rolActual = "gerente";
    expect(await render(team({ team_retardos_anio: 0 }))).toContain(">0<");
  });

  it("sin dato muestra «—», no un cero que parecería «sin retardos»", async () => {
    rolActual = "gerente";
    const html = await render(team({ team_retardos_anio: null }));
    expect(html).toContain("—");
  });

  it("al supervisor le quedan dos tarjetas, no una", async () => {
    rolActual = "supervisor";
    const html = await render(team());
    expect(html.match(/<article/g) ?? []).toHaveLength(2);
    expect(html).toContain("Vacaciones por aprobar");
    expect(html).toContain("Retardos del equipo");
    // Incidencias y total de colaboradores siguen siendo solo para el gerente.
    expect(html).not.toContain("Incidencias activas");
  });

  it("el gerente conserva sus cuatro tarjetas", async () => {
    rolActual = "gerente";
    const html = await render(team());
    expect(html.match(/<article/g) ?? []).toHaveLength(4);
    expect(html).toContain("Incidencias activas");
    expect(html).toContain("Miembro de mi equipo");
  });
});
