import { describe, expect, it } from "vitest";
import {
  buildFormHtml,
  buildRhDescansosEffectiveSummaryHtml,
  computeRhModalFormUi,
} from "./rhNewRequestModalUi.ts";
import type { RhNewRequestFormParams } from "./rhNewRequestModalUi.ts";

const base: Omit<RhNewRequestFormParams, "tipo" | "modoRevision" | "fixedEmpleado"> = {
  items: [],
  selectedEmpleadoId: "",
  empleadoSearchQ: "",
  fechaInicio: "2026-06-01",
  fechaFin: "2026-06-05",
  motivo: "",
  diasLabel: "5 días",
  infoHtml: "<div/>",
  resumenState: "valid",
  resumenHint: "",
  fechaInInvalid: false,
  fechaFinInvalid: false,
  canSubmit: true,
};

describe("buildFormHtml — modo revisión (changes_requested)", () => {
  it("no renderiza pestañas de tipo ni select de empleado", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "vacaciones",
      modoRevision: true,
      fixedEmpleado: { directoryId: "88", displayLine: "PÉREZ, ANA" },
      submitLabel: "Guardar y reenviar",
    });
    expect(html).toContain("data-rh-nr-revision=\"1\"");
    expect(html).toContain("No se puede modificar el tipo al corregir");
    expect(html).not.toContain("data-rh-nr-tipo=");
    expect(html).toContain('id="rh-nr-empleado-id"');
    expect(html).not.toContain('id="rh-nr-empleado"');
    expect(html).toContain("Colaborador de la solicitud");
  });

  it("en creación mantiene búsqueda combobox de empleado", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "home_office",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "",
      submitLabel: "Enviar solicitud",
    });
    expect(html).toContain("data-rh-nr-tipo=");
    expect(html).toContain('id="rh-nr-empleado-q"');
    expect(html).toContain('id="rh-nr-empleado-id"');
    expect(html).toContain('id="rh-nr-empleado-listbox"');
    expect(html).not.toContain('id="rh-nr-empleado"');
  });

  it("no renderiza campo de comentarios", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "permiso_sin_goce_sueldo",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "1",
      motivo: "Permiso personal",
    });
    expect(html).not.toContain('id="rh-nr-comentarios"');
    expect(html).toContain('id="rh-nr-motivo"');
  });

  it.each(["loading", "error"] as const)(
    "bloquea submit cuando descansos está en estado %s",
    (estadoDescansos) => {
      const ui = computeRhModalFormUi(
        "incapacidad_interna",
        null,
        "1",
        "2026-06-01",
        "2026-06-05",
        "",
        false,
        false,
        false,
        null,
        estadoDescansos,
        new Set(),
      );

      expect(ui.canSubmit).toBe(false);
    },
  );

  it.each(["loading", "error"] as const)(
    "bloquea submit de vacaciones cuando descansos está en estado %s",
    (estadoDescansos) => {
      const ui = computeRhModalFormUi(
        "vacaciones",
        10,
        "1",
        "2026-06-02",
        "2026-06-02",
        "",
        false,
        false,
        true,
        null,
        estadoDescansos,
        new Set(),
      );

      expect(ui.canSubmit).toBe(false);
    },
  );

  it.each(["home_office", "permiso_sin_goce_sueldo"] as const)(
    "permite submit de %s aunque descansos esté en error",
    (tipo) => {
      const ui = computeRhModalFormUi(
        tipo,
        null,
        "1",
        "2026-06-02",
        "2026-06-02",
        tipo === "permiso_sin_goce_sueldo" ? "Motivo" : "",
        false,
        false,
        true,
        true,
        "error",
        new Set(),
      );

      expect(ui.canSubmit).toBe(true);
    },
  );

  it("limpia feedback de descansos al cambiar a un tipo fuera de alcance", () => {
    const conAlcance = buildFormHtml({
      ...base,
      tipo: "incapacidad_interna",
      modoRevision: false,
      selectedEmpleadoId: "1",
      descansosState: "error",
      descansosError: "No se pudieron consultar los descansos.",
      fechasDescansoExcluidas: ["2026-06-03"],
    });
    const fueraAlcance = buildFormHtml({
      ...base,
      tipo: "home_office",
      modoRevision: false,
      selectedEmpleadoId: "1",
      descansosState: "error",
      descansosError: "No se pudieron consultar los descansos.",
      fechasDescansoExcluidas: ["2026-06-03"],
    });

    expect(conAlcance).toContain("No se pudieron consultar los descansos.");
    expect(conAlcance).toContain("Se excluirán por descanso: 2026-06-03.");
    expect(fueraAlcance).not.toContain("No se pudieron consultar los descansos.");
    expect(fueraAlcance).not.toContain("Se excluirán por descanso");
  });

  it("muestra feedback de descansos también en vacaciones", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "vacaciones",
      modoRevision: false,
      selectedEmpleadoId: "1",
      descansosState: "error",
      descansosError: "No se pudieron consultar los descansos.",
      fechasDescansoExcluidas: ["2026-06-03"],
    });

    expect(html).toContain("No se pudieron consultar los descansos.");
    expect(html).toContain("Se excluirán por descanso: 2026-06-03.");
  });

  it("matrimonio fija fecha fin deshabilitada a 2 días", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "matrimonio",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "1",
      fechaInicio: "2026-05-04",
      fechaFin: "2026-05-05",
      matrimonioTwoDayMode: true,
    });
    expect(html).toContain('id="rh-nr-fin"');
    expect(html).toContain("disabled");
    expect(html).toContain('value="2026-05-05"');
    expect(html).toContain("data-workday-date-picker");
    expect(html).toContain('for="rh-nr-inicio-trigger"');
    expect(html).toContain('data-block-weekends="false"');
  });

  it("conserva bloqueo de fines de semana solo en rangos administrativos no fijos", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "incapacidad_interna",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "1",
      empleadoAdministrativo: true,
    });

    expect(html).toContain('data-block-weekends="true"');
  });

  it("matrimonio extendido por descansos resume 2 días efectivos", () => {
    const ui = computeRhModalFormUi(
      "matrimonio",
      null,
      "1",
      "2026-07-13",
      "2026-07-16",
      "",
      false,
      false,
      false,
      null,
      "ready",
      new Set(["2026-07-14", "2026-07-15"]),
    );

    expect(ui.diasLabel).toBe("2 días");
    expect(ui.canSubmit).toBe(true);
  });

  it("mantiene separados el estado de carga y las fechas excluidas", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "incapacidad_interna",
      modoRevision: false,
      selectedEmpleadoId: "1",
      descansosState: "loading",
      fechasDescansoExcluidas: ["2026-06-03"],
    });

    expect(html).toContain("data-rh-nr-descansos-load-status");
    expect(html).toContain("data-rh-nr-descansos-effective-summary");
    expect(html).toContain("Se excluirán por descanso: 2026-06-03.");
  });

  it("recalcula exclusiones al cambiar solo fecha inicio", () => {
    const descansos = new Set(["2026-06-03"]);
    const anterior = buildRhDescansosEffectiveSummaryHtml(
      "incapacidad_interna",
      "2026-06-01",
      "2026-06-05",
      descansos,
    );
    const actualizado = buildRhDescansosEffectiveSummaryHtml(
      "incapacidad_interna",
      "2026-06-04",
      "2026-06-05",
      descansos,
    );

    expect(anterior).toContain("2026-06-03");
    expect(actualizado).not.toContain("2026-06-03");
    expect(actualizado).toBe("");
  });

  it("oculta Home Office cuando showHomeOfficeType es false", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "vacaciones",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "",
      showHomeOfficeType: false,
    });
    expect(html).not.toContain('data-rh-nr-tipo="home_office"');
    expect(html).toContain('data-rh-nr-tipo="vacaciones"');
  });
});
