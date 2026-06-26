import { beforeEach, describe, expect, it, vi } from "vitest";

let gestorAlcance: "supervisor" | "gerente" | null = null;
let tokenRol = "rh";
let operativoUiMode = false;

vi.stubGlobal("sessionStorage", {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

vi.mock("../../auth/session.ts", () => ({
  getAccessToken: () => {
    const payload = btoa(JSON.stringify({ rol: tokenRol, rh_gestor_alcance: gestorAlcance }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `header.${payload}.sig`;
  },
}));

vi.mock("../../auth/rhUiMode.ts", () => ({
  isAdminUser: () => true,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => gestorAlcance === "gerente",
  isRhGestorTeamUiMode: () => gestorAlcance === "supervisor" || gestorAlcance === "gerente",
  isRhLiderUiMode: () => gestorAlcance === "supervisor",
  isRhDirectorUiMode: () => false,
  isRhOperativoUiMode: () => operativoUiMode,
  isNonRhRhMode: () => false,
}));

describe("incidenciasUiConfig", () => {
  beforeEach(() => {
    tokenRol = "rh";
    gestorAlcance = null;
    operativoUiMode = false;
    vi.resetModules();
  });

  it("modo gerente no lanza error y oculta tarjetas estadísticas", async () => {
    gestorAlcance = "gerente";
    const { incidenciasUiConfig } = await import("./incidenciasUiConfig.ts");
    expect(incidenciasUiConfig()).toEqual({
      modoFiltros: "rh",
      mostrarFiltroSupervisor: false,
      mostrarTarjetasEstadisticas: false,
    });
  });

  it("modo operativo RH muestra tarjetas estadísticas", async () => {
    operativoUiMode = true;
    const { incidenciasUiConfig } = await import("./incidenciasUiConfig.ts");
    expect(incidenciasUiConfig().mostrarTarjetasEstadisticas).toBe(true);
  });
});
