import { describe, expect, it } from "vitest";
import { createEmptyMenuDiaDetalle } from "./menuDayDetalle.ts";
import { buildPublicarMenuPayloadsForDay } from "./loadMenuDelDia.ts";
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
