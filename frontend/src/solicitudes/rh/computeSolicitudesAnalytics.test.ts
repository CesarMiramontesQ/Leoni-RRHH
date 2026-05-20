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
  it("agrupa KPIs y por tipo sin fusionar permisos", () => {
    const rows = [
      fila({ id: 1, tipo: "vacaciones", estado: "pending", fecha_solicitud: "2026-05-01" }),
      fila({ id: 2, tipo: "home_office", estado: "approved", fecha_solicitud: "2026-05-02" }),
      fila({ id: 3, tipo: "paternidad", estado: "approved", fecha_solicitud: "2026-05-03" }),
      fila({ id: 4, tipo: "matrimonio", estado: "approved", fecha_solicitud: "2026-05-04" }),
      fila({ id: 5, tipo: "permiso_sin_goce_sueldo", estado: "approved", fecha_solicitud: "2026-05-05" }),
    ];
    const d = computeSolicitudesAnalytics(rows, new Date(2026, 4, 15));
    expect(d.kpis.total).toBe(5);
    expect(d.kpis.pendientes).toBe(1);
    expect(d.por_tipo.map((s) => s.codigo).sort()).toEqual(
      ["home_office", "matrimonio", "paternidad", "permiso_sin_goce_sueldo", "vacaciones"].sort(),
    );
    expect(d.por_tipo.some((s) => s.label === "Permisos con goce")).toBe(false);
    expect(d.por_estado.length).toBe(2);
  });

  it("tendencia mensual desglosa por tipo en los últimos 6 meses", () => {
    const rows = [
      fila({ id: 10, tipo: "vacaciones", estado: "approved", fecha_solicitud: "2026-05-01" }),
      fila({ id: 11, tipo: "matrimonio", estado: "approved", fecha_solicitud: "2026-05-15" }),
      fila({ id: 12, tipo: "paternidad", estado: "approved", fecha_solicitud: "2026-04-10" }),
    ];
    const d = computeSolicitudesAnalytics(rows, new Date(2026, 4, 15));
    expect(d.tendencia_mes_por_tipo.periodos).toHaveLength(6);
    const vac = d.tendencia_mes_por_tipo.series.find((s) => s.codigo === "vacaciones");
    const mat = d.tendencia_mes_por_tipo.series.find((s) => s.codigo === "matrimonio");
    const pat = d.tendencia_mes_por_tipo.series.find((s) => s.codigo === "paternidad");
    expect(vac?.valores.at(-1)).toBe(1);
    expect(mat?.valores.at(-1)).toBe(1);
    expect(pat?.valores.at(-2)).toBe(1);
  });

  it("departamentos: solo vac/ho aprobadas por defecto y orden por total", () => {
    const rows = [
      fila({ id: 20, tipo: "vacaciones", estado: "approved", fecha_solicitud: "2026-05-01", area: "Prod A" }),
      fila({ id: 21, tipo: "vacaciones", estado: "approved", fecha_solicitud: "2026-05-02", area: "Prod A" }),
      fila({ id: 22, tipo: "home_office", estado: "approved", fecha_solicitud: "2026-05-01", area: "Prod B" }),
      fila({ id: 23, tipo: "paternidad", estado: "approved", fecha_solicitud: "2026-05-01", area: "Prod C" }),
      fila({ id: 24, tipo: "home_office", estado: "pending", fecha_solicitud: "2026-05-01", area: "Prod D" }),
    ];
    const d = computeSolicitudesAnalytics(rows, new Date(2026, 4, 15));
    expect(d.solicitudes_por_departamento.departamento_lider).toBe("Prod A");
    expect(d.solicitudes_por_departamento.rows[0]?.total).toBe(2);
    expect(d.solicitudes_por_departamento.total_vacaciones).toBe(2);
    expect(d.solicitudes_por_departamento.total_home_office).toBe(1);
    expect(d.solicitudes_por_departamento.rows.find((a) => a.label === "Prod C")).toBeUndefined();
    expect(d.solicitudes_por_departamento.rows.find((a) => a.label === "Prod D")).toBeUndefined();
  });

});
