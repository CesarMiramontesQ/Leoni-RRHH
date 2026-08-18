import { describe, expect, it } from "vitest";
import {
  MENSAJE_FECHA_EN_DESCANSO,
  errorFechaEnDescanso,
  mesesCargadosParaCalendario,
} from "./descansosComedorFecha.ts";

describe("errorFechaEnDescanso", () => {
  it("rechaza una fecha que cae en descanso del beneficiario", () => {
    const error = errorFechaEnDescanso("2026-07-14", new Set(["2026-07-14"]));
    expect(error).toBe(MENSAJE_FECHA_EN_DESCANSO);
  });

  it("acepta una fecha que no está en la lista de descansos", () => {
    expect(errorFechaEnDescanso("2026-07-15", new Set(["2026-07-14"]))).toBeNull();
  });

  it("no rechaza cuando aún no hay descansos cargados", () => {
    expect(errorFechaEnDescanso("2026-07-14", new Set())).toBeNull();
  });

  it("ignora una fecha vacía y deja el error a la validación de requerido", () => {
    expect(errorFechaEnDescanso("", new Set(["2026-07-14"]))).toBeNull();
  });
});

describe("mesesCargadosParaCalendario", () => {
  it("exige los meses cargados mientras la consulta está en curso", () => {
    const meses = mesesCargadosParaCalendario("loading", new Set(["2026-07"]));
    expect(meses).toEqual(new Set(["2026-07"]));
  });

  it("exige los meses cargados cuando la consulta terminó bien", () => {
    const meses = mesesCargadosParaCalendario("ready", new Set(["2026-07", "2026-08"]));
    expect(meses).toEqual(new Set(["2026-07", "2026-08"]));
  });

  it("degrada a calendario abierto si la consulta falló", () => {
    expect(mesesCargadosParaCalendario("error", new Set(["2026-07"]))).toBeNull();
  });

  it("degrada a calendario abierto sin beneficiario seleccionado", () => {
    expect(mesesCargadosParaCalendario("idle", new Set())).toBeNull();
  });
});
