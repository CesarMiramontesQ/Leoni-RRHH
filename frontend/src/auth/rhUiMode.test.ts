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

vi.mock("./jwt.ts", () => ({
  getRolFromAccessToken: () => "rh",
}));

describe("rhUiMode", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("default es operativo", async () => {
    const { getRhUiMode } = await import("./rhUiMode.ts");
    expect(getRhUiMode()).toBe("operativo");
  });

  it("persiste modo empleado", async () => {
    const { getRhUiMode, setRhUiMode, isRhEmpleadoUiMode } = await import("./rhUiMode.ts");
    setRhUiMode("empleado");
    expect(getRhUiMode()).toBe("empleado");
    expect(isRhEmpleadoUiMode()).toBe(true);
  });
});
