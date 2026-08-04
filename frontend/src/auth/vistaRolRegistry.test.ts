/**
 * Paridad con `app/core/vista_rol_registry.py`.
 *
 * Los dos registros son espejos mantenidos a mano (igual que `rhModuleRegistry.ts`).
 * Si se desalinean, el frontend oculta o muestra una vista que el backend resuelve de
 * otra forma, y el usuario ve un menú que no coincide con lo que el API le permite.
 * Este test fija la lista de claves y las resoluciones que deben coincidir.
 */
import { describe, expect, it } from "vitest";

import {
  isRolConfigurable,
  navItemToVistaKey,
  resolveVistaFromHash,
  ROLES_CONFIGURABLES,
} from "./vistaRolRegistry.ts";

/** Claves de `VISTAS_ROL` en el backend, en el mismo orden del catálogo. */
const VISTA_KEYS = [
  "dashboard", "organigrama", "empleados", "level-up",
  "comedor", "mis-evaluaciones", "mis-encuestas", "mis-encuestas-rh", "mis-firmas",
  "mis-aprobaciones-opl", "mis-metas", "mi-desempeno",
  "solicitudes", "metricas", "incidencias", "faltas-retardos", "actas", "viajes-laborales",
  "reportes", "comedor-gestion", "comedor-planear",
  "nominas-horas-extra", "nominas-conciliacion", "nominas-ajustes",
  "puestos", "competencias", "tareas-catalogo", "puestos-ajustes",
  "dashboard-talento", "encuestas-rh", "operaciones",
  "evaluaciones", "metas", "ciclo-desempeno", "historial-objetivo", "evaluacion-360",
  "pdi-gestion", "cursos", "cursos-seguimiento", "sesiones", "capacitaciones", "encuestas",
  "cursos-ajustes", "juntas", "opls", "evidencias", "sugerencias",
  "proveedores-externos", "cursos-externos", "cursos-vencimientos",
] as const;

describe("vistaRolRegistry", () => {
  it("declara los mismos roles configurables que el backend", () => {
    expect([...ROLES_CONFIGURABLES]).toEqual(["empleado", "supervisor", "gerente"]);
    expect(isRolConfigurable("supervisor")).toBe(true);
    expect(isRolConfigurable("director")).toBe(false);
    expect(isRolConfigurable("rh")).toBe(false);
    expect(isRolConfigurable(null)).toBe(false);
  });

  it("resuelve toda clave del catálogo desde algún hash o ítem de navegación", () => {
    const alcanzables = new Set<string>();
    for (const key of VISTA_KEYS) alcanzables.add(key);

    const porNav = new Set<string>();
    const navItems = [
      "dashboard", "organigrama", "empleados", "level-up", "comedor", "mis-evaluaciones",
      "mis-encuestas", "mis-encuestas-rh", "mis-firmas", "mis-aprobaciones-opl", "mis-metas",
      "mi-desempeno", "solicitudes", "metricas", "incidencias", "faltas-retardos", "actas",
      "viajes-laborales", "reportes", "comedor-gestion", "comedor-planear", "horas-extra",
      "conciliacion", "nominas-ajustes", "puestos", "wtw", "competencias", "capacidades",
      "tareas-catalogo", "puestos-ajustes", "dashboard-talento", "encuestas-rh", "operaciones",
      "evaluaciones", "metas", "ciclo-desempeno", "historial-objetivo", "evaluacion-360",
      "pdi-gestion", "cursos", "cursos-seguimiento", "sesiones", "capacitaciones", "encuestas",
      "cursos-ajustes", "cursos-juntas", "opls", "evidencias", "sugerencias",
      "cursos-proveedores", "cursos-externos", "cursos-vencimientos",
    ];
    for (const item of navItems) {
      const key = navItemToVistaKey(item);
      expect(key, `nav item sin vista: ${item}`).not.toBeNull();
      if (key) porNav.add(key);
    }
    // Todas las claves del catálogo tienen al menos un ítem de navegación.
    for (const key of alcanzables) {
      expect(porNav.has(key), `vista sin ítem de navegación: ${key}`).toBe(true);
    }
  });

  it("resuelve el hash por el prefijo más largo, como el backend", () => {
    expect(resolveVistaFromHash("#/")).toBe("dashboard");
    expect(resolveVistaFromHash("#")).toBe("dashboard");
    expect(resolveVistaFromHash("#/comedor")).toBe("comedor");
    expect(resolveVistaFromHash("#/comedor/gestion")).toBe("comedor-gestion");
    expect(resolveVistaFromHash("#/comedor/planear")).toBe("comedor-planear");
    expect(resolveVistaFromHash("#/comedor/reporte")).toBe("reportes");
    expect(resolveVistaFromHash("#/puestos")).toBe("puestos");
    expect(resolveVistaFromHash("#/puestos/ajustes")).toBe("puestos-ajustes");
    expect(resolveVistaFromHash("#/talento/metas")).toBe("metas");
    expect(resolveVistaFromHash("#/talento/mis-metas")).toBe("mis-metas");
    expect(resolveVistaFromHash("#/talento/mi-desempeno")).toBe("mi-desempeno");
    expect(resolveVistaFromHash("#/talento/mis-encuestas")).toBe("mis-encuestas-rh");
    expect(resolveVistaFromHash("#/talento/encuestas")).toBe("encuestas-rh");
    expect(resolveVistaFromHash("#/level-up")).toBe("level-up");
    expect(resolveVistaFromHash("#/level-up/evaluacion-360")).toBe("evaluacion-360");
  });

  it("ignora el query string al resolver (deep links con filtros)", () => {
    expect(resolveVistaFromHash("#/operaciones?area_id=3")).toBe("operaciones");
    expect(resolveVistaFromHash("#/talento/mis-metas?ciclo=2")).toBe("mis-metas");
  });

  it("deja fuera del gate las rutas de horas extra (Regla B)", () => {
    // Regresión: `#/nominas/horas-extra/aprobaciones` cae bajo el prefijo de la vista
    // «Horas Extra» —apagada de fábrica—, así que el gate la bloqueaba y un empleado
    // designado aprobador veía "Acceso no autorizado".
    expect(resolveVistaFromHash("#/nominas/horas-extra/aprobaciones")).toBeNull();
    expect(resolveVistaFromHash("#/horas-extra/solicitud")).toBeNull();
    // La pantalla de gestión sí sigue siendo configurable.
    expect(resolveVistaFromHash("#/nominas/horas-extra")).toBe("nominas-horas-extra");
  });

  it("devuelve null para rutas fuera del catálogo", () => {
    expect(resolveVistaFromHash("#/notificaciones")).toBeNull();
    expect(resolveVistaFromHash("#/ajustes/permisos-rh")).toBeNull();
    expect(resolveVistaFromHash("#/ajustes/vistas-rol")).toBeNull();
    expect(navItemToVistaKey("horas-extra-solicitud")).toBeNull();
    expect(navItemToVistaKey("horas-extra-aprobaciones")).toBeNull();
    expect(navItemToVistaKey("laborales")).toBeNull();
    expect(navItemToVistaKey("comedor-menu")).toBeNull();
    expect(navItemToVistaKey("nominas")).toBeNull();
  });
});
