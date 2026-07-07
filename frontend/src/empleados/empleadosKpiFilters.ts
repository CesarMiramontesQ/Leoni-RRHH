export type KpiTarjetaActiva = "" | "sin-lider" | "sin-email" | "contratos";

export type EmpleadosKpiFilterState = {
  kpi_tarjeta_activa: KpiTarjetaActiva;
  estatus_lider: "" | "inactivo" | "permiso";
};

export type KpiTarjetaKind = "sin-lider" | "sin-email" | "equipo" | "contratos";

export function kpiFiltrarSinLider(state: EmpleadosKpiFilterState): boolean {
  return state.kpi_tarjeta_activa === "sin-lider";
}

export function kpiFiltrarSinEmail(state: EmpleadosKpiFilterState): boolean {
  return state.kpi_tarjeta_activa === "sin-email";
}

export function kpiFiltrarContratos(state: EmpleadosKpiFilterState): boolean {
  return state.kpi_tarjeta_activa === "contratos";
}

export function clearKpiTarjetaFiltros(state: EmpleadosKpiFilterState): void {
  state.kpi_tarjeta_activa = "";
}

export function isVistaEquipoDefault(state: EmpleadosKpiFilterState): boolean {
  return state.kpi_tarjeta_activa === "" && state.estatus_lider === "";
}

export type ApplyKpiTarjetaClickOpts = {
  isRhAdmin: boolean;
  kpiGestionEquipo: boolean;
};

export type ApplyKpiTarjetaClickResult = {
  changed: boolean;
};

export function applyKpiTarjetaClick(
  state: EmpleadosKpiFilterState,
  kind: KpiTarjetaKind,
  opts: ApplyKpiTarjetaClickOpts,
): ApplyKpiTarjetaClickResult {
  if (opts.isRhAdmin) {
    if (kind === "sin-lider" || kind === "sin-email") {
      if (state.kpi_tarjeta_activa === kind) {
        state.kpi_tarjeta_activa = "";
      } else {
        state.kpi_tarjeta_activa = kind;
      }
      return { changed: true };
    }
    return { changed: false };
  }

  if (!opts.kpiGestionEquipo) {
    return { changed: false };
  }

  if (kind === "equipo") {
    if (isVistaEquipoDefault(state)) {
      return { changed: false };
    }
    state.kpi_tarjeta_activa = "";
    state.estatus_lider = "";
    return { changed: true };
  }

  if (kind === "contratos") {
    if (state.kpi_tarjeta_activa === "contratos") {
      state.kpi_tarjeta_activa = "";
    } else {
      state.kpi_tarjeta_activa = "contratos";
      state.estatus_lider = "";
    }
    return { changed: true };
  }

  return { changed: false };
}
