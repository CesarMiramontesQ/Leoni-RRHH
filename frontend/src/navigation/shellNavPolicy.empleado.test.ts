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
  getRolFromAccessToken: () => "empleado",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
}));

describe("shellNavPolicy empleado flat nav", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("detecta rol empleado para menú plano", async () => {
    const { isEmpleadoFlatNavRol } = await import("./shellNavPolicy.ts");
    expect(isEmpleadoFlatNavRol("empleado")).toBe(true);
    expect(isEmpleadoFlatNavRol("operativo")).toBe(false);
    expect(isEmpleadoFlatNavRol("supervisor")).toBe(false);
  });

  it("empleado solo ve dashboard, solicitudes y comedor", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("empleado", "dashboard")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "solicitudes")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "comedor")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "incidencias")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "empleados")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "reportes")).toBe(false);
  });

  it("empleado ve Mis encuestas RH (self-service) pero no la gestión de Encuestas RH", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("empleado", "mis-encuestas-rh")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "encuestas-rh")).toBe(false);
  });

  it("empleado ve Mi desempeño (self-service) pero no la gestión de Ciclo de Desempeño", async () => {
    const { isShellNavItemVisibleForRol, empleadoMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("empleado", "mi-desempeno")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "ciclo-desempeno")).toBe(false);
    expect(empleadoMayAccessHash("#/talento/mi-desempeno")).toBe(true);
  });

  it("empleado no ve hubs agrupados en sidebar", async () => {
    const { isComedorHubVisibleForRol } = await import("./comedorNav.ts");
    const { isLaboralesHubVisibleForRol } = await import("./laboralesNav.ts");
    const { isLevelUpHubVisibleForRol } = await import("./levelUpNav.ts");
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isLaboralesHubVisibleForRol("empleado")).toBe(false);
    expect(isComedorHubVisibleForRol("empleado")).toBe(false);
    expect(isLevelUpHubVisibleForRol("empleado")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "laborales")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "comedor-menu")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "level-up")).toBe(false);
  });

});
