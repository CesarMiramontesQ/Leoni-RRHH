import { beforeEach, describe, expect, it, vi } from "vitest";

const grants = new Set<string>();
let nonRhRhMode = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: (key: string) => grants.has(key),
  hasRhModule: (key: string) => grants.has(key),
  isModulosRhEnrolled: () => true,
}));

vi.mock("../auth/payrollPermissions.ts", () => ({
  canApproveOvertime: () => false,
  canRegisterOvertime: () => false,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => nonRhRhMode,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
}));

describe("shellNavPolicy no-RH en Modo RH", () => {
  beforeEach(() => {
    grants.clear();
    nonRhRhMode = false;
    vi.resetModules();
  });

  it("en modo base el supervisor no ve módulos RH exclusivos sin grant", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("supervisor", "actas")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "incidencias")).toBe(true);
  });

  it("en Modo RH muestra ítems otorgados aunque el rol base no los tenga en el hub", async () => {
    nonRhRhMode = true;
    grants.add("actas");
    grants.add("solicitudes");
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    const { isLaboralesHubVisibleForRol } = await import("./laboralesNav.ts");
    // El hub Laborales sigue oculto para supervisor; los ítems se muestran en sidebar estructurado.
    expect(isLaboralesHubVisibleForRol("supervisor")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "actas")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "solicitudes")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "incidencias")).toBe(false);
  });
});
