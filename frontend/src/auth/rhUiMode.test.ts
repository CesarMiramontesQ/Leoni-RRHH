import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();
let gestorAlcance: "supervisor" | "gerente" | null = null;

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
  getRolFromAccessToken: () => "rh",
  getRhGestorAlcanceFromToken: () => gestorAlcance,
}));

describe("rhUiMode", () => {
  beforeEach(() => {
    storage.clear();
    gestorAlcance = null;
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
});
