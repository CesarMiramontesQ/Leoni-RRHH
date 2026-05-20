import { describe, expect, it } from "vitest";
import { computeSolicitudesAnalytics } from "./computeSolicitudesAnalytics.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

function fila(
  partial: Partial<RhSolicitudTablaFila> & Pick<RhSolicitudTablaFila, "id" | "tipo" | "estado" | "fecha_solicitud">,
): RhSolicitudTablaFila {
  return {
    empleado_id: "1",
    empleado_nombre_raw: "TEST",
    foto_url: null,
    numero_folio: "#1",
    area: "Producción",
    fecha_inicio: "2026-05-10",
    fecha_fin: "2026-05-12",
    periodo_etiqueta: null,
    supervisor_id: "s1",
    supervisor_nombre: "Supervisor A",
    fecha_aprobacion: null,
    ...partial,
  };
}

describe("computeSolicitudesAnalytics", () => {
  it("agrupa KPIs y donuts", () => {
    const rows = [
      fila({ id: 1, tipo: "vacaciones", estado: "pending", fecha_solicitud: "2026-05-01" }),
      fila({ id: 2, tipo: "home_office", estado: "approved", fecha_solicitud: "2026-05-02" }),
    ];
    const d = computeSolicitudesAnalytics(rows, new Date(2026, 4, 15));
    expect(d.kpis.total).toBe(2);
    expect(d.kpis.pendientes).toBe(1);
    expect(d.por_tipo.length).toBeGreaterThan(0);
    expect(d.por_estado.length).toBe(2);
  });

  it("ranking de supervisores solo con pendientes", () => {
    const rows = [
      fila({ id: 1, tipo: "vacaciones", estado: "pending", fecha_solicitud: "2026-05-01", supervisor_nombre: "Sup X" }),
      fila({ id: 2, tipo: "vacaciones", estado: "pending", fecha_solicitud: "2026-05-01", supervisor_nombre: "Sup X" }),
      fila({ id: 3, tipo: "vacaciones", estado: "approved", fecha_solicitud: "2026-05-01", supervisor_nombre: "Sup Y" }),
    ];
    const d = computeSolicitudesAnalytics(rows, new Date(2026, 4, 15));
    expect(d.supervisores_pendientes[0]?.label).toBe("Sup X");
    expect(d.supervisores_pendientes[0]?.total).toBe(2);
  });
});
