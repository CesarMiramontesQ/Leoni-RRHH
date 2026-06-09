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
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
}));

describe("shellNavPolicy supervisor structured nav", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("detecta rol supervisor para menú estructurado", async () => {
    const { isSupervisorStructuredNavRol } = await import("./shellNavPolicy.ts");
    expect(isSupervisorStructuredNavRol("supervisor")).toBe(true);
    expect(isSupervisorStructuredNavRol("rh")).toBe(false);
    expect(isSupervisorStructuredNavRol("empleado")).toBe(false);
  });

  it("supervisor solo ve opciones del menú especificado", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("supervisor", "dashboard")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "metricas")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "incidencias")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "solicitudes")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "comedor")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "empleados")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "actas")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "reportes")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "level-up")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "capacitaciones")).toBe(false);
  });

  it("supervisor no ve hubs agrupados", async () => {
    const { isComedorHubVisibleForRol } = await import("./comedorNav.ts");
    const { isLaboralesHubVisibleForRol } = await import("./laboralesNav.ts");
    const { isLevelUpHubVisibleForRol } = await import("./levelUpNav.ts");
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isLaboralesHubVisibleForRol("supervisor")).toBe(false);
    expect(isComedorHubVisibleForRol("supervisor")).toBe(false);
    expect(isLevelUpHubVisibleForRol("supervisor")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "laborales")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "comedor-menu")).toBe(false);
  });

  it("conserva resaltado individual de ítems laborales", async () => {
    const { resolveLaboralesSidebarActiveNav } = await import("./laboralesNav.ts");
    expect(resolveLaboralesSidebarActiveNav("metricas", "supervisor")).toBe("metricas");
    expect(resolveLaboralesSidebarActiveNav("solicitudes", "supervisor")).toBe("solicitudes");
    expect(resolveLaboralesSidebarActiveNav("metricas", "rh")).toBe("laborales");
  });
});
