import { describe, expect, it } from "vitest";
import type { SchedulerLogItem } from "../api/schedulerLogs.ts";
import { formatearDuracion, renderTablaCorridas } from "./schedulerLogs.ts";

function item(overrides: Partial<SchedulerLogItem> = {}): SchedulerLogItem {
  return {
    id: 1,
    job_id: "sync_ausencias_fi_re",
    inicio_at: "2026-08-12T14:30:00+00:00",
    fin_at: "2026-08-12T14:30:12+00:00",
    duracion_ms: 12000,
    resultado: "ok",
    resumen: "leidos=10 insertados=2",
    error: null,
    ...overrides,
  };
}

describe("schedulerLogs — tabla", () => {
  it("pinta el job, el resumen y el resultado de cada corrida", () => {
    const html = renderTablaCorridas([item()]);
    expect(html).toContain("sync_ausencias_fi_re");
    expect(html).toContain("leidos=10 insertados=2");
    expect(html).toContain("Correcto");
  });

  it("escapa el contenido que viene del servidor", () => {
    const html = renderTablaCorridas([item({ resumen: "<img src=x onerror=1>" })]);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("muestra un estado vacío cuando no hay corridas", () => {
    expect(renderTablaCorridas([])).toContain("Sin corridas registradas");
  });

  it("marca la corrida que sigue en curso", () => {
    const html = renderTablaCorridas([
      item({ resultado: "en_curso", fin_at: null, duracion_ms: null }),
    ]);
    expect(html).toContain("En curso");
  });
});

describe("schedulerLogs — duración", () => {
  it("usa milisegundos, segundos o minutos según la magnitud", () => {
    expect(formatearDuracion(850)).toBe("850 ms");
    expect(formatearDuracion(12000)).toBe("12.0 s");
    expect(formatearDuracion(185000)).toBe("3.1 min");
  });

  it("devuelve un guion cuando aún no hay duración", () => {
    expect(formatearDuracion(null)).toBe("—");
  });
});
