import { describe, expect, it } from "vitest";
import { aggregateSolicitudesPersonasDia } from "./aggregateSolicitudesPersonasDia.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

function fila(partial: Partial<RhSolicitudTablaFila> & Pick<RhSolicitudTablaFila, "id" | "tipo" | "fecha_inicio" | "fecha_fin" | "estado">): RhSolicitudTablaFila {
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

describe("aggregateSolicitudesPersonasDia", () => {
  it("expande un periodo de vacaciones a personas-día por día", () => {
    const rows = [
      fila({
        id: 1,
        tipo: "vacaciones",
        estado: "approved",
        fecha_inicio: "2026-05-10",
        fecha_fin: "2026-05-12",
      }),
    ];
    const serie = aggregateSolicitudesPersonasDia(rows, "2026-05-01", "2026-05-31");
    expect(serie.labels).toHaveLength(31);
    expect(serie.vacaciones[9]).toBe(1);
    expect(serie.vacaciones[10]).toBe(1);
    expect(serie.vacaciones[11]).toBe(1);
    expect(serie.totales[9] + serie.totales[10] + serie.totales[11]).toBe(3);
    expect(serie.vacaciones[0]).toBe(0);
  });

  it("ignora pendientes y rechazadas; recorta al rango del mes", () => {
    const rows = [
      fila({
        id: 2,
        tipo: "home_office",
        estado: "rejected",
        fecha_inicio: "2026-05-05",
        fecha_fin: "2026-05-05",
      }),
      fila({
        id: 3,
        tipo: "home_office",
        estado: "pending",
        fecha_inicio: "2026-04-28",
        fecha_fin: "2026-05-02",
      }),
      fila({
        id: 6,
        tipo: "home_office",
        estado: "approved",
        fecha_inicio: "2026-04-28",
        fecha_fin: "2026-05-02",
      }),
    ];
    const serie = aggregateSolicitudesPersonasDia(rows, "2026-05-01", "2026-05-31");
    expect(serie.home_office[0]).toBe(1);
    expect(serie.home_office[1]).toBe(1);
    expect(serie.home_office[2]).toBe(0);
  });

  it("clasifica permisos con y sin goce", () => {
    const rows = [
      fila({
        id: 4,
        tipo: "paternidad",
        estado: "approved",
        fecha_inicio: "2026-05-15",
        fecha_fin: "2026-05-15",
      }),
      fila({
        id: 5,
        tipo: "permiso_sin_goce_sueldo",
        estado: "approved",
        fecha_inicio: "2026-05-20",
        fecha_fin: "2026-05-20",
      }),
    ];
    const serie = aggregateSolicitudesPersonasDia(rows, "2026-05-01", "2026-05-31");
    expect(serie.con_goce[14]).toBe(1);
    expect(serie.sin_goce[19]).toBe(1);
  });

  it("no cuenta solicitudes pendientes", () => {
    const rows = [
      fila({
        id: 7,
        tipo: "vacaciones",
        estado: "pending",
        fecha_inicio: "2026-05-10",
        fecha_fin: "2026-05-10",
      }),
    ];
    const serie = aggregateSolicitudesPersonasDia(rows, "2026-05-01", "2026-05-31");
    expect(serie.totales.every((n) => n === 0)).toBe(true);
  });
});
