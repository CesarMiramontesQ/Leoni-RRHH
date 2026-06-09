import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("localStorage", {
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
  getRhGestorAlcanceFromToken: () => null,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: (key: string) => allowedModules.has(key),
  isModulosRhEnrolled: () => true,
}));

const allowedModules = new Set<string>([
  "cursos",
  "sesiones",
  "capacitaciones",
  "puestos",
  "evaluaciones",
  "level-up",
]);

describe("rhNav sections", () => {
  beforeEach(() => {
    storage.clear();
    allowedModules.clear();
    allowedModules.add("cursos");
    allowedModules.add("sesiones");
    allowedModules.add("capacitaciones");
    allowedModules.add("puestos");
    allowedModules.add("evaluaciones");
    allowedModules.add("level-up");
    vi.resetModules();
  });

  it("expone Cursos como sección independiente sin duplicar ítems en Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    const cursosSection = sections.find((section) => section.id === "cursos");
    const levelUpSection = sections.find((section) => section.id === "level-up");

    expect(cursosSection?.title).toBe("Cursos");
    expect(cursosSection?.items.map((item) => item.key)).toEqual([
      "cursos",
      "sesiones",
      "capacitaciones",
    ]);
    expect(levelUpSection?.items.some((item) => item.key === "cursos")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "sesiones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "capacitaciones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "puestos")).toBe(true);
  });

  it("conserva rutas y etiquetas originales de los ítems movidos", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const cursosSection = getVisibleRhNavSections("rh").find((section) => section.id === "cursos");

    expect(cursosSection?.items).toEqual([
      expect.objectContaining({
        key: "cursos",
        href: "#/cursos",
        label: "Catálogo de cursos",
      }),
      expect.objectContaining({
        key: "sesiones",
        href: "#/sesiones",
        label: "Sesiones",
      }),
      expect.objectContaining({
        key: "capacitaciones",
        href: "#/capacitaciones",
        label: "Capacitaciones",
      }),
    ]);
  });

  it("omite Cursos cuando no hay ítems visibles", async () => {
    allowedModules.delete("cursos");
    allowedModules.delete("sesiones");
    allowedModules.delete("capacitaciones");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    expect(sections.some((section) => section.id === "cursos")).toBe(false);
  });
});
