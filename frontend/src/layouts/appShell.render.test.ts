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
  // true: mantiene "Mis trámites" con su único ítem (horas-extra-solicitud)
  // para poder seguir afirmando sobre su <details>; la visibilidad condicional
  // de ese ítem ya se prueba en supervisorNav.test.ts/empleadoNav.test.ts.
  isHorasExtraRegistroAutorizado: () => true,
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
  it("emite el enlace a Equipo exactamente una vez, y va en el pie, no en las secciones", () => {
    const secciones = renderSupervisorSidebarSections(undefined, "supervisor");
    const pie = footerGestionHtml(undefined, "supervisor");
    expect(countOccurrences(secciones, 'href="#/empleados"')).toBe(0);
    expect(countOccurrences(pie, 'href="#/empleados"')).toBe(1);
    // `mt-auto` es lo que lo empuja al fondo del sidebar, igual que en el de RH.
    expect(pie).toContain("mt-auto");
    expect(pie).toContain("Equipo");
  });

  it("pinta las secciones plegables como <details> y deja fuera de <details> las estáticas", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    // Pendientes y Mi desarrollo. "Mis trámites" también es plegable, pero a este
    // supervisor le queda un solo ítem visible y se aplana (ver test siguiente).
    expect(countOccurrences(html, "<details")).toBe(2);
    // Mi equipo y Talento del equipo son "estatica": su título no debe quedar envuelto en <details>.
    expect(html).toContain("Mi equipo");
    expect(html).toContain("Talento del equipo");
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    for (const title of ["Mi equipo", "Talento del equipo"]) {
      expect(detailsBlocks.some((block) => block.includes(title))).toBe(false);
    }
  });

  it("alinea las secciones plegables con las estáticas", () => {
    // Las estáticas traen su propio <ul class="-mx-2">; si las plegables se cuelgan
    // del <ul> del shell sin esa compensación, todo su bloque queda 8px a la
    // derecha del resto del menú.
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    const listas = html.match(/<ul[^>]*>/g) ?? [];
    const deSeccion = listas.filter((ul) => !ul.includes("shell-rh-nav-panel-"));
    expect(deSeccion.length).toBeGreaterThan(1);
    for (const ul of deSeccion) {
      expect(ul).toContain("-mx-2");
    }
  });

  it("pinta como estática la sección plegable que queda con un solo ítem", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    // "Mis trámites" solo deja visible "Horas extra": sin acordeón (no aporta
    // jerarquía para un solo enlace) pero conservando el encabezado, porque todos
    // los demás grupos llevan uno y sin él el enlace flotaría suelto.
    expect(html).toContain('href="#/horas-extra/solicitud"');
    expect(detailsBlocks.some((block) => block.includes("Mis trámites"))).toBe(false);
    expect(html).toContain("Mis trámites");
    expect(html).toContain('aria-labelledby="shell-nav-section-tramites"');
  });

  it("abre la sección plegable que contiene la ruta activa", () => {
    const htmlConActiva = renderSupervisorSidebarSections("mis-firmas", "supervisor");
    expect(htmlConActiva).toMatch(/<details[^>]*\bopen\b/);

    // "metricas" vive en la sección estática "Mi equipo": ninguna <details> debe abrirse.
    const htmlSinActivaPlegable = renderSupervisorSidebarSections("metricas", "supervisor");
    expect(htmlSinActivaPlegable).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("emite el enlace a Comedor exactamente una vez, suelto arriba y fuera de cualquier <details>", () => {
    const html = renderSupervisorSidebarSections(undefined, "supervisor");
    expect(countOccurrences(html, 'href="#/comedor"')).toBe(1);
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    expect(detailsBlocks.some((block) => block.includes('href="#/comedor"'))).toBe(false);
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

  it("emite el enlace a Comedor exactamente una vez, suelto arriba y fuera de cualquier <details>", () => {
    const html = renderEmpleadoSidebarSections(undefined, "empleado");
    expect(countOccurrences(html, 'href="#/comedor"')).toBe(1);
    const detailsBlocks = html.match(/<details[\s\S]*?<\/details>/g) ?? [];
    expect(detailsBlocks.some((block) => block.includes('href="#/comedor"'))).toBe(false);
  });
});

describe("footerGestionHtml", () => {
  it("sigue emitiendo el pie para roles que no son supervisor/gerente ni RH estructurado", () => {
    const html = footerGestionHtml(undefined, "director");
    expect(html).toContain('href="#/empleados"');
  });
});
