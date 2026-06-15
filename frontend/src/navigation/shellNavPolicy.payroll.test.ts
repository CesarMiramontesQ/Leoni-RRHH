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
    grants.add("nominas");
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
    rhModules.add("nominas"); // con módulo nominas pero sin designación
    expect(isShellNavItemVisibleForRol("rh", "horas-extra-aprobaciones")).toBe(false);
  });

  it("la lista 'Horas Extra' (Regla A) depende del permiso de Nóminas, no del aprobador", async () => {
    const { isShellNavItemVisibleForRol } = await imports();
    rol = "rh";
    heAprobador = true; // ser aprobador no debe habilitar la lista
    rhModules.clear();
    expect(isShellNavItemVisibleForRol("rh", "horas-extra")).toBe(false);
    rhModules.add("nominas");
    expect(isShellNavItemVisibleForRol("rh", "horas-extra")).toBe(true);
  });
});
