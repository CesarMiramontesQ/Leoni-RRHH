import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

function skel(): string {
  const cell = `
    <div class="animate-pulse rounded-xl border border-border bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="h-4 w-32 rounded bg-slate-200"></div>
        <div class="size-9 rounded-lg bg-slate-100"></div>
      </div>
      <div class="mt-4 h-9 w-14 rounded bg-slate-200"></div>
    </div>`;
  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${cell.repeat(4)}</div>`;
}

/** Cuatro tarjetas KPI (resumen global). */
export function renderRhIncidenciasSummaryCards(vm: RhIncidenciasAdminViewModel): string {
  if (vm.resumenStatus === "loading" || vm.resumen === null) {
    return skel();
  }
  if (vm.resumenStatus === "error") {
    return `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">${escapeIncHtml(INC_COPY.errorMetricas)}</div>`;
  }

  const r = vm.resumen;
  const cards: {
    title: string;
    value: number;
    borderTop: string;
    iconWrap: string;
    svg: string;
    critical?: boolean;
  }[] = [
    {
      title: INC_COPY.kpiAbiertas,
      value: r.abiertas,
      borderTop: "border-t-blue-600",
      iconWrap: "bg-blue-50 text-blue-600",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/></svg>`,
    },
    {
      title: INC_COPY.kpiInvestigacion,
      value: r.en_investigacion,
      borderTop: "border-t-amber-500",
      iconWrap: "bg-amber-50 text-amber-600",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>`,
    },
    {
      title: INC_COPY.kpiResueltas,
      value: r.resueltas,
      borderTop: "border-t-emerald-500",
      iconWrap: "bg-emerald-50 text-emerald-600",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>`,
    },
    {
      title: INC_COPY.kpiCriticas,
      value: r.criticas,
      borderTop: "border-t-red-500",
      iconWrap: "bg-red-50 text-red-600",
      svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/></svg>`,
      critical: true,
    },
  ];

  const html = cards
    .map((c) => {
      const cardCls = c.critical
        ? `rounded-xl border border-red-200/90 border-t-4 ${c.borderTop} bg-white p-5 shadow-sm ring-1 ring-red-100/80`
        : `rounded-xl border border-border border-t-4 ${c.borderTop} bg-white p-5 shadow-sm`;
      const valCls = c.critical ? "text-3xl font-bold tabular-nums tracking-tight text-red-600" : "text-3xl font-bold tabular-nums tracking-tight text-text-primary";
      return `
    <article class="${cardCls}">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-medium text-text-muted">${escapeIncHtml(c.title)}</h2>
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg ${c.iconWrap}" aria-hidden="true">${c.svg}</span>
      </div>
      <p class="${valCls} mt-3">${escapeIncHtml(String(c.value))}</p>
    </article>`;
    })
    .join("");

  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${html}</div>`;
}
