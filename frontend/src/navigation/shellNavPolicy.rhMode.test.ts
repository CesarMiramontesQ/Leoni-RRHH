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
  hasRhModule: (key: string) => key === "dashboard",
  isModulosRhEnrolled: () => true,
}));

describe("shellNavPolicy rh mode", () => {
  beforeEach(() => {
    storage.clear();
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
});
