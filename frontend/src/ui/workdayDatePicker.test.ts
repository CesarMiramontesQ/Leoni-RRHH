import { describe, expect, it } from "vitest";
import {
  bindAbortableEvent,
  buildWorkdayDatePickerHtml,
  buildWorkdayDatePickerMonthHtml,
} from "./workdayDatePicker.ts";

describe("workdayDatePicker — descansos dinámicos", () => {
  it("renderiza un descanso deshabilitado y con etiqueta accesible", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
      blockedDates: new Set(["2026-07-14"]),
    });

    expect(html).toContain('data-wd-day="2026-07-14"');
    expect(html).toContain('title="Descanso"');
    expect(html).toContain('aria-label="2026-07-14 — Descanso"');
    expect(html).toContain("disabled");
    expect(html).toContain("bg-amber-100");
    expect(html).toContain("Días en ámbar = descanso del empleado");
  });

  it("no marca como descanso una fecha disponible", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
      blockedDates: new Set(),
    });

    const availableDay = html.match(/<button[\s\S]*?data-wd-day="2026-07-14"[\s\S]*?<\/button>/)?.[0];
    expect(availableDay).toBeDefined();
    expect(availableDay).not.toContain("Descanso");
    expect(availableDay).not.toContain("disabled");
  });

  it("bloquea días de meses adyacentes hasta confirmar que están cargados", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
      blockedDates: new Set(),
      loadedMonths: new Set(["2026-07"]),
    });

    const adjacentDay = html.split('data-wd-day="2026-06-29"')[1]?.split("</button>")[0];
    const currentDay = html.split('data-wd-day="2026-07-13"')[1]?.split("</button>")[0];
    expect(adjacentDay).toContain("disabled");
    expect(adjacentDay).toContain("Consultando descansos");
    expect(currentDay).not.toContain("disabled");
  });

  it("asocia el control visible con el id esperado por su label", () => {
    const html = buildWorkdayDatePickerHtml({
      inputId: "fecha-inicio",
      value: "",
    });

    expect(html).toContain('id="fecha-inicio-trigger"');
    expect(html).toContain('aria-controls="fecha-inicio-panel"');
    expect(html).toContain('id="fecha-inicio-panel"');
  });

  it("elimina el listener global al abortar el repaint", () => {
    const target = new EventTarget();
    const abort = new AbortController();
    let calls = 0;
    bindAbortableEvent(target, "outside", () => {
      calls += 1;
    }, abort.signal);

    target.dispatchEvent(new Event("outside"));
    abort.abort();
    target.dispatchEvent(new Event("outside"));

    expect(calls).toBe(1);
  });
});
