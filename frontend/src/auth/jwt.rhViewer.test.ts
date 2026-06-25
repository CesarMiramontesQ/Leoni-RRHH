import { beforeEach, describe, expect, it, vi } from "vitest";

let operativoUiMode = true;

function tokenFor(value: string | null): string | null {
  if (value === null) return null;
  const payload = Buffer.from(JSON.stringify({ rol: value, rh_admin: true })).toString("base64");
  return `x.${payload}.y`;
}

vi.mock("./session.ts", () => ({
  getAccessToken: () => tokenFor("gerente"),
}));

vi.mock("./rhModulePermissions.ts", () => ({
  hasExplicitModuleGrant: () => false,
}));

vi.mock("./rhUiMode.ts", () => ({
  isRhOperativoUiMode: () => operativoUiMode,
}));

async function imports() {
  return import("./jwt.ts");
}

describe("hasRhOperativeViewerContext", () => {
  beforeEach(() => {
    operativoUiMode = true;
    vi.resetModules();
  });

  it("ADMIN gerente en Modo RH cuenta como contexto RH operativo", async () => {
    const { hasRhOperativeViewerContext, hasRhOperativeViewerContextOrGrant } = await imports();
    expect(hasRhOperativeViewerContext()).toBe(true);
    expect(hasRhOperativeViewerContextOrGrant("comedor")).toBe(true);
  });

  it("ADMIN gerente en modo operativo de su rol no cuenta como RH", async () => {
    operativoUiMode = false;
    const { hasRhOperativeViewerContext } = await imports();
    expect(hasRhOperativeViewerContext()).toBe(false);
  });
});
