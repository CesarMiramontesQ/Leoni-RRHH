import { beforeEach, describe, expect, it, vi } from "vitest";

let operativoUiMode = true;

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => true,
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => true,
  isModulosRhEnrolled: () => false,
}));

vi.mock("../auth/payrollPermissions.ts", () => ({
  canApproveOvertime: () => false,
  canRegisterOvertime: () => false,
}));

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "gerente",
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => true,
  isNonRhRhMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => operativoUiMode,
}));

async function imports() {
  return import("./shellNavPolicy.ts");
}

describe("ADMIN gerente en Modo RH — navegación", () => {
  beforeEach(() => {
    operativoUiMode = true;
    vi.resetModules();
  });

  it("no aplica sidebar de supervisor ni menú plano de empleado", async () => {
    const { isSupervisorStructuredNavRol, isEmpleadoFlatNavRol, isRhStructuredNavRol } = await imports();
    expect(isSupervisorStructuredNavRol("gerente")).toBe(false);
    expect(isEmpleadoFlatNavRol("gerente")).toBe(false);
    expect(isRhStructuredNavRol("gerente")).toBe(true);
  });

  it("permite rutas RH exclusivas (actas) sin redirigir a #/", async () => {
    const { resolveRoutedHashForRol, isShellNavItemVisibleForRol } = await imports();
    expect(resolveRoutedHashForRol("gerente", "#/actas", { enrolledNonRh: false })).toBe("#/actas");
    expect(isShellNavItemVisibleForRol("gerente", "actas")).toBe(true);
  });
});
