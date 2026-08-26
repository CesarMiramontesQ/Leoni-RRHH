import { describe, expect, it } from "vitest";
import { FALTA_RETARDO_TIPOS, FALTA_RETARDO_TIPO_COLORS, colorFaltaRetardoTipo } from "./constants.ts";

describe("FALTA_RETARDO_TIPO_COLORS", () => {
  it("cubre todos los tipos con un hex válido", () => {
    for (const tipo of FALTA_RETARDO_TIPOS) {
      expect(colorFaltaRetardoTipo(tipo)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("no repite color entre tipos (la gráfica de tendencia los superpone)", () => {
    const colores = FALTA_RETARDO_TIPOS.map((t) => FALTA_RETARDO_TIPO_COLORS[t].toLowerCase());
    expect(new Set(colores).size).toBe(FALTA_RETARDO_TIPOS.length);
  });
});
