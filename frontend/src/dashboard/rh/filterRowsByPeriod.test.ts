import { describe, expect, it } from "vitest";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";
import {
  filterSolicitudRowsByPeriod,
  listDiasEnRango,
  listPeriodosMensualesEnRango,
  listSemanasEnRango,
  tendenciaAgrupacionForPeriod,
  periodRangeIso,
  countVacacionesUrgentes,
} from "./filterRowsByPeriod.ts";

function row(partial: Partial<RhSolicitudTablaFila> & Pick<RhSolicitudTablaFila, "id">): RhSolicitudTablaFila {
  return {
    empleado_id: "1",
    empleado_nombre_raw: "TEST, USER",
    foto_url: null,
    numero_folio: "#SOL-1",
    area: "Area",
    tipo: "vacaciones",
    fecha_solicitud: "2026-05-01",
    fecha_inicio: "2026-05-10",
    fecha_fin: "2026-05-12",
    periodo_etiqueta: null,
    estado: "pending",
    supervisor_id: "2",
    supervisor_nombre: "Supervisor",
    fecha_aprobacion: null,
    ...partial,
  };
}

describe("periodRangeIso", () => {
  it("devuelve rango de 30 días inclusivo", () => {
    const { fechaInicio, fechaFin } = periodRangeIso(30);
    expect(fechaFin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);
    const diff = Math.round((end.getTime() - start.getTime()) / (86400000));
    expect(diff).toBe(29);
  });
});

describe("tendenciaAgrupacionForPeriod", () => {
  it("mapea 30/60/90 a semana/semana/mes", () => {
    expect(tendenciaAgrupacionForPeriod(30)).toBe("semana");
    expect(tendenciaAgrupacionForPeriod(60)).toBe("semana");
    expect(tendenciaAgrupacionForPeriod(90)).toBe("mes");
  });
});

describe("listDiasEnRango", () => {
  it("lista 7 dias inclusivos", () => {
    expect(listDiasEnRango("2026-05-15", "2026-05-21")).toHaveLength(7);
  });
});

describe("listPeriodosMensualesEnRango", () => {
  it("lista todos los meses calendario del rango inclusivo", () => {
    expect(listPeriodosMensualesEnRango("2026-02-22", "2026-05-21")).toEqual([
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
    ]);
    expect(listPeriodosMensualesEnRango("2026-05-01", "2026-05-21")).toEqual(["2026-05"]);
  });
});

describe("filterSolicitudRowsByPeriod", () => {
  it("incluye filas con fecha_solicitud dentro del rango", () => {
    const rows = [
      row({ id: 1, fecha_solicitud: "2026-05-01" }),
      row({ id: 2, fecha_solicitud: "2026-04-01" }),
      row({ id: 3, fecha_solicitud: "2026-05-15" }),
    ];
    const out = filterSolicitudRowsByPeriod(rows, "2026-05-01", "2026-05-10");
    expect(out.map((r) => r.id)).toEqual([1]);
  });
});

describe("countVacacionesUrgentes", () => {
  it("cuenta vacaciones pendientes con inicio en menos de 7 días", () => {
    const rows = [
      row({ id: 1, tipo: "vacaciones", estado: "pending", fecha_inicio: "2026-05-23" }),
      row({ id: 2, tipo: "vacaciones", estado: "pending", fecha_inicio: "2026-06-15" }),
      row({ id: 3, tipo: "home_office", estado: "pending", fecha_inicio: "2026-05-22" }),
    ];
    expect(countVacacionesUrgentes(rows, "2026-05-21")).toBe(1);
  });
});
