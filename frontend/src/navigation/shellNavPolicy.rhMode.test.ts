import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

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
  getRolFromAccessToken: () => "rh",
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: (key: string) => allowedModules.has(key),
  isModulosRhEnrolled: () => true,
}));

const allowedModules = new Set<string>(["dashboard"]);

describe("shellNavPolicy rh mode", () => {
  beforeEach(() => {
    storage.clear();
    allowedModules.clear();
    allowedModules.add("dashboard");
  });

  it("modo empleado permite solicitudes y bloquea empleados", async () => {
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
    expect(resolveRhInitialHash("#/")).toBe("#/level-up");
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
});
