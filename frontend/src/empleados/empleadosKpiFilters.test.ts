import { describe, expect, it } from "vitest";
import {
  applyKpiTarjetaClick,
  clearKpiTarjetaFiltros,
  isVistaEquipoDefault,
  kpiFiltrarContratos,
  kpiFiltrarSinEmail,
  kpiFiltrarSinLider,
  type EmpleadosKpiFilterState,
} from "./empleadosKpiFilters.ts";

function makeState(overrides: Partial<EmpleadosKpiFilterState> = {}): EmpleadosKpiFilterState {
  return {
    kpi_tarjeta_activa: "",
    estatus_lider: "",
    ...overrides,
  };
}

const rhOpts = { isRhAdmin: true, kpiGestionEquipo: false };
const liderOpts = { isRhAdmin: false, kpiGestionEquipo: true };

describe("empleadosKpiFilters", () => {
  describe("helpers de derivación", () => {
    it("mapea kpi_tarjeta_activa a flags de filtro", () => {
      const sinLider = makeState({ kpi_tarjeta_activa: "sin-lider" });
      expect(kpiFiltrarSinLider(sinLider)).toBe(true);
      expect(kpiFiltrarSinEmail(sinLider)).toBe(false);
      expect(kpiFiltrarContratos(sinLider)).toBe(false);

      const contratos = makeState({ kpi_tarjeta_activa: "contratos" });
      expect(kpiFiltrarContratos(contratos)).toBe(true);
    });

    it("clearKpiTarjetaFiltros resetea la tarjeta activa", () => {
      const state = makeState({ kpi_tarjeta_activa: "sin-email" });
      clearKpiTarjetaFiltros(state);
      expect(state.kpi_tarjeta_activa).toBe("");
    });
  });

  describe("applyKpiTarjetaClick — RH", () => {
    it("activa sin-lider desde estado vacío", () => {
      const state = makeState();
      const result = applyKpiTarjetaClick(state, "sin-lider", rhOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("sin-lider");
    });

    it("desactiva sin-lider al pulsar la misma tarjeta", () => {
      const state = makeState({ kpi_tarjeta_activa: "sin-lider" });
      const result = applyKpiTarjetaClick(state, "sin-lider", rhOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("");
    });

    it("reemplaza sin-lider por sin-email (mutua exclusión)", () => {
      const state = makeState({ kpi_tarjeta_activa: "sin-lider" });
      const result = applyKpiTarjetaClick(state, "sin-email", rhOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("sin-email");
      expect(kpiFiltrarSinLider(state)).toBe(false);
      expect(kpiFiltrarSinEmail(state)).toBe(true);
    });

    it("ignora tarjetas de supervisor en vista RH", () => {
      const state = makeState();
      const result = applyKpiTarjetaClick(state, "contratos", rhOpts);
      expect(result.changed).toBe(false);
      expect(state.kpi_tarjeta_activa).toBe("");
    });
  });

  describe("applyKpiTarjetaClick — supervisor", () => {
    it("activa contratos y limpia estatus_lider", () => {
      const state = makeState({ estatus_lider: "inactivo" });
      const result = applyKpiTarjetaClick(state, "contratos", liderOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("contratos");
      expect(state.estatus_lider).toBe("");
    });

    it("desactiva contratos al pulsar la misma tarjeta", () => {
      const state = makeState({ kpi_tarjeta_activa: "contratos" });
      const result = applyKpiTarjetaClick(state, "contratos", liderOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("");
    });

    it("equipo no cambia si ya está en vista por defecto", () => {
      const state = makeState();
      expect(isVistaEquipoDefault(state)).toBe(true);
      const result = applyKpiTarjetaClick(state, "equipo", liderOpts);
      expect(result.changed).toBe(false);
    });

    it("equipo restablece contratos y estatus_lider", () => {
      const state = makeState({ kpi_tarjeta_activa: "contratos" });
      const result = applyKpiTarjetaClick(state, "equipo", liderOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("");
      expect(state.estatus_lider).toBe("");
    });

    it("equipo restablece solo estatus_lider cuando contratos no está activo", () => {
      const state = makeState({ estatus_lider: "permiso" });
      const result = applyKpiTarjetaClick(state, "equipo", liderOpts);
      expect(result.changed).toBe(true);
      expect(state.kpi_tarjeta_activa).toBe("");
      expect(state.estatus_lider).toBe("");
    });
  });
});
