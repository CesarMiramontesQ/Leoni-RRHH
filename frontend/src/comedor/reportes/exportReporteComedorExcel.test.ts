import { describe, expect, it } from "vitest";
import {
  buildPlaneacionPlatillosExcelRows,
  buildReporteComedorExcelRows,
} from "./exportReporteComedorExcel.ts";
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

describe("buildPlaneacionPlatillosExcelRows", () => {
  function filaPlan(over: Partial<ComedorRhProximoRegistroRow> = {}): ComedorRhProximoRegistroRow {
    return {
      id: 1,
      empleado_id: 1,
      empleado_nombre: "Ana",
      no_empleado: "406",
      area: "Producción",
      comedor_nombre: "Central",
      fecha_servicio: "2026-08-12",
      tipo_comida: "casera",
      estado_acceso: "PENDIENTE",
      tu_codigo: "G9",
      ho_codigo: "001",
      hora_inicio_comida: "10:00:00",
      hora_fin_comida: "10:30:00",
      ...over,
    };
  }

  it("desglosa por comedor, dia y horario con las dos opciones", () => {
    const filas = buildPlaneacionPlatillosExcelRows([
      filaPlan(),
      filaPlan({ tipo_comida: "saludable" }),
      filaPlan({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" }),
    ]);

    expect(filas[0]).toMatchObject({
      Comedor: "Central",
      "Horario de comida": "10:00 – 10:30",
      "Opción A": 1,
      "Opción B": 1,
      "Total platillos": 2,
    });
    expect(filas[1]).toMatchObject({ "Horario de comida": "18:00 – 18:30", "Total platillos": 1 });
  });

  it("cierra con un renglon de totales", () => {
    const filas = buildPlaneacionPlatillosExcelRows([filaPlan(), filaPlan({ tipo_comida: "saludable" })]);
    expect(filas[filas.length - 1]).toMatchObject({
      Comedor: "TOTAL",
      "Opción A": 1,
      "Opción B": 1,
      "Total platillos": 2,
    });
  });

  it("no inventa un renglon de totales cuando no hay datos", () => {
    expect(buildPlaneacionPlatillosExcelRows([])).toEqual([]);
  });

  it("el detalle expone el turno y el horario resueltos", () => {
    const [fila] = buildReporteComedorExcelRows([filaPlan()]);
    expect(fila).toMatchObject({ Turno: "G9", "Horario de comida": "10:00 – 10:30" });
  });

  it("marca «Sin horario» el dia sin ventana en vez de dejarlo vacio", () => {
    const [fila] = buildReporteComedorExcelRows([
      filaPlan({ hora_inicio_comida: null, hora_fin_comida: null }),
    ]);
    expect(fila["Horario de comida"]).toBe("Sin horario");
  });
});

describe("cuando el backend manda tipos que no son texto", () => {
  it("no revienta con no_empleado numerico", () => {
    // El backend declara `no_empleado: int`, asi que el JSON trae un numero. El
    // exportador hacia `row.no_empleado.trim()` y lanzaba TypeError: el boton de
    // exportar no descargaba nada y no decia por que.
    const fila = {
      id: 1,
      empleado_id: 1,
      empleado_nombre: "ARBALLO ORDOÑEZ, KARLA VANESSA",
      no_empleado: 4972 as unknown as string,
      area: "",
      comedor_nombre: "Central",
      fecha_servicio: "2026-08-12",
      tipo_comida: "casera",
      estado_acceso: "PENDIENTE",
      hora_inicio_comida: "10:00:00",
      hora_fin_comida: "10:30:00",
    } as ComedorRhProximoRegistroRow;

    const [salida] = buildReporteComedorExcelRows([fila]);

    expect(salida["No. empleado"]).toBe("4972");
    expect(salida["Área"]).toBe("—");
  });

  it("tolera nulos en los textos del empleado", () => {
    const fila = {
      id: 2,
      empleado_id: 2,
      empleado_nombre: null,
      no_empleado: null,
      area: null,
      comedor_nombre: null,
      fecha_servicio: "2026-08-12",
      tipo_comida: "casera",
      estado_acceso: "PENDIENTE",
    } as unknown as ComedorRhProximoRegistroRow;

    const [salida] = buildReporteComedorExcelRows([fila]);

    expect(salida.Empleado).toBe("—");
    expect(salida.Comedor).toBe("—");
  });
});
