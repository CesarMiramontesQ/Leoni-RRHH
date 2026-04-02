import type { TimelineItem } from "../../utils/vista360Domain.ts";
import { formatFechaHora } from "../../utils/vista360Domain.ts";
import { escapeHtml } from "./html.ts";

export function vista360TimelineHtml(items: TimelineItem[]): string {
  if (items.length === 0) {
    return `
      <div class="rounded-lg border border-dashed border-border bg-white py-8 text-center">
        <p class="text-sm text-text-muted">No hay actividades recientes que mostrar.</p>
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
