import { describe, expect, it } from "vitest";

import type { CicloDesempenoBanda } from "../api/cicloDesempeno.ts";
import { celdaVisual, MAX_NOMBRES_CELDA, repartirNombres } from "./nueveBox.ts";

const BANDAS: CicloDesempenoBanda[] = ["bajo", "medio", "alto"];

describe("celdaVisual", () => {
  it("le pone nombre a las nueve posiciones, sin repetir", () => {
    const nombres = BANDAS.flatMap((bd) => BANDAS.map((bp) => celdaVisual(bd, bp).segmento));
    expect(nombres).toHaveLength(9);
    expect(new Set(nombres).size).toBe(9);
  });

  it("las dos esquinas que importan son las que destacan", () => {
    expect(celdaVisual("alto", "alto").tono).toBe("estrella");
    expect(celdaVisual("alto", "alto").segmento).toBe("Estrella");
    expect(celdaVisual("bajo", "bajo").tono).toBe("riesgo");
    expect(celdaVisual("bajo", "bajo").segmento).toBe("Riesgo");
  });

  it("el color es divergente: el tono depende de la suma de los dos ejes", () => {
    // La antidiagonal (suma 2) es el punto neutro de la escala, y las tres
    // celdas comparten tono aunque describan situaciones distintas.
    expect(celdaVisual("alto", "bajo").tono).toBe("neutro");
    expect(celdaVisual("medio", "medio").tono).toBe("neutro");
    expect(celdaVisual("bajo", "alto").tono).toBe("neutro");
    // Y es simétrico respecto de esa diagonal.
    expect(celdaVisual("alto", "medio").tono).toBe(celdaVisual("medio", "alto").tono);
    expect(celdaVisual("bajo", "medio").tono).toBe(celdaVisual("medio", "bajo").tono);
  });

  it("no inventa colores: usa los tokens de estado del sistema", () => {
    const clases = BANDAS.flatMap((bd) => BANDAS.map((bp) => celdaVisual(bd, bp).clases)).join(" ");
    expect(clases).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(celdaVisual("bajo", "bajo").clases).toContain("bg-danger-bg");
    expect(celdaVisual("alto", "alto").clases).toContain("bg-success-bg");
  });

  it("cada celda explica qué significa, para no depender del color", () => {
    for (const bd of BANDAS) {
      for (const bp of BANDAS) {
        expect(celdaVisual(bd, bp).descripcion.length).toBeGreaterThan(10);
      }
    }
  });
});

describe("repartirNombres", () => {
  it("muestra todos cuando caben", () => {
    const nombres = ["a", "b", "c", "d"];
    expect(repartirNombres(nombres)).toEqual({ visibles: nombres, restantes: 0 });
  });

  it("resume el excedente sin perder a nadie de la cuenta", () => {
    const nombres = Array.from({ length: 12 }, (_, i) => `emp${i}`);
    const { visibles, restantes } = repartirNombres(nombres);
    // Un hueco se reserva para el "+N", así el bloque no cambia de alto.
    expect(visibles).toHaveLength(MAX_NOMBRES_CELDA - 1);
    expect(visibles.length + restantes).toBe(nombres.length);
  });

  it("lista vacía no rompe", () => {
    expect(repartirNombres([])).toEqual({ visibles: [], restantes: 0 });
  });
});
