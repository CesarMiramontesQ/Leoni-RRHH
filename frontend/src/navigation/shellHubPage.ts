import { RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const HUB_CARD =
  "group flex aspect-square flex-col items-center justify-center gap-3 rounded-lg border border-border bg-white p-4 text-center outline-none transition-[border-color,background-color,box-shadow] duration-150 hover:border-accent hover:bg-accent-light/40 focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2";

const HUB_CARD_ICON =
  "size-8 shrink-0 text-text-muted transition-colors duration-150 group-hover:text-accent";

export type ShellHubAccessItem = {
  href: string;
  label: string;
  svgPaths: string;
};

export type ShellHubCategory = {
  id: string;
  title: string;
  items: readonly ShellHubAccessItem[];
};

export type ShellHubPageOptions = {
  eyebrow: string;
  title: string;
  description: string;
  categories: readonly ShellHubCategory[];
  emptyTitle: string;
  emptyMessage: string;
  sectionPrefix: string;
};

export function renderShellHubPage(options: ShellHubPageOptions): string {
  if (options.categories.length === 0) {
    return `
      <div class="${RH_LISTADO_SURFACE} mx-auto max-w-lg p-8 text-center">
        <h1 class="text-lg font-semibold text-text-primary">${escapeHtml(options.emptyTitle)}</h1>
        <p class="mt-2 text-sm text-text-muted">${escapeHtml(options.emptyMessage)}</p>
      </div>`;
  }

  const sections = options.categories
    .map((category) => {
      const cards = category.items
        .map(
          (item) => `
          <a href="${item.href}" class="${HUB_CARD}" title="${escapeHtml(item.label)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${HUB_CARD_ICON}">
              ${item.svgPaths}
            </svg>
            <span class="text-sm font-semibold leading-snug text-text-primary">${escapeHtml(item.label)}</span>
          </a>`,
        )
        .join("");

      return `
        <section aria-labelledby="${options.sectionPrefix}-section-${category.id}" class="flex flex-col gap-4">
          <h2 id="${options.sectionPrefix}-section-${category.id}" class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            ${escapeHtml(category.title)}
          </h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            ${cards}
          </div>
        </section>`;
    })
    .join("");

  return `
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header class="flex flex-col gap-1">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(options.eyebrow)}</p>
        <h1 class="text-xl font-bold text-text-primary">${escapeHtml(options.title)}</h1>
        <p class="max-w-2xl text-sm text-text-muted">${escapeHtml(options.description)}</p>
      </header>
      ${sections}
    </div>`;
}
