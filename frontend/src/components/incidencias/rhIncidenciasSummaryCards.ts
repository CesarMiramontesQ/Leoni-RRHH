import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

function skel(): string {
  const skeleton = Array.from({ length: 4 })
    .map(
      () => `
        <article class="animate-pulse rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <div class="h-4 w-28 rounded bg-slate-200"></div>
          <div class="mt-3 h-8 w-14 rounded bg-slate-200"></div>
          <div class="mt-3 h-3 w-24 rounded bg-slate-100"></div>
        </article>`,
    )
    .join("");
  return `<section class="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy="true">${skeleton}</section>`;
}

type KpiCard = {
  title: string;
  micro: string;
  value: number;
  toneClass: string;
  borderTopColor: string;
  icon: string;
};

/** Cuatro tarjetas KPI con el mismo patrón visual que Actas. */
export function renderRhIncidenciasSummaryCards(vm: RhIncidenciasAdminViewModel): string {
  if (vm.resumenStatus === "loading" || vm.resumen === null) {
    return skel();
  }
  if (vm.resumenStatus === "error") {
    return `<div class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">${escapeIncHtml(INC_COPY.errorMetricas)}</div>`;
  }

  const r = vm.resumen;
  const cardsData: readonly KpiCard[] = [
    {
      title: INC_COPY.kpiAbiertas,
      micro: INC_COPY.kpiAbiertasMicro,
      value: r.abiertas,
      toneClass: "border-blue-200 bg-blue-50/50 text-blue-900",
      borderTopColor: "border-t-blue-500",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 3.5v6.5l3.5 2.1M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>`,
    },
    {
      title: INC_COPY.kpiInvestigacion,
      micro: INC_COPY.kpiInvestigacionMicro,
      value: r.en_investigacion,
      toneClass: "border-amber-200 bg-amber-50/50 text-amber-900",
      borderTopColor: "border-t-amber-500",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 3.5v3m0 7v3m6.5-6.5h-3m-7 0h-3m10.95 4.95-2.12-2.12m-4.66-4.66L5.05 5.05m9.9 0-2.12 2.12m-4.66 4.66-2.12 2.12" /></svg>`,
    },
    {
      title: INC_COPY.kpiResueltas,
      micro: INC_COPY.kpiResueltasMicro,
      value: r.resueltas,
      toneClass: "border-emerald-200 bg-emerald-50/50 text-emerald-900",
      borderTopColor: "border-t-emerald-500",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 10 3.2 3.2 7.8-7.8" /></svg>`,
    },
    {
      title: INC_COPY.kpiCriticas,
      micro: INC_COPY.kpiCriticasMicro,
      value: r.criticas,
      toneClass: "border-red-200 bg-red-50/50 text-red-900",
      borderTopColor: "border-t-red-500",
      icon: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M10 3.5 3 16.5h14L10 3.5Zm0 9v2.5M10 14h.01" /></svg>`,
    },
  ];

  const cards = cardsData
    .map(
      (card) => `
      <article>
        <div
          class="h-full w-full rounded-2xl border border-[#e5e7eb] border-t-4 ${card.borderTopColor} bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-[#667085]">${escapeIncHtml(card.title)}</p>
              <p class="mt-2 text-3xl font-semibold leading-none tabular-nums text-[#111827]">${escapeIncHtml(String(card.value))}</p>
              <p class="mt-2 text-xs text-[#667085]">${escapeIncHtml(card.micro)}</p>
            </div>
            <span class="inline-flex size-9 items-center justify-center rounded-xl ${card.toneClass}">
              ${card.icon}
            </span>
          </div>
        </div>
      </article>`,
    )
    .join("");

  return `<section class="grid grid-cols-2 gap-3 xl:grid-cols-4">${cards}</section>`;
}
