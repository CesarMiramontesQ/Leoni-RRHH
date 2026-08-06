import { escapeHtml } from "./html.ts";
import type { EmpleadoIncidenciasMetricas } from "../../utils/incidenciaMetricas.ts";

type MetricCardDef = {
  id: string;
  title: string;
  iconShell: string;
};

const INCIDENCIA_CARDS: MetricCardDef[] = [
  {
    id: "total",
    title: "Total de incidencias",
    iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
  },
  {
    id: "retardos",
    title: "Total de retardos",
    iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
  },
  {
    id: "faltas",
    title: "Total de faltas justificadas",
    iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
  },
];

const VACACIONES_CARD: MetricCardDef = {
  id: "vacaciones",
  title: "Saldo de vacaciones",
  iconShell: "rh-dash-kpi-icon rh-dash-kpi-icon--emerald",
};

const iconAlert = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
</svg>`;

const iconClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg>`;

const iconCalendar = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
</svg>`;

const iconVacaciones = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  <path stroke-linecap="round" stroke-linejoin="round" d="m16.5 9.75-4.5 4.5m0-4.5 4.5 4.5" />
</svg>`;

function iconFor(id: string): string {
  if (id === "retardos") return iconClock;
  if (id === "faltas") return iconCalendar;
  if (id === "vacaciones") return iconVacaciones;
  return iconAlert;
}

function valueForIncidencia(id: string, m: EmpleadoIncidenciasMetricas): number {
  if (id === "retardos") return m.retardos;
  if (id === "faltas") return m.faltasJustificadas;
  return m.total;
}

function renderIncidenciaMetricCard(def: MetricCardDef, value: number): string {
  return `
    <article class="rh-dash-kpi-card flex h-full flex-col rounded-[18px] p-5" data-v360-estadistica="${def.id}">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-medium text-text-muted">${escapeHtml(def.title)}</h2>
        <div class="flex shrink-0 rounded-[14px] p-2 ${def.iconShell}" aria-hidden="true">
          ${iconFor(def.id)}
        </div>
      </div>
      <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(String(value))}</p>
    </article>`;
}

function renderVacacionesCard(saldoVacacionesReal: number | null): string {
  const def = VACACIONES_CARD;
  const disponible = saldoVacacionesReal !== null;
  const valor = disponible ? String(saldoVacacionesReal) : "—";
  const nota = disponible
    ? "Días de gozo disponibles (saldo de nómina sincronizado)."
    : "Saldo no disponible.";
  return `
    <article class="rh-dash-kpi-card flex h-full flex-col rounded-[18px] p-5" data-v360-estadistica="${def.id}">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-medium text-text-muted">${escapeHtml(def.title)}</h2>
        <div class="flex shrink-0 rounded-[14px] p-2 ${def.iconShell}" aria-hidden="true">
          ${iconFor(def.id)}
        </div>
      </div>
      <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-leoni-blue">${escapeHtml(valor)}</p>
      <p class="mt-2 text-xs leading-relaxed text-text-muted">${escapeHtml(nota)}</p>
    </article>`;
}

function estadisticasGridClass(cardCount: number): string {
  if (cardCount <= 1) return "grid grid-cols-1 gap-4 sm:max-w-sm";
  if (cardCount === 2) return "grid grid-cols-1 gap-4 sm:grid-cols-2";
  if (cardCount === 3) return "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";
  return "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
}

function skeletonCell(): string {
  return `
    <div class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="flex justify-between gap-3">
        <div class="h-4 w-40 max-w-[70%] rounded bg-slate-200"></div>
        <div class="size-10 rounded-xl bg-slate-200"></div>
      </div>
      <div class="mt-4 h-9 w-16 rounded bg-slate-200"></div>
    </div>`;
}

/** @deprecated Usar `vista360EstadisticasSkeletonHtml`. */
export function vista360IncidenciasMetricasSkeletonHtml(): string {
  return vista360EstadisticasSkeletonHtml(true);
}

export function vista360EstadisticasSkeletonHtml(includeIncidencias: boolean): string {
  const count = includeIncidencias ? 4 : 1;
  return `
    <div class="${estadisticasGridClass(count)}" aria-busy="true" aria-label="Cargando estadísticas del empleado">
      ${skeletonCell().repeat(count)}
    </div>`;
}

/** @deprecated Usar `vista360EstadisticasCardsHtml`. */
export function vista360IncidenciasMetricasCardsHtml(metricas: EmpleadoIncidenciasMetricas): string {
  return vista360EstadisticasCardsHtml(metricas, 0);
}

export function vista360EstadisticasCardsHtml(
  metricas: EmpleadoIncidenciasMetricas | null,
  saldoVacacionesReal: number | null,
): string {
  const incidenciaCards = metricas
    ? INCIDENCIA_CARDS.map((def) => renderIncidenciaMetricCard(def, valueForIncidencia(def.id, metricas))).join("")
    : "";
  const vacacionesCard = renderVacacionesCard(saldoVacacionesReal);
  const cardCount = (metricas ? INCIDENCIA_CARDS.length : 0) + 1;
  return `
    <div class="${estadisticasGridClass(cardCount)}" aria-label="Estadísticas del empleado">
      ${incidenciaCards}${vacacionesCard}
    </div>`;
}
