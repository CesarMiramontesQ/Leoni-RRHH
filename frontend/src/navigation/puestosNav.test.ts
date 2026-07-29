/**
 * La sección «Puestos» y el hub `#/level-up` deben listar lo mismo: los dos
 * salen de `LEVEL_UP_PUESTOS`, y si alguien los desacopla cada uno contaría una
 * historia distinta del mismo producto.
 */
import { describe, expect, it } from "vitest";

import { LEVEL_UP_CATEGORIES, LEVEL_UP_PUESTOS } from "./levelUpNav.ts";
import { PUESTOS_NAV_ITEMS, PUESTOS_SIDEBAR_ITEM } from "./puestosNav.ts";
import { TALENTO_NAV_ITEMS } from "./talentoNav.ts";

describe("sección Puestos", () => {
  it("lista la definición del puesto, en orden de captura", () => {
    // «Estructura WTW» va tras los perfiles: es el marco en el que viven, y se
    // lee antes que los catálogos que los componen.
    expect(PUESTOS_NAV_ITEMS.map((item) => item.key)).toEqual([
      "puestos",
      "wtw",
      "competencias",
      "tareas-catalogo",
      "puestos-ajustes",
    ]);
  });

  it("el encabezado se llama Puestos y aterriza en los perfiles", () => {
    expect(PUESTOS_SIDEBAR_ITEM.label).toBe("Puestos");
    expect(PUESTOS_SIDEBAR_ITEM.href).toBe("#/puestos");
  });

  it("no comparte ningún ítem con Talento", () => {
    const enTalento = new Set(TALENTO_NAV_ITEMS.map((item) => item.key));
    for (const item of PUESTOS_NAV_ITEMS) {
      expect(enTalento.has(item.key as never)).toBe(false);
    }
  });

  it("el hub agrupa igual que el menú", () => {
    const categoria = LEVEL_UP_CATEGORIES.find((c) => c.id === "puestos");
    expect(categoria?.title).toBe("Puestos");
    expect(categoria?.items.map((i) => i.key)).toEqual(
      PUESTOS_NAV_ITEMS.map((i) => i.key),
    );
  });

  it("los ítems salen de LEVEL_UP_PUESTOS, no de una copia", () => {
    expect(PUESTOS_NAV_ITEMS.map((i) => i.href)).toEqual(
      LEVEL_UP_PUESTOS.map((i) => i.href),
    );
  });
});
