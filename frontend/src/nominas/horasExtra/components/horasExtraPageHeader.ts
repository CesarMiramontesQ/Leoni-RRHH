import { BTN_PRIMARY, BTN_SECONDARY } from "../../../ui/uiTokens.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

const ICON_IMPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`;

const ICON_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`;

const ICON_CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18 9 12l6-6" /></svg>`;

const ICON_CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 18 6-6-6-6" /></svg>`;

const HE_SEMANA_NAV_BTN = `${BTN_SECONDARY} inline-flex min-h-10 min-w-10 items-center justify-center px-2 py-2`;

export function renderHorasExtraPageHeader(
  vm: Pick<HorasExtraPageViewModel, "filtersStatus" | "semanaLabel">,
): string {
  const disabled = vm.filtersStatus === "loading";

  return `
    <header id="horas-extra-page-header" class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Gestión de horas extras</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex items-center gap-1" role="group" aria-label="Navegación por semana">
          <button
            type="button"
            data-he-semana-prev
            class="${HE_SEMANA_NAV_BTN}"
            aria-label="Semana anterior"
            ${disabled ? "disabled" : ""}
          >
            ${ICON_CHEVRON_LEFT}
          </button>
          <span class="${BTN_SECONDARY} inline-flex min-h-10 min-w-[9.5rem] items-center justify-center px-4 py-2 text-sm font-semibold tabular-nums">
            ${escapeHtml(vm.semanaLabel)}
          </span>
          <button
            type="button"
            data-he-semana-next
            class="${HE_SEMANA_NAV_BTN}"
            aria-label="Semana siguiente"
            ${disabled ? "disabled" : ""}
          >
            ${ICON_CHEVRON_RIGHT}
          </button>
        </div>
        <button type="button" class="${BTN_SECONDARY} opacity-60" disabled title="Próximamente">
          ${ICON_IMPORT}
          Importar datos
        </button>
        <button type="button" class="${BTN_PRIMARY} opacity-60" disabled title="Próximamente">
          ${ICON_EXPORT}
          Exportar datos
        </button>
      </div>
    </header>`;
}
