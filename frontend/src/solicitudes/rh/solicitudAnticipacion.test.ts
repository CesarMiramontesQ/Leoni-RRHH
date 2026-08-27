import { describe, expect, it } from "vitest";
import {
  MENSAJE_ANTICIPACION_MINIMA,
  fechaMinimaSolicitudIso,
  fechaInicioCumpleAnticipacion,
  tipoRequiereAnticipacionMinima,
} from "./rhNewRequestDays.ts";

describe("anticipación mínima de vacaciones y home office", () => {
  it("la fecha mínima es mañana respecto a hoy", () => {
    expect(fechaMinimaSolicitudIso("2026-05-04")).toBe("2026-05-05");
    expect(fechaMinimaSolicitudIso("2026-12-31")).toBe("2027-01-01");
  });

  it("solo vacaciones y home office llevan anticipación", () => {
    expect(tipoRequiereAnticipacionMinima("vacaciones")).toBe(true);
    expect(tipoRequiereAnticipacionMinima("home_office")).toBe(true);
    expect(tipoRequiereAnticipacionMinima("permiso_sin_goce_sueldo")).toBe(false);
    expect(tipoRequiereAnticipacionMinima("matrimonio")).toBe(false);
  });

  it("rechaza hoy y pasado, acepta mañana; sin fecha mínima no valida", () => {
    expect(fechaInicioCumpleAnticipacion("2026-05-04", "2026-05-05")).toBe(false);
    expect(fechaInicioCumpleAnticipacion("2026-05-01", "2026-05-05")).toBe(false);
    expect(fechaInicioCumpleAnticipacion("2026-05-05", "2026-05-05")).toBe(true);
    expect(fechaInicioCumpleAnticipacion("2026-05-04", null)).toBe(true);
  });

  it("el mensaje menciona anticipación", () => {
    expect(MENSAJE_ANTICIPACION_MINIMA.toLowerCase()).toContain("anticipación");
  });
});
