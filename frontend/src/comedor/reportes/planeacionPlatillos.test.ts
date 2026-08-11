import { describe, expect, it } from "vitest";

import type { ComedorRhProximoRegistroRow } from "../rh/types.ts";
import {
  SIN_HORARIO_ID,
  agregarPlatillosPorHorario,
  filaCuentaComoPlatillo,
  filtrarPorHorario,
  horarioIdDeFila,
  opcionesHorario,
  totalesPlatillos,
} from "./planeacionPlatillos.ts";

let secuencia = 0;
function fila(over: Partial<ComedorRhProximoRegistroRow> = {}): ComedorRhProximoRegistroRow {
  secuencia += 1;
  return {
    id: secuencia,
    empleado_id: secuencia,
    empleado_nombre: "Empleado",
    no_empleado: String(secuencia),
    area: "Producción",
    comedor_nombre: "Central",
    fecha_servicio: "2026-08-12",
    tipo_comida: "casera",
    estado_acceso: "PENDIENTE",
    ho_codigo: "001",
    hora_inicio_comida: "10:00:00",
    hora_fin_comida: "10:30:00",
    ...over,
  };
}

describe("horarioIdDeFila", () => {
  it("arma el identificador con la ventana resuelta", () => {
    expect(horarioIdDeFila(fila())).toBe("10:00-10:30");
  });

  it("agrupa como «sin horario» lo que no tiene ventana", () => {
    // Es el día de descanso o la jornada que nadie configuró todavía.
    expect(horarioIdDeFila(fila({ hora_inicio_comida: null, hora_fin_comida: null }))).toBe(
      SIN_HORARIO_ID,
    );
    expect(horarioIdDeFila(fila({ hora_inicio_comida: undefined }))).toBe(SIN_HORARIO_ID);
  });

  it("conserva la ventana que cruza medianoche", () => {
    const f = fila({ hora_inicio_comida: "23:30:00", hora_fin_comida: "00:00:00" });
    expect(horarioIdDeFila(f)).toBe("23:30-00:00");
  });
});

describe("filaCuentaComoPlatillo", () => {
  it("cuenta lo que hay que servir", () => {
    expect(filaCuentaComoPlatillo(fila({ estado_acceso: "PENDIENTE" }))).toBe(true);
    expect(filaCuentaComoPlatillo(fila({ estado_acceso: "ACCEDIDO" }))).toBe(true);
  });

  it("no cuenta cancelados ni segundas entradas", () => {
    // Un cancelado no se cocina, y REPETIDO es otra entrada el mismo día, no otro plato.
    expect(filaCuentaComoPlatillo(fila({ estado_acceso: "EXPIRADO" }))).toBe(false);
    expect(filaCuentaComoPlatillo(fila({ estado_acceso: "REPETIDO" }))).toBe(false);
  });
});

describe("agregarPlatillosPorHorario", () => {
  it("separa Opción A de Opción B y suma el total", () => {
    const rows = [
      fila({ tipo_comida: "casera" }),
      fila({ tipo_comida: "casera" }),
      fila({ tipo_comida: "saludable" }),
    ];

    const [bucket] = agregarPlatillosPorHorario(rows);

    expect(bucket.opcionA).toBe(2);
    expect(bucket.opcionB).toBe(1);
    expect(bucket.total).toBe(3);
  });

  it("agrupa por comedor, día y horario", () => {
    const rows = [
      fila(),
      fila({ comedor_nombre: "Norte" }),
      fila({ fecha_servicio: "2026-08-13" }),
      fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" }),
    ];

    expect(agregarPlatillosPorHorario(rows)).toHaveLength(4);
  });

  it("excluye del conteo los cancelados y los repetidos", () => {
    const rows = [
      fila({ estado_acceso: "PENDIENTE" }),
      fila({ estado_acceso: "EXPIRADO" }),
      fila({ estado_acceso: "REPETIDO" }),
    ];

    const [bucket] = agregarPlatillosPorHorario(rows);

    expect(bucket.total).toBe(1);
  });

  it("conserva las comidas sin horario en su propio grupo", () => {
    // Si se descartaran, el total del plan no cuadraría con el detalle y nadie sabría por qué.
    const rows = [fila(), fila({ hora_inicio_comida: null, hora_fin_comida: null })];

    const buckets = agregarPlatillosPorHorario(rows);

    expect(buckets).toHaveLength(2);
    expect(buckets.map((b) => b.horarioId)).toContain(SIN_HORARIO_ID);
    expect(totalesPlatillos(buckets).total).toBe(2);
  });

  it("ordena por comedor, fecha y hora, y deja «sin horario» al final del día", () => {
    const rows = [
      fila({ hora_inicio_comida: null, hora_fin_comida: null }),
      fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" }),
      fila({ hora_inicio_comida: "02:00:00", hora_fin_comida: "02:30:00" }),
      fila({ comedor_nombre: "Norte", hora_inicio_comida: "10:00:00", hora_fin_comida: "10:30:00" }),
    ];

    const buckets = agregarPlatillosPorHorario(rows);

    expect(buckets.map((b) => `${b.comedor} ${b.horarioId}`)).toEqual([
      "Central 02:00-02:30",
      "Central 18:00-18:30",
      `Central ${SIN_HORARIO_ID}`,
      "Norte 10:00-10:30",
    ]);
  });

  it("con datos vacíos devuelve una lista vacía, no falla", () => {
    expect(agregarPlatillosPorHorario([])).toEqual([]);
    expect(totalesPlatillos([])).toEqual({ opcionA: 0, opcionB: 0, total: 0 });
  });
});

describe("opcionesHorario", () => {
  it("lista los horarios presentes, ordenados y sin repetir", () => {
    const rows = [
      fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" }),
      fila({ hora_inicio_comida: "02:00:00", hora_fin_comida: "02:30:00" }),
      fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" }),
    ];

    expect(opcionesHorario(rows).map((o) => o.id)).toEqual(["02:00-02:30", "18:00-18:30"]);
  });

  it("pone «sin horario» al final y solo si existe", () => {
    expect(opcionesHorario([fila()]).map((o) => o.id)).toEqual(["10:00-10:30"]);

    const conSin = opcionesHorario([fila(), fila({ hora_inicio_comida: null })]);
    expect(conSin[conSin.length - 1].id).toBe(SIN_HORARIO_ID);
  });
});

describe("filtrarPorHorario", () => {
  it("«todos» no filtra", () => {
    const rows = [fila(), fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" })];
    expect(filtrarPorHorario(rows, "todos")).toHaveLength(2);
  });

  it("deja solo el horario elegido", () => {
    const rows = [fila(), fila({ hora_inicio_comida: "18:00:00", hora_fin_comida: "18:30:00" })];
    expect(filtrarPorHorario(rows, "18:00-18:30")).toHaveLength(1);
  });

  it("permite aislar las comidas sin horario", () => {
    const rows = [fila(), fila({ hora_inicio_comida: null, hora_fin_comida: null })];
    expect(filtrarPorHorario(rows, SIN_HORARIO_ID)).toHaveLength(1);
  });
});
