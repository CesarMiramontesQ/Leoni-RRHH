import { beforeEach, describe, expect, it, vi } from "vitest";

let gestorAlcance: "supervisor" | "gerente" | null = null;
let tokenRol = "supervisor";

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
  isRhGestorTeamUiMode: () => gestorAlcance === "supervisor",
  isRhLiderUiMode: () => gestorAlcance === "supervisor",
  isRhOperativoUiMode: () => gestorAlcance === null,
}));

describe("canAccessMetricasPage", () => {
  beforeEach(() => {
    tokenRol = "supervisor";
    gestorAlcance = null;
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

  it("deniega RH en modo líder (usa dashboard de equipo, no métricas globales)", async () => {
    tokenRol = "rh";
    gestorAlcance = "supervisor";
    const { canAccessMetricasPage } = await import("./jwt.ts");
    expect(canAccessMetricasPage()).toBe(false);
  });
});
