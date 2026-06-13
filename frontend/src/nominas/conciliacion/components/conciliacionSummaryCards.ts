import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { ConciliacionSummaryAccent, ConciliacionSummaryCard } from "../types.ts";

const ACCENT_BORDER: Record<ConciliacionSummaryAccent, string> = {
  default: "border-t-slate-200",
  info: "border-t-blue-500",
  danger: "border-t-red-500",
  success: "border-t-emerald-500",
  warning: "border-t-amber-500",
};

const BADGE_TONE_CLASS = {
  danger: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

function renderBadge(card: ConciliacionSummaryCard): string {
  if (!card.badgeLabel) return "";
  const tone = card.badgeTone ?? "neutral";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${BADGE_TONE_CLASS[tone]}">${escapeHtml(card.badgeLabel)}</span>`;
}

export function renderConciliacionSummaryCards(cards: readonly ConciliacionSummaryCard[]): string {
  return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      ${cards
        .map((card) => {
          const accent = ACCENT_BORDER[card.accent ?? "default"];
          return `
        <article class="rounded-xl border border-border border-t-[3px] ${accent} bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">${escapeHtml(card.label)}</p>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <p class="text-2xl font-bold tabular-nums tracking-tight text-text-primary">${escapeHtml(card.value)}</p>
            ${renderBadge(card)}
          </div>
          <p class="mt-2 text-xs text-text-secondary">${escapeHtml(card.footer)}</p>
        </article>`;
        })
        .join("")}
    </div>`;
}
