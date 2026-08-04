/**
 * El gate por rol debe seguir al modo de UI: un admin RH ve todo en Modo RH, pero al
 * simular otro perfil con el toggle se le aplica la configuración de ese rol.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let esAdmin = false;
let modoUi = "operativo";

vi.mock("./rhUiMode.ts", () => ({
  isAdminUser: () => esAdmin,
  getRhUiMode: () => modoUi,
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
});
