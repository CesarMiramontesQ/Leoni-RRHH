import { describe, expect, it } from "vitest";
import {
  chartCategoricalPalette,
  chartColorAt,
  chartColorSlots,
  chartPalette,
  chartSemanticColors,
  cssVar,
} from "./chartTokens.ts";

function hexToHue(hex: string): number | null {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return null;
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return Math.round(((hue * 60) + 360) % 360);
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

describe("chartTokens (sin DOM)", () => {
  it("cssVar devuelve fallback en entorno node", () => {
    expect(cssVar("--color-accent", "#2563EB")).toBe("#2563EB");
  });

  it("chartSemanticColors usa fallbacks", () => {
    const c = chartSemanticColors();
    expect(c.accent).toBe("#2563EB");
    expect(c.leoniBlue).toBe("#002147");
  });

  it("chartPalette tiene al menos 8 colores", () => {
    expect(chartPalette().length).toBeGreaterThanOrEqual(8);
    expect(chartCategoricalPalette().length).toBeGreaterThanOrEqual(8);
  });

  it("chartCategoricalPalette no tiene colores duplicados", () => {
    const palette = chartCategoricalPalette();
    const normalized = palette.map((c) => c.toLowerCase());
    expect(new Set(normalized).size).toBe(palette.length);
  });

  it("pares adyacentes de la paleta no comparten el mismo matiz", () => {
    const palette = chartCategoricalPalette();
    const hues = palette.map(hexToHue);
    for (let i = 0; i < hues.length - 1; i += 1) {
      const a = hues[i];
      const b = hues[i + 1];
      if (a == null || b == null) continue;
      expect(hueDistance(a, b)).toBeGreaterThanOrEqual(25);
    }
  });

  it("chartColorAt rota de forma estable", () => {
    const palette = chartCategoricalPalette();
    expect(chartColorAt(0)).toBe(palette[0]);
    expect(chartColorAt(palette.length)).toBe(palette[0]);
    expect(chartColorAt(-1)).toBe(palette[palette.length - 1]);
  });

  it("chartColorSlots expone los nueve slots nombrados", () => {
    const slots = chartColorSlots();
    expect(slots.accent).toBe("#2563EB");
    expect(slots.violet).toBe("#9333EA");
    expect(slots.teal).toBe("#0891B2");
  });
});
