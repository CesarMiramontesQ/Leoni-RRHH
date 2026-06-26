import { beforeEach, describe, expect, it, vi } from "vitest";

let rol: string | null = "gerente";
let operativoUiMode = true;
let gestorTeamUiMode = false;
let liderUiMode = false;

function tokenFor(value: string | null): string | null {
  if (value === null) return null;
  const payload = Buffer.from(JSON.stringify({ rol: value, rh_admin: true })).toString("base64");
  return `x.${payload}.y`;
}

vi.mock("./session.ts", () => ({
  getAccessToken: () => tokenFor(rol),
}));

vi.mock("./rhModulePermissions.ts", () => ({
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => true,
}));

vi.mock("./rhUiMode.ts", () => ({
  isRhEmpleadoUiMode: () => false,
  isRhGestorTeamUiMode: () => gestorTeamUiMode,
  isRhGerenteUiMode: () => false,
  isRhLiderUiMode: () => liderUiMode,
  isRhDirectorUiMode: () => false,
  isRhOperativoUiMode: () => operativoUiMode,
}));

async function imports() {
  return import("./jwt.ts");
}

describe("ADMIN gerente en Modo RH (operativo)", () => {
  beforeEach(() => {
    rol = "gerente";
    operativoUiMode = true;
    gestorTeamUiMode = false;
    liderUiMode = false;
    vi.resetModules();
  });

  it("muestra dashboard RH operativo, no el de líder/gerente", async () => {
    const { canAccessLiderTeamDashboard, canAccessRhOperationalDashboard } = await imports();
    expect(canAccessLiderTeamDashboard()).toBe(false);
    expect(canAccessRhOperationalDashboard()).toBe(true);
  });

  it("no usa vista de comedor de líder", async () => {
    const { canAccessComedorLiderPage, canAccessComedorRhPage } = await imports();
    expect(canAccessComedorLiderPage()).toBe(false);
    expect(canAccessComedorRhPage()).toBe(true);
  });
});

describe("ADMIN supervisor en Modo líder", () => {
  beforeEach(() => {
    rol = "supervisor";
    operativoUiMode = false;
    gestorTeamUiMode = true;
    liderUiMode = true;
    vi.resetModules();
  });

  it("muestra dashboard de líder, no el personal de empleado", async () => {
    const {
      canAccessEmpleadoPersonalDashboard,
      canAccessLiderTeamDashboard,
      canAccessRhOperationalDashboard,
      getEffectiveGestorNavRol,
    } = await imports();
    expect(getEffectiveGestorNavRol()).toBe("supervisor");
    expect(canAccessEmpleadoPersonalDashboard()).toBe(false);
    expect(canAccessLiderTeamDashboard()).toBe(true);
    expect(canAccessRhOperationalDashboard()).toBe(false);
  });

  it("oculta calendario de equipo en dashboard supervisor", async () => {
    const { canSeeDashboardTeamCalendar } = await imports();
    expect(canSeeDashboardTeamCalendar()).toBe(false);
  });

  it("usa vista de comedor de líder", async () => {
    const { canAccessComedorLiderPage, canAccessComedorRhPage } = await imports();
    expect(canAccessComedorLiderPage()).toBe(true);
    expect(canAccessComedorRhPage()).toBe(false);
  });
});
