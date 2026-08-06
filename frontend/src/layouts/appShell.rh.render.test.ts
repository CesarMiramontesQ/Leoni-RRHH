/**
 * Cobertura del sidebar de RH operativo (`renderRhStructuredSidebarSections`).
 *
 * Vive en un archivo aparte de `appShell.render.test.ts` porque `isRhOperativoUiMode`
 * se mockea por archivo (vi.mock aplica a todo el módulo dentro del archivo que lo
 * declara) y el otro archivo ya fija `isRhOperativoUiMode: () => false` para probar
 * empleado/supervisor. Con `true` aquí, `usesRhStructuredSidebar` activa la rama de
 * `renderRhStructuredSidebarSections`, que ningún test previo ejercitaba.
 *
 * El motivo concreto del task: un commit anterior generalizó
 * `renderRhCollapsibleSection` a `renderCollapsibleNavSection` para compartirlo entre
 * RH y supervisor, y se verificó "a mano" que el HTML de RH no cambiara. Este test
 * afirma sobre esa salida real: que las secciones de RH se pintan como `<details>`,
 * que la que contiene la ruta activa abre, y que el `panelId` conserva el prefijo
 * `shell-rh-nav-panel-` (justo lo que la generalización pudo haber roto).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "rh",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => false,
  isHorasExtraRegistroAutorizado: () => false,
  canAccessEmpleadoPersonalDashboard: () => false,
  getUserDisplayNameFromAccessToken: () => "",
  getUserInitialsFromAccessToken: () => "",
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  isNonRhPermisosUser: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => true,
  hasRhPermisosActivos: () => false,
  getRhUiModeLabel: () => "",
  isRhToggleOn: () => false,
  toggleNonRhRhMode: () => {},
  toggleRhUiMode: () => {},
  setAdminUser: () => {},
  setRhInPermisosList: () => {},
  setRhPermisosActivos: () => {},
  getRhUiModeHeaderValue: () => null,
}));

// Mismo patrón que `frontend/src/navigation/rhNav.test.ts`: `hasRhModule` decide qué
// secciones de RH aparecen. El set es mutable porque el número de ítems visibles
// cambia el render: con uno solo la sección se aplana a enlace directo.
const mocks = vi.hoisted(() => ({ modulos: new Set<string>() }));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: (key: string) => mocks.modulos.has(key),
  isModulosRhEnrolled: () => true,
}));

/** Dos ítems por sección: Laborales y Puestos se pintan como acordeón. */
function otorgarDosPorSeccion(): void {
  mocks.modulos = new Set(["solicitudes", "actas", "puestos", "competencias"]);
}

/** Un ítem por sección: ambas se aplanan a enlace directo. */
function otorgarUnoPorSeccion(): void {
  mocks.modulos = new Set(["solicitudes", "puestos"]);
}

import { renderRhStructuredSidebarSections } from "./appShell.ts";

/** Bloques `<details>...</details>` completos del HTML renderizado. */
function detailsBlocks(html: string): string[] {
  return html.match(/<details[\s\S]*?<\/details>/g) ?? [];
}

describe("renderRhStructuredSidebarSections", () => {
  beforeEach(otorgarDosPorSeccion);

  it("pinta las secciones de RH como <details>", () => {
    const html = renderRhStructuredSidebarSections(undefined, "rh");
    // Laborales (solicitudes + actas) y Puestos (puestos + competencias).
    expect(detailsBlocks(html)).toHaveLength(2);
  });

  it("abre solo la sección que contiene la ruta activa", () => {
    const html = renderRhStructuredSidebarSections("solicitudes", "rh");
    const blocks = detailsBlocks(html);
    const laboralesBlock = blocks.find((b) => b.includes('href="#/solicitudes"'));
    const puestosBlock = blocks.find((b) => b.includes('href="#/puestos"'));

    expect(laboralesBlock).toMatch(/<details[^>]*\bopen\b/);
    expect(puestosBlock).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("conserva el prefijo shell-rh-nav-panel- en el panelId de cada sección", () => {
    const html = renderRhStructuredSidebarSections(undefined, "rh");
    expect(html).toContain('id="shell-rh-nav-panel-laborales"');
    expect(html).toContain('id="shell-rh-nav-panel-puestos"');
    expect(html).toContain('aria-controls="shell-rh-nav-panel-laborales"');
    expect(html).toContain('aria-controls="shell-rh-nav-panel-puestos"');
  });

  describe("con un solo ítem visible por sección", () => {
    beforeEach(otorgarUnoPorSeccion);

    it("aplana la sección a un enlace directo, sin <details>", () => {
      const html = renderRhStructuredSidebarSections(undefined, "rh");
      expect(detailsBlocks(html)).toHaveLength(0);
      expect(html).toContain('href="#/solicitudes"');
      expect(html).toContain('href="#/puestos"');
    });

    it("usa el nombre del ítem, no el de la sección", () => {
      const html = renderRhStructuredSidebarSections(undefined, "rh");
      expect(html).toContain("Solicitudes");
      // "Laborales" es el título de la sección: al aplanar ya no se pinta.
      expect(html).not.toContain(">Laborales<");
    });

    it("marca el enlace aplanado como activo cuando es la ruta actual", () => {
      const html = renderRhStructuredSidebarSections("solicitudes", "rh");
      expect(html).toMatch(/href="#\/solicitudes"[^>]*aria-current="page"/);
    });
  });
});
