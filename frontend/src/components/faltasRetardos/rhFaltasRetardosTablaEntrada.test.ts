import { describe, expect, it } from "vitest";

import type { FaltaRetardoListItem } from "../../api/faltasRetardos.ts";
import { emptyFaltasRetardosListFilters } from "../../faltasRetardos/rh/types.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import { renderRhFaltasRetardosTable } from "./rhFaltasRetardosTable.ts";

function item(overrides: Partial<FaltaRetardoListItem> = {}): FaltaRetardoListItem {
  return {
    id: 1,
    empleado_id: 10,
    empleado_nombre: "ANA LOPEZ",
    numero_empleado: "553",
    tipo: "retardo",
    fecha_evento: "2026-06-28",
    fecha_fin: null,
    observaciones: null,
    hora_programada: null,
    hora_entrada: null,
    minutos_retardo: null,
    registrado_por_id: null,
    registrado_por_nombre: null,
    created_at: "2026-06-28T00:00:00Z",
    origen: "ausencia",
    origen_id: 1,
    ...overrides,
  };
}

function vm(items: FaltaRetardoListItem[]): FaltasRetardosAdminViewModel {
  return {
    filterDraft: emptyFaltasRetardosListFilters(),
    appliedFilters: emptyFaltasRetardosListFilters(),
    estadisticas: null,
    estadisticasStatus: "ready",
    tableStatus: "ready",
    table: { items, total: items.length, page: 1, page_size: 20 },
    puedeCrear: true,
  };
}

describe("tabla de incidencias — columna Entrada", () => {
  it("muestra la hora de entrada con los minutos de retardo", () => {
    const html = renderRhFaltasRetardosTable(
      vm([item({ hora_entrada: "06:27", minutos_retardo: 27 })]),
    );
    expect(html).toContain("Entrada");
    expect(html).toContain("06:27 (+27)");
  });

  it("mantiene la columna pero sin dato para una incidencia que no es retardo", () => {
    const html = renderRhFaltasRetardosTable(vm([item({ tipo: "falta_injustificada" })]));
    expect(html).toContain("Entrada");
    expect(html).not.toContain("(+");
  });

  it("la tarjeta móvil también trae la entrada", () => {
    const html = renderRhFaltasRetardosTable(
      vm([item({ hora_entrada: "06:27", minutos_retardo: 27 })]),
    );
    // La vista móvil y la tabla se renderizan juntas; la hora debe salir dos veces.
    expect(html.split("06:27 (+27)").length - 1).toBe(2);
  });
});
