import { describe, expect, it } from "vitest";
import { aggregateSolicitudesDiasPorMes } from "./aggregateSolicitudesDiasPorMes.ts";
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

describe("aggregateSolicitudesDiasPorMes", () => {
  const periodos = ["2026-04", "2026-05"] as const;

  it("suma días de vacaciones en el mes del periodo", () => {
    const rows = [
      fila({
        id: 1,
        tipo: "vacaciones",
        estado: "approved",
        fecha_inicio: "2026-05-10",
        fecha_fin: "2026-05-12",
      }),
    ];
    const serie = aggregateSolicitudesDiasPorMes(rows, periodos);
    expect(serie.vacaciones[1]).toBe(3);
    expect(serie.totales[1]).toBe(3);
  });

  it("separa permisos con goce y sin goce", () => {
    const rows = [
      fila({
        id: 2,
        tipo: "paternidad",
        estado: "approved",
        fecha_inicio: "2026-05-15",
        fecha_fin: "2026-05-16",
      }),
      fila({
        id: 3,
        tipo: "permiso_sin_goce_sueldo",
        estado: "approved",
        fecha_inicio: "2026-05-20",
        fecha_fin: "2026-05-22",
      }),
    ];
    const serie = aggregateSolicitudesDiasPorMes(rows, periodos);
    expect(serie.con_goce[1]).toBe(2);
    expect(serie.sin_goce[1]).toBe(3);
  });

  it("reparte días entre meses cuando el periodo cruza meses", () => {
    const rows = [
      fila({
        id: 4,
        tipo: "vacaciones",
        estado: "approved",
        fecha_inicio: "2026-04-28",
        fecha_fin: "2026-05-02",
      }),
    ];
    const serie = aggregateSolicitudesDiasPorMes(rows, periodos);
    expect(serie.vacaciones[0]).toBe(3);
    expect(serie.vacaciones[1]).toBe(2);
  });

  it("ignora solicitudes no aprobadas", () => {
    const rows = [
      fila({
        id: 5,
        tipo: "vacaciones",
        estado: "pending",
        fecha_inicio: "2026-05-01",
        fecha_fin: "2026-05-10",
      }),
    ];
    const serie = aggregateSolicitudesDiasPorMes(rows, periodos);
    expect(serie.totales.every((n) => n === 0)).toBe(true);
  });
});
