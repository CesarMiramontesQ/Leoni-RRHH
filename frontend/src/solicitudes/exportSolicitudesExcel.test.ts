import { describe, expect, it } from "vitest";
import { buildSolicitudesExcelRows } from "./exportSolicitudesExcel.ts";
import type { RhSolicitudTablaFila } from "./rh/types.ts";

const filaBase: RhSolicitudTablaFila = {
  id: 1,
  empleado_id: "10",
  empleado_nombre_raw: "PEREZ, JUAN",
  empleado_no_empleado: "1001",
  foto_url: null,
  numero_folio: "SOL-99",
  area: "Producción",
  tipo: "vacaciones",
  fecha_solicitud: "2026-05-01",
  fecha_inicio: "2026-05-10",
  fecha_fin: "2026-05-12",
  periodo_etiqueta: null,
  estado: "pending",
  supervisor_id: "2",
  supervisor_nombre: "GARCIA, ANA",
  fecha_aprobacion: null,
};

describe("buildSolicitudesExcelRows", () => {
  it("mapea columnas de tabla gestor", () => {
    const rows = buildSolicitudesExcelRows([filaBase], "gestor");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      Empleado: "JUAN PEREZ",
      Número: "#SOL-99",
      Área: "Producción",
      Tipo: "Vacaciones",
      Estado: "Pendiente",
    });
    expect(rows[0]["Periodo solicitado"]).toContain("may");
  });

  it("mapea columnas de tabla empleado", () => {
    const rows = buildSolicitudesExcelRows([filaBase], "empleado");
    expect(rows[0]).toMatchObject({
      Folio: "#SOL-99",
      Tipo: "Vacaciones",
      Días: 3,
      Estatus: "Pendiente",
    });
  });

  it("incluye columna Sección cuando se indica", () => {
    const rows = buildSolicitudesExcelRows([filaBase], "gestor", ["Mis solicitudes"]);
    expect(rows[0].Sección).toBe("Mis solicitudes");
    expect(rows[0].Empleado).toBe("JUAN PEREZ");
  });
});
