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
  "competencias",
  "tareas-catalogo",
  "puestos-ajustes",
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
    allowedModules.add("competencias");
    allowedModules.add("tareas-catalogo");
    allowedModules.add("puestos-ajustes");
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
  });

  it("expone Puestos como sección independiente sin duplicar ítems en Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    const puestosSection = sections.find((section) => section.id === "puestos");
    const levelUpSection = sections.find((section) => section.id === "level-up");

    expect(puestosSection?.title).toBe("Puestos");
    expect(puestosSection?.items.map((item) => item.key)).toEqual([
      "puestos",
      "competencias",
      "tareas-catalogo",
      "puestos-ajustes",
    ]);
    expect(levelUpSection?.items.some((item) => item.key === "puestos")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "competencias")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "tareas-catalogo")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "puestos-ajustes")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "evaluaciones")).toBe(true);
  });

  it("conserva rutas y etiquetas originales de los ítems de Cursos", async () => {
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

  it("conserva rutas y etiquetas originales de los ítems de Puestos", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const puestosSection = getVisibleRhNavSections("rh").find((section) => section.id === "puestos");

    expect(puestosSection?.items).toEqual([
      expect.objectContaining({
        key: "puestos",
        href: "#/puestos",
        label: "Perfiles de puesto",
      }),
      expect.objectContaining({
        key: "competencias",
        href: "#/competencias",
        label: "Competencias",
      }),
      expect.objectContaining({
        key: "tareas-catalogo",
        href: "#/tareas-catalogo",
        label: "Tareas",
      }),
      expect.objectContaining({
        key: "puestos-ajustes",
        href: "#/puestos/ajustes",
        label: "Ajustes perfil de puesto",
      }),
    ]);
  });

  it("ordena módulos de forma lógica para RH", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sectionIds = getVisibleRhNavSections("rh").map((section) => section.id);

    expect(sectionIds).toEqual(["cursos", "puestos", "level-up"]);
  });

  it("omite Cursos cuando no hay ítems visibles", async () => {
    allowedModules.delete("cursos");
    allowedModules.delete("sesiones");
    allowedModules.delete("capacitaciones");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    expect(sections.some((section) => section.id === "cursos")).toBe(false);
  });

  it("omite Puestos cuando no hay ítems visibles", async () => {
    allowedModules.delete("puestos");
    allowedModules.delete("competencias");
    allowedModules.delete("tareas-catalogo");
    allowedModules.delete("puestos-ajustes");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    expect(sections.some((section) => section.id === "puestos")).toBe(false);
  });
});
