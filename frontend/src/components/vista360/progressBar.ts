import { escapeHtml } from "./html.ts";

export type CompetenciaItem = { label: string; percent: number };

export function vista360ProgressBarHtml(label: string, percent: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return `
    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-text-primary">${escapeHtml(label)}</span>
        <span class="text-sm font-semibold text-leoni-blue">${clamped}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow="${clamped}" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full bg-leoni-blue transition-all" style="width:${clamped}%"></div>
      </div>
    </div>`;
}

export function vista360CompetenciasCardHtml(items: CompetenciaItem[]): string {
  if (items.length === 0) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/70 px-4 py-8 text-center">
        <div class="mx-auto flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-5"><path fill-rule="evenodd" d="M10 2a.75.75 0 0 1 .75.75v.518a7.251 7.251 0 0 1 5.982 5.982h.518a.75.75 0 0 1 0 1.5h-.518a7.251 7.251 0 0 1-5.982 5.982v.518a.75.75 0 0 1-1.5 0v-.518a7.251 7.251 0 0 1-5.982-5.982H2.75a.75.75 0 0 1 0-1.5h.518a7.251 7.251 0 0 1 5.982-5.982V2.75A.75.75 0 0 1 10 2Zm0 3a5.75 5.75 0 1 0 0 11.5A5.75 5.75 0 0 0 10 5Z" clip-rule="evenodd" /></svg>
        </div>
        <p class="mt-3 text-sm font-semibold text-text-primary">Sin evaluaciones registradas</p>
        <p class="mt-1.5 text-xs text-text-muted">Las competencias aparecerán cuando existan datos en el sistema.</p>
      </div>`;
  }
  return `<div class="space-y-4">${items.map((i) => vista360ProgressBarHtml(i.label, i.percent)).join("")}</div>`;
}
