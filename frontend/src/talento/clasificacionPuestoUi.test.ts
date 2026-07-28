import { describe, expect, it } from "vitest";
import {
  clasificacionPendienteBadge,
  estadoPerfilLabel,
  formatGlobalLevelRango,
  globalGradeBadge,
  globalLevelChips,
  globalLevelLabel,
  globalLevelsEntre,
  globalLevelsSonConsecutivos,
  GLOBAL_GRADE_TOOLTIP,
} from "./clasificacionPuestoUi.ts";

const P = (orden: number, codigo = `P${orden}`) => ({
  id: orden,
  nombre: `Grado ${orden}`,
  orden,
  codigo,
  career_path_codigo: "P",
});

const M = (orden: number) => ({
  id: 100 + orden,
  nombre: `Management ${orden}`,
  orden,
  codigo: `M${orden}`,
  career_path_codigo: "M",
});

describe("formatGlobalLevelRango", () => {
  it("devuelve un guion largo cuando no hay niveles", () => {
    expect(formatGlobalLevelRango([])).toBe("—");
  });

  it("muestra el codigo solo cuando hay un unico nivel", () => {
    expect(formatGlobalLevelRango([P(10)])).toBe("P10");
  });

  it("condensa el rango del menor al mayor", () => {
    expect(formatGlobalLevelRango([P(12), P(10), P(11)])).toBe("P10 → P12");
  });

  it("cae al nombre cuando el nivel no tiene codigo", () => {
    expect(
      formatGlobalLevelRango([{ id: 1, nombre: "Grado 1", orden: 1, codigo: null }]),
    ).toBe("Grado 1");
  });
});

describe("globalLevelLabel", () => {
  it("prefiere el codigo sobre el nombre", () => {
    expect(globalLevelLabel(P(10))).toBe("P10");
  });

  it("ignora un codigo en blanco", () => {
    expect(globalLevelLabel({ id: 1, nombre: "Grado 1", orden: 1, codigo: "   " })).toBe(
      "Grado 1",
    );
  });
});

describe("globalLevelsEntre", () => {
  const catalogo = [P(10), P(11), P(12), M(1)];

  it("devuelve el rango inclusivo ordenado", () => {
    expect(globalLevelsEntre(catalogo, 10, 12)).toEqual([10, 11, 12]);
  });

  it("acepta los extremos invertidos", () => {
    expect(globalLevelsEntre(catalogo, 12, 10)).toEqual([10, 11, 12]);
  });

  it("no cruza career paths: un rango solo vive dentro de uno", () => {
    expect(globalLevelsEntre(catalogo, 10, 101)).toEqual([]);
  });

  it("devuelve vacio si falta algun extremo", () => {
    expect(globalLevelsEntre(catalogo, null, 12)).toEqual([]);
    expect(globalLevelsEntre(catalogo, 10, 999)).toEqual([]);
  });
});

describe("globalLevelsSonConsecutivos", () => {
  const catalogo = [P(7), P(8), P(9), P(11)];

  it("acepta un rango consecutivo", () => {
    expect(globalLevelsSonConsecutivos(catalogo, [7, 8, 9])).toBe(true);
  });

  it("rechaza un hueco", () => {
    expect(globalLevelsSonConsecutivos(catalogo, [9, 11])).toBe(false);
  });

  it("rechaza la lista vacia", () => {
    expect(globalLevelsSonConsecutivos(catalogo, [])).toBe(false);
  });

  it("rechaza ids que no estan en el catalogo", () => {
    expect(globalLevelsSonConsecutivos(catalogo, [7, 999])).toBe(false);
  });
});

describe("globalGradeBadge", () => {
  it("lleva el tooltip que explica que es el global grade", () => {
    const html = globalGradeBadge("GG10");
    expect(html).toContain("GG10");
    expect(html).toContain(GLOBAL_GRADE_TOOLTIP);
  });

  it("no sugiere sueldo ni compensacion", () => {
    const html = globalGradeBadge("GG10", { nombre: "Global Grade 10" }).toLowerCase();
    for (const palabra of ["sueldo", "salari", "compensac", "banda", "tabulador"]) {
      expect(html).not.toContain(palabra);
    }
  });

  it("degrada a un estado vacio explicito", () => {
    expect(globalGradeBadge(null)).toContain("Sin global grade");
  });

  it("escapa el contenido dinamico", () => {
    expect(globalGradeBadge('<img src=x onerror="alert(1)">')).not.toContain("<img");
  });
});

describe("globalLevelChips", () => {
  it("pinta un chip por nivel con flechas entre ellos", () => {
    const html = globalLevelChips([P(10), P(11)]);
    expect(html).toContain("P10");
    expect(html).toContain("P11");
    expect(html).toContain("→");
  });

  it("devuelve cadena vacia sin niveles", () => {
    expect(globalLevelChips([])).toBe("");
  });
});

describe("estados y badges", () => {
  it("traduce los estados del perfil", () => {
    expect(estadoPerfilLabel("en_revision")).toBe("En revisión");
    expect(estadoPerfilLabel("activo")).toBe("Activo");
    expect(estadoPerfilLabel("desconocido")).toBe("—");
  });

  it("el badge de pendiente siempre lleva texto, no solo color", () => {
    expect(clasificacionPendienteBadge()).toContain("Clasificación pendiente");
  });
});
