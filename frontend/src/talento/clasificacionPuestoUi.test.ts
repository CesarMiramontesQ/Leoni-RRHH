import { describe, expect, it } from "vitest";
import {
  clasificacionPendienteBadge,
  estadoPerfilLabel,
  formatCareerLevelRango,
  globalGradeBadge,
  careerLevelChips,
  careerLevelLabel,
  careerLevelsEntre,
  careerLevelsSonConsecutivos,
  GLOBAL_GRADE_TOOLTIP,
  compararCareerLevels,
  formatGlobalGrades,
  componerCodigoCareerLevel,
  numeroDeCareerLevel,
  siguienteNumeroCareerLevel,
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

describe("formatCareerLevelRango", () => {
  it("devuelve un guion largo cuando no hay niveles", () => {
    expect(formatCareerLevelRango([])).toBe("—");
  });

  it("muestra el codigo solo cuando hay un unico nivel", () => {
    expect(formatCareerLevelRango([P(10)])).toBe("P10");
  });

  it("condensa el rango del menor al mayor", () => {
    expect(formatCareerLevelRango([P(12), P(10), P(11)])).toBe("P10 → P12");
  });

  it("cae al nombre cuando el nivel no tiene codigo", () => {
    expect(
      formatCareerLevelRango([{ id: 1, nombre: "Grado 1", orden: 1, codigo: null }]),
    ).toBe("Grado 1");
  });
});

describe("careerLevelLabel", () => {
  it("prefiere el codigo sobre el nombre", () => {
    expect(careerLevelLabel(P(10))).toBe("P10");
  });

  it("ignora un codigo en blanco", () => {
    expect(careerLevelLabel({ id: 1, nombre: "Grado 1", orden: 1, codigo: "   " })).toBe(
      "Grado 1",
    );
  });
});

describe("careerLevelsEntre", () => {
  const catalogo = [P(10), P(11), P(12), M(1)];

  it("devuelve el rango inclusivo ordenado", () => {
    expect(careerLevelsEntre(catalogo, 10, 12)).toEqual([10, 11, 12]);
  });

  it("acepta los extremos invertidos", () => {
    expect(careerLevelsEntre(catalogo, 12, 10)).toEqual([10, 11, 12]);
  });

  it("no cruza career paths: un rango solo vive dentro de uno", () => {
    expect(careerLevelsEntre(catalogo, 10, 101)).toEqual([]);
  });

  it("devuelve vacio si falta algun extremo", () => {
    expect(careerLevelsEntre(catalogo, null, 12)).toEqual([]);
    expect(careerLevelsEntre(catalogo, 10, 999)).toEqual([]);
  });
});

describe("careerLevelsSonConsecutivos", () => {
  const catalogo = [P(7), P(8), P(9), P(11)];

  it("acepta un rango consecutivo", () => {
    expect(careerLevelsSonConsecutivos(catalogo, [7, 8, 9])).toBe(true);
  });

  it("rechaza un hueco", () => {
    expect(careerLevelsSonConsecutivos(catalogo, [9, 11])).toBe(false);
  });

  it("rechaza la lista vacia", () => {
    expect(careerLevelsSonConsecutivos(catalogo, [])).toBe(false);
  });

  it("rechaza ids que no estan en el catalogo", () => {
    expect(careerLevelsSonConsecutivos(catalogo, [7, 999])).toBe(false);
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

describe("careerLevelChips", () => {
  it("pinta un chip por nivel con flechas entre ellos", () => {
    const html = careerLevelChips([P(10), P(11)]);
    expect(html).toContain("P10");
    expect(html).toContain("P11");
    expect(html).toContain("→");
  });

  it("devuelve cadena vacia sin niveles", () => {
    expect(careerLevelChips([])).toBe("");
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

describe("código del career level", () => {
  it("compone el código con el prefijo del career path", () => {
    expect(componerCodigoCareerLevel("P", "10")).toBe("P10");
    expect(componerCodigoCareerLevel("M", "3")).toBe("M3");
  });

  it("rechaza lo que el backend rechazaría, para no gastar el viaje", () => {
    // Cero y ceros a la izquierda: 'P01' sería otra fila con el mismo significado.
    expect(componerCodigoCareerLevel("P", "0")).toBeNull();
    expect(componerCodigoCareerLevel("P", "01")).toBeNull();
    expect(componerCodigoCareerLevel("P", "")).toBeNull();
    expect(componerCodigoCareerLevel("P", "1.5")).toBeNull();
    expect(componerCodigoCareerLevel("", "10")).toBeNull();
  });

  it("no compone un código que no cabe en la columna", () => {
    expect(componerCodigoCareerLevel("PROFESSION", "1")).toBeNull();
  });

  it("extrae el número de un código existente para precargar el campo", () => {
    expect(numeroDeCareerLevel("P", "P10")).toBe(10);
    expect(numeroDeCareerLevel("P", "p10")).toBe(10);
  });

  it("devuelve null cuando el código es de otro career path", () => {
    expect(numeroDeCareerLevel("P", "M10")).toBeNull();
    expect(numeroDeCareerLevel("P", "Nivel 3")).toBeNull();
  });

  it("sugiere por encima del mayor, no por el conteo", () => {
    // Con un hueco (falta P2) reusar el 2 chocaría con un nivel desactivado.
    expect(siguienteNumeroCareerLevel("P", ["P1", "P3"])).toBe(4);
  });

  it("ignora los códigos de otro career path al sugerir", () => {
    expect(siguienteNumeroCareerLevel("M", ["P1", "P2", "P9"])).toBe(1);
  });

  it("empieza en 1 cuando el career path no tiene niveles", () => {
    expect(siguienteNumeroCareerLevel("P", [])).toBe(1);
  });
});

describe("tramo de global grades", () => {
  const m4 = {
    id: 1,
    nombre: "M4",
    codigo: "M4",
    career_path_codigo: "M",
    posicion_desde: 17,
    posicion_hasta: 18,
    global_grades: [
      { id: 1, codigo: "GG17", orden: 17 },
      { id: 2, codigo: "GG18", orden: 18 },
    ],
  };
  const m5 = {
    id: 2,
    nombre: "M5",
    codigo: "M5",
    career_path_codigo: "M",
    posicion_desde: 19,
    posicion_hasta: 19,
    global_grades: [{ id: 3, codigo: "GG19", orden: 19 }],
  };
  const m6 = {
    id: 3,
    nombre: "M6",
    codigo: "M6",
    career_path_codigo: "M",
    posicion_desde: 21,
    posicion_hasta: 21,
    global_grades: [{ id: 4, codigo: "GG21", orden: 21 }],
  };
  const sinGrades = {
    id: 4,
    nombre: "M7",
    codigo: "M7",
    career_path_codigo: "M",
    global_grades: [],
  };

  it("etiqueta el tramo con sus extremos", () => {
    expect(formatGlobalGrades(m4)).toBe("GG17 – GG18");
  });

  it("un solo grade no se muestra como rango", () => {
    expect(formatGlobalGrades(m5)).toBe("GG19");
  });

  it("sin equivalencias lo dice, no queda en blanco", () => {
    expect(formatGlobalGrades(sinGrades)).toBe("Sin equivalencia");
  });

  it("dos niveles pueden cubrir tres grades sin hueco", () => {
    // M4 abarca 17-18 y M5 el 19: la unión es contigua aunque sean dos niveles.
    expect(careerLevelsSonConsecutivos([m4, m5], [m4.id, m5.id])).toBe(true);
  });

  it("detecta el hueco entre dos tramos", () => {
    // M4 llega a 18 y M6 empieza en 21: faltan 19 y 20.
    expect(careerLevelsSonConsecutivos([m4, m6], [m4.id, m6.id])).toBe(false);
  });

  it("un nivel sin equivalencias invalida el rango", () => {
    expect(careerLevelsSonConsecutivos([m4, sinGrades], [m4.id, sinGrades.id])).toBe(
      false,
    );
  });

  it("el rango hasta un nivel incluye todo su tramo", () => {
    // De M5 a M4: el extremo superior es el 18, no el 17 donde M4 empieza.
    expect(careerLevelsEntre([m4, m5], m5.id, m4.id)).toEqual([m4.id, m5.id]);
  });

  it("ordena por el inicio del tramo, no por el final", () => {
    expect([m5, m4].sort(compararCareerLevels).map((n) => n.codigo)).toEqual([
      "M4",
      "M5",
    ]);
  });
});
