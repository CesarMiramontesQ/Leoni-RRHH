import { describe, expect, it } from "vitest";
import { mapSolicitudApiItemToRhTablaFila } from "./solicitudes.ts";
import type { SolicitudApiItem } from "./solicitudes.ts";

const baseItem: SolicitudApiItem = {
  id: 10,
  empleado_id: 984,
  tipo: "vacaciones",
  fecha_inicio: "2026-05-05",
  fecha_fin: "2026-05-09",
  estado: "pending",
  created_at: "2026-04-01T12:00:00Z",
  empleado_nombre: "PÉREZ, JUAN",
};

describe("mapSolicitudApiItemToRhTablaFila", () => {
  it("mapea empleado_no_empleado numérico del API", () => {
    const fila = mapSolicitudApiItemToRhTablaFila({ ...baseItem, empleado_no_empleado: 25 });
    expect(fila.empleado_no_empleado).toBe("25");
    expect(fila.empleado_id).toBe("984");
  });

  it("mapea empleado_no_empleado string del API", () => {
    const fila = mapSolicitudApiItemToRhTablaFila({ ...baseItem, empleado_no_empleado: "108" });
    expect(fila.empleado_no_empleado).toBe("108");
  });
});
