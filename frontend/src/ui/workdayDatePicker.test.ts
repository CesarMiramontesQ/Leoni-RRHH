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

describe("workdayDatePicker — fecha mínima", () => {
  it("deshabilita los días anteriores a minDate", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
      minDate: "2026-07-15",
    });

    const anterior = html.split('data-wd-day="2026-07-14"')[1]?.split("</button>")[0];
    const minimo = html.split('data-wd-day="2026-07-15"')[1]?.split("</button>")[0];
    expect(anterior).toContain("disabled");
    expect(anterior).toContain("No disponible");
    expect(minimo).not.toContain("disabled");
  });

  it("no deshabilita nada cuando no hay minDate", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
    });

    const dia = html.split('data-wd-day="2026-07-14"')[1]?.split("</button>")[0];
    expect(dia).not.toContain("disabled");
  });

  it("no confunde el mínimo con un descanso en la leyenda", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 6,
      selected: "",
      blockWeekends: false,
      minDate: "2026-07-15",
    });

    expect(html).not.toContain("Días en ámbar = descanso del empleado");
  });
});

describe("workdayDatePicker — festivos", () => {
  it("renderiza el festivo bloqueado, con su descripción y color propio", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 8,
      selected: "",
      blockWeekends: false,
      blockedDates: new Set(["2026-09-16"]),
      festivos: new Map([["2026-09-16", "Día de la Independencia"]]),
    });
    const day = html.match(/<button[\s\S]*?data-wd-day="2026-09-16"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(day).toContain("disabled");
    expect(day).toContain('title="Festivo: Día de la Independencia"');
    expect(day).toContain("bg-rose-100");
    // El festivo manda sobre el descanso en la misma fecha.
    expect(day).not.toContain("bg-amber-100");
    expect(html).toContain("Días en rosa = festivo de la planta");
  });

  it("sin festivos no muestra la leyenda", () => {
    const html = buildWorkdayDatePickerMonthHtml({
      year: 2026,
      monthIndex: 8,
      selected: "",
      blockWeekends: false,
      festivos: new Map(),
    });
    expect(html).not.toContain("Días en rosa");
  });
});
