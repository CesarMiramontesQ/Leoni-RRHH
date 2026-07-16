import { describe, expect, it } from "vitest";
import { debeBloquearFinSemanaEnPicker } from "./nuevaFaltaRetardoModal.ts";

describe("nuevaFaltaRetardoModal — política de fines de semana", () => {
  it.each(["matrimonio", "defuncion", "paternidad"] as const)(
    "no bloquea fines de semana para %s aunque el empleado sea administrativo",
    (tipo) => {
      expect(debeBloquearFinSemanaEnPicker(tipo, true)).toBe(false);
    },
  );

  it.each(["suspension", "incapacidad_interna"] as const)(
    "mantiene el bloqueo administrativo para %s",
    (tipo) => {
      expect(debeBloquearFinSemanaEnPicker(tipo, true)).toBe(true);
      expect(debeBloquearFinSemanaEnPicker(tipo, false)).toBe(false);
    },
  );
});
