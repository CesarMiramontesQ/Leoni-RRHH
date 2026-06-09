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
  "opls",
  "evidencias",
  "sugerencias",
  "encuestas",
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
    allowedModules.add("opls");
    allowedModules.add("evidencias");
    allowedModules.add("sugerencias");
    allowedModules.add("encuestas");
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
      "encuestas",
    ]);
    expect(levelUpSection?.items.some((item) => item.key === "cursos")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "sesiones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "capacitaciones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "encuestas")).toBe(false);
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
  });

  it("expone Cumplimiento como sección independiente sin duplicar ítems en Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    const cumplimientoSection = sections.find((section) => section.id === "cumplimiento");
    const levelUpSection = sections.find((section) => section.id === "level-up");

    expect(cumplimientoSection?.title).toBe("Cumplimiento");
    expect(cumplimientoSection?.items.map((item) => item.key)).toEqual([
      "evaluaciones",
      "opls",
      "evidencias",
      "sugerencias",
    ]);
    expect(levelUpSection?.items.some((item) => item.key === "evaluaciones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "opls")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "evidencias")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "sugerencias")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "encuestas")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "level-up")).toBe(true);
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
      expect.objectContaining({
        key: "encuestas",
        href: "#/encuestas",
        label: "Encuestas Post Curso",
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

  it("conserva rutas y etiquetas originales de los ítems de Cumplimiento", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const cumplimientoSection = getVisibleRhNavSections("rh").find(
      (section) => section.id === "cumplimiento",
    );

    expect(cumplimientoSection?.items).toEqual([
      expect.objectContaining({
        key: "evaluaciones",
        href: "#/evaluaciones",
        label: "Evaluaciones",
      }),
      expect.objectContaining({
        key: "opls",
        href: "#/opls",
        label: "Manejo de OPLs",
      }),
      expect.objectContaining({
        key: "evidencias",
        href: "#/evidencias",
        label: "Motor de Evidencias",
      }),
      expect.objectContaining({
        key: "sugerencias",
        href: "#/sugerencias",
        label: "Motor de Sugerencias",
      }),
    ]);
  });

  it("ordena módulos de forma lógica para RH", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sectionIds = getVisibleRhNavSections("rh").map((section) => section.id);

    expect(sectionIds).toEqual(["cursos", "puestos", "cumplimiento", "level-up"]);
  });

  it("omite Cursos cuando no hay ítems visibles", async () => {
    allowedModules.delete("cursos");
    allowedModules.delete("sesiones");
    allowedModules.delete("capacitaciones");
    allowedModules.delete("encuestas");

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

  it("omite Cumplimiento cuando no hay ítems visibles", async () => {
    allowedModules.delete("evaluaciones");
    allowedModules.delete("opls");
    allowedModules.delete("evidencias");
    allowedModules.delete("sugerencias");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("rh");

    expect(sections.some((section) => section.id === "cumplimiento")).toBe(false);
  });
});
