import { describe, expect, it } from "vitest";
import { createEmptyMenuDiaDetalle } from "./menuDayDetalle.ts";
import { buildDayMenuPersistPlan, buildPublicarMenuPayloadsForDay } from "./loadMenuDelDia.ts";
import type { ComedorWeekPlannerDayKey } from "./types.ts";
import { WEEK_PLANNER_DAY_KEYS } from "./weekPlannerDays.ts";

describe("buildPublicarMenuPayloadsForDay", () => {
  it("genera payloads distintos por cada día de la semana", () => {
    const payloads = WEEK_PLANNER_DAY_KEYS.flatMap((key) =>
      buildPublicarMenuPayloadsForDay({
        key,
        menuNormal: `Plato A ${key}`,
        menuDieta: key === "sabado" || key === "domingo" ? "" : `Plato B ${key}`,
        detalle: createEmptyMenuDiaDetalle(),
      }),
    );

    const byDay = new Map<ComedorWeekPlannerDayKey, string>();
    for (const entry of payloads) {
      if (entry.tipo === "normal") byDay.set(entry.dia as ComedorWeekPlannerDayKey, entry.descripcion);
    }

    expect(byDay.get("lunes")).toBe("Plato A lunes");
    expect(byDay.get("martes")).toBe("Plato A martes");
    expect(byDay.get("domingo")).toBe("Plato A domingo");
    expect(payloads).toHaveLength(12);
  });
});

describe("buildDayMenuPersistPlan", () => {
  const detalle = { ...createEmptyMenuDiaDetalle(), guarniciones: ["ARROZ ROJO"] };

  it("publica los dos tipos cuando el día está completo", () => {
    const plan = buildDayMenuPersistPlan({
      key: "lunes",
      menuNormal: "Mole",
      menuDieta: "Flautas",
      detalle,
    });
    expect(plan.publicar.map((entry) => entry.tipo)).toEqual(["normal", "dieta"]);
    expect(plan.borrar).toEqual([]);
  });

  it("borra el tipo que quedó vacío en vez de omitirlo", () => {
    // Antes se omitía y la fila anterior sobrevivía en la BD: el empleado seguía viendo
    // el menú viejo. Ese es justo el bug que hacía obligatorio borrar la semana.
    const plan = buildDayMenuPersistPlan({
      key: "jueves",
      menuNormal: "Fajitas",
      menuDieta: "   ",
      detalle,
    });
    expect(plan.publicar.map((entry) => entry.tipo)).toEqual(["normal"]);
    expect(plan.borrar).toEqual(["dieta"]);
  });

  it("vacía el día entero cuando no queda texto", () => {
    const plan = buildDayMenuPersistPlan({
      key: "domingo",
      menuNormal: "",
      menuDieta: "",
      detalle: createEmptyMenuDiaDetalle(),
    });
    expect(plan.publicar).toEqual([]);
    expect(plan.borrar).toEqual(["normal", "dieta"]);
  });

  it("el detalle viaja solo en la fila normal", () => {
    const plan = buildDayMenuPersistPlan({
      key: "martes",
      menuNormal: "Puerco",
      menuDieta: "Chilaquiles",
      detalle,
    });
    const normal = plan.publicar.find((entry) => entry.tipo === "normal");
    const dieta = plan.publicar.find((entry) => entry.tipo === "dieta");
    expect(normal?.detalle?.guarniciones).toEqual(["ARROZ ROJO"]);
    expect(dieta?.detalle).toBeUndefined();
  });
});

