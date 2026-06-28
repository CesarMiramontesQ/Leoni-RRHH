import { describe, expect, it } from "vitest";
import { buildFormHtml } from "./rhNewRequestModalUi.ts";
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

  it("en creación mantiene pestañas de tipo y select de empleado", () => {
    const html = buildFormHtml({
      ...base,
      tipo: "home_office",
      modoRevision: false,
      items: [],
      selectedEmpleadoId: "",
      submitLabel: "Enviar solicitud",
    });
    expect(html).toContain("data-rh-nr-tipo=");
    expect(html).toContain('id="rh-nr-empleado"');
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
