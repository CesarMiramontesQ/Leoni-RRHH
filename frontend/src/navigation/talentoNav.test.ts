/**
 * Hub «Talento» aterriza en el dashboard: id/key/href/icono deben coincidir
 * con `dashboard-talento`, no con encuestas ni con un ítem accidental de la lista.
 */
import { describe, expect, it } from "vitest";

import { TALENTO_NAV_ITEMS, TALENTO_SIDEBAR_ITEM } from "./talentoNav.ts";

describe("TALENTO_SIDEBAR_ITEM", () => {
  it("apunta al dashboard de talento (href + icono de dashboard-talento)", () => {
    const dashboard = TALENTO_NAV_ITEMS.find((item) => item.id === "dashboard-talento");
    expect(dashboard).toBeDefined();
    expect(TALENTO_SIDEBAR_ITEM.id).toBe("dashboard-talento");
    expect(TALENTO_SIDEBAR_ITEM.key).toBe("dashboard-talento");
    expect(TALENTO_SIDEBAR_ITEM.href).toBe("#/talento/dashboard");
    expect(TALENTO_SIDEBAR_ITEM.svgPaths).toBe(dashboard!.svgPaths);
  });
});
