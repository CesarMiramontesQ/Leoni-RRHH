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
    ...overrides,
  };
}

describe("rhFaltasRetardosAdminView — toolbar", () => {
  it("no renderiza el botón Sincronizar: el mirror FI/RE es un job del backend", () => {
    const html = renderRhFaltasRetardosAdminView(vm());
    expect(html).not.toContain("rh-fr-sync");
    expect(html).not.toContain("Sincronizar");
  });

  it("conserva el botón de nuevo registro", () => {
    const html = renderRhFaltasRetardosAdminView(vm());
    expect(html).toContain('id="rh-fr-nuevo"');
  });
});
