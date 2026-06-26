import { beforeEach, describe, expect, it, vi } from "vitest";

let gestorAlcance: "supervisor" | "gerente" | null = null;
let tokenRol = "supervisor";
let operativoUiMode = false;

vi.stubGlobal("sessionStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

vi.mock("./session.ts", () => ({
  getAccessToken: () => {
    const payload = btoa(JSON.stringify({ rol: tokenRol, rh_gestor_alcance: gestorAlcance }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `header.${payload}.sig`;
  },
}));

vi.mock("./rhModulePermissions.ts", () => ({
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => true,
}));

vi.mock("./rhUiMode.ts", () => ({
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => gestorAlcance === "gerente",
  isRhGestorTeamUiMode: () => gestorAlcance === "supervisor" || gestorAlcance === "gerente",
  isRhLiderUiMode: () => gestorAlcance === "supervisor",
  isRhDirectorUiMode: () => false,
  isRhOperativoUiMode: () => operativoUiMode,
  isNonRhRhMode: () => false,
}));

describe("canAccessMetricasPage", () => {
  beforeEach(() => {
    tokenRol = "supervisor";
    gestorAlcance = null;
    operativoUiMode = false;
    vi.resetModules();
  });

  it("permite supervisor nativo", async () => {
    tokenRol = "supervisor";
    const { canAccessMetricasPage } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(true);
  });

  it("permite gerente", async () => {
    tokenRol = "gerente";
    const { canAccessMetricasPage } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(true);
  });

  it("deniega empleado", async () => {
    tokenRol = "empleado";
    const { canAccessMetricasPage } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(false);
  });

  it("permite ADMIN en modo líder (métricas de equipo directo)", async () => {
    tokenRol = "supervisor";
    gestorAlcance = "supervisor";
    operativoUiMode = false;
    const { canAccessMetricasPage, canAccessFaltasRetardosPage, canAccessRhIncidenciasPage } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(true);
    expect(canAccessFaltasRetardosPage()).toBe(true);
    expect(canAccessRhIncidenciasPage()).toBe(true);
  });

  it("permite ADMIN en Modo RH operativo vía módulos", async () => {
    tokenRol = "supervisor";
    gestorAlcance = null;
    operativoUiMode = true;
    const { canAccessMetricasPage, canAccessRhOperationalDashboard } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(true);
    expect(canAccessRhOperationalDashboard()).toBe(true);
  });
});
