import { describe, expect, it } from "vitest";
import { faltasRetardosFiltersFromHash } from "./faltasRetardosFilterHelpers.ts";
import { emptyFaltasRetardosListFilters } from "./types.ts";

describe("faltasRetardosFiltersFromHash", () => {
  it("siembra tipo y rango de fechas desde el deep-link", () => {
    const filters = faltasRetardosFiltersFromHash(
      "#/faltas-retardos?tipo=retardo&fecha_inicio=2026-01-01&fecha_fin=2026-03-31",
    );
    expect(filters).toEqual({
      busqueda: "",
      tipo: "retardo",
      fecha_inicio: "2026-01-01",
      fecha_fin: "2026-03-31",
    });
  });

  it("acepta falta_injustificada", () => {
    const filters = faltasRetardosFiltersFromHash(
      "#/faltas-retardos?tipo=falta_injustificada",
    );
    expect(filters.tipo).toBe("falta_injustificada");
  });

  it("ignora un tipo inválido", () => {
    const filters = faltasRetardosFiltersFromHash("#/faltas-retardos?tipo=otro");
    expect(filters.tipo).toBe("");
  });

  it("ignora fechas con formato inválido", () => {
    const filters = faltasRetardosFiltersFromHash(
      "#/faltas-retardos?fecha_inicio=01-01-2026&fecha_fin=hoy",
    );
    expect(filters.fecha_inicio).toBe("");
    expect(filters.fecha_fin).toBe("");
  });

  it("devuelve filtros vacíos cuando no hay query", () => {
    expect(faltasRetardosFiltersFromHash("#/faltas-retardos")).toEqual(
      emptyFaltasRetardosListFilters(),
    );
    expect(faltasRetardosFiltersFromHash("")).toEqual(emptyFaltasRetardosListFilters());
  });

  it("recorta la búsqueda", () => {
    const filters = faltasRetardosFiltersFromHash(
      "#/faltas-retardos?busqueda=%20Ana%20",
    );
    expect(filters.busqueda).toBe("Ana");
  });
});
