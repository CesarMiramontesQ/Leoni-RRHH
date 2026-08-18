import { describe, expect, it } from "vitest";

import { formatEntradaCelda, formatHoraRetardo, formatMinutosRetardo } from "./horasRetardo.ts";

describe("formatHoraRetardo", () => {
  it("muestra la hora tal cual cuando cabe en el día", () => {
    expect(formatHoraRetardo("06:27")).toBe("06:27");
    expect(formatHoraRetardo("14:00")).toBe("14:00");
  });

  it("normaliza las horas >= 24 y marca que es del día siguiente", () => {
    // TRESS escribe "25:00" para la 01:00 del turno que entró a las 18:00.
    expect(formatHoraRetardo("25:00")).toBe("01:00 (+1 d)");
    expect(formatHoraRetardo("24:56")).toBe("00:56 (+1 d)");
  });

  it("sin dato muestra el guion largo", () => {
    expect(formatHoraRetardo(null)).toBe("—");
    expect(formatHoraRetardo("")).toBe("—");
    expect(formatHoraRetardo("   ")).toBe("—");
  });

  it("no inventa nada si el valor no es una hora", () => {
    expect(formatHoraRetardo("temprano")).toBe("—");
  });
});

describe("formatMinutosRetardo", () => {
  it("muestra los minutos con su unidad", () => {
    expect(formatMinutosRetardo(27)).toBe("27 min");
    expect(formatMinutosRetardo(0)).toBe("0 min");
  });

  it("pasa a horas y minutos cuando se va de una hora", () => {
    expect(formatMinutosRetardo(90)).toBe("1 h 30 min");
    expect(formatMinutosRetardo(536)).toBe("8 h 56 min");
    expect(formatMinutosRetardo(120)).toBe("2 h");
  });

  it("sin dato muestra el guion largo", () => {
    expect(formatMinutosRetardo(null)).toBe("—");
    expect(formatMinutosRetardo(undefined)).toBe("—");
  });
});

describe("formatEntradaCelda", () => {
  it("junta la hora con los minutos de retardo", () => {
    expect(formatEntradaCelda({ hora_entrada: "06:27", minutos_retardo: 27 })).toBe(
      "06:27 (+27)",
    );
  });

  it("omite el paréntesis cuando no se pudo calcular el retardo", () => {
    // Checó antes de su hora: los minutos vienen en null a propósito.
    expect(formatEntradaCelda({ hora_entrada: "07:02", minutos_retardo: null })).toBe("07:02");
  });

  it("sin hora de entrada es un guion, aunque haya minutos", () => {
    expect(formatEntradaCelda({ hora_entrada: null, minutos_retardo: 27 })).toBe("—");
  });
});
