/**
 * El menú del empleado se agrupa por momento de uso. Lo que se protege aquí es
 * que agrupar no agregue ni quite accesos, que cada página caiga en la sección
 * donde el empleado la va a buscar, y que quitar los permisos de horas extra no
 * deje secciones vacías ni huecos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let heAprobador = false;
let heAutorizado = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "empleado",
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
  EMPLEADO_DASHBOARD_ITEM,
  EMPLEADO_NAV_SECTIONS,
  getVisibleEmpleadoNavSections,
} from "./empleadoNav.ts";

/** Todo lo que el menú ofrece, sin filtrar por permiso. */
const TODOS = [
  EMPLEADO_DASHBOARD_ITEM,
  ...EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items),
];

describe("EMPLEADO_NAV_SECTIONS", () => {
  it("tiene las tres secciones en orden", () => {
    expect(EMPLEADO_NAV_SECTIONS.map((s) => s.id)).toEqual([
      "tramites",
      "pendientes",
      "desarrollo",
    ]);
    expect(EMPLEADO_NAV_SECTIONS.map((s) => s.title)).toEqual([
      "Mis trámites",
      "Pendientes",
      "Mi desarrollo",
    ]);
  });

  it("coloca cada ítem en su sección, en orden", () => {
    const porSeccion = Object.fromEntries(
      EMPLEADO_NAV_SECTIONS.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.tramites).toEqual([
      "solicitudes",
      "horas-extra-solicitud",
      "comedor",
    ]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "horas-extra-aprobaciones",
      "mis-encuestas",
      "mis-encuestas-rh",
      "mis-evaluaciones",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("deja el dashboard fuera de las secciones", () => {
    expect(EMPLEADO_DASHBOARD_ITEM.id).toBe("dashboard");
    expect(EMPLEADO_DASHBOARD_ITEM.href).toBe("#/");
    const enSecciones = EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(enSecciones).not.toContain("dashboard");
  });

  it("agrupar no agregó ni quitó accesos", () => {
    // Los 12 ids que el empleado veía antes del cambio.
    expect(TODOS.map((i) => i.id).sort()).toEqual(
      [
        "comedor",
        "dashboard",
        "horas-extra-aprobaciones",
        "horas-extra-solicitud",
        "mi-desempeno",
        "mis-aprobaciones-opl",
        "mis-encuestas",
        "mis-encuestas-rh",
        "mis-evaluaciones",
        "mis-firmas",
        "mis-metas",
        "solicitudes",
      ].sort(),
    );
  });

  it("renombra las etiquetas que engañaban", () => {
    const label = (id: string) => TODOS.find((i) => i.id === id)?.label;
    expect(label("comedor")).toBe("Comedor");
    expect(label("mis-aprobaciones-opl")).toBe("Aprobaciones de OPL");
    expect(label("mis-encuestas")).toBe("Encuestas de curso");
    expect(label("mis-encuestas-rh")).toBe("Encuestas de RH");
    expect(label("mis-evaluaciones")).toBe("Evaluaciones 360");
  });

  it("no repite ítems entre secciones", () => {
    const ids = EMPLEADO_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getVisibleEmpleadoNavSections", () => {
  beforeEach(() => {
    heAprobador = false;
    heAutorizado = false;
  });

  it("sin permisos de horas extra, oculta los dos ítems y conserva el resto", () => {
    const secciones = getVisibleEmpleadoNavSections("empleado");
    const porSeccion = Object.fromEntries(
      secciones.map((s) => [s.id, s.items.map((i) => i.id)]),
    );
    expect(porSeccion.tramites).toEqual(["solicitudes", "comedor"]);
    expect(porSeccion.pendientes).toEqual([
      "mis-firmas",
      "mis-aprobaciones-opl",
      "mis-encuestas",
      "mis-encuestas-rh",
      "mis-evaluaciones",
    ]);
    expect(porSeccion.desarrollo).toEqual(["mis-metas", "mi-desempeno"]);
  });

  it("con permiso de registro, Horas extra vuelve a Mis trámites en su posición", () => {
    heAutorizado = true;
    const tramites = getVisibleEmpleadoNavSections("empleado").find((s) => s.id === "tramites");
    expect(tramites?.items.map((i) => i.id)).toEqual([
      "solicitudes",
      "horas-extra-solicitud",
      "comedor",
    ]);
  });

  it("con permiso de aprobación, Aprobar horas extra vuelve a Pendientes", () => {
    heAprobador = true;
    const pendientes = getVisibleEmpleadoNavSections("empleado").find((s) => s.id === "pendientes");
    expect(pendientes?.items.map((i) => i.id)).toContain("horas-extra-aprobaciones");
  });

  it("nunca devuelve una sección vacía", () => {
    const secciones = getVisibleEmpleadoNavSections("empleado");
    expect(secciones.length).toBe(3);
    for (const seccion of secciones) {
      expect(seccion.items.length).toBeGreaterThan(0);
    }
  });

  it("no cuela ítems que el rol no puede ver (supervisor pierde mis-evaluaciones)", () => {
    // SUPERVISOR_VISIBLE_NAV_IDS (shellNavPolicy.ts) no incluye "mis-evaluaciones",
    // a diferencia de EMPLEADO_VISIBLE_NAV_IDS. Ejercita el filtro con un rol
    // cuya política sí excluye ítems presentes en el menú del empleado.
    const idsEmpleado = getVisibleEmpleadoNavSections("empleado").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    const idsSupervisor = getVisibleEmpleadoNavSections("supervisor").flatMap((s) =>
      s.items.map((i) => i.id),
    );
    expect(idsEmpleado).toContain("mis-evaluaciones");
    expect(idsSupervisor).not.toContain("mis-evaluaciones");
    expect(idsSupervisor.length).toBeLessThan(idsEmpleado.length);
  });
});
