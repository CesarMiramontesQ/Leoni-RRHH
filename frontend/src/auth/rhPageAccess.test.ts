import { beforeEach, describe, expect, it, vi } from "vitest";

// Acceso a páginas RH-exclusivas por PERMISO (admin operativo o grant en Modo RH):
// - ADMIN en Modo RH con el módulo → entra.
// - No-admin inscrito con grant en Modo RH → entra.
// - Sin permiso → bloqueado.
// - ADMIN en modo empleado / gestor de equipo → bloqueado.

let rol: string | null = "supervisor";
const grants = new Set<string>();
const rhModules = new Set<string>();
let empleadoUiMode = false;
let gestorTeamUiMode = false;
let operativoUiMode = true;
let nonRhRhMode = false;

function tokenFor(value: string | null): string | null {
  if (value === null) return null;
  const payload = Buffer.from(JSON.stringify({ rol: value, rh_admin: true })).toString("base64");
  return `x.${payload}.y`;
}

vi.mock("./session.ts", () => ({
  getAccessToken: () => tokenFor(rol),
}));

vi.mock("./rhModulePermissions.ts", () => ({
  hasExplicitModuleGrant: (key: string) => grants.has(key),
  hasRhModule: (key: string) =>
    (operativoUiMode && rhModules.has(key)) || (nonRhRhMode && grants.has(key)),
}));

vi.mock("./rhUiMode.ts", () => ({
  isRhEmpleadoUiMode: () => empleadoUiMode,
  isRhGestorTeamUiMode: () => gestorTeamUiMode,
  isRhGerenteUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhOperativoUiMode: () => operativoUiMode,
  isNonRhRhMode: () => nonRhRhMode,
}));

async function imports() {
  return import("./jwt.ts");
}

describe("acceso a páginas RH-exclusivas por permiso de módulo", () => {
  beforeEach(() => {
    rol = "supervisor";
    grants.clear();
    rhModules.clear();
    empleadoUiMode = false;
    gestorTeamUiMode = false;
    operativoUiMode = true;
    nonRhRhMode = false;
    vi.resetModules();
  });

  it("ADMIN operativo con módulo accede (actas / nominas-ajustes)", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rhModules.add("actas");
    rhModules.add("nominas-ajustes");
    expect(canAccessActasPage()).toBe(true);
    expect(canAccessNominasAjustesPage()).toBe(true);
  });

  it("ADMIN operativo sin módulo queda bloqueado", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    expect(canAccessActasPage()).toBe(false);
    expect(canAccessNominasAjustesPage()).toBe(false);
  });

  it("inscrito no-admin en Modo RH con grant accede", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rol = "empleado";
    operativoUiMode = false;
    nonRhRhMode = true;
    grants.add("actas");
    grants.add("nominas-ajustes");
    expect(canAccessActasPage()).toBe(true);
    expect(canAccessNominasAjustesPage()).toBe(true);
  });

  it("sin permiso queda bloqueado aunque tenga otro rol base", async () => {
    const { canAccessActasPage, canAccessNominasAjustesPage } = await imports();
    rol = "gerente";
    operativoUiMode = false;
    expect(canAccessActasPage()).toBe(false);
    expect(canAccessNominasAjustesPage()).toBe(false);
  });

  it("ADMIN en modo empleado o gestor de equipo no entra a vista operativa", async () => {
    const { canAccessActasPage } = await imports();
    rhModules.add("actas");
    empleadoUiMode = true;
    expect(canAccessActasPage()).toBe(false);
    empleadoUiMode = false;
    gestorTeamUiMode = true;
    expect(canAccessActasPage()).toBe(false);
  });
});
