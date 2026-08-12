/**
 * `#/ajustes/scheduler-logs` es una pantalla oculta solo-admin: se comporta igual que
 * `#/ajustes/vistas-rol` en todos los modos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

let esAdmin = false;
let modoOperativo = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => "empleado",
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => esAdmin,
  isNonRhRhMode: () => false,
  hasRhPermisosActivos: () => true,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => modoOperativo,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => esAdmin,
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => false,
  isModulosRhEnrolled: () => false,
}));

const HASH = "#/ajustes/scheduler-logs";

beforeEach(() => {
  esAdmin = false;
  modoOperativo = false;
});

describe("política de hash de los logs del scheduler", () => {
  it("un usuario no admin no puede entrar", async () => {
    const { modulosMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(HASH, "empleado")).toBe(false);
  });

  it("un admin en Modo RH sí puede", async () => {
    esAdmin = true;
    modoOperativo = true;
    const { modulosMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(modulosMayAccessHash(HASH, "rh")).toBe(true);
  });

  it("un admin simulando otro rol no puede", async () => {
    esAdmin = true;
    const { rhEmpleadoMayAccessHash } = await import("./shellNavPolicy.ts");
    expect(rhEmpleadoMayAccessHash(HASH)).toBe(false);
  });
});
