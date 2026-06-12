import { BTN_PRIMARY, BTN_SECONDARY, FIELD_FOCUS, RH_LISTADO_FOCUS_RING, SELECT_CHEVRON } from "../../../ui/uiTokens.ts";
import type { HorasExtraPageViewModel } from "../types.ts";
import { semanasPermitidasParaFiltro } from "../semanaFilterHelpers.ts";

const ICON_IMPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>`;

const ICON_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`;

const HE_SEMANA_SELECT = `${BTN_SECONDARY} min-h-10 appearance-none py-2 pl-9 pr-9`;

function renderSemanaOptions(semanaActual: number, selected: string): string {
  const semanas = semanasPermitidasParaFiltro(semanaActual);
  const opts = semanas
    .map((n) => `<option value="${n}"${selected === String(n) ? " selected" : ""}>Semana ${n}</option>`)
    .join("");
  return `<option value=""${selected === "" ? " selected" : ""}>Todas las semanas</option>${opts}`;
}

export function renderHorasExtraPageHeader(
  vm: Pick<HorasExtraPageViewModel, "filters" | "semanaActual" | "filtersStatus">,
): string {
  const disabled = vm.filtersStatus === "loading";
  const semanaOptions = renderSemanaOptions(vm.semanaActual, vm.filters.semana);

  return `
    <header id="horas-extra-page-header" class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Gestión de horas extras</h1>
        <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Solicitudes de horas extra registradas por los líderes autorizados, con su estado de aprobación por centro de costo.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative grid grid-cols-1">
          <select
            id="he-filter-semana"
            name="semana"
            data-he-filter="semana"
            class="${HE_SEMANA_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
            aria-label="Filtrar por semana"
            ${disabled ? "disabled" : ""}
          >
            ${semanaOptions}
          </select>
          ${SELECT_CHEVRON}
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
