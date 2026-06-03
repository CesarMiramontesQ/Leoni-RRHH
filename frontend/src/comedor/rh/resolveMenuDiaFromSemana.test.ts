import { describe, expect, it } from "vitest";
import { resolveMenuDiaFromSemanaApi } from "./resolveMenuDiaFromSemana.ts";

describe("resolveMenuDiaFromSemanaApi", () => {
  it("resuelve opciones A/B y complementos para un día laboral", () => {
    const menu = resolveMenuDiaFromSemanaApi(
      [
        {
          id: 1,
          comedor_id: 1,
          semana: "2026-06-01",
          dia: "martes",
          tipo: "normal",
          descripcion: "Milanesa de res",
          foto_path: null,
          created_by: 1,
          created_at: "2026-06-01T12:00:00Z",
          detalle: {
            sopa_o_crema: ["Sopa del día"],
            guarniciones: ["Arroz", "Frijoles"],
            complementos: ["Ensalada"],
            postres: ["Flan"],
            salsas: ["Roja"],
          },
        },
        {
          id: 2,
          comedor_id: 1,
          semana: "2026-06-01",
          dia: "martes",
          tipo: "dieta",
          descripcion: "Pollo a la plancha",
          foto_path: null,
          created_by: 1,
          created_at: "2026-06-01T12:00:00Z",
        },
      ],
      "2026-06-02",
    );

    expect(menu).not.toBeNull();
    expect(menu?.menuNormal).toBe("Milanesa de res");
    expect(menu?.menuDieta).toBe("Pollo a la plancha");
    expect(menu?.detalle.sopa_o_crema).toEqual(["Sopa del día"]);
    expect(menu?.detalle.guarniciones).toEqual(["Arroz", "Frijoles"]);
    expect(menu?.detalle.complementos).toEqual(["Ensalada"]);
    expect(menu?.detalle.postres).toEqual(["Flan"]);
    expect(menu?.detalle.salsas).toEqual(["Roja"]);
  });

  it("retorna null si no hay menú para la fecha", () => {
    expect(resolveMenuDiaFromSemanaApi([], "2026-06-02")).toBeNull();
  });
});
