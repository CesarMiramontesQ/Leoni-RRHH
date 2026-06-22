import { describe, expect, it } from "vitest";
import { mapTablaFilaToSolicitudDetallePendiente } from "./mapTablaFilaToSolicitudDetalle.ts";
import type { RhSolicitudTablaFila } from "./types.ts";

const filaBase: RhSolicitudTablaFila = {
  id: 501,
  empleado_id: "42",
  empleado_no_empleado: "00042",
  empleado_puesto: "Operador general",
  empleado_nombre_raw: "PÉREZ, JUAN",
  foto_url: null,
  numero_folio: "SOL-501",
  area: "Operaciones",
  tipo: "vacaciones",
  fecha_solicitud: "2026-04-01",
  fecha_inicio: "2026-05-05",
  fecha_fin: "2026-05-09",
  periodo_etiqueta: null,
  estado: "pending",
  supervisor_id: "7",
  supervisor_nombre: "LÓPEZ, MARÍA",
  fecha_aprobacion: null,
  comentarios: "Comentario real desde API",
};

describe("mapTablaFilaToSolicitudDetallePendiente", () => {
  it("prioriza comentarios de la fila (API) sobre extras mock", () => {
    const vm = mapTablaFilaToSolicitudDetallePendiente(filaBase);
    expect(vm?.solicitud.comentario_empleado).toBe("Comentario real desde API");
  });

it("soloLectura: prioriza número de empleado y puesto desde la fila/API", () => {
    const vm = mapTablaFilaToSolicitudDetallePendiente(filaBase, { soloLectura: true });
    expect(vm?.empleado.id_empleado).toBe("42");
    expect(vm?.empleado.puesto).toBe("Operador general");
  });

  it("soloLectura: misma solicitud que modo aprobador (fechas y tipo)", () => {
    const vmL = mapTablaFilaToSolicitudDetallePendiente(filaBase, { soloLectura: true });
    const vmA = mapTablaFilaToSolicitudDetallePendiente(filaBase, { soloLectura: false });
    expect(vmL?.solicitud.total_dias).toBe(vmA?.solicitud.total_dias);
    expect(vmL?.solicitud.tipo_codigo).toBe(vmA?.solicitud.tipo_codigo);
    expect(vmL?.id).toBe(vmA?.id);
  });
});
