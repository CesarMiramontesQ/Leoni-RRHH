import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { HorasExtraSummaryCard, HorasExtraSummaryDeltaTone } from "../types.ts";

const DELTA_TONE_CLASS: Record<HorasExtraSummaryDeltaTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
};

function renderDeltaPill(card: HorasExtraSummaryCard): string {
  if (!card.deltaLabel) return "";
  const tone = card.deltaTone ?? "neutral";
  const cls = DELTA_TONE_CLASS[tone];
  const warnIcon =
    tone === "warning"
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-3 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>`
      : "";
  return `<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}">${warnIcon}${escapeHtml(card.deltaLabel)}</span>`;
}

export function renderHorasExtraSummaryCards(cards: readonly HorasExtraSummaryCard[]): string {
  return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
        <article class="rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">${escapeHtml(card.label)}</p>
          <p class="mt-2 text-2xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(card.value)}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            ${renderDeltaPill(card)}
            <span class="text-xs text-text-secondary">${escapeHtml(card.footer)}</span>
          </div>
        </article>`,
        )
        .join("")}
    </div>`;
}
