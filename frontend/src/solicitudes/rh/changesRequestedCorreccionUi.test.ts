import { describe, expect, it } from "vitest";
import { solicitudResueltaContentHtml } from "../../components/solicitudes/solicitudResueltaModalUi.ts";
import { mapTablaFilaToSolicitudResuelta } from "./mapTablaFilaToSolicitudResuelta.ts";
import type { RhSolicitudTablaFila } from "./types.ts";
import { toResolvedRequestDetail } from "./solicitudResueltaTypes.ts";

const filaCambios: RhSolicitudTablaFila = {
  id: 9101,
  empleado_id: "88",
  empleado_nombre_raw: "GARCÍA, CARLOS",
  foto_url: null,
  numero_folio: "SOL-9101",
  area: "Operaciones",
  tipo: "vacaciones",
  fecha_solicitud: "2026-04-10",
  fecha_inicio: "2026-06-01",
  fecha_fin: "2026-06-05",
  periodo_etiqueta: null,
  estado: "changes_requested",
  supervisor_id: "7",
  supervisor_nombre: "LÓPEZ, MARÍA",
  fecha_aprobacion: null,
  nivel_actual: 1,
  comentarios: "Nota",
};

describe("changes_requested — corrección por creador", () => {
  it("marca puede_corregir_y_reenviar cuando sesionEsCreador", () => {
    const vm = mapTablaFilaToSolicitudResuelta(filaCambios, { sesionEsCreador: true });
    expect(vm?.estado_ui).toBe("cambios_solicitados");
    expect(vm?.puede_corregir_y_reenviar).toBe(true);
  });

  it("no marca puede_corregir_y_reenviar sin sesionEsCreador", () => {
    const vm = mapTablaFilaToSolicitudResuelta(filaCambios, { sesionEsCreador: false });
    expect(vm?.puede_corregir_y_reenviar).toBeUndefined();
  });

  it("toResolvedRequestDetail expone canCorrectAndResubmit", () => {
    const vm = mapTablaFilaToSolicitudResuelta(filaCambios, { sesionEsCreador: true })!;
    const d = toResolvedRequestDetail(vm);
    expect(d.status).toBe("changes_requested");
    expect(d.canCorrectAndResubmit).toBe(true);
  });

  it("el HTML del modal incluye el botón de corregir solo para el creador", () => {
    const con = mapTablaFilaToSolicitudResuelta(filaCambios, { sesionEsCreador: true })!;
    const sin = mapTablaFilaToSolicitudResuelta(filaCambios, { sesionEsCreador: false })!;
    expect(solicitudResueltaContentHtml(con)).toContain("data-rh-sr-corregir");
    expect(solicitudResueltaContentHtml(sin)).not.toContain("data-rh-sr-corregir");
  });
});
