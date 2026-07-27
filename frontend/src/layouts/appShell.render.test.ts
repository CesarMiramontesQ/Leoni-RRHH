/**
 * `appShell.ts` no tenía cobertura: sus funciones de render de sidebar
 * devuelven strings de HTML (no tocan el DOM), así que se pueden probar en
 * el entorno `node` de vitest afirmando sobre el string, sin jsdom.
 *
 * El motivo concreto del task: en el supervisor, `Empleados` se movió del pie
 * anclado (`footerGestionHtml`) al interior de la sección estática "Mi
 * equipo". Si el pie siguiera emitiéndolo, el ítem saldría duplicado.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => null,
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
  isRhOperativoUiMode: () => false,
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

import {
  footerGestionHtml,
  renderEmpleadoSidebarSections,
  renderSupervisorSidebarSections,
} from "./appShell.ts";

/** Cuenta cuántas veces aparece una subcadena literal en `html`. */
function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("renderSupervisorSidebarSections", () => {
  it("emite el enlace a Empleados exactamente una vez, y el pie no lo repite", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    expect(countOccurrences(html, 'href="#/empleados"')).toBe(1);
    expect(footerGestionHtml(undefined, "supervisor")).toBe("");
  });

  it("pinta las secciones plegables como <details> y deja fuera de <details> las estáticas", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    // Mis trámites, Pendientes y Mi desarrollo son "plegable" en SUPERVISOR_NAV_SECTIONS.
    expect(countOccurrences(html, "<details")).toBe(3);
    // Mi equipo y Talento del equipo son "estatica": su título no debe quedar envuelto en <details>.
    expect(html).toContain("Mi equipo");
    expect(html).toContain("Talento del equipo");
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    for (const title of ["Mi equipo", "Talento del equipo"]) {
      expect(detailsBlocks.some((block) => block.includes(title))).toBe(false);
    }
  });

  it("abre la sección plegable que contiene la ruta activa", () => {
    const htmlConActiva = renderSupervisorSidebarSections("mis-firmas", "supervisor");
    expect(htmlConActiva).toMatch(/<details[^>]*\bopen\b/);

    // "metricas" vive en la sección estática "Mi equipo": ninguna <details> debe abrirse.
    const htmlSinActivaPlegable = renderSupervisorSidebarSections("metricas", "supervisor");
    expect(htmlSinActivaPlegable).not.toMatch(/<details[^>]*\bopen\b/);
  });
});

describe("renderEmpleadoSidebarSections", () => {
  it("pinta sus tres secciones de forma estática, sin <details>", () => {
    const html = renderEmpleadoSidebarSections(undefined, "empleado");
    expect(countOccurrences(html, "<details")).toBe(0);
    // No basta con "sin <details>": un string vacío también lo cumpliría.
    // Confirma que sí renderizó las tres secciones estáticas del empleado.
    expect(html).toContain("Mis trámites");
    expect(html).toContain("Pendientes");
    expect(html).toContain("Mi desarrollo");
  });
});

describe("footerGestionHtml", () => {
  it("sigue emitiendo el pie para roles que no son supervisor/gerente ni RH estructurado", () => {
    const html = footerGestionHtml(undefined, "director");
    expect(html).toContain('href="#/empleados"');
  });
});
