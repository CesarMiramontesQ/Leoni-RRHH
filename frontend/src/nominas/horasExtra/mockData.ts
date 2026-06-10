import type { HorasExtraPageViewModel } from "./types.ts";

/** Datos estáticos de demostración — reemplazar por respuesta de API. */
export const HORAS_EXTRA_MOCK_VIEW_MODEL: HorasExtraPageViewModel = {
  semanaLabel: "Semana 19",
  summaryCards: [
    {
      id: "total-horas",
      label: "Total de horas extras",
      value: "101 h",
      deltaLabel: "+8.5 h",
      deltaTone: "success",
      footer: "12 colaboradores Sem 19",
    },
    {
      id: "empleados-con-he",
      label: "Empleados con horas extras",
      value: "12",
      deltaLabel: "-3",
      deltaTone: "danger",
      footer: "de 188 en planta",
    },
    {
      id: "solicitudes-pendientes",
      label: "Solicitudes pendientes",
      value: "4",
      deltaLabel: "Revisar",
      deltaTone: "warning",
      footer: "2 con diferencia de caseta",
    },
    {
      id: "solicitudes-aprobadas",
      label: "Solicitudes aprobadas",
      value: "6",
      deltaLabel: "50%",
      deltaTone: "success",
      footer: "2 rechazadas · 0 vencidas",
    },
  ],
  tabs: [
    { id: "todos", label: "Todos", count: 12 },
    { id: "pendientes", label: "Pendientes", count: 4 },
    { id: "aprobados", label: "Aprobados", count: 6 },
    { id: "rechazados", label: "Rechazados", count: 2 },
  ],
  activeTabId: "todos",
  totalRegistros: 48,
  pageSize: 12,
  currentPage: 1,
  totalPages: 4,
};
