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

  it("devuelve null para rutas que no son de ningún módulo", () => {
    expect(resolveModuleFromHash("#/no-existe")).toBeNull();
  });
});
