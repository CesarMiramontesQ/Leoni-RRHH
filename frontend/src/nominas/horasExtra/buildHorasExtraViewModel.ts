import type { HorasExtraListResponse } from "../../api/horasExtra.ts";
import type { HorasExtraPageViewModel, HorasExtraTab, HorasExtraTabId } from "./types.ts";

const TAB_LABELS: Record<HorasExtraTabId, string> = {
  todos: "Todos",
  pendientes: "Pendientes",
  aprobados: "Aprobados",
  rechazados: "Rechazados",
};

function formatHoras(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} h` : `${rounded.toFixed(1)} h`;
}

export function buildHorasExtraViewModel(
  data: HorasExtraListResponse,
  activeTabId: HorasExtraTabId = "todos",
): HorasExtraPageViewModel {
  const { resumen, tabs, semana_actual: semana } = data;
  const deltaHoras = Math.round((resumen.total_horas_extra * 0.084) * 10) / 10;
  const deltaEmpleados = resumen.empleados_activos_planta - resumen.empleados_con_horas_extra;

  const tabEntries: HorasExtraTab[] = (Object.keys(TAB_LABELS) as HorasExtraTabId[]).map((id) => ({
    id,
    label: TAB_LABELS[id],
    count: tabs[id] ?? 0,
  }));

  const filas = data.items.slice(0, 10);
  const totalRegistros = filas.length;

  return {
    semanaLabel: `Semana ${semana}`,
    summaryCards: [
      {
        id: "total-horas",
        label: "Total de horas extras",
        value: formatHoras(resumen.total_horas_extra),
        deltaLabel: deltaHoras > 0 ? `+${deltaHoras} h` : undefined,
        deltaTone: "success",
        footer: `${resumen.colaboradores_con_registro} colaboradores Sem ${semana}`,
      },
      {
        id: "empleados-con-he",
        label: "Empleados con horas extras",
        value: String(resumen.empleados_con_horas_extra),
        deltaLabel: deltaEmpleados !== 0 ? String(deltaEmpleados) : undefined,
        deltaTone: deltaEmpleados < 0 ? "danger" : "neutral",
        footer: `de ${resumen.empleados_activos_planta} en planta`,
      },
      {
        id: "solicitudes-pendientes",
        label: "Solicitudes pendientes",
        value: String(resumen.solicitudes_pendientes),
        deltaLabel: resumen.solicitudes_pendientes > 0 ? "Revisar" : undefined,
        deltaTone: "warning",
        footer: `${resumen.solicitudes_con_dif_caseta} con diferencia de caseta`,
      },
      {
        id: "solicitudes-aprobadas",
        label: "Solicitudes aprobadas",
        value: String(resumen.solicitudes_aprobadas),
        deltaLabel: `${resumen.porcentaje_aprobacion}%`,
        deltaTone: "success",
        footer: `${resumen.solicitudes_rechazadas} rechazadas · 0 vencidas`,
      },
    ],
    tabs: tabEntries,
    activeTabId,
    filas,
    totalRegistros,
    pageSize: 10,
    currentPage: 1,
    totalPages: 1,
    tableStatus: "ready",
  };
}
