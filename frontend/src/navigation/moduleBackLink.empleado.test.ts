import { beforeEach, describe, expect, it, vi } from "vitest";

let mockRol: string | null = "empleado";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => mockRol,
}));

describe("module back link empleado", () => {
  beforeEach(() => {
    mockRol = "empleado";
    vi.resetModules();
  });

  it("oculta Volver en Solicitudes para rol empleado", async () => {
    const { renderSolicitudesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderSolicitudesBackBar()).toBe("");
  });

  it("muestra Volver en Solicitudes para rol RH", async () => {
    mockRol = "rh";
    vi.resetModules();
    const { renderSolicitudesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderSolicitudesBackBar()).toContain("Volver");
    expect(renderSolicitudesBackBar()).toContain("#/laborales");
  });

  it("oculta Volver en Comedor para rol empleado", async () => {
    const { renderComedorBackBar } = await import("./comedorBackLink.ts");
    expect(renderComedorBackBar()).toBe("");
  });

  it("muestra Volver en Comedor para rol RH", async () => {
    mockRol = "rh";
    vi.resetModules();
    const { renderComedorBackBar } = await import("./comedorBackLink.ts");
    expect(renderComedorBackBar()).toContain("Volver");
    expect(renderComedorBackBar()).toContain("#/comedor/accesos");
  });

  it("mantiene Volver en otros módulos laborales para empleado", async () => {
    const { renderLaboralesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderLaboralesBackBar()).toContain("Volver");
  });

  it("oculta Volver en Laborales para rol supervisor", async () => {
    mockRol = "supervisor";
    vi.resetModules();
    const { renderLaboralesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderLaboralesBackBar()).toBe("");
  });

  it("oculta Volver en Comedor para rol supervisor", async () => {
    mockRol = "supervisor";
    vi.resetModules();
    const { renderComedorBackBar } = await import("./comedorBackLink.ts");
    expect(renderComedorBackBar()).toBe("");
  });

  it("oculta Volver en Solicitudes para rol supervisor", async () => {
    mockRol = "supervisor";
    vi.resetModules();
    const { renderSolicitudesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderSolicitudesBackBar()).toBe("");
  });

  it("muestra Volver en Métricas para rol RH", async () => {
    mockRol = "rh";
    vi.resetModules();
    const { renderLaboralesBackBar } = await import("./laboralesBackLink.ts");
    expect(renderLaboralesBackBar()).toContain("Volver");
  });
});
