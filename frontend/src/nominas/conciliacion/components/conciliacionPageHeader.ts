import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY } from "../../../ui/uiTokens.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import type { ConciliacionPageViewModel } from "../types.ts";

const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>`;

const ICON_EXCEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 7.5 12 3m0 0 4.5 4.5M12 3v13.5" /></svg>`;

const ICON_PDF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>`;

const ICON_WAND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>`;

function periodoEstadoBadge(vm: ConciliacionPageViewModel): string {
  if (vm.periodoEstado === "conciliado") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${escapeHtml(vm.periodoEstadoLabel)}</span>`;
  }
  if (vm.periodoEstado === "pendiente") {
    return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true"></span>${escapeHtml(vm.periodoEstadoLabel)}</span>`;
  }
  return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${escapeHtml(vm.periodoEstadoLabel)}</span>`;
}

export function renderConciliacionPageHeader(vm: ConciliacionPageViewModel): string {
  return `
    <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <nav class="text-xs text-text-muted" aria-label="Breadcrumb">
          <ol class="flex flex-wrap items-center gap-1">
            <li><span class="font-medium">Nóminas</span></li>
            <li class="text-slate-300" aria-hidden="true">/</li>
            <li class="font-semibold text-text-primary" aria-current="page">Conciliación</li>
          </ol>
        </nav>
        <p class="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          Conciliación financiera · Cierre mensual
        </p>
        <div class="mt-1 flex flex-wrap items-center gap-2.5">
          <h1 class="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">Conciliación de Nómina</h1>
          ${periodoEstadoBadge(vm)}
        </div>
        <p class="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          Contraste acumulado entre nómina, TRESS y contabilidad por concepto. Identifica diferencias críticas antes del cierre del periodo.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" data-conciliacion-action="refresh" class="${BTN_GHOST} px-2.5" aria-label="Actualizar conciliación">
          ${ICON_REFRESH}
        </button>
        <button type="button" data-conciliacion-action="export-excel" class="${BTN_SECONDARY}">
          ${ICON_EXCEL}
          Excel
        </button>
        <button type="button" data-conciliacion-action="export-pdf" class="${BTN_SECONDARY}">
          ${ICON_PDF}
          PDF
        </button>
        <button type="button" data-conciliacion-action="conciliar-periodo" class="${BTN_PRIMARY}">
          ${ICON_WAND}
          Conciliar periodo
        </button>
      </div>
    </header>`;
}
