import { describe, expect, it } from "vitest";
import { buildActasExcelRows } from "./exportActasExcel.ts";
import type { ActaTablaFila } from "./actasMockData.ts";

const filaBase: ActaTablaFila = {
  id: 7,
  folio: "ACT-2026-007",
  empleado_id: "1001",
  empleado_nombre_raw: "PEREZ, JUAN",
  foto_url: null,
  area: "Producción",
  supervisor_id: "sup-1",
  supervisor_nombre: "GARCIA, ANA",
  tipo: "amonestacion",
  fecha: "2026-05-10",
  estado: "en_proceso",
};

describe("buildActasExcelRows", () => {
  it("mapea columnas visibles del listado", () => {
    const rows = buildActasExcelRows([filaBase]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Empleado: "JUAN PEREZ",
      Folio: "ACT-2026-007",
      Área: "Producción",
      Tipo: "Amonestación",
      Estado: "En proceso",
      Supervisor: "GARCIA, ANA",
    });
    expect(rows[0].Fecha).toBeTruthy();
  });
});
