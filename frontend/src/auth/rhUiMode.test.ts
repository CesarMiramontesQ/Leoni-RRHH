import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
let gestorAlcance: "supervisor" | "gerente" | null = null;
let rol: string | null = "gerente";

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
});

vi.mock("./jwt.ts", () => ({
  getRolFromAccessToken: () => rol,
  getRhGestorAlcanceFromToken: () => gestorAlcance,
  getAccessTokenPayload: () => ({}),
}));

describe("rhUiMode — usuarios ADMIN", () => {
  beforeEach(() => {
    storage.clear();
    gestorAlcance = null;
    rol = "gerente";
    vi.resetModules();
  });

  async function adminMod() {
    const mod = await import("./rhUiMode.ts");
    mod.setAdminUser(true);
    return mod;
  }

  it("default es operativo (vista RH)", async () => {
    const { getRhUiMode } = await adminMod();
    expect(getRhUiMode()).toBe("operativo");
  });

  it("persiste modo empleado para ADMIN con rol empleado", async () => {
    rol = "empleado";
    const { getRhUiMode, setRhUiMode, isRhEmpleadoUiMode } = await adminMod();
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("empleado");
    expect(isRhEmpleadoUiMode()).toBe(true);
  });

  it("toggle alterna operativo y empleado para ADMIN empleado", async () => {
    rol = "empleado";
    const { getRhUiMode, toggleRhUiMode } = await adminMod();
    expect(getRhUiMode()).toBe("operativo");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("empleado");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("operativo");
  });

  it("ADMIN supervisor alterna operativo y lider", async () => {
    rol = "supervisor";
    const { getRhUiMode, toggleRhUiMode, isRhLiderUiMode, getRhToggleLabels } = await adminMod();
    expect(getRhToggleLabels().on).toBe("Modo líder");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("lider");
    expect(isRhLiderUiMode()).toBe(true);
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("operativo");
  });

  it("ADMIN gerente alterna operativo y gerente", async () => {
    const { getRhUiMode, toggleRhUiMode, isRhGerenteUiMode } = await adminMod();
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("gerente");
    expect(isRhGerenteUiMode()).toBe(true);
  });

  it("ADMIN director alterna operativo y director", async () => {
    rol = "director";
    const { getRhUiMode, toggleRhUiMode, isRhDirectorUiMode, getRhToggleLabels } = await adminMod();
    expect(getRhToggleLabels().on).toBe("Modo director");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("director");
    expect(isRhDirectorUiMode()).toBe(true);
  });

  it("sanitiza modos no permitidos según rol operativo", async () => {
    rol = "supervisor";
    const { getRhUiMode, setRhUiMode } = await adminMod();
    setRhUiMode("gerente");
    expect(getRhUiMode()).toBe("operativo");
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("operativo");
  });

  it("usuario no ADMIN no puede cambiar modo de UI", async () => {
    const mod = await import("./rhUiMode.ts");
    mod.setAdminUser(false);
    mod.setRhUiMode("empleado");
    expect(mod.getRhUiMode()).toBe("operativo");
    expect(mod.isRhOperativoUiMode()).toBe(false);
  });
});

describe("rhUiMode — modo no-ADMIN (usuarios con permisos asignados)", () => {
  beforeEach(() => {
    storage.clear();
    gestorAlcance = null;
    rol = "gerente";
    vi.resetModules();
  });

  it("sin permisos activos no es usuario de permisos y no entra a Modo RH", async () => {
    const mod = await import("./rhUiMode.ts");
    mod.setAdminUser(false);
    expect(mod.isNonRhPermisosUser()).toBe(false);
    mod.setNonRhRhMode(true); // no-op sin permisos
    expect(mod.isNonRhRhMode()).toBe(false);
  });

  it("con permisos: default modo base, y el toggle alterna a Modo RH", async () => {
    const mod = await import("./rhUiMode.ts");
    mod.setAdminUser(false);
    mod.setRhPermisosActivos(true);
    expect(mod.isNonRhPermisosUser()).toBe(true);
    expect(mod.isNonRhRhMode()).toBe(false); // default = base

    mod.toggleNonRhRhMode();
    expect(mod.isNonRhRhMode()).toBe(true);
    mod.toggleNonRhRhMode();
    expect(mod.isNonRhRhMode()).toBe(false);
  });

  it("un usuario ADMIN no se considera usuario no-ADMIN de permisos", async () => {
    const mod = await import("./rhUiMode.ts");
    mod.setAdminUser(true);
    mod.setRhPermisosActivos(true);
    expect(mod.isNonRhPermisosUser()).toBe(false);
    expect(mod.isNonRhRhMode()).toBe(false);
  });
});
