/**
 * El menú del supervisor separa el trabajo del equipo (estático, diario) de sus
 * propias páginas (plegable, secundario). Lo que se protege aquí es que reagrupar
 * no agregue ni quite accesos, que cada página caiga donde el supervisor la va a
 * buscar, y que las plegables tengan icono — sin él desaparecen en el rail de tablet.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let heAprobador = false;
let heAutorizado = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "supervisor",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
  isHorasExtraAprobador: () => heAprobador,
  isHorasExtraRegistroAutorizado: () => heAutorizado,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
}));

import {
  SUPERVISOR_DASHBOARD_ITEM,
  SUPERVISOR_NAV_SECTIONS,
  SUPERVISOR_TOP_ITEMS,
  getVisibleSupervisorNavSections,
} from "./supervisorNav.ts";

/** Todo lo que el menú ofrece, sin filtrar por permiso: los ítems sueltos de
 * arriba (Dashboard, Comedor) más los de las secciones. */
const TODOS = [
  ...SUPERVISOR_TOP_ITEMS,
  ...SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items),
];

describe("SUPERVISOR_NAV_SECTIONS", () => {
  it("tiene las cinco secciones en orden", () => {
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "equipo",
      "talento-equipo",
      "tramites",
      "pendientes",
      "desarrollo",
    ]);
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Mi equipo",
      "Talento del equipo",
      "Mis trámites",
      "Pendientes",
      "Mi desarrollo",
    ]);
  });

  it("deja estático lo del equipo y plegable lo personal", () => {
    expect(SUPERVISOR_NAV_SECTIONS.map((s) => s.tipo)).toEqual([
      "estatica",
      "estatica",
      "plegable",
      "plegable",
      "plegable",
    ]);
  });

  it("da icono a toda sección plegable y solo a ésas", () => {
    // Sin icono, una sección cerrada desaparece en el rail de tablet
    // (el encabezado lleva md:max-lg:hidden) y sus ítems quedan inalcanzables.
    for (const seccion of SUPERVISOR_NAV_SECTIONS) {
      if (seccion.tipo === "plegable") {
        expect(seccion.iconSvgPaths, seccion.id).toBeTruthy();
      } else {
        expect(seccion.iconSvgPaths, seccion.id).toBeUndefined();
      }
    }
  });

  it("coloca cada ítem en su sección, en orden", () => {
    const porSeccion = Object.fromEntries(
      SUPERVISOR_NAV_SECTIONS.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.equipo).toEqual([
      "empleados",
      "metricas",
      "incidencias",
      "faltas-retardos",
      "solicitudes",
    ]);
    expect(porSeccion["talento-equipo"]).toEqual([
      "dashboard-talento",
      "metas",
      "ciclo-desempeno",
      "historial-objetivo",
    ]);
    expect(porSeccion.tramites).toEqual(["horas-extra-solicitud"]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "horas-extra-aprobaciones",
      "mis-encuestas",
      "mis-encuestas-rh",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("deja el dashboard fuera de las secciones", () => {
    expect(SUPERVISOR_DASHBOARD_ITEM.id).toBe("dashboard");
    const enSecciones = SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(enSecciones).not.toContain("dashboard");
  });

  it("reagrupar no agregó ni quitó accesos", () => {
    // Los mismos 19 ids que el supervisor alcanza hoy (viajes-laborales pasó a
    // ser exclusivo de RH y salió del menú): 17 viven en las secciones, y 2 son
    // sueltos arriba (dashboard, comedor).
    expect(TODOS.map((i) => i.id).sort()).toEqual(
      [
        "ciclo-desempeno",
        "comedor",
        "dashboard",
        "dashboard-talento",
        "empleados",
        "faltas-retardos",
        "historial-objetivo",
        "horas-extra-aprobaciones",
        "horas-extra-solicitud",
        "incidencias",
        "metas",
        "metricas",
        "mi-desempeno",
        "mis-aprobaciones-opl",
        "mis-encuestas",
        "mis-encuestas-rh",
        "mis-firmas",
        "mis-metas",
        "solicitudes",
      ].sort(),
    );
  });

  it("alinea las etiquetas personales con el menú del empleado", () => {
    const label = (id: string) => TODOS.find((i) => i.id === id)?.label;
    expect(label("mis-aprobaciones-opl")).toBe("Aprobaciones de OPL");
    expect(label("mis-encuestas")).toBe("Encuestas de curso");
    expect(label("mis-encuestas-rh")).toBe("Encuestas de RH");
    expect(label("comedor")).toBe("Comedor");
  });

  it("no repite ítems entre secciones", () => {
    const ids = SUPERVISOR_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getVisibleSupervisorNavSections", () => {
  beforeEach(() => {
    heAprobador = false;
    heAutorizado = false;
  });

  it("sin permisos de horas extra, la sección tramites desaparece (era su único ítem) y conserva el resto", () => {
    const secciones = getVisibleSupervisorNavSections("supervisor");
    const porSeccion = Object.fromEntries(secciones.map((s) => [s.id, s.items.map((i) => i.id)]));
    expect(secciones.map((s) => s.id)).not.toContain("tramites");
    expect(porSeccion.tramites).toBeUndefined();
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "mis-encuestas",
      "mis-encuestas-rh",
    ]);
    expect(porSeccion.equipo).toHaveLength(5);
  });

  it("con permiso de registro, Horas extra vuelve a Mis trámites en su posición", () => {
    heAutorizado = true;
    const tramites = getVisibleSupervisorNavSections("supervisor").find((s) => s.id === "tramites");
    expect(tramites?.items.map((i) => i.id)).toEqual(["horas-extra-solicitud"]);
  });

  it("con permiso de aprobación, Aprobar horas extra vuelve a Pendientes", () => {
    heAprobador = true;
    const pendientes = getVisibleSupervisorNavSections("supervisor").find(
      (s) => s.id === "pendientes",
    );
    expect(pendientes?.items.map((i) => i.id)).toContain("horas-extra-aprobaciones");
  });

  it("sin permiso de horas extra son 4 secciones (tramites se queda sin nada que mostrar)", () => {
    const secciones = getVisibleSupervisorNavSections("supervisor");
    expect(secciones.length).toBe(4);
    for (const seccion of secciones) {
      expect(seccion.items.length).toBeGreaterThan(0);
    }
  });

  it("con permiso de horas extra vuelven a ser 5 secciones, con tramites de un solo ítem", () => {
    heAutorizado = true;
    const secciones = getVisibleSupervisorNavSections("supervisor");
    expect(secciones.length).toBe(5);
    for (const seccion of secciones) {
      expect(seccion.items.length).toBeGreaterThan(0);
    }
    const tramites = secciones.find((s) => s.id === "tramites");
    expect(tramites?.items).toHaveLength(1);
  });

  it("aplica de verdad el filtro por rol", () => {
    // `metricas` está en SUPERVISOR_VISIBLE_NAV_IDS pero no en EMPLEADO_VISIBLE_NAV_IDS
    // (shellNavPolicy.ts): con rol empleado tiene que desaparecer del menú.
    const conSupervisor = getVisibleSupervisorNavSections("supervisor").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    const conEmpleado = getVisibleSupervisorNavSections("empleado").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    expect(conSupervisor).toContain("metricas");
    expect(conEmpleado).not.toContain("metricas");
    expect(conEmpleado.length).toBeLessThan(conSupervisor.length);
  });
});
