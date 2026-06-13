import { escapeHtml } from "../../ui/uiUtils.ts";

export type HorasExtraKpiCard = {
  label: string;
  value: string;
  sub: string;
  icon: string;
  iconWrap: string;
  valueClass?: string;
};

export type HorasExtraKpiCardsState = {
  status: "loading" | "ready" | "error";
  cards?: HorasExtraKpiCard[];
  error?: string;
};

const ICON_HE_KPI_SOLICITUDES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke-linecap="round"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`;
const ICON_HE_KPI_PENDIENTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_HE_KPI_APROBADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m9 12 2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9"/></svg>`;
const ICON_HE_KPI_PARCIAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round"/></svg>`;
const ICON_HE_KPI_RECHAZADA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="m15 9-6 6m0-6 6 6" stroke-linecap="round"/><circle cx="12" cy="12" r="9"/></svg>`;
const ICON_HE_KPI_HORAS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 6v6l4 2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9"/></svg>`;

export const HE_KPI_ICONS = {
  solicitudes: ICON_HE_KPI_SOLICITUDES,
  pendiente: ICON_HE_KPI_PENDIENTE,
  aprobada: ICON_HE_KPI_APROBADA,
  parcial: ICON_HE_KPI_PARCIAL,
  rechazada: ICON_HE_KPI_RECHAZADA,
  horas: ICON_HE_KPI_HORAS,
} as const;

function renderSkeleton(columnsClass: string): string {
  return `
    <div class="grid grid-cols-1 gap-3 ${columnsClass}" aria-busy="true" aria-label="Cargando estadísticas">
      ${Array.from({ length: 5 })
        .map(
          () => `
        <article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
          <div class="h-4 w-28 rounded bg-slate-200"></div>
          <div class="mt-4 h-8 w-16 rounded bg-slate-200"></div>
          <div class="mt-2 h-3 w-36 rounded bg-slate-100"></div>
        </article>`,
        )
        .join("")}
    </div>`;
}

export function renderHorasExtraKpiCards(
  state: HorasExtraKpiCardsState,
  options: { columnsClass?: string; ariaLabel?: string } = {},
): string {
  const columnsClass = options.columnsClass ?? "sm:grid-cols-2 xl:grid-cols-4";
  const ariaLabel = options.ariaLabel ?? "Estadísticas de horas extra";

  if (state.status === "loading") {
    return renderSkeleton(columnsClass);
  }
  if (state.status === "error") {
    return `
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        ${escapeHtml(state.error ?? "No se pudieron cargar las estadísticas.")}
      </div>`;
  }
  const cards = state.cards ?? [];
  if (!cards.length) return "";

  return `
    <section class="grid grid-cols-1 gap-3 ${columnsClass}" role="group" aria-label="${escapeHtml(ariaLabel)}">
      ${cards
        .map(
          (card) => `
        <article class="rh-dash-kpi-card rounded-[18px] p-5">
          <div class="flex items-start justify-between gap-3">
            <p class="text-xs font-semibold text-text-muted">${escapeHtml(card.label)}</p>
            <span class="${card.iconWrap} size-11 shrink-0 [&_svg]:size-5">${card.icon}</span>
          </div>
          <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary ${card.valueClass ?? ""}">${escapeHtml(card.value)}</p>
          <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(card.sub)}</p>
        </article>`,
        )
        .join("")}
    </section>`;
}
