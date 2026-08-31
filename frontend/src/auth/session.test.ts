import { beforeEach, describe, expect, it, vi } from "vitest";

const local = new Map<string, string>();
const session = new Map<string, string>();

function stubStorage(store: Map<string, string>): Storage {
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

vi.stubGlobal("localStorage", stubStorage(local));
vi.stubGlobal("sessionStorage", stubStorage(session));

vi.mock("./rhUiMode.ts", () => ({ resetRhUiMode: () => undefined }));
vi.mock("./vistaRolPermissions.ts", () => ({ resetVistasRol: () => undefined }));
vi.mock("../notificaciones/notificacionesResumenStore.ts", () => ({
  resetNotificacionesResumen: () => undefined,
}));
vi.mock("../pages/dashboard.ts", () => ({ resetRhDashboardSessionState: () => undefined }));

describe("session — sin Recordarme", () => {
  beforeEach(() => {
    local.clear();
    session.clear();
    vi.resetModules();
  });

  it("setSession guarda tokens solo en sessionStorage", async () => {
    const { setSession, getAccessToken, getRefreshToken } = await import("./session.ts");
    setSession({ access_token: "acc", refresh_token: "ref" });
    expect(session.get("access_token")).toBe("acc");
    expect(session.get("refresh_token")).toBe("ref");
    expect(local.get("access_token")).toBeUndefined();
    expect(local.get("refresh_token")).toBeUndefined();
    expect(local.get("auth_persistent")).toBeUndefined();
    expect(getAccessToken()).toBe("acc");
    expect(getRefreshToken()).toBe("ref");
  });

  it("migra tokens viejos de localStorage a la pestaña y borra persistencia", async () => {
    local.set("auth_persistent", "1");
    local.set("access_token", "old-acc");
    local.set("refresh_token", "old-ref");
    const { getAccessToken, getRefreshToken } = await import("./session.ts");
    expect(getAccessToken()).toBe("old-acc");
    expect(getRefreshToken()).toBe("old-ref");
    expect(session.get("access_token")).toBe("old-acc");
    expect(local.get("access_token")).toBeUndefined();
    expect(local.get("auth_persistent")).toBeUndefined();
  });

  it("no pisa tokens de la pestaña con un Recordarme viejo; solo limpia localStorage", async () => {
    session.set("access_token", "new-acc");
    session.set("refresh_token", "new-ref");
    local.set("auth_persistent", "1");
    local.set("access_token", "old-acc");
    local.set("refresh_token", "old-ref");
    const { getAccessToken, getRefreshToken } = await import("./session.ts");
    expect(getAccessToken()).toBe("new-acc");
    expect(getRefreshToken()).toBe("new-ref");
    expect(local.get("access_token")).toBeUndefined();
    expect(local.get("auth_persistent")).toBeUndefined();
  });
});
