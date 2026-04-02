import { escapeHtml } from "./html.ts";

export type Vista360CardProps = {
  title: string;
  iconSvg?: string;
  bodyHtml: string;
};

export function vista360CardHtml(p: Vista360CardProps): string {
  const icon = p.iconSvg
    ? `<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-leoni-blue" aria-hidden="true">${p.iconSvg}</span>`
    : "";
  return `
    <article class="flex h-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm">
      <div class="mb-4 flex items-center gap-3">
        ${icon}
        <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(p.title)}</h3>
      </div>
      <div class="flex flex-1 flex-col gap-3 text-sm">${p.bodyHtml}</div>
    </article>`;
}

export function vista360FieldRow(label: string, value: string): string {
  return `
    <div>
      <p class="text-xs font-medium uppercase tracking-wide text-text-muted">${escapeHtml(label)}</p>
      <p class="mt-0.5 font-medium text-text-primary">${value}</p>
    </div>`;
}
