/**
 * Dos career levels del mismo path pueden solaparse en global grades: el modelo
 * lo permite desde que un nivel abarca un tramo. En una sola fila del mapa se
 * pisarían y el gráfico diría algo falso.
 */
import { describe, expect, it } from "vitest";

import { repartirEnCarriles } from "./wtwCarriles.ts";

const nivel = (codigo: string, desde: number, hasta: number) => ({
  codigo,
  posicion_desde: desde,
  posicion_hasta: hasta,
});

describe("repartirEnCarriles", () => {
  it("un catálogo sano cabe en un solo carril", () => {
    // P2[8-9] P3[10-11] P4[12-13]: consecutivos, sin solape.
    const carriles = repartirEnCarriles([
      nivel("P2", 8, 9),
      nivel("P3", 10, 11),
      nivel("P4", 12, 13),
    ]);
    expect(carriles).toHaveLength(1);
    expect(carriles[0].map((n) => n.codigo)).toEqual(["P2", "P3", "P4"]);
  });

  it("dos niveles que se pisan bajan a carriles distintos", () => {
    const carriles = repartirEnCarriles([nivel("A", 10, 13), nivel("B", 12, 15)]);
    expect(carriles.map((c) => c.map((n) => n.codigo))).toEqual([["A"], ["B"]]);
  });

  it("compartir un solo grade ya es solape", () => {
    // El extremo cuenta: en el grid ocuparían la misma columna.
    const carriles = repartirEnCarriles([nivel("A", 10, 12), nivel("B", 12, 14)]);
    expect(carriles).toHaveLength(2);
  });

  it("tocarse sin compartir columna cabe en el mismo carril", () => {
    const carriles = repartirEnCarriles([nivel("A", 10, 11), nivel("B", 12, 13)]);
    expect(carriles).toHaveLength(1);
  });

  it("reusa el primer carril libre en vez de abrir uno nuevo", () => {
    // C no choca con A, así que vuelve al carril de A en lugar de crear un tercero.
    const carriles = repartirEnCarriles([
      nivel("A", 1, 2),
      nivel("B", 2, 5),
      nivel("C", 3, 4),
    ]);
    expect(carriles.map((c) => c.map((n) => n.codigo))).toEqual([
      ["A", "C"],
      ["B"],
    ]);
  });

  it("sin niveles no hay carriles", () => {
    expect(repartirEnCarriles([])).toEqual([]);
  });
});
