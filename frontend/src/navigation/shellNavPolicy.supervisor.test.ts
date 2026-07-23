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

describe("shellNavPolicy supervisor structured nav", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("detecta roles con menú estructurado (supervisor y gerente)", async () => {
    const { isSupervisorStructuredNavRol } = await import("./shellNavPolicy.ts");
    expect(isSupervisorStructuredNavRol("supervisor")).toBe(true);
    expect(isSupervisorStructuredNavRol("gerente")).toBe(true);
    expect(isSupervisorStructuredNavRol("operativo")).toBe(false);
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
    expect(isShellNavItemVisibleForRol("supervisor", "metas")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "ciclo-desempeno")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "historial-objetivo")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "mi-desempeno")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "actas")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "reportes")).toBe(false);
    expect(isShellNavItemVisibleForRol("supervisor", "level-up")).toBe(false);
  });

  it("supervisor puede acceder a #/talento/metas (ítem Metas descubrible)", async () => {
    const { supervisorMayAccessHash, isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("supervisor", "metas")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/metas")).toBe(true);
  });

  it("supervisor puede acceder a #/talento/ciclo-desempeno y #/talento/mi-desempeno", async () => {
    const { supervisorMayAccessHash, isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("supervisor", "ciclo-desempeno")).toBe(true);
    expect(isShellNavItemVisibleForRol("supervisor", "mi-desempeno")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/ciclo-desempeno")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/mi-desempeno")).toBe(true);
  });

  it("supervisor puede acceder a #/cumplimiento/historial-objetivo (ítem Historial Objetivo descubrible)", async () => {
    const { supervisorMayAccessHash, isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("supervisor", "historial-objetivo")).toBe(true);
    expect(supervisorMayAccessHash("#/cumplimiento/historial-objetivo")).toBe(true);
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
    expect(resolveLaboralesSidebarActiveNav("metricas", "operativo")).toBe("laborales");
  });

  it("supervisor puede acceder a #/metricas", async () => {
    const { supervisorMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(supervisorMayAccessHash("#/metricas")).toBe(true);
    expect(supervisorMayAccessHash("#/metricas?foo=bar")).toBe(true);
  });
});

describe("shellNavPolicy gerente structured nav", () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it("gerente ve el mismo menú que supervisor", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    expect(isShellNavItemVisibleForRol("gerente", "dashboard")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "metricas")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "incidencias")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "solicitudes")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "comedor")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "empleados")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "metas")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "ciclo-desempeno")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "historial-objetivo")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "actas")).toBe(false);
    expect(isShellNavItemVisibleForRol("gerente", "reportes")).toBe(false);
    expect(isShellNavItemVisibleForRol("gerente", "level-up")).toBe(false);
    expect(isShellNavItemVisibleForRol("gerente", "puestos")).toBe(false);
  });

  it("gerente no ve hubs agrupados", async () => {
    const { isComedorHubVisibleForRol } = await import("./comedorNav.ts");
    const { isLaboralesHubVisibleForRol } = await import("./laboralesNav.ts");
    const { isLevelUpHubVisibleForRol } = await import("./levelUpNav.ts");
    expect(isLaboralesHubVisibleForRol("gerente")).toBe(false);
    expect(isComedorHubVisibleForRol("gerente")).toBe(false);
    expect(isLevelUpHubVisibleForRol("gerente")).toBe(false);
  });

  it("gerente comparte política de rutas con supervisor", async () => {
    const { supervisorMayAccessHash, usesSupervisorRoutePolicy } = await import("./shellNavPolicy.ts");
    expect(usesSupervisorRoutePolicy("gerente")).toBe(true);
    expect(supervisorMayAccessHash("#/metricas")).toBe(true);
    expect(supervisorMayAccessHash("#/actas")).toBe(false);
    expect(supervisorMayAccessHash("#/comedor/reporte")).toBe(false);
    expect(supervisorMayAccessHash("#/level-up")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/metas")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/ciclo-desempeno")).toBe(true);
    expect(supervisorMayAccessHash("#/talento/mi-desempeno")).toBe(true);
    expect(supervisorMayAccessHash("#/cumplimiento/historial-objetivo")).toBe(true);
  });
});
