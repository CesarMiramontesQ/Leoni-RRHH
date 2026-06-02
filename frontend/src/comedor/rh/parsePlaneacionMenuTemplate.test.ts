import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parsePlaneacionMenuTemplateFromArrayBuffer } from "./parsePlaneacionMenuTemplate.ts";

function buildSampleWorkbook(): ArrayBuffer {
  const rows: string[][] = [
    ["", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"],
    ["OPCION A", "Plato A lun", "Plato A mar", "Plato A mie", "Plato A jue", "Plato A vie", "Plato A sab", "Plato A dom"],
    ["OPCION B", "Plato B lun", "Plato B mar", "Plato B mie", "Plato B jue", "Plato B vie", "", ""],
    ["SOPA O CREMA", "Crema lun", "Crema mar", "Sopa mie", "Crema jue", "Sopa vie", "Crema sab", "Sopa dom"],
    ["GUARNICION 1", "Arroz lun", "Arroz mar", "Arroz mie", "Arroz jue", "Arroz vie", "Arroz sab", "Arroz dom"],
    ["GUARNICION 2", "Frijoles lun", "Frijoles mar", "Frijoles mie", "Frijoles jue", "Frijoles vie", "Frijoles sab", "Frijoles dom"],
    ["GUARNICION 3", "Verduras lun", "Verduras mar", "Verduras mie", "Verduras jue", "Verduras vie", "Verduras sab", "Verduras dom"],
    ["COMPLEMENTO", "Ensalada lun", "Ensalada mar", "Ensalada mie", "Ensalada jue", "Ensalada vie", "Ensalada sab", "Ensalada dom"],
    ["COMPLEMENTO 2", "Galletas lun", "Galletas mar", "Galletas mie", "Galletas jue", "Galletas vie", "Galletas sab", "Galletas dom"],
    ["TORTILLA", "Maiz lun", "Maiz mar", "Maiz mie", "Maiz jue", "Maiz vie", "Maiz sab", "Maiz dom"],
    ["POSTRE", "Flan lun", "Gelatina mar", "Flan mie", "Arroz jue", "Gelatina vie", "Flan sab", "Arroz dom"],
    ["SALSA", "Roja lun", "Verde mar", "Roja mie", "Chipotle jue", "Morita vie", "Verde sab", "Roja dom"],
    ["AGUAS", "Jamaica lun", "Pepino mar", "Sandia mie", "Avena jue", "Jamaica vie", "Avena sab", "Sandia dom"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Menu");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parsePlaneacionMenuTemplateFromArrayBuffer", () => {
  it("mapea OPCION A/B y complementos por día", () => {
    const result = parsePlaneacionMenuTemplateFromArrayBuffer(buildSampleWorkbook());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lunes = result.days.find((d) => d.key === "lunes");
    expect(lunes?.menuNormal).toBe("Plato A lun");
    expect(lunes?.menuDieta).toBe("Plato B lun");
    expect(lunes?.detalle.sopa_o_crema).toEqual(["Crema lun"]);
    expect(lunes?.detalle.guarniciones).toEqual(["Arroz lun", "Frijoles lun", "Verduras lun"]);
    expect(lunes?.detalle.complementos).toEqual(["Ensalada lun", "Galletas lun"]);
    expect(lunes?.detalle.tortillas).toEqual(["Maiz lun"]);
    expect(lunes?.detalle.postres).toEqual(["Flan lun"]);
    expect(lunes?.detalle.salsas).toEqual(["Roja lun"]);
    expect(lunes?.detalle.aguas).toEqual(["Jamaica lun"]);
    expect(result.days.find((d) => d.key === "sabado")?.menuDieta).toBe("");
    expect(result.days.find((d) => d.key === "domingo")?.menuDieta).toBe("");
  });

  it("rechaza plantilla sin encabezados de día", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["OPCION A", "x"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Menu");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parsePlaneacionMenuTemplateFromArrayBuffer(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_template");
  });

  it("acepta sábado y domingo sin OPCIÓN B", () => {
    const rows: string[][] = [
      ["", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"],
      ["OPCION A", "A", "A", "A", "A", "A", "A", "A"],
      ["OPCION B", "B", "B", "B", "B", "B", "", ""],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Menu");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parsePlaneacionMenuTemplateFromArrayBuffer(buffer);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.days.find((d) => d.key === "domingo")?.menuDieta).toBe("");
  });

  it("rechaza datos incompletos en días laborales", () => {
    const rows: string[][] = [
      ["", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO"],
      ["OPCION A", "A", "", "C", "D", "E", "F", "G"],
      ["OPCION B", "B", "B2", "C2", "D2", "E2", "F2", "G2"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Menu");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parsePlaneacionMenuTemplateFromArrayBuffer(buffer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("incomplete_data");
  });
});
