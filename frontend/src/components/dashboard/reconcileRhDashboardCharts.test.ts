import { describe, expect, it } from "vitest";
import { selectDescriptorsToRemount } from "./rhAnalyticsCharts.ts";

type Desc = { ids: readonly string[]; hasData: boolean; label: string };

const desc = (label: string, ids: string[], hasData: boolean): Desc => ({
  label,
  ids,
  hasData,
});

describe("selectDescriptorsToRemount", () => {
  it("remonta una gráfica con datos cuyo canvas existe pero no está sana", () => {
    const descriptors = [desc("retardos", ["a"], true)];
    const result = selectDescriptorsToRemount(
      descriptors,
      () => true, // canvas presente
      () => false, // no sana
    );
    expect(result.map((d) => d.label)).toEqual(["retardos"]);
  });

  it("no toca gráficas sanas (cero parpadeo)", () => {
    const descriptors = [desc("retardos", ["a"], true)];
    const result = selectDescriptorsToRemount(
      descriptors,
      () => true,
      () => true, // sana
    );
    expect(result).toEqual([]);
  });

  it("ignora gráficas sin datos aunque el canvas exista", () => {
    const descriptors = [desc("comedor", ["a"], false)];
    const result = selectDescriptorsToRemount(
      descriptors,
      () => true,
      () => false,
    );
    expect(result).toEqual([]);
  });

  it("ignora canvases ausentes del DOM (no remonta a ciegas)", () => {
    const descriptors = [desc("retardos", ["a"], true)];
    const result = selectDescriptorsToRemount(
      descriptors,
      () => false, // canvas ausente
      () => false,
    );
    expect(result).toEqual([]);
  });

  it("remonta si alguno de varios canvases del mismo mount no está sano", () => {
    const descriptors = [desc("empleados", ["a", "b"], true)];
    const result = selectDescriptorsToRemount(
      descriptors,
      () => true,
      (id) => id === "a", // 'a' sana, 'b' no
    );
    expect(result.map((d) => d.label)).toEqual(["empleados"]);
  });

  it("selecciona solo las no sanas en un conjunto mixto", () => {
    const descriptors = [
      desc("retardos", ["a"], true),
      desc("faltas", ["b"], true),
      desc("comedor", ["c"], true),
    ];
    const healthy = new Set(["a", "c"]);
    const result = selectDescriptorsToRemount(
      descriptors,
      () => true,
      (id) => healthy.has(id),
    );
    expect(result.map((d) => d.label)).toEqual(["faltas"]);
  });
});
