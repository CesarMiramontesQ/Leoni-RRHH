/**
 * El gate por rol debe seguir al modo de UI: un admin RH ve todo en Modo RH, pero al
 * simular otro perfil con el toggle se le aplica la configuración de ese rol.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let esAdmin = false;
let modoUi = "operativo";

let inscritoEnModulos = false;
let enModoRh = false;

vi.mock("./rhUiMode.ts", () => ({
  isAdminUser: () => esAdmin,
  getRhUiMode: () => modoUi,
  isNonRhRhMode: () => enModoRh,
}));

vi.mock("./rhModulePermissions.ts", () => ({
  isModulosRhEnrolled: () => inscritoEnModulos,
}));

const ME = {
  rol: "gerente",
  configurable: false,
  vistas: { metricas: true, actas: true, dashboard: true },
  por_rol: {
    empleado: { metricas: false, actas: false, dashboard: true },
    supervisor: { metricas: true, actas: false, dashboard: true },
    gerente: { metricas: false, actas: true, dashboard: true },
  },
};

let respuesta: unknown = ME;
vi.mock("../api/vistasRol.ts", () => ({
  fetchVistasRolMe: async () => respuesta,
}));

async function cargar() {
  const mod = await import("./vistaRolPermissions.ts");
  await mod.loadVistasRol();
  return mod;
}

describe("vistaRolPermissions y el modo de UI", () => {
  beforeEach(() => {
    esAdmin = false;
    modoUi = "operativo";
    inscritoEnModulos = false;
    enModoRh = false;
    respuesta = ME;
    vi.resetModules();
  });

  it("un admin en Modo RH no tiene gate: ve todo", async () => {
    esAdmin = true;
    const m = await cargar();
    expect(m.isVistaRolGateActivo()).toBe(false);
    expect(m.vistaRolPermiteNavItem("metricas")).toBeNull();
    expect(m.vistaRolPermiteHash("#/metricas")).toBeNull();
  });

  it("el mismo admin, simulando gerente, ve lo configurado para gerente", async () => {
    esAdmin = true;
    const m = await cargar();
    modoUi = "gerente";   // el toggle cambia después de cargar: no debe requerir refetch
    expect(m.isVistaRolGateActivo()).toBe(true);
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(false);
    expect(m.vistaRolPermiteNavItem("actas")).toBe(true);
    expect(m.vistaRolPermiteHash("#/metricas")).toBe(false);
  });

  it("`lider` aplica la configuración del rol supervisor", async () => {
    esAdmin = true;
    const m = await cargar();
    modoUi = "lider";
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(true);
    expect(m.vistaRolPermiteNavItem("actas")).toBe(false);
  });

  it("volver a Modo RH restituye la vista completa sin recargar", async () => {
    esAdmin = true;
    const m = await cargar();
    modoUi = "empleado";
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(false);
    modoUi = "operativo";
    expect(m.vistaRolPermiteNavItem("metricas")).toBeNull();
  });

  it("a un no-admin se le aplica su propio rol y el modo no influye", async () => {
    respuesta = { rol: "gerente", configurable: true, vistas: { metricas: false } };
    const m = await cargar();
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(false);
    modoUi = "operativo";
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(false);
  });

  it("si la petición falla no se esconde nada (fail-open)", async () => {
    respuesta = null;
    const m = await cargar();
    expect(m.isVistaRolGateActivo()).toBe(false);
    expect(m.vistaRolPermiteNavItem("metricas")).toBeNull();
  });

  it("un inscrito EN MODO RH queda fuera del gate: manda su grant", async () => {
    // A una empleada con los 4 módulos de Comedor otorgados se le aplicaba además la
    // config de su rol base, así que solo veía la página cuya vista está encendida para
    // `empleado` (Comedor) y le aparecía el Dashboard de su rol.
    inscritoEnModulos = true;
    enModoRh = true;
    respuesta = {
      rol: "empleado",
      configurable: true,
      vistas: { "comedor-gestion": false, "comedor-planear": false, reportes: false, dashboard: true },
    };
    const m = await cargar();

    expect(m.isVistaRolGateActivo()).toBe(false);
    // El gate ya no opina: deciden los permisos por módulo.
    expect(m.vistaRolPermiteNavItem("comedor-gestion")).toBeNull();
    expect(m.vistaRolPermiteNavItem("comedor-planear")).toBeNull();
    expect(m.vistaRolPermiteNavItem("reportes")).toBeNull();
    expect(m.vistaRolPermiteNavItem("dashboard")).toBeNull();
    expect(m.vistaRolPermiteHash("#/comedor/gestion")).toBeNull();
  });

  it("un rol base SIN módulos otorgados sí queda sujeto al gate", async () => {
    inscritoEnModulos = false;
    respuesta = { rol: "empleado", configurable: true, vistas: { "comedor-gestion": false } };
    const m = await cargar();

    expect(m.isVistaRolGateActivo()).toBe(true);
    expect(m.vistaRolPermiteNavItem("comedor-gestion")).toBe(false);
  });

  it("el mismo inscrito EN MODO BASE sí ve su menú de rol limitado", async () => {
    // Las dos navegaciones conviven: en Modo RH mandan los módulos, en Modo base manda
    // la configuración que el admin RH puso para su rol.
    inscritoEnModulos = true;
    enModoRh = false;
    respuesta = {
      rol: "empleado",
      configurable: true,
      vistas: { "comedor-gestion": false, dashboard: true },
    };
    const m = await cargar();

    expect(m.isVistaRolGateActivo()).toBe(true);
    expect(m.vistaRolPermiteNavItem("comedor-gestion")).toBe(false);
    expect(m.vistaRolPermiteNavItem("dashboard")).toBe(true);
  });

  it("el admin en modo simulado no se ve afectado por estar inscrito", async () => {
    // Un admin cuenta como inscrito, pero su rama va antes: manda el modo del toggle.
    esAdmin = true;
    inscritoEnModulos = true;
    enModoRh = false;
    const m = await cargar();
    modoUi = "gerente";
    expect(m.vistaRolPermiteNavItem("metricas")).toBe(false);
    expect(m.vistaRolPermiteNavItem("actas")).toBe(true);
  });
});
