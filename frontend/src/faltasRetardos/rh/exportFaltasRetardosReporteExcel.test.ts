import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { FaltasRetardosReporteSemanalResponse } from "../../api/faltasRetardos.ts";
import {
  buildReporteHeaders,
  buildReporteMatrix,
  reporteFilename,
} from "./exportFaltasRetardosReporteExcel.ts";

const data: FaltasRetardosReporteSemanalResponse = {
  generado_en: "2026-08-19",
  semanas: [
    { anio: 2026, numero: 31, etiqueta: "Semana 31", fecha_inicio: "2026-07-27", fecha_fin: "2026-08-02" },
    { anio: 2026, numero: 32, etiqueta: "Semana 32", fecha_inicio: "2026-08-03", fecha_fin: "2026-08-09" },
    { anio: 2026, numero: 33, etiqueta: "Semana 33", fecha_inicio: "2026-08-10", fecha_fin: "2026-08-16" },
  ],
  items: [
    { no_empleado: 1001, nombre: "Juan Pérez", semanas: ["FI, RE", "VAC", ""] },
    { no_empleado: 1002, nombre: "María López", semanas: ["", "FJ", "RE, RE"] },
    { no_empleado: 1003, nombre: "Carlos Ruiz", semanas: ["INC", "INC1", "FI"] },
  ],
};

describe("buildReporteHeaders", () => {
  it("son exactamente cinco columnas: empleado, nombre y las tres semanas", () => {
    expect(buildReporteHeaders(data)).toEqual([
      "no_empleado",
      "nombre",
      "Semana 31",
      "Semana 32",
      "Semana 33",
    ]);
  });
});

describe("buildReporteMatrix", () => {
  it("un renglón por empleado, con los códigos agrupados en la celda de su semana", () => {
    const matrix = buildReporteMatrix(data);

    expect(matrix).toHaveLength(4); // cabecera + 3 empleados
    expect(matrix[1]).toEqual([1001, "Juan Pérez", "FI, RE", "VAC", ""]);
    expect(matrix[2]).toEqual([1002, "María López", "", "FJ", "RE, RE"]);
    expect(matrix[3]).toEqual([1003, "Carlos Ruiz", "INC", "INC1", "FI"]);
    for (const fila of matrix) expect(fila).toHaveLength(5);
  });

  it("rellena la fila aunque falten celdas, sin desplazar las columnas", () => {
    const corta: FaltasRetardosReporteSemanalResponse = {
      ...data,
      items: [{ no_empleado: 7, nombre: "Sin datos", semanas: ["RE"] }],
    };
    expect(buildReporteMatrix(corta)[1]).toEqual([7, "Sin datos", "RE", "", ""]);
  });
});

describe("reporteFilename", () => {
  it("lleva la fecha de generación del servidor", () => {
    expect(reporteFilename(data)).toBe("reporte_incidencias_2026-08-19.xlsx");
  });
});

describe("hoja generada", () => {
  it("se lee de vuelta como un xlsx válido con las mismas celdas", () => {
    const worksheet = XLSX.utils.aoa_to_sheet(buildReporteMatrix(data));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Incidencias");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const releido = XLSX.read(buffer, { type: "array" });
    expect(releido.SheetNames).toEqual(["Incidencias"]);
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      releido.Sheets.Incidencias,
    );
    expect(filas).toHaveLength(3);
    expect(filas[0]).toMatchObject({
      no_empleado: 1001,
      nombre: "Juan Pérez",
      "Semana 31": "FI, RE",
      "Semana 32": "VAC",
    });
    // Semana sin incidencias: la celda existe y está vacía, no se omite ni se corre
    // el contenido de la columna siguiente.
    expect(filas[0]["Semana 33"]).toBe("");
    expect(Object.keys(filas[2])).toEqual([
      "no_empleado",
      "nombre",
      "Semana 31",
      "Semana 32",
      "Semana 33",
    ]);
  });
});
