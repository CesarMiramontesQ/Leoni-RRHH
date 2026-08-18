import { describe, expect, it } from "vitest";

import type { FaltaRetardoListItem } from "../../api/faltasRetardos.ts";
import { renderFaltaRetardoDetalleBody } from "./faltaRetardoDetalleModal.ts";

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

describe("detalle de incidencia — horario del retardo", () => {
  it("muestra hora programada, hora de entrada y minutos tarde", () => {
    const html = renderFaltaRetardoDetalleBody(
      item({ hora_programada: "06:00", hora_entrada: "06:27", minutos_retardo: 27 }),
    );
    expect(html).toContain("Hora programada");
    expect(html).toContain("06:00");
    expect(html).toContain("Hora de entrada");
    expect(html).toContain("06:27");
    expect(html).toContain("Minutos tarde");
    expect(html).toContain("27 min");
  });

  it("no agrega los campos de horario a una incidencia que no es retardo", () => {
    const html = renderFaltaRetardoDetalleBody(item({ tipo: "falta_justificada" }));
    expect(html).not.toContain("Hora programada");
    expect(html).not.toContain("Minutos tarde");
  });

  it("un retardo sin checada conserva los campos con guion", () => {
    const html = renderFaltaRetardoDetalleBody(item({ hora_programada: "06:00" }));
    expect(html).toContain("Hora de entrada");
    expect(html).toContain("06:00");
  });
});
