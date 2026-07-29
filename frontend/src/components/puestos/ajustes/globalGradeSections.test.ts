/**
 * La card de equivalencias agrupa por career level, no por par nivel↔grade.
 *
 * El backend guarda un renglón por par, pero RH piensa «M4 equivale a GG17 y
 * GG18». Sin agrupar, M4 aparecía dos veces y el formulario solo dejaba ligar
 * un grade por vez.
 */
import { describe, expect, it } from "vitest";

import {
  agruparEquivalenciasPorNivel,
  gradesElegidos,
} from "./globalGradeSections.ts";
import type { Equivalencia } from "../../../dashboard/clasificacionPuesto/types.ts";

function eq(over: Partial<Equivalencia>): Equivalencia {
  return {
    id: 0,
    career_level_id: 1,
    career_level_codigo: "M4",
    career_level_nombre: "M4",
    career_path_id: 1,
    career_path_codigo: "M",
    career_path_nombre: "Management",
    global_grade_id: 1,
    global_grade_codigo: "GG17",
    global_grade_nombre: "GG 17",
    activo: true,
    created_at: "",
    updated_at: "",
    ...over,
  } as Equivalencia;
}

describe("agruparEquivalenciasPorNivel", () => {
  it("junta en una fila los grades del mismo career level", () => {
    const filas = agruparEquivalenciasPorNivel(
      [
        eq({ id: 1, global_grade_id: 1, global_grade_codigo: "GG17" }),
        eq({ id: 2, global_grade_id: 2, global_grade_codigo: "GG18" }),
      ],
      [1, 2],
    );

    expect(filas).toHaveLength(1);
    expect(filas[0].career_level_codigo).toBe("M4");
    expect(filas[0].grades.map((g) => g.codigo)).toEqual(["GG17", "GG18"]);
  });

  it("la fila se identifica por el career level, no por el renglón", () => {
    // El id es el del nivel: editar o borrar actúa sobre todo su tramo.
    const filas = agruparEquivalenciasPorNivel(
      [eq({ id: 99, career_level_id: 7 })],
      [1],
    );
    expect(filas[0].id).toBe(7);
  });

  it("ordena los grades como el catálogo, no como se capturaron", () => {
    const filas = agruparEquivalenciasPorNivel(
      [
        eq({ id: 1, global_grade_id: 2, global_grade_codigo: "GG18" }),
        eq({ id: 2, global_grade_id: 1, global_grade_codigo: "GG17" }),
      ],
      [1, 2],
    );
    expect(filas[0].grades.map((g) => g.codigo)).toEqual(["GG17", "GG18"]);
  });

  it("conserva el id de cada renglón, que es lo que permite borrarlo", () => {
    const filas = agruparEquivalenciasPorNivel(
      [
        eq({ id: 11, global_grade_id: 1 }),
        eq({ id: 22, global_grade_id: 2 }),
      ],
      [1, 2],
    );
    expect(filas[0].filas).toEqual([
      { grade_id: 1, equivalencia_id: 11 },
      { grade_id: 2, equivalencia_id: 22 },
    ]);
  });

  it("separa los niveles distintos", () => {
    const filas = agruparEquivalenciasPorNivel(
      [
        eq({ id: 1, career_level_id: 1, career_level_codigo: "M4" }),
        eq({ id: 2, career_level_id: 2, career_level_codigo: "M5" }),
      ],
      [1],
    );
    expect(filas.map((f) => f.career_level_codigo)).toEqual(["M4", "M5"]);
  });
});

describe("gradesElegidos", () => {
  it("lee la lista que manda el multiselect", () => {
    expect(gradesElegidos({ global_grade_ids: "3,7" })).toEqual([3, 7]);
  });

  it("sin nada marcado devuelve vacío, para que la validación lo rechace", () => {
    expect(gradesElegidos({ global_grade_ids: "" })).toEqual([]);
    expect(gradesElegidos({})).toEqual([]);
  });
});
