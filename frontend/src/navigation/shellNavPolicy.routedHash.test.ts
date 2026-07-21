import { beforeEach, describe, expect, it, vi } from "vitest";

// Regresión: un no-RH INSCRITO con permiso de una página RH-exclusiva (ajustes,
// actas, reporte comedor, evaluación 360) era enviado a "#/" por la compuerta de
// ruta por rol (supervisorMayAccessHash/empleadoMayAccessHash), pisando su grant.
// `resolveRoutedHashForRol` debe respetar el hash para inscritos (enrolledNonRh).

let heAprobador = false;
let heAutorizado = false;

vi.mock("../auth/jwt.ts", () => ({
  getRolFromAccessToken: () => null,
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

vi.mock("../auth/rhModulePermissions.ts", () => ({
  canAccessRhPermisosAdmin: () => false,
  hasExplicitModuleGrant: () => false,
  hasRhModule: () => false,
  isModulosRhEnrolled: () => true,
}));

async function imports() {
  return import("./shellNavPolicy.ts");
}

const RH_EXCLUSIVE_HASHES = [
  "#/nominas/ajustes",
  "#/actas",
  "#/comedor/reporte",
  "#/reportes",
  "#/level-up/evaluacion-360",
];

describe("resolveRoutedHashForRol", () => {
  beforeEach(() => {
    heAprobador = false;
    heAutorizado = false;
    vi.resetModules();
  });

  it("no-RH inscrito conserva el hash de páginas RH-exclusivas (no redirige a #/)", async () => {
    const { resolveRoutedHashForRol } = await imports();
    for (const hash of RH_EXCLUSIVE_HASHES) {
      expect(resolveRoutedHashForRol("supervisor", hash, { enrolledNonRh: true })).toBe(hash);
      expect(resolveRoutedHashForRol("empleado", hash, { enrolledNonRh: true })).toBe(hash);
    }
  });

  it("supervisor NO inscrito sigue redirigido a #/ en páginas que su rol no permite", async () => {
    const { resolveRoutedHashForRol } = await imports();
    expect(resolveRoutedHashForRol("supervisor", "#/nominas/ajustes", { enrolledNonRh: false })).toBe("#/");
    expect(resolveRoutedHashForRol("supervisor", "#/actas", { enrolledNonRh: false })).toBe("#/");
  });

  it("supervisor NO inscrito conserva su superficie de rol (páginas permitidas)", async () => {
    const { resolveRoutedHashForRol } = await imports();
    // supervisorMayAccessHash permite estas por defecto.
    expect(resolveRoutedHashForRol("supervisor", "#/metricas", { enrolledNonRh: false })).toBe("#/metricas");
    expect(resolveRoutedHashForRol("supervisor", "#/incidencias", { enrolledNonRh: false })).toBe("#/incidencias");
  });

  it("empleado NO inscrito sigue restringido a su navegación base", async () => {
    const { resolveRoutedHashForRol } = await imports();
    expect(resolveRoutedHashForRol("empleado", "#/actas", { enrolledNonRh: false })).toBe("#/");
    expect(resolveRoutedHashForRol("empleado", "#/solicitudes", { enrolledNonRh: false })).toBe("#/solicitudes");
  });

  it("Mis encuestas RH (self-service) es accesible para cualquier autenticado, sin importar el módulo", async () => {
    const { resolveRoutedHashForRol } = await imports();
    expect(resolveRoutedHashForRol("empleado", "#/talento/mis-encuestas", { enrolledNonRh: false })).toBe(
      "#/talento/mis-encuestas",
    );
    expect(resolveRoutedHashForRol("supervisor", "#/talento/mis-encuestas", { enrolledNonRh: false })).toBe(
      "#/talento/mis-encuestas",
    );
  });
});
