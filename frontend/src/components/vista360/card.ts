import { escapeHtml } from "./html.ts";

export type Vista360CardIconTone = "blue" | "emerald" | "indigo" | "sky";

const ICON_TONE: Record<Vista360CardIconTone, string> = {
  blue: "bg-blue-50 text-leoni-blue",
  emerald: "bg-emerald-50 text-emerald-700",
  indigo: "bg-indigo-50 text-indigo-800",
  sky: "bg-sky-50 text-sky-900",
};

export type Vista360CardProps = {
  title: string;
  iconSvg?: string;
  iconTone?: Vista360CardIconTone;
  bodyHtml: string;
};

export function vista360CardHtml(p: Vista360CardProps): string {
  const tone = p.iconTone ?? "blue";
  const wrap = ICON_TONE[tone];
  const icon = p.iconSvg
    ? `<span class="flex size-10 shrink-0 items-center justify-center rounded-xl ${wrap}" aria-hidden="true">${p.iconSvg}</span>`
    : "";
  return `
    <article class="flex h-full min-h-[10.5rem] flex-col rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
      <div class="mb-3 flex min-h-[2.5rem] items-center gap-3">
        ${icon}
        <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(p.title)}</h3>
      </div>
      <div class="flex flex-1 flex-col gap-3 text-sm">${p.bodyHtml}</div>
    </article>`;
}

export function vista360FieldRowText(label: string, value: string | null | undefined): string {
  const t = value?.trim();
  const inner =
    t && t !== "—"
      ? escapeHtml(t)
      : `<span class="font-semibold text-text-muted">No disponible</span>`;
  return vista360FieldRowHtml(label, inner);
}

export function vista360FieldRowHtml(label: string, valueInnerHtml: string): string {
  return `
    <div class="min-h-[2.625rem]">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500/90">${escapeHtml(label)}</p>
      <p class="mt-1 text-[15px] font-semibold leading-snug text-text-primary">${valueInnerHtml}</p>
    </div>`;
}
