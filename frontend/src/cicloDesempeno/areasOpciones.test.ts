import { describe, expect, it } from "vitest";

import { mezclarAreasOpciones } from "./areasOpciones.ts";

const r = (area_id: number | null, area_nombre: string | null) => ({ area_id, area_nombre });

describe("mezclarAreasOpciones", () => {
  it("saca las áreas de los resultados, sin repetir y ordenadas por nombre", () => {
    const opciones = mezclarAreasOpciones([], [r(2, "Zinc"), r(1, "Arneses"), r(1, "Arneses")]);
    expect(opciones).toEqual([
      { id: 1, nombre: "Arneses" },
      { id: 2, nombre: "Zinc" },
    ]);
  });

  it("no pierde las opciones previas cuando los resultados vienen filtrados", () => {
    // Este es el caso que rompe si la lista se recalcula desde cero: tras
    // filtrar por "Arneses", los resultados solo traen esa área y el selector
    // se quedaría sin la opción para volver a "Zinc".
    const previas = [
      { id: 1, nombre: "Arneses" },
      { id: 2, nombre: "Zinc" },
    ];
    expect(mezclarAreasOpciones(previas, [r(1, "Arneses")])).toEqual(previas);
  });

  it("ignora a los empleados sin área", () => {
    expect(mezclarAreasOpciones([], [r(null, null)])).toEqual([]);
  });

  it("no deja una opción sin etiqueta si falta el nombre", () => {
    expect(mezclarAreasOpciones([], [r(7, null)])).toEqual([{ id: 7, nombre: "Área 7" }]);
  });
});
