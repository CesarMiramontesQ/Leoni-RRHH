import type { FaltasRetardosEstadisticasData } from "../../faltasRetardos/rh/types.ts";
import { FR_COPY } from "../../faltasRetardos/rh/faltasRetardosCopy.ts";
import type { FaltasRetardosAdminViewModel } from "../../faltasRetardos/rh/types.ts";
import {
  HE_KPI_ICONS,
  renderHorasExtraKpiCards,
  type HorasExtraKpiCard,
} from "../../horasExtra/shared/renderHorasExtraKpiCards.ts";

function buildKpiCards(data: FaltasRetardosEstadisticasData): HorasExtraKpiCard[] {
  return [
    {
      label: FR_COPY.kpiTotal,
      value: String(data.total_eventos),
      sub: FR_COPY.kpiTotalSub,
      icon: HE_KPI_ICONS.solicitudes,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: FR_COPY.kpiFaltaJustificada,
      value: String(data.falta_justificada),
      sub: FR_COPY.kpiFaltaJustificadaSub,
      icon: HE_KPI_ICONS.aprobada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald",
    },
    {
      label: FR_COPY.kpiFaltaInjustificada,
      value: String(data.falta_injustificada),
      sub: FR_COPY.kpiFaltaInjustificadaSub,
      icon: HE_KPI_ICONS.rechazada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
    },
    {
      label: FR_COPY.kpiRetardo,
      value: String(data.retardo),
      sub: FR_COPY.kpiRetardoSub,
      icon: HE_KPI_ICONS.pendiente,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
    },
    {
      label: FR_COPY.kpiIncapacidad,
      value: String(data.incapacidad),
      sub: FR_COPY.kpiIncapacidadSub,
      icon: HE_KPI_ICONS.horas,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: FR_COPY.kpiSuspension,
      value: String(data.suspension),
      sub: FR_COPY.kpiSuspensionSub,
      icon: HE_KPI_ICONS.parcial,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
    },
  ];
}

export function renderRhFaltasRetardosKpiSection(vm: FaltasRetardosAdminViewModel): string {
  if (vm.estadisticasStatus === "loading") {
    return `<div id="rh-fr-kpis" class="shrink-0">${renderHorasExtraKpiCards(
      { status: "loading" },
      { columnsClass: "sm:grid-cols-2 lg:grid-cols-3", ariaLabel: FR_COPY.estadisticasAria },
    )}</div>`;
  }
  if (vm.estadisticasStatus === "error") {
    return `<div id="rh-fr-kpis" class="shrink-0">${renderHorasExtraKpiCards(
      {
        status: "error",
        error: vm.estadisticasErrorMessage || FR_COPY.errorEstadisticas,
      },
      { ariaLabel: FR_COPY.estadisticasAria },
    )}</div>`;
  }
  const data = vm.estadisticas;
  if (!data) {
    return `<div id="rh-fr-kpis" class="shrink-0"></div>`;
  }
  return `<div id="rh-fr-kpis" class="shrink-0 mb-4 sm:mb-5">${renderHorasExtraKpiCards(
    { status: "ready", cards: buildKpiCards(data) },
    { columnsClass: "sm:grid-cols-2 lg:grid-cols-3", ariaLabel: FR_COPY.estadisticasAria },
  )}</div>`;
}
