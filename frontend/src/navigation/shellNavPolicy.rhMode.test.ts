import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
let gestorAlcance: "supervisor" | "gerente" | null = null;
let jwtRol: string | null = "supervisor";

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => jwtRol,
  getRhGestorAlcanceFromToken: () => gestorAlcance,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: (key: string) => allowedModules.has(key),
  isModulosRhEnrolled: () => true,
}));

const allowedModules = new Set<string>(["dashboard"]);

describe("shellNavPolicy rh mode", () => {
  beforeEach(async () => {
    storage.clear();
    gestorAlcance = null;
    jwtRol = "supervisor";
    allowedModules.clear();
    allowedModules.add("dashboard");
    vi.resetModules();
    const { setAdminUser } = await import("../auth/rhUiMode.ts");
    setAdminUser(true);
  });

  it("modo empleado permite solicitudes y bloquea empleados", async () => {
    jwtRol = "empleado";
    const { setRhUiMode } = await import("../auth/rhUiMode.ts");
    const { rhMayAccessHash } = await import("./shellNavPolicy.ts");
    setRhUiMode("empleado");
    expect(rhMayAccessHash("#/solicitudes")).toBe(true);
    expect(rhMayAccessHash("#/empleados")).toBe(false);
  });

  it("modo operativo respeta módulo dashboard", async () => {
    const { rhMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(rhMayAccessHash("#/")).toBe(true);
    expect(rhMayAccessHash("#/empleados")).toBe(false);
  });

  it("modo líder usa menú supervisor y bloquea actas", async () => {
    gestorAlcance = "supervisor";
    const { setRhUiMode } = await import("../auth/rhUiMode.ts");
    const { isShellNavItemVisibleForRol, rhMayAccessHash } = await import("./shellNavPolicy.ts");
    setRhUiMode("lider");
    expect(isShellNavItemVisibleForRol("supervisor", "solicitudes")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "actas")).toBe(false);
    expect(rhMayAccessHash("#/actas")).toBe(false);
    expect(rhMayAccessHash("#/solicitudes")).toBe(true);
  });

  it("modo gerente permite evaluaciones y bloquea permisos RH", async () => {
    jwtRol = "gerente";
    gestorAlcance = "gerente";
    const { setRhUiMode } = await import("../auth/rhUiMode.ts");
    const { rhMayAccessHash } = await import("./shellNavPolicy.ts");
    setRhUiMode("gerente");
    expect(rhMayAccessHash("#/evaluaciones")).toBe(true);
    expect(rhMayAccessHash("#/ajustes/permisos-rh")).toBe(false);
  });

  it("aterrizaje operativo elige la primera página permitida del menú", async () => {
    allowedModules.clear();
    allowedModules.add("metricas");
    allowedModules.add("level-up");
    const { resolveRhOperativoLandingHash } = await import("./shellNavPolicy.ts");
    expect(resolveRhOperativoLandingHash()).toBe("#/metricas");
  });

  it("resolveRhInitialHash redirige desde inicio cuando no hay dashboard", async () => {
    allowedModules.clear();
    allowedModules.add("level-up");
    const { resolveRhInitialHash, RH_SIN_PERMISOS_HASH } = await import("./shellNavPolicy.ts");
    expect(resolveRhInitialHash("#/")).toBe("#/level-up/resumen");
    expect(resolveRhInitialHash("#/")).not.toBe("#/");
    allowedModules.clear();
    expect(resolveRhInitialHash("#/")).toBe(RH_SIN_PERMISOS_HASH);
  });

  it("resolveRhInitialHash conserva deep links válidos", async () => {
    allowedModules.clear();
    allowedModules.add("level-up");
    const { resolveRhInitialHash } = await import("./shellNavPolicy.ts");
    expect(resolveRhInitialHash("#/level-up")).toBe("#/level-up");
  });

  it("resolveRhInitialHash en modo líder mantiene inicio en dashboard equipo", async () => {
    gestorAlcance = "supervisor";
    const { setRhUiMode } = await import("../auth/rhUiMode.ts");
    const { resolveRhInitialHash } = await import("./shellNavPolicy.ts");
    setRhUiMode("lider");
    expect(resolveRhInitialHash("#/")).toBe("#/");
  });

  it("resolveRhModeLandingHash en modo gerente siempre va al dashboard equipo", async () => {
    jwtRol = "gerente";
    gestorAlcance = "gerente";
    const { setRhUiMode } = await import("../auth/rhUiMode.ts");
    const { resolveRhModeLandingHash } = await import("./shellNavPolicy.ts");
    setRhUiMode("gerente");
    expect(resolveRhModeLandingHash()).toBe("#/");
  });

  it("resolveRhModeLandingHash en modo operativo usa dashboard o primera página permitida", async () => {
    const { resolveRhModeLandingHash } = await import("./shellNavPolicy.ts");
    expect(resolveRhModeLandingHash()).toBe("#/");

    allowedModules.clear();
    allowedModules.add("metricas");
    vi.resetModules();
    const { setAdminUser } = await import("../auth/rhUiMode.ts");
    setAdminUser(true);
    const { resolveRhModeLandingHash: landing } = await import("./shellNavPolicy.ts");
    expect(landing()).toBe("#/metricas");
  });
});
