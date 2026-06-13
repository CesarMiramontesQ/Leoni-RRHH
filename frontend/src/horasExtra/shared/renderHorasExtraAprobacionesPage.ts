import type { HorasExtraAprobacionEstadisticas, HorasExtraPendiente } from "../../api/horasExtraAprobacion.ts";
import { RH_DASHBOARD_PAGE_SHELL, RH_LISTADO_BTN_GHOST } from "../../ui/uiTokens.ts";
import { escapeHtml } from "../../ui/uiUtils.ts";
import { HE_TABLE_SECTION } from "./horasExtraTableUi.ts";
import {
  renderHorasExtraAprobacionDetalleModalSlot,
  renderHorasExtraAprobacionRechazoModal,
  type HorasExtraAprobacionDetalleModalState,
} from "./renderHorasExtraAprobacionDetalleModal.ts";
import { HE_KPI_ICONS, renderHorasExtraKpiCards, type HorasExtraKpiCard } from "./renderHorasExtraKpiCards.ts";
import { renderHorasExtraAprobacionesTable } from "./renderHorasExtraAprobacionesTable.ts";

export type HorasExtraAprobacionesPageState = {
  listaStatus: "loading" | "ready" | "error";
  items: HorasExtraPendiente[];
  total: number;
  page: number;
  pageSize: number;
  listaError?: string;
  estadisticasStatus: "loading" | "ready" | "error";
  estadisticas: HorasExtraAprobacionEstadisticas | null;
  estadisticasError?: string;
  detalleModal: HorasExtraAprobacionDetalleModalState;
  rechazo: {
    solicitudId: number;
    comentario: string;
    submitting: boolean;
    error?: string;
  } | null;
  toast?: { tone: "ok" | "error"; message: string };
};

function buildEstadisticasCards(stats: HorasExtraAprobacionEstadisticas): HorasExtraKpiCard[] {
  return [
    {
      label: "Total solicitudes",
      value: String(stats.total_solicitudes),
      sub: "Asignadas a tu revisión",
      icon: HE_KPI_ICONS.solicitudes,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
    },
    {
      label: "Pendientes",
      value: String(stats.pendientes),
      sub: "Requieren tu firma",
      icon: HE_KPI_ICONS.pendiente,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      valueClass: stats.pendientes > 0 ? "text-amber-700" : "",
    },
    {
      label: "Aprobación parcial",
      value: String(stats.aprobacion_parcial),
      sub: "Esperando otra firma",
      icon: HE_KPI_ICONS.parcial,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
      valueClass: stats.aprobacion_parcial > 0 ? "text-sky-700" : "",
    },
    {
      label: "Aprobadas",
      value: String(stats.aprobadas),
      sub: "Completamente autorizadas",
      icon: HE_KPI_ICONS.aprobada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald",
      valueClass: stats.aprobadas > 0 ? "text-emerald-700" : "",
    },
    {
      label: "Rechazadas",
      value: String(stats.rechazadas),
      sub: "Solicitudes rechazadas",
      icon: HE_KPI_ICONS.rechazada,
      iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      valueClass: stats.rechazadas > 0 ? "text-red-700" : "",
    },
  ];
}

function renderToast(state: HorasExtraAprobacionesPageState): string {
  if (!state.toast) return "";
  const tone = state.toast.tone === "ok" ? "bg-emerald-600" : "bg-red-600";
  return `<div class="fixed bottom-4 right-4 z-[70] rounded-lg ${tone} px-4 py-2 text-sm font-medium text-white shadow-lg">${escapeHtml(state.toast.message)}</div>`;
}

export function renderHorasExtraAprobacionesPage(state: HorasExtraAprobacionesPageState): string {
  const kpiState =
    state.estadisticasStatus === "loading"
      ? { status: "loading" as const }
      : state.estadisticasStatus === "error"
        ? { status: "error" as const, error: state.estadisticasError }
        : state.estadisticas
          ? { status: "ready" as const, cards: buildEstadisticasCards(state.estadisticas) }
          : { status: "ready" as const, cards: [] };

  return `
    <div id="he-aprob-page" class="${RH_DASHBOARD_PAGE_SHELL}">
      <header class="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Aprobación de Horas Extra</h1>
          <p class="mt-1 text-sm text-text-secondary">Revisa las solicitudes asignadas a tu rol antes de aprobar o rechazar.</p>
        </div>
        <button type="button" class="${RH_LISTADO_BTN_GHOST} shrink-0" data-he-aprob-refrescar>Actualizar</button>
      </header>

      <div class="mb-4">
        ${renderHorasExtraKpiCards(kpiState, {
          columnsClass: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
          ariaLabel: "Estadísticas de solicitudes asignadas",
        })}
      </div>

      <section class="${HE_TABLE_SECTION}" aria-label="Solicitudes asignadas">
        <div class="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 class="text-base font-semibold text-text-primary">Solicitudes asignadas</h2>
          <p class="text-xs text-text-secondary">Solo se muestran solicitudes donde estás designado como aprobador.</p>
        </div>
        <div id="he-aprob-content">
          ${renderHorasExtraAprobacionesTable({
            status: state.listaStatus,
            items: state.items,
            error: state.listaError,
          })}
        </div>
      </section>

      ${renderHorasExtraAprobacionDetalleModalSlot(state.detalleModal)}
      <div id="he-aprob-rechazo-modal">${state.rechazo ? renderHorasExtraAprobacionRechazoModal(state.rechazo) : ""}</div>
      <div id="he-aprob-toast">${renderToast(state)}</div>
    </div>`;
}
