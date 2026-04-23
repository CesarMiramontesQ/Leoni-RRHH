import { describe, expect, it } from "vitest";
import { debeOcultarAccionesAprobacionPorAutopaprobacion } from "./solicitudAutopaprobacionUi.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

function fila(empleadoId: string): RhSolicitudTablaFila {
  return {
    id: 1,
    empleado_id: empleadoId,
    empleado_nombre_raw: "TEST",
    foto_url: null,
    numero_folio: "SOL-1",
    area: "A",
    tipo: "vacaciones",
    fecha_solicitud: "2026-01-01",
    fecha_inicio: "2026-02-01",
    fecha_fin: "2026-02-05",
    periodo_etiqueta: null,
    estado: "pending",
    supervisor_id: "",
    supervisor_nombre: "—",
    fecha_aprobacion: null,
  };
}

describe("debeOcultarAccionesAprobacionPorAutopaprobacion", () => {
  it("supervisor con misma id de fila → true", () => {
    expect(debeOcultarAccionesAprobacionPorAutopaprobacion(fila("42"), "supervisor", "42")).toBe(true);
  });

  it("gerente con misma id de fila → true", () => {
    expect(debeOcultarAccionesAprobacionPorAutopaprobacion(fila("7"), "gerente", "7")).toBe(true);
  });

  it("supervisor con id distinta → false", () => {
    expect(debeOcultarAccionesAprobacionPorAutopaprobacion(fila("1"), "supervisor", "2")).toBe(false);
  });

  it("rh con misma id → false (no aplica regla jerárquica)", () => {
    expect(debeOcultarAccionesAprobacionPorAutopaprobacion(fila("99"), "rh", "99")).toBe(false);
  });

  it("supervisor sin sub en token → false", () => {
    expect(debeOcultarAccionesAprobacionPorAutopaprobacion(fila("1"), "supervisor", null)).toBe(false);
  });
});
