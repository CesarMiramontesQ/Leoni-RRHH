import { describe, expect, it } from "vitest";
import {
  destroyChart,
  renderChartCanvas,
  renderChartLoadingSkeleton,
} from "./chartHost.ts";

describe("chartHost", () => {
  it("renderChartCanvas incluye data-chart-host y data-chart-id", () => {
    const html = renderChartCanvas({ chartId: "test-chart", ariaLabel: "Prueba" });
    expect(html).toContain('data-chart-id="test-chart"');
    expect(html).toContain("data-chart-host");
    expect(html).toContain('aria-label="Prueba"');
  });

  it("renderChartLoadingSkeleton acepta mensaje personalizado", () => {
    const html = renderChartLoadingSkeleton({ message: "Cargando gráfica..." });
    expect(html).toContain("data-chart-loading");
    expect(html).toContain("Cargando gráfica...");
  });

  it("destroyChart no lanza si el id no existe", () => {
    expect(() => destroyChart("inexistente")).not.toThrow();
  });
});
