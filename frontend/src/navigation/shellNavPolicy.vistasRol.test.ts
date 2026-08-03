/**
 * Gate de vistas por rol sobre el sidebar y las rutas.
 *
 * `vistaRolPermiteNavItem` / `vistaRolPermiteHash` devuelven `null` cuando el gate no
 * aplica (admin RH, rol fuera del alcance, ruta sin vista) — esos casos se simulan aquí
 * devolviendo `null` desde el mock.
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

let jwtRol: string | null = "empleado";

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => jwtRol,
  getRhGestorAlcanceFromToken: () => null,
  getAccessTokenPayload: () => null,
}));

vi.mock("../auth/rhUiMode.ts", () => ({
  isAdminUser: () => false,
  isNonRhRhMode: () => false,
  hasRhPermisosActivos: () => false,
  isRhDirectorUiMode: () => false,
  isRhEmpleadoUiMode: () => false,
  isRhGerenteUiMode: () => false,
  isRhGestorTeamUiMode: () => false,
  isRhLiderUiMode: () => false,
  isRhOperativoUiMode: () => false,
}));

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => false,
  isModulosRhEnrolled: () => false,
}));

vi.mock("../auth/payrollPermissions.ts", () => ({
  canApproveOvertime: () => false,
  canRegisterOvertime: () => false,
}));

/** `undefined` = el gate no aplica (se devuelve null). */
const vistasPorNavItem = new Map<string, boolean>();
const vistasPorHash = new Map<string, boolean>();

vi.mock("../auth/vistaRolPermissions.ts", () => ({
  vistaRolPermiteNavItem: (itemId: string) => vistasPorNavItem.get(itemId) ?? null,
  vistaRolPermiteHash: (hash: string) => vistasPorHash.get(hash) ?? null,
}));

describe("shellNavPolicy — gate de vistas por rol", () => {
  beforeEach(() => {
    storage.clear();
    vistasPorNavItem.clear();
    vistasPorHash.clear();
    jwtRol = "empleado";
    vi.resetModules();
  });

  it("oculta del sidebar un ítem cuya vista está apagada", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    // Sin gate, «Solicitudes» es visible para el empleado.
    expect(isShellNavItemVisibleForRol("empleado", "solicitudes")).toBe(true);

    vistasPorNavItem.set("solicitudes", false);
    expect(isShellNavItemVisibleForRol("empleado", "solicitudes")).toBe(false);
  });

  it("muestra un ítem que el rol no tenía cuando la vista se enciende", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    // «Actas» no está en el menú del empleado.
    expect(isShellNavItemVisibleForRol("empleado", "actas")).toBe(false);

    vistasPorNavItem.set("actas", true);
    expect(isShellNavItemVisibleForRol("empleado", "actas")).toBe(true);
  });

  it("es independiente por rol: el mismo ítem se resuelve con la config de cada uno", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    jwtRol = "supervisor";
    expect(isShellNavItemVisibleForRol("supervisor", "metricas")).toBe(true);

    vistasPorNavItem.set("metricas", false);
    expect(isShellNavItemVisibleForRol("supervisor", "metricas")).toBe(false);
  });

  it("no toca los ítems de horas extra (Regla B: solo claims de nómina)", async () => {
    const { isShellNavItemVisibleForRol } = await import("./shellNavPolicy.ts");
    // Aunque alguien intentara configurarlos, la Regla B es autoritativa.
    vistasPorNavItem.set("horas-extra-solicitud", true);
    vistasPorNavItem.set("horas-extra-aprobaciones", true);
    expect(isShellNavItemVisibleForRol("empleado", "horas-extra-solicitud")).toBe(false);
    expect(isShellNavItemVisibleForRol("empleado", "horas-extra-aprobaciones")).toBe(false);
  });

  it("bloquea la ruta de una vista apagada y abre la de una encendida", async () => {
    const { resolveRoutedHashForRol } = await import("./shellNavPolicy.ts");

    // Ruta permitida por la política del rol, pero con la vista apagada.
    vistasPorHash.set("#/solicitudes", false);
    expect(
      resolveRoutedHashForRol("empleado", "#/solicitudes", { enrolledNonRh: false }),
    ).toBe("#/");

    // Ruta que el rol no tenía, encendida por el admin.
    vistasPorHash.set("#/actas", true);
    expect(resolveRoutedHashForRol("empleado", "#/actas", { enrolledNonRh: false })).toBe(
      "#/actas",
    );
  });

  it("sin gate activo la política por rol sigue mandando", async () => {
    const { resolveRoutedHashForRol } = await import("./shellNavPolicy.ts");
    // Sin entradas en el mock, `vistaRolPermiteHash` devuelve null.
    expect(resolveRoutedHashForRol("empleado", "#/actas", { enrolledNonRh: false })).toBe("#/");
    expect(
      resolveRoutedHashForRol("empleado", "#/solicitudes", { enrolledNonRh: false }),
    ).toBe("#/solicitudes");
  });
});
