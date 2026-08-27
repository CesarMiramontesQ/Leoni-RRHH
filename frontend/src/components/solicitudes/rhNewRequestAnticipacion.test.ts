import { describe, expect, it } from "vitest";
import { MENSAJE_ANTICIPACION_MINIMA } from "../../solicitudes/rh/rhNewRequestDays.ts";
import { computeRhModalFormUi } from "./rhNewRequestModalUi.ts";

const ui = (fechaInicio: string, fechaMinimaIso: string | null) =>
  computeRhModalFormUi(
    "vacaciones",
    10,
    "1",
    fechaInicio,
    fechaInicio,
    "",
    false,
    false,
    false,
    null,
    "ready",
    new Set(),
    fechaMinimaIso,
  );

describe("computeRhModalFormUi — anticipación mínima", () => {
  it("bloquea envío y marca la fecha si inicia antes de la mínima", () => {
    const r = ui("2026-05-04", "2026-05-05");
    expect(r.canSubmit).toBe(false);
    expect(r.fechaInInvalid).toBe(true);
    expect(r.resumenState).toBe("error");
    expect(r.resumenHint).toBe(MENSAJE_ANTICIPACION_MINIMA);
  });

  it("permite envío desde la fecha mínima", () => {
    const r = ui("2026-05-05", "2026-05-05");
    expect(r.canSubmit).toBe(true);
    expect(r.fechaInInvalid).toBe(false);
  });

  it("sin fecha mínima (RH) no aplica", () => {
    expect(ui("2026-05-04", null).canSubmit).toBe(true);
  });
});
