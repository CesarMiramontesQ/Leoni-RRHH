import { beforeEach, describe, expect, it, vi } from "vitest";

let mockRol: string | null = "empleado";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => mockRol,
  getRhGestorAlcanceFromToken: () => null,
}));

describe("module back link", () => {
  beforeEach(() => {
    mockRol = "empleado";
    vi.resetModules();
  });

  it("no muestra Volver en Solicitudes para ningún rol", async () => {
    const { renderSolicitudesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderSolicitudesBackBar()).toBe("");
  });

  it("no muestra Volver en Comedor para ningún rol", async () => {
    const { renderComedorBackBar } = await import("./comedorBackLink.ts");
    expect(renderComedorBackBar()).toBe("");
  });

  it("no muestra Volver en Laborales para ningún rol", async () => {
    const { renderLaboralesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderLaboralesBackBar()).toBe("");
  });

  it("no muestra Volver en Level Up para ningún rol", async () => {
    mockRol = "supervisor";
    vi.resetModules();
    const { renderLevelUpBackBar } = await import("./levelUpBackLink.ts");
    expect(renderLevelUpBackBar()).toBe("");
  });
});
