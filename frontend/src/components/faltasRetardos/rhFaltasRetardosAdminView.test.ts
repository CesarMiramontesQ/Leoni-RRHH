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

/** Fragmento del botón de descarga: el `aria-busy` de la tabla en carga no cuenta. */
function botonDescarga(html: string): string {
  const desde = html.indexOf('id="rh-fr-descargar-reporte"');
  expect(desde).toBeGreaterThan(-1);
  return html.slice(desde, html.indexOf("</button>", desde));
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

  it("el botón Descargar Reporte lo ve también quien no puede capturar", () => {
    // Supervisor y gerente consultan sin registrar, pero sí revisan las tres semanas.
    for (const puedeCrear of [true, false]) {
      const html = renderRhFaltasRetardosAdminView(vm({ puedeCrear }));
      expect(html).toContain('id="rh-fr-descargar-reporte"');
      expect(html).toContain("Descargar Reporte");
    }
  });

  it("mientras genera, el botón queda deshabilitado y anuncia el estado", () => {
    const boton = botonDescarga(
      renderRhFaltasRetardosAdminView(vm({ descargandoReporte: true })),
    );
    expect(boton).toContain("disabled");
    expect(boton).toContain('aria-busy="true"');
    expect(boton).toContain("Generando…");
  });

  it("en reposo el botón está habilitado", () => {
    const boton = botonDescarga(
      renderRhFaltasRetardosAdminView(vm({ descargandoReporte: false })),
    );
    expect(boton).toContain("Descargar Reporte");
    expect(boton).not.toContain("disabled");
    expect(boton).not.toContain("aria-busy");
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
