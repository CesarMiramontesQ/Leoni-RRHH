import { describe, expect, it } from "vitest";

import { FALTA_RETARDO_TIPOS } from "../../faltasRetardos/rh/constants.ts";
import { tiposPresentesEnEmpleados } from "./rhFaltasRetardosCharts.ts";

describe("tiposPresentesEnEmpleados", () => {
  it("dibuja cualquier tipo del catálogo, no solo los disciplinables", () => {
    // Si el usuario filtra la página por vacaciones, el top viene de vacaciones y la
    // gráfica tiene que pintarlas; con una lista a mano se quedaba en blanco.
    const tipos = tiposPresentesEnEmpleados([
      { label: "Ana", total: 3, byTipo: { vacaciones: 3 } },
    ]);
    expect(tipos).toEqual(["vacaciones"]);
  });

  it("ningún tipo del catálogo se queda sin dibujar", () => {
    const rows = FALTA_RETARDO_TIPOS.map((tipo) => ({
      label: tipo,
      total: 1,
      byTipo: { [tipo]: 1 },
    }));
    expect(tiposPresentesEnEmpleados(rows).sort()).toEqual([...FALTA_RETARDO_TIPOS].sort());
  });

  it("respeta el orden del catálogo y omite los que no aparecen", () => {
    const tipos = tiposPresentesEnEmpleados([
      { label: "Ana", total: 2, byTipo: { retardo: 1, falta_justificada: 1 } },
    ]);
    expect(tipos).toEqual(["falta_justificada", "retardo"]);
  });

  it("un conteo en cero no cuenta como presente", () => {
    const tipos = tiposPresentesEnEmpleados([
      { label: "Ana", total: 1, byTipo: { retardo: 1, incapacidad: 0 } },
    ]);
    expect(tipos).toEqual(["retardo"]);
  });
});
