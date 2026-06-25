import { beforeEach, describe, expect, it, vi } from "vitest";

// Verifica la separación de reglas:
// - Regla A (navegación): permiso RH "Nóminas" → ver páginas generales.
// - Regla B (operativa): aprobar/registrar horas extra (claims he_aprobador/he_autorizado).
// "Aprobar Horas Extra" (horas-extra-aprobaciones) debe depender SOLO de la Regla B.

const storage = new Map<string, string>();
let rol: string | null = "gerente";
let heAprobador = false;
let heAutorizado = false;
const grants = new Set<string>();
const rhModules = new Set<string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => rol,
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => ({}),
  isHorasExtraAprobador: () => heAprobador,
  isHorasExtraRegistroAutorizado: () => heAutorizado,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: (key: string) => grants.has(key),
  hasRhModule: (key: string) => rhModules.has(key),
  isModulosRhEnrolled: () => true,
}));

async function imports() {
  const navMod = await import("./shellNavPolicy.ts");
  const uiMod = await import("../auth/rhUiMode.ts");
  return { ...navMod, ...uiMod };
}

describe("separación Nóminas (Regla A) vs aprobar horas extra (Regla B)", () => {
  beforeEach(() => {
    storage.clear();
    rol = "gerente";
    heAprobador = false;
    heAutorizado = false;
    grants.clear();
    rhModules.clear();
    vi.resetModules();
  });

  it("permiso de Nóminas NO muestra 'Aprobar Horas Extra' (no aprobador)", async () => {
    const { isShellNavItemVisibleForRol, setRhPermisosActivos, setNonRhRhMode } = await imports();
    // No-RH con grant de Nóminas, en Modo RH, pero NO aprobador.
    grants.add("nominas-horas-extra");
    setRhPermisosActivos(true);
    setNonRhRhMode(true);
    expect(isShellNavItemVisibleForRol("gerente", "horas-extra-aprobaciones")).toBe(false);
  });

  it("aprobador SÍ ve 'Aprobar Horas Extra' aunque NO tenga permiso de Nóminas", async () => {
    const { isShellNavItemVisibleForRol } = await imports();
    heAprobador = true; // Regla B
    // Sin grant ni módulo de nóminas.
    expect(isShellNavItemVisibleForRol("gerente", "horas-extra-aprobaciones")).toBe(true);
    expect(isShellNavItemVisibleForRol("empleado", "horas-extra-aprobaciones")).toBe(true);
    expect(isShellNavItemVisibleForRol("rh", "horas-extra-aprobaciones")).toBe(true);
  });

  it("'Aprobar Horas Extra' para RH depende solo de la Regla B (no del módulo Nóminas)", async () => {
    const { isShellNavItemVisibleForRol } = await imports();
    rol = "rh";
    heAprobador = true;
    rhModules.clear(); // sin módulo nominas
    expect(isShellNavItemVisibleForRol("rh", "horas-extra-aprobaciones")).toBe(true);
    heAprobador = false;
    rhModules.add("nominas-horas-extra"); // con módulo nominas pero sin designación
    expect(isShellNavItemVisibleForRol("rh", "horas-extra-aprobaciones")).toBe(false);
  });

  it("la lista 'Horas Extra' (Regla A) depende del permiso de Nóminas, no del aprobador", async () => {
    const { isShellNavItemVisibleForRol } = await imports();
    rol = "rh";
    heAprobador = true; // ser aprobador no debe habilitar la lista
    rhModules.clear();
    expect(isShellNavItemVisibleForRol("rh", "horas-extra")).toBe(false);
    rhModules.add("nominas-horas-extra");
    expect(isShellNavItemVisibleForRol("rh", "horas-extra")).toBe(true);
  });

  it("permisos por página: otorgar solo Conciliación no muestra Horas Extra", async () => {
    const { isShellNavItemVisibleForRol, setRhPermisosActivos, setNonRhRhMode } = await imports();
    grants.add("nominas-conciliacion"); // solo Conciliación
    setRhPermisosActivos(true);
    setNonRhRhMode(true);
    expect(isShellNavItemVisibleForRol("gerente", "conciliacion")).toBe(true);
    expect(isShellNavItemVisibleForRol("gerente", "horas-extra")).toBe(false);
    expect(isShellNavItemVisibleForRol("gerente", "nominas-ajustes")).toBe(false);
  });
});

// Acceso a RUTAS de Nóminas tras el split granular (regresión: usaba el key obsoleto "nominas").
describe("modulosMayAccessHash: rutas de Nóminas por página", () => {
  beforeEach(() => {
    storage.clear();
    rol = "empleado";
    heAprobador = false;
    heAutorizado = false;
    grants.clear();
    rhModules.clear();
    vi.resetModules();
  });

  it("no-RH con grant de Horas Extra en Modo RH entra a #/nominas/horas-extra", async () => {
    const { modulosMayAccessHash, setRhPermisosActivos, setNonRhRhMode } = await imports();
    grants.add("nominas-horas-extra");
    setRhPermisosActivos(true);
    setNonRhRhMode(true);
    expect(modulosMayAccessHash("#/nominas/horas-extra", "empleado")).toBe(true);
  });

  it("no-RH sin el grant de Horas Extra queda bloqueado (bug reportado)", async () => {
    const { modulosMayAccessHash, setRhPermisosActivos, setNonRhRhMode } = await imports();
    grants.add("nominas-conciliacion"); // tiene otra página, no Horas Extra
    setRhPermisosActivos(true);
    setNonRhRhMode(true);
    expect(modulosMayAccessHash("#/nominas/horas-extra", "empleado")).toBe(false);
    expect(modulosMayAccessHash("#/nominas/conciliacion", "empleado")).toBe(true);
  });

  it("gerente conserva su superficie de rol en modo base (sin Modo RH)", async () => {
    const { modulosMayAccessHash } = await imports();
    expect(modulosMayAccessHash("#/nominas/horas-extra", "gerente")).toBe(true);
  });

  it("Ajustes de Nóminas es RH-exclusivo: no-RH solo con grant en Modo RH", async () => {
    const { modulosMayAccessHash, setRhPermisosActivos, setNonRhRhMode } = await imports();
    setRhPermisosActivos(true);
    setNonRhRhMode(true);
    expect(modulosMayAccessHash("#/nominas/ajustes", "gerente")).toBe(false);
    grants.add("nominas-ajustes");
    expect(modulosMayAccessHash("#/nominas/ajustes", "gerente")).toBe(true);
  });

  it("RH entra solo a las páginas de Nóminas que tiene otorgadas", async () => {
    const { modulosMayAccessHash } = await imports();
    rol = "rh";
    rhModules.add("nominas-horas-extra");
    expect(modulosMayAccessHash("#/nominas/horas-extra", "rh")).toBe(true);
    expect(modulosMayAccessHash("#/nominas/conciliacion", "rh")).toBe(false);
  });
});
