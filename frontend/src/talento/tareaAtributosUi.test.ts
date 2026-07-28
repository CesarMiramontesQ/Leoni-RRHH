import { describe, expect, it } from "vitest";
import {
  categoriaTareaBadge,
  dedicacionBadge,
  dedicacionResumen,
  frecuenciaBadge,
  frecuenciaLabel,
  prioridadBadge,
  prioridadLabel,
} from "./tareaAtributosUi.ts";

describe("etiquetas", () => {
  it("traduce prioridad y frecuencia", () => {
    expect(prioridadLabel("alta")).toBe("Alta");
    expect(frecuenciaLabel("trimestral")).toBe("Trimestral");
  });

  it("devuelve cadena vacia para valores desconocidos o nulos", () => {
    expect(prioridadLabel("urgentisima")).toBe("");
    expect(frecuenciaLabel(null)).toBe("");
    expect(prioridadBadge(undefined)).toBe("");
    expect(frecuenciaBadge("")).toBe("");
  });
});

describe("badges", () => {
  it("el badge de prioridad lleva texto, no solo color", () => {
    expect(prioridadBadge("alta")).toContain("Alta");
    expect(prioridadBadge("baja")).toContain("Baja");
  });

  it("el % se muestra con su signo", () => {
    expect(dedicacionBadge(25)).toContain("25%");
  });

  it("0% es un dato valido y se pinta", () => {
    expect(dedicacionBadge(0)).toContain("0%");
  });

  it("sin porcentaje no se pinta nada", () => {
    expect(dedicacionBadge(null)).toBe("");
    expect(dedicacionBadge(undefined)).toBe("");
  });

  it("escapa el contenido dinamico de la categoria", () => {
    expect(categoriaTareaBadge('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });

  it("categoria vacia no genera badge", () => {
    expect(categoriaTareaBadge("   ")).toBe("");
  });
});

describe("dedicacionResumen", () => {
  it("celebra el 100% exacto", () => {
    const html = dedicacionResumen({ total: 100, sinPorcentaje: 0 });
    expect(html).toContain("100%");
    expect(html).toContain("emerald");
  });

  it("avisa en ambar cuando falta por repartir, e indica cuanto", () => {
    const html = dedicacionResumen({ total: 70, sinPorcentaje: 0 });
    expect(html).toContain("amber");
    expect(html).toContain("70%");
    expect(html).toContain("30%");
  });

  it("distingue pasarse del 100% con tono de error", () => {
    const html = dedicacionResumen({ total: 130, sinPorcentaje: 0 });
    expect(html).toContain("red");
    expect(html).toContain("130%");
  });

  it("menciona las tareas sin porcentaje para no leer el total como completo", () => {
    const html = dedicacionResumen({ total: 40, sinPorcentaje: 3 });
    expect(html).toContain("3 tareas sin porcentaje");
  });

  it("singulariza el aviso con una sola tarea pendiente", () => {
    expect(dedicacionResumen({ total: 40, sinPorcentaje: 1 })).toContain(
      "1 tarea sin porcentaje",
    );
  });

  it("nombra el alcance cuando se le pasa", () => {
    expect(dedicacionResumen({ total: 50, sinPorcentaje: 0, alcance: "P10" })).toContain(
      "en P10",
    );
  });

  it("es informativo: nunca habla de error ni de bloqueo", () => {
    const html = dedicacionResumen({ total: 55, sinPorcentaje: 0 }).toLowerCase();
    for (const palabra of ["error", "invalid", "no se puede", "obligatorio"]) {
      expect(html).not.toContain(palabra);
    }
  });
});
