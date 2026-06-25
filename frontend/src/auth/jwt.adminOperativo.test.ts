import { beforeEach, describe, expect, it, vi } from "vitest";

let rol: string | null = "gerente";
let operativoUiMode = true;

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
  isRhGestorTeamUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhLiderUiMode: () => false,
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
