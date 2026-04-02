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
      <div class="rounded-xl border border-dashed border-border bg-slate-50/80 p-6 text-center">
        <p class="text-sm font-medium text-text-muted">Sin evaluaciones registradas</p>
        <p class="mt-1 text-xs text-text-muted">Las competencias aparecerán cuando existan datos en el sistema.</p>
      </div>`;
  }
  return `<div class="space-y-4">${items.map((i) => vista360ProgressBarHtml(i.label, i.percent)).join("")}</div>`;
}
