import type { ViajesLaboralesEstadisticasData } from "../../viajesLaborales/rh/types.ts";
import { VL_COPY } from "../../viajesLaborales/rh/viajesLaboralesCopy.ts";
import type { ViajesLaboralesAdminViewModel } from "../../viajesLaborales/rh/types.ts";
import {
  HE_KPI_ICONS,
  renderHorasExtraKpiCards,
  type HorasExtraKpiCard,
} from "../../horasExtra/shared/renderHorasExtraKpiCards.ts";

function buildKpiCards(data: ViajesLaboralesEstadisticasData): HorasExtraKpiCard[] {
  return [
    {
      label: VL_COPY.kpiTotal,
      value: String(data.total),
      sub: "Registros con los filtros aplicados",
      icon: HE_KPI_ICONS.solicitudes,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: VL_COPY.kpiPendientes,
      value: String(data.pendientes),
      sub: "En espera de aprobación",
      icon: HE_KPI_ICONS.pendiente,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
    },
    {
      label: VL_COPY.kpiAprobados,
      value: String(data.aprobados),
      sub: "Viajes autorizados",
      icon: HE_KPI_ICONS.aprobada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald",
    },
    {
      label: VL_COPY.kpiCancelados,
      value: String(data.cancelados),
      sub: "Viajes cancelados",
      icon: HE_KPI_ICONS.rechazada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
  ];
}

export function renderRhViajesLaboralesKpiSection(vm: ViajesLaboralesAdminViewModel): string {
  if (vm.estadisticasStatus === "loading") {
    return `<div id="rh-vl-kpis" class="shrink-0">${renderHorasExtraKpiCards(
      { status: "loading" },
      { columnsClass: "sm:grid-cols-2 lg:grid-cols-4", ariaLabel: VL_COPY.estadisticasAria },
    )}</div>`;
  }
  if (vm.estadisticasStatus === "error") {
    return `<div id="rh-vl-kpis" class="shrink-0">${renderHorasExtraKpiCards(
      {
        status: "error",
        error: vm.estadisticasErrorMessage || VL_COPY.errorEstadisticas,
      },
      { ariaLabel: VL_COPY.estadisticasAria },
    )}</div>`;
  }
  const data = vm.estadisticas;
  if (!data) return `<div id="rh-vl-kpis" class="shrink-0"></div>`;
  return `<div id="rh-vl-kpis" class="shrink-0 mb-4 sm:mb-5">${renderHorasExtraKpiCards(
    { status: "ready", cards: buildKpiCards(data) },
    { columnsClass: "sm:grid-cols-2 lg:grid-cols-4", ariaLabel: VL_COPY.estadisticasAria },
  )}</div>`;
}
