import { beforeEach, describe, expect, it, vi } from "vitest";

let structuredSidebar = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "supervisor",
}));

vi.mock("./shellNavPolicy.ts", () => ({
  usesRhStructuredSidebar: () => structuredSidebar,
}));

// Helpers de remapeo del sidebar plano: el de Level Up colapsa las sub-claves de
// Talento al hub; el resto se deja como identidad para aislar la lógica de ramas.
const TALENTO_KEYS = new Set([
  "cursos",
  "puestos",
  "competencias",
  "evaluaciones",
  "opls",
  "tareas-catalogo",
]);
vi.mock("./laboralesNav.ts", () => ({ resolveLaboralesSidebarActiveNav: (nav: string) => nav }));
vi.mock("./comedorNav.ts", () => ({ resolveComedorSidebarActiveNav: (nav: string) => nav }));
vi.mock("./nominasNav.ts", () => ({ resolveNominasSidebarActiveNav: (nav: string) => nav }));
vi.mock("./levelUpNav.ts", () => ({
  resolveLevelUpSidebarActiveNav: (nav: string) => (TALENTO_KEYS.has(nav) ? "level-up" : nav),
}));

describe("resolveShellSidebarActiveNav", () => {
  beforeEach(() => {
    structuredSidebar = false;
    vi.resetModules();
  });

  it("sidebar estructurado (admin operativo o no-RH en Modo RH): conserva la sub-clave activa", async () => {
    structuredSidebar = true;
    const { resolveShellSidebarActiveNav } = await import("./shellSidebarActiveNav.ts");
    for (const key of ["cursos", "puestos", "competencias", "evaluaciones", "opls", "tareas-catalogo"]) {
      expect(resolveShellSidebarActiveNav(key)).toBe(key);
    }
  });

  it("sidebar plano: remapea las sub-claves de Talento al hub level-up", async () => {
    structuredSidebar = false;
    const { resolveShellSidebarActiveNav } = await import("./shellSidebarActiveNav.ts");
    expect(resolveShellSidebarActiveNav("cursos")).toBe("level-up");
    expect(resolveShellSidebarActiveNav("competencias")).toBe("level-up");
  });
});
