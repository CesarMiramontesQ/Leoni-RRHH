import { describe, expect, it } from "vitest";
import { emptyFaltasRetardosListFilters } from "../../faltasRetardos/rh/types.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import { renderRhFaltasRetardosAdminView } from "./rhFaltasRetardosAdminView.ts";

function vm(
  overrides: Partial<FaltasRetardosAdminViewModel> = {},
): FaltasRetardosAdminViewModel {
  return {
    filterDraft: emptyFaltasRetardosListFilters(),
    appliedFilters: emptyFaltasRetardosListFilters(),
    estadisticas: null,
    estadisticasStatus: "loading",
    tableStatus: "loading",
    table: null,
    puedeCrear: true,
    ...overrides,
  };
}

describe("rhFaltasRetardosAdminView — toolbar", () => {
  it("no renderiza el botón Sincronizar: el mirror FI/RE es un job del backend", () => {
    const html = renderRhFaltasRetardosAdminView(vm());
    expect(html).not.toContain("rh-fr-sync");
    expect(html).not.toContain("Sincronizar");
  });

  it("conserva el botón de nuevo registro para quien sí puede capturar", () => {
    const html = renderRhFaltasRetardosAdminView(vm({ puedeCrear: true }));
    expect(html).toContain('id="rh-fr-nuevo"');
  });

  it("sin permiso de captura no emite el botón: registrar a mano es de RH", () => {
    const html = renderRhFaltasRetardosAdminView(vm({ puedeCrear: false }));
    expect(html).not.toContain('id="rh-fr-nuevo"');
  });

  it("sin permiso de captura tampoco lo emite el estado vacío de la tabla", () => {
    const tablaVacia = {
      tableStatus: "empty" as const,
      table: { items: [], total: 0, page: 1, page_size: 10 },
    };
    expect(renderRhFaltasRetardosAdminView(vm({ ...tablaVacia, puedeCrear: true }))).toContain(
      'id="rh-fr-nueva-empty"',
    );
    expect(renderRhFaltasRetardosAdminView(vm({ ...tablaVacia, puedeCrear: false }))).not.toContain(
      'id="rh-fr-nueva-empty"',
    );
  });
});
