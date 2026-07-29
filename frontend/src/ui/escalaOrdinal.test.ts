/**
 * La rampa ordinal tiene dos garantías que no se pueden romper sin que la vista
 * mienta: es monótona (a la derecha, más tinta) y el texto encima siempre
 * contrasta.
 */
import { describe, expect, it } from "vitest";

import {
  progresoOrdinal,
  tinteOrdinalChip,
  tinteOrdinalFondo,
  UMBRAL_TEXTO_INVERTIDO,
} from "./escalaOrdinal.ts";

/** Porcentaje de tinta que la expresión `color-mix` le da al primario. */
function tinta(css: string): number {
  const m = css.match(/var\(--color-primary\)\s+([\d.]+)%/);
  expect(m, `sin porcentaje en «${css}»`).not.toBeNull();
  return Number(m![1]);
}

describe("progresoOrdinal", () => {
  it("recorre de 0 a 1 a lo largo del eje", () => {
    expect(progresoOrdinal(0, 5)).toBe(0);
    expect(progresoOrdinal(4, 5)).toBe(1);
  });

  it("una sola columna se pinta en el extremo alto, no dividiendo entre cero", () => {
    expect(progresoOrdinal(0, 1)).toBe(1);
  });

  it("acota los índices fuera de rango en vez de salirse de la rampa", () => {
    expect(progresoOrdinal(-3, 5)).toBe(0);
    expect(progresoOrdinal(99, 5)).toBe(1);
  });
});

describe("tinteOrdinalFondo", () => {
  it("es monótona: cada columna lleva al menos tanta tinta como la anterior", () => {
    const total = 13;
    const tintas = Array.from({ length: total }, (_, i) =>
      tinta(tinteOrdinalFondo(i, total)),
    );
    for (let i = 1; i < tintas.length; i++) {
      expect(tintas[i]).toBeGreaterThan(tintas[i - 1]);
    }
  });

  it("se mantiene como fondo: nunca compite con lo que se apoya encima", () => {
    const total = 13;
    for (let i = 0; i < total; i++) {
      expect(tinta(tinteOrdinalFondo(i, total))).toBeLessThanOrEqual(30);
    }
  });

  it("interpola sobre un token, no sobre un hex inventado", () => {
    expect(tinteOrdinalFondo(2, 10)).toContain("var(--color-primary)");
  });
});

describe("tinteOrdinalChip", () => {
  it("el texto se invierte justo donde el fondo se oscurece", () => {
    const total = 100;
    for (let i = 0; i < total; i++) {
      const chip = tinteOrdinalChip(i, total);
      const oscuro = tinta(chip.fondo) >= UMBRAL_TEXTO_INVERTIDO;
      expect(chip.texto === "#FFFFFF").toBe(oscuro);
    }
  });

  it("recorre la rampa completa, que es donde el color se lee", () => {
    expect(tinta(tinteOrdinalChip(0, 10).fondo)).toBeLessThan(20);
    expect(tinta(tinteOrdinalChip(9, 10).fondo)).toBe(100);
  });
});
