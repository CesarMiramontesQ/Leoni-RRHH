import { describe, expect, it } from "vitest";
import { computeRhModalFormUi } from "./rhNewRequestModalUi.ts";

function vacaciones(fi: string, ff: string) {
  return computeRhModalFormUi(
    "vacaciones", 30, "1", fi, ff, "", false, false, null, null, "ready", new Set(), null, new Set(),
  );
}

describe("modal de solicitud — una solicitud por semana (lun–dom)", () => {
  it("vacaciones dentro de la misma semana pasan", () => {
    const ui = vacaciones("2026-09-14", "2026-09-18");
    expect(ui.canSubmit).toBe(true);
  });

  it("vacaciones que cruzan de semana se bloquean con el corte sugerido", () => {
    const ui = vacaciones("2026-09-16", "2026-09-22");
    expect(ui.canSubmit).toBe(false);
    expect(ui.resumenState).toBe("error");
    expect(ui.resumenHint).toContain("por semana");
    expect(ui.resumenHint).toContain("del 16/09/2026 al 20/09/2026");
    expect(ui.resumenHint).toContain("del 21/09/2026 al 22/09/2026");
  });

  it("permiso sin goce que cruza de semana se bloquea", () => {
    const ui = computeRhModalFormUi(
      "permiso_sin_goce_sueldo", null, "1", "2026-09-16", "2026-09-22", "motivo",
      false, false, null, null, "ready", new Set(), null, new Set(),
    );
    expect(ui.canSubmit).toBe(false);
    expect(ui.resumenHint).toContain("por semana");
  });
});
