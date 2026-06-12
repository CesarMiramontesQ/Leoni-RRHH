import type { HorasExtraListResponse } from "../../api/horasExtra.ts";
import type {
  HorasExtraFilterOptions,
  HorasExtraFilters,
  HorasExtraPageViewModel,
  HorasExtraTabId,
} from "./types.ts";
import { EMPTY_HORAS_EXTRA_FILTER_OPTIONS, EMPTY_HORAS_EXTRA_FILTERS } from "./types.ts";

function formatHoras(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} h` : `${rounded.toFixed(1)} h`;
}

function estadoCountsFromTabs(tabs: HorasExtraListResponse["tabs"]): Record<HorasExtraTabId, number> {
  return {
    todos: tabs.todos ?? 0,
    pendientes: tabs.pendientes ?? 0,
    aprobados: tabs.aprobados ?? 0,
    rechazados: tabs.rechazados ?? 0,
  };
}

export function buildHorasExtraViewModel(
  data: HorasExtraListResponse,
  opts: {
    filters?: HorasExtraFilters;
    filterOptions?: HorasExtraFilterOptions;
    filtersStatus?: HorasExtraPageViewModel["filtersStatus"];
  } = {},
): HorasExtraPageViewModel {
  const { resumen, tabs, semana_actual: semana } = data;
  const filters = opts.filters ?? EMPTY_HORAS_EXTRA_FILTERS;
  const filterOptions: HorasExtraFilterOptions = opts.filterOptions ?? {
    areas: EMPTY_HORAS_EXTRA_FILTER_OPTIONS.areas,
    centrosCosto: data.filter_options.centros_costo.map((cc) => ({
      id: cc.id,
      label: cc.label,
    })),
  };

  const totalPages = Math.max(1, Math.ceil(data.total / data.page_size));

  return {
    semanaActual: semana,
    semanaLabel: filters.semana.trim() ? `Semana ${filters.semana}` : `Semana ${semana}`,
    summaryCards: [
      {
        id: "total-horas",
        label: "Total de horas extras",
        value: formatHoras(resumen.total_horas_extra),
        footer: `${resumen.colaboradores_con_registro} colaboradores con registro`,
      },
      {
        id: "empleados-con-he",
        label: "Empleados con horas extras",
        value: String(resumen.empleados_con_horas_extra),
        footer: `de ${resumen.empleados_activos_planta} en planta`,
      },
      {
        id: "solicitudes-pendientes",
        label: "Solicitudes pendientes",
        value: String(resumen.solicitudes_pendientes),
        deltaLabel: resumen.solicitudes_pendientes > 0 ? "Revisar" : undefined,
        deltaTone: "warning",
        footer: `${resumen.solicitudes_total} solicitudes en total`,
      },
      {
        id: "solicitudes-aprobadas",
        label: "Solicitudes aprobadas",
        value: String(resumen.solicitudes_aprobadas),
        deltaLabel: `${resumen.porcentaje_aprobacion}%`,
        deltaTone: "success",
        footer: `${resumen.solicitudes_rechazadas} rechazadas`,
      },
    ],
    filters,
    filterOptions,
    filtersStatus: opts.filtersStatus ?? "ready",
    estadoCounts: estadoCountsFromTabs(tabs),
    filas: data.items.slice(0, data.page_size),
    totalRegistros: data.total,
    pageSize: data.page_size,
    currentPage: data.page,
    totalPages,
    tableStatus: "ready",
  };
}
