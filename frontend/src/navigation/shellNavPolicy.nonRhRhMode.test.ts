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
  hasRhPermisosActivos: () => grants.size > 0,
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

  it("resolveRhModeLandingHash sin dashboard aterriza en rh-inicio", async () => {
    nonRhRhMode = true;
    grants.add("actas");
    const { resolveRhModeLandingHash, RH_MODO_INICIO_HASH } = await import("./shellNavPolicy.ts");
    expect(resolveRhModeLandingHash()).toBe(RH_MODO_INICIO_HASH);
  });

  it("resolveRhInitialHash en Modo RH sin dashboard aterriza en rh-inicio", async () => {
    nonRhRhMode = true;
    grants.add("solicitudes");
    const { resolveRhInitialHash, RH_MODO_INICIO_HASH } = await import("./shellNavPolicy.ts");
    expect(resolveRhInitialHash("#/")).toBe(RH_MODO_INICIO_HASH);
  });

  it("resolveRhModoHomeHash con dashboard grant va a #/", async () => {
    nonRhRhMode = true;
    grants.add("dashboard");
    grants.add("actas");
    const { resolveRhModoHomeHash } = await import("./shellNavPolicy.ts");
    expect(resolveRhModoHomeHash()).toBe("#/");
  });

  it("modulosMayAccessHash bloquea #/ en Modo RH sin grant de dashboard", async () => {
    nonRhRhMode = true;
    grants.add("actas");
    const { modulosMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash("#/", "supervisor")).toBe(false);
  });

  it("modulosMayAccessHash permite rh-inicio con módulos activos", async () => {
    nonRhRhMode = true;
    grants.add("actas");
    const { modulosMayAccessHash, RH_MODO_INICIO_HASH } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(RH_MODO_INICIO_HASH, "supervisor")).toBe(true);
  });

  it("modulosMayAccessHash permite sin-permisos-rh en Modo RH", async () => {
    nonRhRhMode = true;
    const { modulosMayAccessHash, RH_SIN_PERMISOS_HASH } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(RH_SIN_PERMISOS_HASH, "supervisor")).toBe(true);
  });

  it("pdi-gestion como único módulo aterriza en rh-inicio", async () => {
    nonRhRhMode = true;
    grants.add("pdi-gestion");
    const { resolveRhModoHomeHash, RH_MODO_INICIO_HASH } = await import("./shellNavPolicy.ts");
    expect(resolveRhModoHomeHash()).toBe(RH_MODO_INICIO_HASH);
  });

  it("empleados o comedor-registro como único módulo aterriza en rh-inicio", async () => {
    nonRhRhMode = true;
    grants.add("empleados");
    const { resolveRhModoHomeHash, RH_MODO_INICIO_HASH } = await import("./shellNavPolicy.ts");
    expect(resolveRhModoHomeHash()).toBe(RH_MODO_INICIO_HASH);

    grants.clear();
    grants.add("comedor-registro");
    vi.resetModules();
    nonRhRhMode = true;
    const { resolveRhModoHomeHash: homeComedor, RH_MODO_INICIO_HASH: rhInicio } = await import("./shellNavPolicy.ts");
    expect(homeComedor()).toBe(rhInicio);
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("empleado", "comedor")).toBe(true);
  });
});
