import { BTN_PRIMARY, BTN_SECONDARY } from "../../../ui/uiTokens.ts";
import type { HorasExtraPageViewModel } from "../types.ts";

const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>`;

const ICON_IMPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`;

const ICON_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`;

const ICON_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;

export function renderHorasExtraPageHeader(vm: Pick<HorasExtraPageViewModel, "semanaLabel" | "selectedCount">): string {
  const approveLabel =
    vm.selectedCount > 0
      ? `Aprobar seleccionadas (${vm.selectedCount})`
      : "Aprobar seleccionadas";

  return `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
          <ol class="flex flex-wrap items-center gap-1">
            <li><span class="font-medium">Nóminas</span></li>
            <li class="text-slate-300" aria-hidden="true">/</li>
            <li class="font-semibold text-text-primary" aria-current="page">Horas Extra</li>
          </ol>
        </nav>
        <h1 class="mt-2 text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Gestión de horas extras</h1>
        <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Revisión y aprobación por centro de costo. La diferencia de caseta contrasta las horas reportadas contra el reloj checador de acceso.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="${BTN_SECONDARY} opacity-60 cursor-not-allowed" disabled aria-disabled="true">
          ${ICON_FILTER}
          ${vm.semanaLabel}
        </button>
        <button type="button" class="${BTN_SECONDARY} opacity-60 cursor-not-allowed" disabled aria-disabled="true">
          ${ICON_IMPORT}
          Importar datos
        </button>
        <button type="button" class="${BTN_SECONDARY} opacity-60 cursor-not-allowed" disabled aria-disabled="true">
          ${ICON_EXPORT}
          Exportar datos
        </button>
        <button type="button" class="${BTN_PRIMARY} opacity-60 cursor-not-allowed" disabled aria-disabled="true">
          ${ICON_CHECK}
          ${approveLabel}
        </button>
      </div>
    </header>`;
}
