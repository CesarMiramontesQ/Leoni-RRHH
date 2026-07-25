/**
 * `TALENTO_SIDEBAR_ITEM.id/key/href` apuntan a `encuestas-rh`, así que su
 * icono debe ser el de encuestas -- no el del primer item de
 * `TALENTO_NAV_ITEMS`, que cambia si la lista se reordena (p.ej. al insertar
 * el Dashboard de Talento como primer item).
 */
import { describe, expect, it } from "vitest";

import { TALENTO_NAV_ITEMS, TALENTO_SIDEBAR_ITEM } from "./talentoNav.ts";

describe("TALENTO_SIDEBAR_ITEM", () => {
  it("usa el icono de encuestas-rh, no el del primer item de la lista", () => {
    const encuestas = TALENTO_NAV_ITEMS.find((item) => item.id === "encuestas-rh");
    expect(encuestas).toBeDefined();
    expect(TALENTO_SIDEBAR_ITEM.svgPaths).toBe(encuestas!.svgPaths);
    // Reordenar la lista (dashboard-talento va primero) no debe afectar el
    // icono del hub: no coincide con el primer item si ese no es encuestas.
    expect(TALENTO_NAV_ITEMS[0]!.id).not.toBe("encuestas-rh");
    expect(TALENTO_SIDEBAR_ITEM.svgPaths).not.toBe(TALENTO_NAV_ITEMS[0]!.svgPaths);
  });
});
