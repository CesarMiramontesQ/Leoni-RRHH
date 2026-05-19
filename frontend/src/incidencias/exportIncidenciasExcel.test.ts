import { describe, expect, it } from "vitest";
import { buildIncidenciasExcelRows } from "./exportIncidenciasExcel.ts";
import type { RhIncidenciaTablaFila } from "./rh/types.ts";

const filaBase: RhIncidenciaTablaFila = {
  id: 42,
  empleado_id: "10",
  empleado_nombre_raw: "PEREZ, JUAN",
  foto_url: null,
  numero_folio: "INC-42",
  area: "Producción",
  supervisor_id: "",
  supervisor_nombre: "—",
  tipo: "retardo",
  tipo_texto: "Retardo laboral",
  fecha: "2026-05-10",
  estado: "abierto",
  prioridad: "media",
  no_empleado: "1001",
  detalle: "Llegada tarde",
  subarea: "Línea A",
};

describe("buildIncidenciasExcelRows", () => {
  it("mapea columnas visibles del listado", () => {
    const rows = buildIncidenciasExcelRows([filaBase]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "No empleado": "1001",
      Nombre: "Juan Perez",
      Tipo: "Retardo laboral",
      Detalle: "Llegada tarde",
      Área: "Producción",
      "Subárea": "Línea A",
    });
  });
});
