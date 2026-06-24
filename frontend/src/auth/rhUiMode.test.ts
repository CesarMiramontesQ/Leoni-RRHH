import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
let gestorAlcance: "supervisor" | "gerente" | null = null;
let rol: string | null = "rh";

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
}));

describe("rhUiMode", () => {
  beforeEach(() => {
    storage.clear();
    gestorAlcance = null;
    rol = "rh";
    vi.resetModules();
  });

  it("default es operativo", async () => {
    const { getRhUiMode } = await import("./rhUiMode.ts");
    expect(getRhUiMode()).toBe("operativo");
  });

  it("persiste modo empleado para RH normal", async () => {
    const { getRhUiMode, setRhUiMode, isRhEmpleadoUiMode } = await import("./rhUiMode.ts");
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("empleado");
    expect(isRhEmpleadoUiMode()).toBe(true);
  });

  it("toggle alterna operativo y empleado para RH normal", async () => {
    const { getRhUiMode, toggleRhUiMode } = await import("./rhUiMode.ts");
    expect(getRhUiMode()).toBe("operativo");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("empleado");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("operativo");
  });

  it("RH líder alterna operativo y lider", async () => {
    gestorAlcance = "supervisor";
    const { getRhUiMode, toggleRhUiMode, isRhLiderUiMode, getRhToggleLabels } = await import("./rhUiMode.ts");
    expect(getRhToggleLabels().on).toBe("Modo líder");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("lider");
    expect(isRhLiderUiMode()).toBe(true);
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("operativo");
  });

  it("RH gerente alterna operativo y gerente", async () => {
    gestorAlcance = "gerente";
    const { getRhUiMode, toggleRhUiMode, isRhGerenteUiMode } = await import("./rhUiMode.ts");
    toggleRhUiMode();
    expect(getRhUiMode()).toBe("gerente");
    expect(isRhGerenteUiMode()).toBe(true);
  });

  it("sanitiza modos no permitidos según alcance", async () => {
    gestorAlcance = "supervisor";
    const { getRhUiMode, setRhUiMode } = await import("./rhUiMode.ts");
    setRhUiMode("gerente");
    expect(getRhUiMode()).toBe("operativo");
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("operativo");
  });

  it("RH fuera de la lista de permisos conserva el modo de UI elegido", async () => {
    const { getRhUiMode, setRhInPermisosList, setRhUiMode } = await import("./rhUiMode.ts");
    setRhInPermisosList(false);
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("empleado");
    setRhUiMode("operativo");
    expect(getRhUiMode()).toBe("operativo");
  });
});

describe("rhUiMode — modo no-RH (usuarios con permisos asignados)", () => {
  beforeEach(() => {
    storage.clear();
    gestorAlcance = null;
    rol = "gerente";
    vi.resetModules();
  });

  it("sin permisos activos no es usuario de permisos y no entra a Modo RH", async () => {
    const mod = await import("./rhUiMode.ts");
    expect(mod.isNonRhPermisosUser()).toBe(false);
    mod.setNonRhRhMode(true); // no-op sin permisos
    expect(mod.isNonRhRhMode()).toBe(false);
  });

  it("con permisos: default modo base, y el toggle alterna a Modo RH", async () => {
    const mod = await import("./rhUiMode.ts");
    mod.setRhPermisosActivos(true);
    expect(mod.isNonRhPermisosUser()).toBe(true);
    expect(mod.isNonRhRhMode()).toBe(false); // default = base

    mod.toggleNonRhRhMode();
    expect(mod.isNonRhRhMode()).toBe(true);
    mod.toggleNonRhRhMode();
    expect(mod.isNonRhRhMode()).toBe(false);
  });

  it("un usuario RH no se considera usuario no-RH de permisos", async () => {
    rol = "rh";
    const mod = await import("./rhUiMode.ts");
    mod.setRhPermisosActivos(true);
    expect(mod.isNonRhPermisosUser()).toBe(false);
    expect(mod.isNonRhRhMode()).toBe(false);
  });
});
