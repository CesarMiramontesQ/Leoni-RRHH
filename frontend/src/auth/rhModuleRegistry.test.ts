import { describe, expect, it } from "vitest";

import { resolveModuleFromHash } from "./rhModuleRegistry.ts";

describe("resolveModuleFromHash", () => {
  it("resuelve el módulo de una ruta simple", () => {
    expect(resolveModuleFromHash("#/operaciones")).toBe("operaciones");
    expect(resolveModuleFromHash("#/talento/dashboard")).toBe("dashboard-talento");
    expect(resolveModuleFromHash("#/pdi-gestion")).toBe("pdi-gestion");
    expect(resolveModuleFromHash("#/")).toBe("dashboard");
  });

  /**
   * Sin esto, un deep-link (`#/operaciones?area_id=3`, los enlaces cruzados del
   * Dashboard de Talento, `#/faltas-retardos?tipo=...` desde las gráficas)
   * resolvía a `null` y `modulosMayAccessHash` lo dejaba pasar como "ruta sin
   * módulo": el query string saltaba la compuerta de permisos RH.
   */
  it("ignora el query string del deep-link", () => {
    expect(resolveModuleFromHash("#/operaciones?area_id=3")).toBe("operaciones");
    expect(resolveModuleFromHash("#/pdi-gestion?area_id=3")).toBe("pdi-gestion");
    expect(resolveModuleFromHash("#/faltas-retardos?tipo=retardo")).toBe("faltas-retardos");
  });

  it("la Matriz de multihabilidades resuelve al módulo con el que se fusionó", () => {
    // `#/capacidades` sigue siendo una pantalla propia; lo que dejó de existir
    // es su clave de permiso (misma API y misma tabla que Competencias).
    expect(resolveModuleFromHash("#/capacidades")).toBe("competencias");
    expect(resolveModuleFromHash("#/competencias")).toBe("competencias");
  });

  it("devuelve null para rutas que no son de ningún módulo", () => {
    expect(resolveModuleFromHash("#/no-existe")).toBeNull();
  });

  /**
   * `#/level-up/resumen` era una pantalla propia (una maqueta con KPIs
   * inventados) y dejó de existir: ahora cae en el hub. El módulo tiene que
   * seguir resolviendo, o un marcador guardado se saltaría la compuerta de
   * permisos por ser "ruta sin módulo".
   */
  it("un marcador de la pantalla retirada sigue resolviendo a su módulo", () => {
    expect(resolveModuleFromHash("#/level-up/resumen")).toBe("level-up");
    expect(resolveModuleFromHash("#/level-up")).toBe("level-up");
    // Y no se come la ruta de Evaluación 360°, que cuelga del mismo prefijo.
    expect(resolveModuleFromHash("#/level-up/evaluacion-360")).toBe("evaluacion-360");
  });
});
