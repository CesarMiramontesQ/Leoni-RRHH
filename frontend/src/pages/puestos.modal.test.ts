/**
 * Regiones del modal de perfil que cuelgan de otro campo.
 *
 * Se renderizan por separado para poder reemplazarlas solas: repintar el modal
 * entero cerraba el select recién usado y hacía parpadear el formulario. Aquí se
 * cubre lo que cada región debe decir, que es lo que el usuario ve.
 */
import { describe, expect, it } from "vitest";

import {
  nivelesDeCareerPath,
  renderCareerLevelCampo,
  renderDisciplinaCampo,
  renderGlobalGradeTramo,
} from "./puestos.ts";
import type { ModalValues } from "../dashboard/puestos/types.ts";

const VALORES: ModalValues = {
  codigo: "",
  nombre_puesto: "",
  area: "",
  grado_id: "",
  career_path_id: "",
  funcion_id: "",
  disciplina_id: "",
  estado: "activo",
};

const nivel = (over: Record<string, unknown> = {}) =>
  ({
    id: 1,
    career_path_id: 1,
    career_path_codigo: "P",
    career_path_nombre: "Professional",
    codigo: "P4",
    nombre: "Specialist",
    global_grades: [
      { id: 1, codigo: "GG12", orden: 12 },
      { id: 2, codigo: "GG13", orden: 13 },
    ],
    posicion_desde: 12,
    posicion_hasta: 13,
    activo: true,
    reactivado: false,
    created_at: "",
    updated_at: "",
    ...over,
  }) as never;

describe("nivelesDeCareerPath", () => {
  it("solo ofrece los del career path elegido", () => {
    const catalogo = [nivel(), nivel({ id: 2, career_path_id: 2, codigo: "M1" })];
    expect(nivelesDeCareerPath(catalogo, "1").map((g) => g.codigo)).toEqual(["P4"]);
  });

  it("descarta los que no tienen tramo: sin él no se pueden ubicar", () => {
    const catalogo = [nivel(), nivel({ id: 3, codigo: "P1", global_grades: [] })];
    expect(nivelesDeCareerPath(catalogo, "1").map((g) => g.codigo)).toEqual(["P4"]);
  });

  it("sin career path elegido no ofrece ninguno", () => {
    expect(nivelesDeCareerPath([nivel()], "")).toEqual([]);
  });
});

describe("renderDisciplinaCampo", () => {
  const catalogos = {
    careerPaths: [],
    funciones: [],
    disciplinas: [{ id: 5, funcion_id: 9, nombre: "Automatización" }],
    globalGrades: [],
  } as never;

  it("una función sin disciplinas lo dice, en vez de quedarse muda", () => {
    // Es el caso real: 9 de 11 funciones no tienen ninguna capturada.
    const html = renderDisciplinaCampo({ ...VALORES, funcion_id: "7" }, catalogos);
    expect(html).toContain("Esta función no tiene disciplinas");
    expect(html).toContain("#/puestos/ajustes");
    expect(html).toContain("disabled");
  });

  it("ofrece las de la función elegida", () => {
    const html = renderDisciplinaCampo({ ...VALORES, funcion_id: "9" }, catalogos);
    expect(html).toContain("Automatización");
    expect(html).not.toContain("no tiene disciplinas");
  });

  it("sin función pide elegirla primero", () => {
    expect(renderDisciplinaCampo(VALORES, catalogos)).toContain("Elige una función");
  });
});

describe("renderCareerLevelCampo", () => {
  it("sin career path no deja elegir nivel", () => {
    const html = renderCareerLevelCampo(VALORES, [nivel()]);
    expect(html).toContain("Elige un career path");
    expect(html).toContain("disabled");
  });

  it("avisa cuando ningún nivel del path tiene equivalencia", () => {
    const html = renderCareerLevelCampo(
      { ...VALORES, career_path_id: "1" },
      [nivel({ global_grades: [] })],
    );
    expect(html).toContain("no tiene niveles con equivalencia");
    expect(html).toContain("#/puestos/ajustes");
  });

  it("deja claro que el puesto lleva un solo nivel", () => {
    const html = renderCareerLevelCampo({ ...VALORES, career_path_id: "1" }, [nivel()]);
    expect(html).toContain("un solo career level");
  });
});

describe("renderGlobalGradeTramo", () => {
  it("muestra el tramo del nivel elegido", () => {
    const html = renderGlobalGradeTramo(
      { ...VALORES, career_path_id: "1", grado_id: "1" },
      [nivel()],
    );
    expect(html).toContain("GG12 – GG13");
  });

  it("sin nivel elegido no inventa un valor", () => {
    expect(renderGlobalGradeTramo({ ...VALORES, career_path_id: "1" }, [nivel()])).toContain(
      "—",
    );
  });

  it("dice que el global grade va por persona, no por puesto", () => {
    const html = renderGlobalGradeTramo(
      { ...VALORES, career_path_id: "1", grado_id: "1" },
      [nivel()],
    );
    expect(html).toContain("cada persona");
  });
});
