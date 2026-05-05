import type { TimelineItem } from "../../utils/vista360Domain.ts";
import { formatFechaHora } from "../../utils/vista360Domain.ts";
import { escapeHtml } from "./html.ts";

export function vista360TimelineHtml(items: TimelineItem[]): string {
  if (items.length === 0) {
    return `
      <div class="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/70 px-4 py-10 text-center">
        <div class="mx-auto flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm" aria-hidden="true">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-5"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-12a1 1 0 1 0-2 0v4a1 1 0 0 0 .293.707l2.828 2.829a1 1 0 1 0 1.415-1.415L11 9.586V6Z" clip-rule="evenodd" /></svg>
        </div>
        <p class="mt-3 text-sm font-semibold text-text-primary">Sin actividades recientes</p>
        <p class="mt-1.5 text-xs text-text-muted">Cuando existan movimientos aparecerán en esta línea de tiempo.</p>
      </div>`;
  }

  const rows = items
    .map((it, idx) => {
      const active = idx === 0;
      const dotCls = active
        ? "border-leoni-blue bg-leoni-blue"
        : "border-slate-200 bg-slate-200";
      const lineCls = idx < items.length - 1 ? "min-h-[2.5rem] border-l border-slate-200" : "";
      return `
        <li class="relative flex gap-4 pb-1">
          <div class="flex flex-col items-center">
            <span class="z-10 mt-1.5 size-3 shrink-0 rounded-full border-2 ${dotCls}" aria-hidden="true"></span>
            <div class="flex-1 ${lineCls} ml-[5px] w-px"></div>
          </div>
          <div class="min-w-0 flex-1 pb-4">
            <p class="text-sm font-medium text-text-primary">${escapeHtml(it.title)}</p>
            <p class="mt-0.5 text-xs text-text-muted">${escapeHtml(it.subtitle)}</p>
            <p class="mt-1 text-xs text-text-muted">${escapeHtml(formatFechaHora(it.atIso))}</p>
          </div>
        </li>`;
    })
    .join("");

  return `<ul class="list-none space-y-0 p-0 m-0">${rows}</ul>`;
}
