import { describe, expect, it, vi } from "vitest";
import {
  buildDescansosFeedback,
  createDescansosEmpleadoController,
  createLatestRequestSequence,
  tipoRequiereCalendarioDescansos,
} from "./descansosEmpleado.ts";

describe("tipoRequiereCalendarioDescansos", () => {
  it.each([
    "matrimonio",
    "defuncion",
    "paternidad",
    "suspension",
    "incapacidad_interna",
    "vacaciones",
  ] as const)("incluye %s en el alcance TRESS", (tipo) => {
    expect(tipoRequiereCalendarioDescansos(tipo)).toBe(true);
  });

  it.each([
    "home_office",
    "permiso_sin_goce_sueldo",
    "",
    null,
    undefined,
  ] as const)("excluye %s del alcance TRESS", (tipo) => {
    expect(tipoRequiereCalendarioDescansos(tipo)).toBe(false);
  });
});

describe("descansosEmpleado controller", () => {
  it("cachea por empleado+mes y deduplica peticiones concurrentes", async () => {
    let resolver: ((value: string[]) => void) | undefined;
    const fetchMonth = vi.fn(
      () => new Promise<string[]>((resolve) => {
        resolver = resolve;
      }),
    );
    const controller = createDescansosEmpleadoController(fetchMonth);
    controller.setEmpleado(42);

    const first = controller.loadMonth(2026, 6);
    const second = controller.loadMonth(2026, 6);
    expect(fetchMonth).toHaveBeenCalledTimes(1);

    resolver?.(["2026-07-14"]);
    await expect(first).resolves.toEqual(new Set(["2026-07-14"]));
    await expect(second).resolves.toEqual(new Set(["2026-07-14"]));
    await controller.loadMonth(2026, 6);
    expect(fetchMonth).toHaveBeenCalledTimes(1);
  });

  it("limpia e invalida resultados pendientes al cambiar empleado", async () => {
    const resolvers = new Map<number, (value: string[]) => void>();
    const fetchMonth = vi.fn(
      (empleadoId: number) =>
        new Promise<string[]>((resolve) => {
          resolvers.set(empleadoId, resolve);
        }),
    );
    const controller = createDescansosEmpleadoController(fetchMonth);

    controller.setEmpleado(42);
    const oldRequest = controller.loadMonth(2026, 6);
    controller.setEmpleado(99);
    const currentRequest = controller.loadMonth(2026, 6);
    resolvers.get(42)?.(["2026-07-14"]);
    resolvers.get(99)?.(["2026-07-15"]);

    await oldRequest;
    await currentRequest;
    expect(controller.getLoadedDates()).toEqual(new Set(["2026-07-15"]));
  });

  it("solo permite aplicar la respuesta de selección más reciente", () => {
    const sequence = createLatestRequestSequence();
    const first = sequence.next();
    const second = sequence.next();

    expect(sequence.isCurrent(first)).toBe(false);
    expect(sequence.isCurrent(second)).toBe(true);
  });

  it("carga los tres meses visibles y deduplica los ya pendientes", async () => {
    const fetchMonth = vi.fn(async () => []);
    const controller = createDescansosEmpleadoController(fetchMonth);
    controller.setEmpleado(42);

    await Promise.all([
      controller.loadVisibleMonths(2026, 6),
      controller.loadVisibleMonths(2026, 6),
    ]);

    expect(fetchMonth).toHaveBeenCalledTimes(3);
    expect(controller.getLoadedMonths()).toEqual(
      new Set(["2026-06", "2026-07", "2026-08"]),
    );
  });

  it("conserva el resumen efectivo al actualizar carga/error", () => {
    const feedback = buildDescansosFeedback(
      "loading",
      "",
      ["2026-07-14", "2026-07-15"],
    );

    expect(feedback.loadHtml).toContain("Consultando descansos");
    expect(feedback.effectiveSummaryHtml).toContain(
      "Se excluirán por descanso: 2026-07-14, 2026-07-15.",
    );
  });
});
