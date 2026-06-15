import { beforeEach, describe, expect, it, vi } from "vitest";

// Acceso a páginas RH-exclusivas por PERMISO (no por rol):
// - RH con el módulo asignado → entra.
// - No-RH con el módulo otorgado (grant) → entra.
// - Sin el permiso → bloqueado, aunque tenga otro rol base.
// - RH en modo empleado / gestor de equipo → bloqueado (no es vista RH operativa).

let rol: string | null = "rh";
const grants = new Set<string>();
const rhModules = new Set<string>();
let empleadoUiMode = false;
let gestorTeamUiMode = false;

function tokenFor(value: string | null): string | null {
  if (value === null) return null;
  const payload = Buffer.from(JSON.stringify({ rol: value })).toString("base64");
  return `x.${payload}.y`;
}

vi.mock("./session.ts", () => ({
  getAccessToken: () => tokenFor(rol),
}));

vi.mock("./rhModulePermissions.ts", () => ({
  hasExplicitModuleGrant: (key: string) => grants.has(key),
  hasRhModule: (key: string) => rol === "rh" && rhModules.has(key),
}));

vi.mock("./rhUiMode.ts", () => ({
  isRhEmpleadoUiMode: () => empleadoUiMode,
  isRhGestorTeamUiMode: () => gestorTeamUiMode,
  isRhGerenteUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => !empleadoUiMode && !gestorTeamUiMode,
}));

async function imports() {
  return import("./jwt.ts");
}

describe("acceso a páginas RH-exclusivas por permiso de módulo", () => {
  beforeEach(() => {
    rol = "rh";
    grants.clear();
    rhModules.clear();
    empleadoUiMode = false;
    gestorTeamUiMode = false;
    vi.resetModules();
  });

  it("RH con el módulo asignado accede (actas / nominas-ajustes)", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rhModules.add("actas");
    rhModules.add("nominas-ajustes");
    expect(canAccessActasPage()).toBe(true);
    expect(canAccessNominasAjustesPage()).toBe(true);
  });

  it("RH sin el módulo asignado queda bloqueado", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    expect(canAccessActasPage()).toBe(false);
    expect(canAccessNominasAjustesPage()).toBe(false);
  });

  it("no-RH con el módulo OTORGADO accede (sin rol RH)", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rol = "empleado";
    grants.add("actas");
    grants.add("nominas-ajustes");
    expect(canAccessActasPage()).toBe(true);
    expect(canAccessNominasAjustesPage()).toBe(true);
  });

  it("no-RH sin el permiso queda bloqueado aunque tenga otro rol base", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rol = "gerente";
    expect(canAccessActasPage()).toBe(false);
    expect(canAccessNominasAjustesPage()).toBe(false);
  });

  it("RH en modo empleado o gestor de equipo no entra a la vista RH operativa", async () => {
    const { canAccessActasPage } = await imports();
    rhModules.add("actas");
    empleadoUiMode = true;
    expect(canAccessActasPage()).toBe(false);
    empleadoUiMode = false;
    gestorTeamUiMode = true;
    expect(canAccessActasPage()).toBe(false);
  });
});
