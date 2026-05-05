import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

function skel(): string {
  const skeleton = `
      <div class="rh-sol-kpi-skel animate-pulse rounded-[14px] border border-[rgba(148,163,184,0.2)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-4">
        <div class="flex items-center justify-between gap-2">
          <div class="h-3.5 w-24 rounded-md bg-slate-200/90"></div>
          <div class="h-9 w-16 rounded-md bg-slate-200/90"></div>
        </div>
        <div class="mt-3 h-8 w-20 rounded-md bg-slate-100/90"></div>
      </div>`;
  return `<section class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4" aria-busy="true">${skeleton.repeat(4)}</section>`;
}

type KpiDef = {
  title: string;
  subtitle: string;
  value: number;
  accent: "inc-abiertas" | "inc-investigacion" | "inc-resueltas" | "inc-criticas";
  icon: string;
};

/** KPIs con la misma estructura que Solicitudes (icono en cápsula, gradientes suaves). */
export function renderRhIncidenciasSummaryCards(vm: RhIncidenciasAdminViewModel): string {
  if (vm.resumenStatus === "loading" || vm.resumen === null) {
    return skel();
  }
  if (vm.resumenStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeIncHtml(INC_COPY.errorMetricas)}</div>`;
  }

  const r = vm.resumen;
  const cardsData: readonly KpiDef[] = [
    {
      title: INC_COPY.kpiAbiertas,
      subtitle: INC_COPY.kpiAbiertasMicro,
      value: r.abiertas,
      accent: "inc-abiertas",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    },
    {
      title: INC_COPY.kpiInvestigacion,
      subtitle: INC_COPY.kpiInvestigacionMicro,
      value: r.en_investigacion,
      accent: "inc-investigacion",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
    },
    {
      title: INC_COPY.kpiResueltas,
      subtitle: INC_COPY.kpiResueltasMicro,
      value: r.resueltas,
      accent: "inc-resueltas",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
    },
    {
      title: INC_COPY.kpiCriticas,
      subtitle: INC_COPY.kpiCriticasMicro,
      value: r.criticas,
      accent: "inc-criticas",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>`,
    },
  ];

  const cards = cardsData
    .map(
      (c) => `
    <article class="rh-sol-kpi-card rh-sol-kpi-card--${c.accent} rounded-[14px] border p-4 sm:p-5">
      <div class="flex items-center gap-3 sm:gap-3.5">
        <div class="rh-sol-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_12px_rgba(15,23,42,0.06)]" aria-hidden="true">${c.icon}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">${escapeIncHtml(c.title)}</p>
              <p class="mt-0.5 text-xs leading-snug text-[#64748b]">${escapeIncHtml(c.subtitle)}</p>
            </div>
            <p class="rh-sol-kpi-card__value shrink-0 text-2xl font-bold tabular-nums leading-none tracking-tight sm:text-3xl">${escapeIncHtml(String(c.value))}</p>
          </div>
        </div>
      </div>
    </article>`,
    )
    .join("");

  return `<section class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3 xl:grid-cols-4">${cards}</section>`;
}
