import { describe, expect, it } from "vitest";
import {
  FALTA_RETARDO_TIPOS,
  FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO,
  FALTA_RETARDO_TIPOS_GOCE,
} from "./constants.ts";

describe("FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO", () => {
  it("deja fuera vacaciones y los permisos con goce", () => {
    expect([...FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO]).toEqual([
      "falta_justificada",
      "falta_injustificada",
      "retardo",
      "incapacidad",
      "suspension",
    ]);
  });

  it("se deriva del catálogo, para que un tipo nuevo no quede huérfano", () => {
    const excluidos = FALTA_RETARDO_TIPOS.filter(
      (t) => !FALTA_RETARDO_TIPOS_DASHBOARD_EQUIPO.includes(t),
    );
    expect(excluidos.every((t) => t === "vacaciones" || FALTA_RETARDO_TIPOS_GOCE.has(t))).toBe(
      true,
    );
  });
});
