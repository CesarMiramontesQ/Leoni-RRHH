import { describe, expect, it } from "vitest";
import { buildSupervisorHomeOfficeWeekdayChart } from "./buildSupervisorHomeOfficeWeekday.ts";
import type { RhSolicitudTablaFila } from "../../solicitudes/rh/types.ts";

function fila(
  partial: Partial<RhSolicitudTablaFila> & Pick<RhSolicitudTablaFila, "fecha_inicio" | "fecha_fin">,
): RhSolicitudTablaFila {
  return {
    id: 1,
    empleado_id: "10",
    empleado_nombre_raw: "Colaborador",
    foto_url: null,
    numero_folio: "SOL-1",
    area: "Producción",
    tipo: "home_office",
    estado: "approved",
    fecha_inicio: partial.fecha_inicio,
    fecha_fin: partial.fecha_fin,
    ...partial,
  };
}

describe("buildSupervisorHomeOfficeWeekdayChart", () => {
  it("cuenta días laborales y KPIs", () => {
    const data = buildSupervisorHomeOfficeWeekdayChart([
      fila({ fecha_inicio: "2025-01-06", fecha_fin: "2025-01-08" }),
      fila({ id: 2, fecha_inicio: "2025-01-07", fecha_fin: "2025-01-07" }),
      fila({ id: 3, fecha_inicio: "2025-01-11", fecha_fin: "2025-01-12" }),
    ]);

    expect(data.days[0]?.count).toBe(1);
    expect(data.days[1]?.count).toBe(2);
    expect(data.total_dias_ho).toBe(4);
    expect(data.solicitudes_ho).toBe(3);
    expect(data.dia_mas_solicitado).toBe("Martes");
    expect(data.concentracion_dia_principal_pct).toBe(50);
  });

  it("devuelve vacío sin solicitudes", () => {
    const data = buildSupervisorHomeOfficeWeekdayChart([]);
    expect(data.total_dias_ho).toBe(0);
    expect(data.solicitudes_ho).toBe(0);
    expect(data.dia_mas_solicitado).toBeNull();
    expect(data.concentracion_dia_principal_pct).toBeNull();
  });
});
