import { describe, expect, it } from "vitest";
import { chartPalette, chartSemanticColors, cssVar } from "./chartTokens.ts";

describe("chartTokens (sin DOM)", () => {
  it("cssVar devuelve fallback en entorno node", () => {
    expect(cssVar("--color-accent", "#2563EB")).toBe("#2563EB");
  });

  it("chartSemanticColors usa fallbacks", () => {
    const c = chartSemanticColors();
    expect(c.accent).toBe("#2563EB");
    expect(c.leoniBlue).toBe("#002147");
  });

  it("chartPalette tiene al menos 4 colores", () => {
    expect(chartPalette().length).toBeGreaterThanOrEqual(4);
  });
});
