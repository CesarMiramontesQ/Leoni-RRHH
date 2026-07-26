import { describe, expect, it } from "vitest";

import {
  talentoDetailPanel,
  talentoEyebrow,
  talentoKpiCard,
  talentoKpiGrid,
  talentoKpiSkeleton,
  talentoPageRoot,
  TALENTO_KPI_ICONS,
} from "./pageKit.ts";

describe("talentoPageKit", () => {
  it("talentoPageRoot usa shell gradient y opcionalmente dashboard", () => {
    const list = talentoPageRoot("<p>hola</p>", { rootId: "talento-x" });
    expect(list).toContain('id="talento-x"');
    expect(list).toContain("max-w-[1320px]");
    expect(list).not.toContain("rh-dashboard-page");

    const dash = talentoPageRoot("<p>hola</p>", { dashboard: true });
    expect(dash).toContain("rh-dashboard-page");
    expect(dash).toContain("max-w-[1320px]");
  });

  it("talentoEyebrow escapa texto", () => {
    expect(talentoEyebrow("Talento · <script>")).toContain("Talento · &lt;script&gt;");
    expect(talentoEyebrow()).toContain("Talento");
  });

  it("talentoKpiCard renderiza label, valor e icono con accent", () => {
    const html = talentoKpiCard({
      label: "Desempeño",
      value: "78.2%",
      sub: "promedio del ciclo",
      icon: TALENTO_KPI_ICONS.chart,
      accent: "blue",
      extra: '<div data-extra="1"></div>',
    });
    expect(html).toContain("rh-dash-kpi-card");
    expect(html).toContain("Desempeño");
    expect(html).toContain("78.2%");
    expect(html).toContain("promedio del ciclo");
    expect(html).toContain("rh-dash-kpi-icon--blue");
    expect(html).toContain('data-extra="1"');
  });

  it("talentoKpiSkeleton y grid", () => {
    expect(talentoKpiSkeleton()).toContain("rh-dash-kpi-card--skeleton");
    const grid = talentoKpiGrid(talentoKpiSkeleton(), { cols: "5", ariaLabel: "KPIs" });
    expect(grid).toContain("xl:grid-cols-5");
    expect(grid).toContain('aria-label="KPIs"');
  });

  it("talentoDetailPanel usa fondo tonal sin surface con sombra heredada", () => {
    const html = talentoDetailPanel("<span>detalle</span>");
    expect(html).toContain("bg-active-tint/40");
    expect(html).toContain("detalle");
  });
});
