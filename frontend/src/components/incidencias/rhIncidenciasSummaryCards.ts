import { INC_COPY } from "../../incidencias/rh/incidenciasCopy.ts";
import type { RhIncidenciasAdminViewModel } from "../../incidencias/rh/types.ts";
import { escapeIncHtml } from "./rhIncidenciasUiUtils.ts";

function skel(): string {
  const cell = `
    <div class="animate-pulse rounded-xl border border-border bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div class="h-4 w-32 rounded bg-slate-200"></div>
        <div class="h-9 w-14 rounded bg-slate-200"></div>
      </div>
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
    critical?: boolean;
  }[] = [
    {
      title: INC_COPY.kpiAbiertas,
      value: r.abiertas,
      borderTop: "border-t-blue-600",
    },
    {
      title: INC_COPY.kpiInvestigacion,
      value: r.en_investigacion,
      borderTop: "border-t-amber-500",
    },
    {
      title: INC_COPY.kpiResueltas,
      value: r.resueltas,
      borderTop: "border-t-emerald-500",
    },
    {
      title: INC_COPY.kpiCriticas,
      value: r.criticas,
      borderTop: "border-t-red-500",
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
      <div class="flex items-center justify-between gap-3">
        <h2 class="min-w-0 text-sm font-medium text-text-muted">${escapeIncHtml(c.title)}</h2>
        <p class="${valCls} shrink-0">${escapeIncHtml(String(c.value))}</p>
      </div>
    </article>`;
    })
    .join("");

  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">${html}</div>`;
}
