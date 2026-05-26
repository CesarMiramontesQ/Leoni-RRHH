import { describe, expect, it } from "vitest";
import { aggregateHoDiasPorDiaLaboral } from "./aggregateHoDiasPorDiaLaboral.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

function fila(
  partial: Partial<RhSolicitudTablaFila> & Pick<RhSolicitudTablaFila, "id" | "tipo" | "fecha_inicio" | "fecha_fin" | "estado">,
): RhSolicitudTablaFila {
  return {
    empleado_id: "1",
    empleado_nombre_raw: "TEST, USER",
    foto_url: null,
    numero_folio: "#SOL-1",
    area: "Prod",
    fecha_solicitud: "2026-05-01",
    periodo_etiqueta: null,
    supervisor_id: "s1",
    supervisor_nombre: "Sup",
    fecha_aprobacion: null,
    ...partial,
  };
}

describe("aggregateHoDiasPorDiaLaboral", () => {
  it("expande lunes a miércoles en días laborales", () => {
    // 2026-05-11 lun, 12 mar, 13 mié
    const rows = [
      fila({
        id: 1,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-11",
        fecha_fin: "2026-05-13",
      }),
    ];
    const s = aggregateHoDiasPorDiaLaboral(rows);
    expect(s.valores[0]).toBe(1);
    expect(s.valores[1]).toBe(1);
    expect(s.valores[2]).toBe(1);
    expect(s.total).toBe(3);
    expect(s.dia_mas_solicitado).toBe("Lunes");
  });

  it("excluye sábado y domingo", () => {
    // 2026-05-08 vie … 2026-05-11 lun
    const rows = [
      fila({
        id: 2,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-08",
        fecha_fin: "2026-05-11",
      }),
    ];
    const s = aggregateHoDiasPorDiaLaboral(rows);
    expect(s.valores[4]).toBe(1);
    expect(s.valores[0]).toBe(1);
    expect(s.total).toBe(2);
  });

  it("por defecto ignora no aprobadas; con filtro de estado respeta filas entrantes", () => {
    const rows = [
      fila({
        id: 3,
        tipo: "home_office",
        estado: "pending",
        fecha_inicio: "2026-05-12",
        fecha_fin: "2026-05-12",
      }),
      fila({
        id: 4,
        tipo: "home_office",
        estado: "pending",
        fecha_inicio: "2026-05-13",
        fecha_fin: "2026-05-13",
      }),
    ];
    expect(aggregateHoDiasPorDiaLaboral(rows).total).toBe(0);
    expect(aggregateHoDiasPorDiaLaboral(rows, { estadoFiltroActivo: "pending" }).total).toBe(2);
  });

  it("calcula concentración como día principal / total × 100", () => {
    const rows = [
      fila({
        id: 6,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-11",
        fecha_fin: "2026-05-11",
      }),
      fila({
        id: 7,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-11",
        fecha_fin: "2026-05-12",
      }),
    ];
    const s = aggregateHoDiasPorDiaLaboral(rows);
    expect(s.total).toBe(3);
    expect(s.dia_mas_solicitado).toBe("Lunes");
    expect(s.dia_mas_solicitado_total).toBe(2);
    expect(s.dia_mas_solicitado_pct).toBeCloseTo(66.7, 1);
  });

  it("reporta solicitudes HO distinto del total si hay fin de semana en el periodo", () => {
    const rows = [
      fila({
        id: 9,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-09",
        fecha_fin: "2026-05-09",
      }),
      fila({
        id: 10,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-05-11",
        fecha_fin: "2026-05-11",
      }),
    ];
    const s = aggregateHoDiasPorDiaLaboral(rows);
    expect(s.solicitudes_ho).toBe(2);
    expect(s.total).toBe(1);
  });

  it("ignora tipos distintos a home office", () => {
    const rows = [
      fila({
        id: 5,
        tipo: "vacaciones",
        estado: "approved",
        fecha_inicio: "2026-05-12",
        fecha_fin: "2026-05-14",
      }),
    ];
    expect(aggregateHoDiasPorDiaLaboral(rows).total).toBe(0);
  });
});
