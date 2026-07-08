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
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => false,
  isHorasExtraRegistroAutorizado: () => false,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: (key: string) => allowedModules.has(key),
  isModulosRhEnrolled: () => true,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => adminUser,
  isNonRhRhMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => adminUser,
}));

let adminUser = true;

const allowedModules = new Set<string>([
  "cursos",
  "cursos-seguimiento",
  "cursos-ajustes",
  "sesiones",
  "puestos",
  "competencias",
  "tareas-catalogo",
  "puestos-ajustes",
  "evaluaciones",
  "pdi-gestion",
  "opls",
  "evidencias",
  "sugerencias",
  "encuestas",
  "level-up",
]);

describe("rhNav sections", () => {
  beforeEach(() => {
    storage.clear();
    adminUser = true;
    allowedModules.clear();
    allowedModules.add("cursos");
    allowedModules.add("cursos-seguimiento");
    allowedModules.add("cursos-ajustes");
    allowedModules.add("sesiones");
    allowedModules.add("puestos");
    allowedModules.add("competencias");
    allowedModules.add("tareas-catalogo");
    allowedModules.add("puestos-ajustes");
    allowedModules.add("evaluaciones");
    allowedModules.add("pdi-gestion");
    allowedModules.add("opls");
    allowedModules.add("evidencias");
    allowedModules.add("sugerencias");
    allowedModules.add("encuestas");
    allowedModules.add("level-up");
    vi.resetModules();
  });

  it("expone Cursos como sección independiente sin duplicar ítems en Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

    const cursosSection = sections.find((section) => section.id === "cursos");
    const levelUpSection = sections.find((section) => section.id === "level-up");

    expect(cursosSection?.title).toBe("Cursos");
    expect(cursosSection?.items.map((item) => item.key)).toEqual([
      "cursos-seguimiento",
      "cursos",
      "sesiones",
      "encuestas",
      "cursos-ajustes",
    ]);
    expect(levelUpSection?.items.some((item) => item.key === "cursos")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "sesiones")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "encuestas")).toBe(false);
  });

  it("expone Personal Externo como sección de primer nivel con sus tres subpáginas", async () => {
    allowedModules.add("proveedores-externos");
    allowedModules.add("cursos-externos");
    allowedModules.add("cursos-vencimientos");
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

    const peSection = sections.find((section) => section.id === "personal-externo");
    const cursosSection = sections.find((section) => section.id === "cursos");

    expect(peSection?.title).toBe("Personal Externo");
    expect(peSection?.items.map((item) => item.key)).toEqual([
      "cursos-proveedores",
      "cursos-externos",
      "cursos-vencimientos",
    ]);
    // Ya no cuelgan del acordeón Cursos.
    expect(cursosSection?.items.some((item) => item.key === "cursos-proveedores")).toBe(false);
    expect(cursosSection?.items.some((item) => item.key === "cursos-externos")).toBe(false);
    expect(cursosSection?.items.some((item) => item.key === "cursos-vencimientos")).toBe(false);
  });

  it("expone Puestos como sección independiente sin duplicar ítems en Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

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

  it("no expone sección Cumplimiento; Evaluaciones vive dentro de Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

    const cumplimientoSection = sections.find((section) => section.id === "cumplimiento");
    const levelUpSection = sections.find((section) => section.id === "level-up");

    expect(cumplimientoSection).toBeUndefined();
    expect(levelUpSection?.items.some((item) => item.key === "evaluaciones")).toBe(true);
    expect(levelUpSection?.items.some((item) => item.key === "encuestas")).toBe(false);
    expect(levelUpSection?.items.some((item) => item.key === "level-up")).toBe(true);
  });

  it("conserva rutas y etiquetas originales de los ítems de Cursos", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const cursosSection = getVisibleRhNavSections("supervisor").find((section) => section.id === "cursos");

    expect(cursosSection?.items).toEqual([
      expect.objectContaining({
        key: "cursos-seguimiento",
        href: "#/cursos/seguimiento",
        label: "Seguimiento",
      }),
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
        key: "encuestas",
        href: "#/encuestas",
        label: "Encuestas Post Curso",
      }),
      expect.objectContaining({
        key: "cursos-ajustes",
        href: "#/cursos/ajustes",
        label: "Ajustes de cursos",
      }),
    ]);
  });

  it("conserva rutas y etiquetas originales de los ítems de Puestos", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const puestosSection = getVisibleRhNavSections("supervisor").find((section) => section.id === "puestos");

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

  it("conserva ruta y etiqueta de Evaluaciones dentro de Level Up", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const levelUpSection = getVisibleRhNavSections("supervisor").find(
      (section) => section.id === "level-up",
    );

    expect(levelUpSection?.items).toContainEqual(
      expect.objectContaining({
        key: "evaluaciones",
        href: "#/evaluaciones",
        label: "Evaluaciones",
      }),
    );
  });

  it("ordena módulos de forma lógica para RH", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sectionIds = getVisibleRhNavSections("supervisor").map((section) => section.id);

    expect(sectionIds).toEqual(["cursos", "puestos", "level-up"]);
  });

  it("omite Cursos cuando no hay ítems visibles", async () => {
    allowedModules.delete("cursos");
    allowedModules.delete("cursos-seguimiento");
    allowedModules.delete("sesiones");
    allowedModules.delete("encuestas");
    allowedModules.delete("cursos-ajustes");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

    expect(sections.some((section) => section.id === "cursos")).toBe(false);
  });

  it("omite Puestos cuando no hay ítems visibles", async () => {
    allowedModules.delete("puestos");
    allowedModules.delete("competencias");
    allowedModules.delete("tareas-catalogo");
    allowedModules.delete("puestos-ajustes");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sections = getVisibleRhNavSections("supervisor");

    expect(sections.some((section) => section.id === "puestos")).toBe(false);
  });

});
