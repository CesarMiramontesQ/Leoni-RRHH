import { describe, expect, it } from "vitest";
import {
  buildRhDescansosEffectiveSummaryHtml,
  computeRhModalFormUi,
} from "./rhNewRequestModalUi.ts";
import {
  MENSAJE_HOME_OFFICE_FESTIVO,
  MENSAJE_VACACIONES_FESTIVO_EXTREMO,
} from "../../solicitudes/rh/rhNewRequestDays.ts";

const FESTIVOS = new Set(["2026-09-15"]);

function vacaciones(fi: string, ff: string, descansos = new Set<string>()) {
  return computeRhModalFormUi(
    "vacaciones", 10, "1", fi, ff, "", false, false, null, null, "ready", descansos, null, FESTIVOS,
  );
}

describe("modal de solicitud — festivos", () => {
  it("vacaciones 14–16 sep con el 15 festivo cuentan 2 días", () => {
    const ui = vacaciones("2026-09-14", "2026-09-16");
    expect(ui.diasLabel).toBe("2 días");
    expect(ui.canSubmit).toBe(true);
    expect(ui.resumenHint).toContain("quedarían 8 días");
  });

  it("festivo que coincide con descanso se excluye una sola vez", () => {
    const ui = vacaciones("2026-09-14", "2026-09-16", new Set(["2026-09-15"]));
    expect(ui.diasLabel).toBe("2 días");
  });

  it("vacaciones no pueden iniciar ni terminar en festivo", () => {
    const inicio = vacaciones("2026-09-15", "2026-09-16");
    expect(inicio.canSubmit).toBe(false);
    expect(inicio.fechaInInvalid).toBe(true);
    expect(inicio.resumenHint).toBe(MENSAJE_VACACIONES_FESTIVO_EXTREMO);
    const fin = vacaciones("2026-09-14", "2026-09-15");
    expect(fin.canSubmit).toBe(false);
    expect(fin.fechaFinInvalid).toBe(true);
  });

  it("home office en festivo se bloquea", () => {
    const ui = computeRhModalFormUi(
      "home_office", null, "1", "2026-09-15", "2026-09-15", "", false, false, true, true, "ready", new Set(), null, FESTIVOS,
    );
    expect(ui.canSubmit).toBe(false);
    expect(ui.resumenHint).toBe(MENSAJE_HOME_OFFICE_FESTIVO);
  });

  it("otros tipos ignoran los festivos", () => {
    const ui = computeRhModalFormUi(
      "permiso_sin_goce_sueldo", null, "1", "2026-09-15", "2026-09-16", "motivo", false, false, null, null, "ready", new Set(), null, FESTIVOS,
    );
    expect(ui.canSubmit).toBe(true);
    expect(ui.diasLabel).toBe("2 días");
  });

  it("el resumen separa descansos de festivos", () => {
    const html = buildRhDescansosEffectiveSummaryHtml(
      "vacaciones", "2026-09-13", "2026-09-16", new Set(["2026-09-13"]), FESTIVOS,
    );
    expect(html).toContain("Se excluirán por descanso: 2026-09-13.");
    expect(html).toContain("No se descontarán por festivo: 2026-09-15.");
  });
});
