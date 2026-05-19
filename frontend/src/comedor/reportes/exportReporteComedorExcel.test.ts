import { describe, expect, it } from "vitest";
import { buildReporteComedorExcelRows } from "./exportReporteComedorExcel.ts";
import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";

const filaBase: ComedorRhProximoRegistroRow = {
  id: 1,
  empleado_id: 10,
  empleado_nombre: "JUAN PEREZ",
  no_empleado: "E-1001",
  area: "Producción",
  comedor_nombre: "Comedor Norte",
  fecha_servicio: "2026-05-15",
  tipo_comida: "casera",
  estado_acceso: "ACCEDIDO",
};

describe("buildReporteComedorExcelRows", () => {
  it("mapea columnas visibles del listado de detalle", () => {
    const rows = buildReporteComedorExcelRows([filaBase]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Empleado: "JUAN PEREZ",
      "No. empleado": "E-1001",
      Área: "Producción",
      Comedor: "Comedor Norte",
      Tipo: "Opción A",
      Estado: "Accedido",
    });
    expect(rows[0]["Fecha servicio"]).toBeTruthy();
  });

  it("respeta etiquetas de estado cancelado", () => {
    const rows = buildReporteComedorExcelRows([
      { ...filaBase, estado_acceso: "EXPIRADO" },
    ]);
    expect(rows[0].Estado).toBe("Cancelado");
  });
});
