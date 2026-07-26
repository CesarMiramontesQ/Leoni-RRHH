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

  it("agrupa el menú por dominio: Talento, Desempeño y Desarrollo", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const sectionIds = getVisibleRhNavSections("supervisor").map((section) => section.id);

    // Ya no hay sección «Level Up»: era un nombre de fase, no un dominio, y sus
    // ítems se repartieron entre las tres secciones de abajo.
    expect(sectionIds).toEqual(["talento", "desempeno", "cursos"]);
    expect(sectionIds).not.toContain("level-up");
    expect(sectionIds).not.toContain("puestos");
  });

  it("ningún ítem aparece en dos secciones", async () => {
    allowedModules.add("dashboard-talento");
    allowedModules.add("encuestas-rh");
    allowedModules.add("operaciones");
    allowedModules.add("ciclo-desempeno");
    allowedModules.add("metas");
    allowedModules.add("evaluacion-360");
    allowedModules.add("historial-objetivo");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const keys = getVisibleRhNavSections("supervisor").flatMap((s) => s.items.map((i) => i.key));

    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("Talento reúne el perfil de puesto y todo lo que se mide sobre él", async () => {
    allowedModules.add("dashboard-talento");
    allowedModules.add("operaciones");
    allowedModules.add("encuestas-rh");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const talento = getVisibleRhNavSections("supervisor").find((s) => s.id === "talento");

    expect(talento?.title).toBe("Talento");
    // Competencias y Matriz de multihabilidades leen la misma tabla, y
    // Cobertura y polivalencia es el building block del propio dashboard:
    // estaban en tres secciones distintas.
    expect(talento?.items.map((item) => item.key)).toEqual([
      "dashboard-talento",
      "puestos",
      "competencias",
      "capacidades",
      "operaciones",
      "tareas-catalogo",
      "puestos-ajustes",
      "encuestas-rh",
    ]);
  });

  it("Desempeño reúne las señales que el ciclo pondera", async () => {
    allowedModules.add("ciclo-desempeno");
    allowedModules.add("metas");
    allowedModules.add("evaluacion-360");
    allowedModules.add("historial-objetivo");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const desempeno = getVisibleRhNavSections("supervisor").find((s) => s.id === "desempeno");

    expect(desempeno?.title).toBe("Desempeño");
    expect(desempeno?.items.map((item) => item.key)).toEqual([
      "ciclo-desempeno",
      "metas",
      "evaluacion-360",
      "evaluaciones",
      "historial-objetivo",
    ]);
  });

  it("Desarrollo incluye Gestión PDI, que no tenía entrada de menú", async () => {
    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const desarrollo = getVisibleRhNavSections("supervisor").find((s) => s.id === "cursos");

    expect(desarrollo?.title).toBe("Desarrollo");
    // `#/pdi-gestion` tenía página propia y era uno de los cinco bloques del
    // Dashboard de Talento, pero solo se llegaba por URL.
    expect(desarrollo?.items).toContainEqual(
      expect.objectContaining({ key: "pdi-gestion", href: "#/pdi-gestion", label: "Gestión PDI" }),
    );
  });

  it("conserva rutas y etiquetas de los ítems que cambiaron de sección", async () => {
    allowedModules.add("operaciones");
    allowedModules.add("evaluacion-360");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    const items = getVisibleRhNavSections("supervisor").flatMap((s) => s.items);
    const porKey = (key: string) => items.find((item) => item.key === key);

    expect(porKey("puestos")).toMatchObject({ href: "#/puestos", label: "Perfiles de puesto" });
    expect(porKey("competencias")).toMatchObject({ href: "#/competencias", label: "Competencias" });
    expect(porKey("capacidades")).toMatchObject({ href: "#/capacidades", label: "Matriz de multihabilidades" });
    expect(porKey("operaciones")).toMatchObject({ href: "#/operaciones", label: "Cobertura y polivalencia" });
    expect(porKey("evaluacion-360")).toMatchObject({ href: "#/level-up/evaluacion-360", label: "Evaluación 360°" });
    expect(porKey("evaluaciones")).toMatchObject({ href: "#/evaluaciones", label: "Evaluaciones" });
    expect(porKey("cursos-seguimiento")).toMatchObject({ href: "#/cursos/seguimiento", label: "Seguimiento" });
  });

  it("omite Desarrollo cuando no hay ítems visibles", async () => {
    for (const key of ["cursos", "cursos-seguimiento", "sesiones", "encuestas", "cursos-ajustes", "pdi-gestion"]) {
      allowedModules.delete(key);
    }

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    expect(getVisibleRhNavSections("supervisor").some((s) => s.id === "cursos")).toBe(false);
  });

  it("omite Talento cuando no hay ninguno de sus módulos", async () => {
    for (const key of ["puestos", "competencias", "tareas-catalogo", "puestos-ajustes"]) {
      allowedModules.delete(key);
    }

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    expect(getVisibleRhNavSections("supervisor").some((s) => s.id === "talento")).toBe(false);
  });

  it("omite Desempeño cuando no hay ninguno de sus módulos", async () => {
    allowedModules.delete("evaluaciones");

    const { getVisibleRhNavSections } = await import("./rhNav.ts");
    expect(getVisibleRhNavSections("supervisor").some((s) => s.id === "desempeno")).toBe(false);
  });
});
