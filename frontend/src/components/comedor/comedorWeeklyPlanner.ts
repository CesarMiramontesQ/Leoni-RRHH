import type { ComedorPanelState, ComedorWeekPlanner, ComedorWeekPlannerDayKey } from "../../comedor/rh/types.ts";
import { isWeekendPlannerDay } from "../../comedor/rh/weekPlannerDays.ts";
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, RH_LISTADO_SURFACE } from "../../ui/uiTokens.ts";
import { renderMenuPreviewDetalleSections } from "./comedorMenuPreview.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

export type ComedorWeeklyPlannerViewState = {
  panelState: ComedorPanelState;
  errorMessage: string | null;
  week: ComedorWeekPlanner;
  weekPickerValue: string;
  selectedDayKey: ComedorWeekPlannerDayKey;
  incompleteDaysCount: number;
  isSavingDraft: boolean;
  isPublishing: boolean;
  isDuplicating: boolean;
  lastSavedAtLabel: string | null;
};

// ── Iconos SVG inline ────────────────────────────────────────────────────────

const ICON_CHEVRON_LEFT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>`;
const ICON_CHEVRON_RIGHT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>`;
const ICON_UPLOAD = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z"/><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"/></svg>`;
const ICON_CHECK_CIRCLE = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd"/></svg>`;
const ICON_WARNING = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/></svg>`;
const ICON_MENU_LINES = `<svg viewBox="0 0 24 24" fill="none" class="size-6" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>`;
const ICON_SPINNER = `<svg class="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>`;

// ── Badge de estado ──────────────────────────────────────────────────────────

function statusBadge(status: ComedorWeekPlanner["status"]): string {
  if (status === "publicado") {
    return '<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><span class="size-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>Publicado</span>';
  }
  return '<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"><span class="size-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>Borrador</span>';
}

function weekHasRegisteredMenu(panelState: ComedorPanelState): boolean {
  return panelState === "ready";
}

// ── Selector de día con indicadores de contenido ─────────────────────────────

function renderPreviewDaySelector(week: ComedorWeekPlanner, selectedDayKey: ComedorWeekPlannerDayKey): string {
  return `
    <div
      class="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1"
      role="tablist"
      aria-label="Seleccionar día para vista previa"
    >
      ${week.dias
        .map((day) => {
          const active = day.key === selectedDayKey;
          const hasContent = Boolean(day.menuNormal.trim());
          return `
        <button
          type="button"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
          data-comedor-plan-preview-day="${day.key}"
          class="relative flex min-w-[3.5rem] flex-1 flex-col items-center rounded-lg px-2 py-2 text-center transition-all duration-150 sm:min-w-0 ${
            active
              ? "bg-white text-leoni-blue shadow-sm"
              : "bg-transparent text-slate-500 hover:bg-white/70 hover:text-slate-700"
          }"
        >
          <span class="text-xs font-semibold leading-tight">${escapeComedorHtml(day.label)}</span>
          <span class="mt-0.5 text-[10px] ${active ? "text-leoni-blue/70" : "text-slate-400"}">${escapeComedorHtml(day.fechaCorta)}</span>
          <span class="mt-1.5 size-1.5 rounded-full ${hasContent ? "bg-emerald-400" : "bg-slate-300"}" aria-hidden="true" title="${hasContent ? "Con menú" : "Sin menú"}"></span>
        </button>`;
        })
        .join("")}
    </div>`;
}

// ── Estado vacío del preview ─────────────────────────────────────────────────

function renderPreviewEmptyState(): string {
  return `
    <div class="flex flex-col items-center justify-center px-4 py-14 text-center" role="status">
      <div class="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400" aria-hidden="true">
        ${ICON_MENU_LINES}
      </div>
      <h3 class="mt-4 text-sm font-semibold text-[#0A1628]">Sin menú para esta semana</h3>
      <p class="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">
        Usa <strong>Nueva planeación</strong> para cargar la plantilla Excel y visualizar el menú aquí.
      </p>
    </div>`;
}

function renderPreview(week: ComedorWeekPlanner, selectedDayKey: ComedorWeekPlannerDayKey): string {
  const selected = week.dias.find((day) => day.key === selectedDayKey) ?? week.dias[0]!;
  return renderMenuPreviewDetalleSections(selected.menuNormal, selected.menuDieta, selected.detalle, {
    includeOpcionB: !isWeekendPlannerDay(selected.key),
  });
}

// ── Panel de vista previa ────────────────────────────────────────────────────

function renderPreviewPanel(state: ComedorWeeklyPlannerViewState): string {
  const hasMenu = weekHasRegisteredMenu(state.panelState);
  return `
    <section id="comedor-plan-preview-panel" class="${RH_LISTADO_SURFACE} flex flex-col p-5 sm:p-6">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 class="text-base font-semibold text-[#0A1628]">Vista previa del menú</h2>
          <p class="mt-0.5 text-xs text-slate-500">${hasMenu ? "Menú como lo verá el empleado, por día." : "Carga una planeación para previsualizar el menú."}</p>
        </div>
      </div>
      ${
        hasMenu
          ? `<div>
               ${renderPreviewDaySelector(state.week, state.selectedDayKey)}
               ${renderPreview(state.week, state.selectedDayKey)}
             </div>`
          : `<div class="border-t border-slate-100 pt-2">${renderPreviewEmptyState()}</div>`
      }
    </section>`;
}

// ── Panel de acciones / publicación ─────────────────────────────────────────

function renderActionsPanel(state: ComedorWeeklyPlannerViewState): string {
  const allComplete = state.incompleteDaysCount === 0;
  return `
    <aside>
      <div class="${RH_LISTADO_SURFACE} p-5">
        <h2 class="text-sm font-semibold text-[#0A1628]">Publicación</h2>
        <p class="mt-1 text-xs text-slate-500">Revisa que todos los días tengan contenido antes de publicar.</p>

        <div class="mt-4 rounded-lg border px-3 py-3 ${
          allComplete
            ? "border-emerald-200/80 bg-emerald-50/60"
            : "border-amber-200/80 bg-amber-50/60"
        }">
          <div class="flex items-center gap-2">
            <span class="${allComplete ? "text-emerald-500" : "text-amber-500"}">
              ${allComplete ? ICON_CHECK_CIRCLE : ICON_WARNING}
            </span>
            <p class="text-xs font-semibold ${allComplete ? "text-emerald-800" : "text-amber-900"}">
              ${allComplete ? "Semana completa" : `${state.incompleteDaysCount} día(s) incompletos`}
            </p>
          </div>
          <p class="mt-1 text-[11px] ${allComplete ? "text-emerald-700/80" : "text-amber-800/80"}">
            ${allComplete ? "Lista para publicar." : "Algunos días no tienen menú registrado."}
          </p>
        </div>

        ${
          state.lastSavedAtLabel
            ? `<p class="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <svg viewBox="0 0 16 16" fill="currentColor" class="size-3.5 shrink-0" aria-hidden="true"><path fill-rule="evenodd" d="M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8Zm7.75-4.25a.75.75 0 0 0-1.5 0V8c0 .414.336.75.75.75h3.25a.75.75 0 0 0 0-1.5h-2.5v-3.5Z" clip-rule="evenodd"/></svg>
                Guardado hace ${escapeComedorHtml(state.lastSavedAtLabel)}
               </p>`
            : ""
        }

        <div class="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            data-comedor-plan-publish
            class="${BTN_PRIMARY} min-h-10 justify-center disabled:cursor-not-allowed disabled:opacity-70"
            ${state.isPublishing ? "disabled" : ""}
          >
            ${state.isPublishing ? `${ICON_SPINNER}Publicando...` : `${ICON_UPLOAD}Publicar semana`}
          </button>
          <button
            type="button"
            data-comedor-plan-save-draft
            class="${BTN_SECONDARY} min-h-10 justify-center disabled:cursor-not-allowed disabled:opacity-70"
            ${state.isSavingDraft ? "disabled" : ""}
          >
            ${
              state.isSavingDraft
                ? `${ICON_SPINNER}Guardando...`
                : `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0" aria-hidden="true"><path d="M3 3.5A1.5 1.5 0 0 1 4.5 2h6.879a1.5 1.5 0 0 1 1.06.44l4.122 4.12A1.5 1.5 0 0 1 17 7.622V16.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 16.5v-13Zm10.5-.937V5.5a1 1 0 0 0 1 1h2.937l-3.937-3.937Z"/></svg>Guardar borrador`
            }
          </button>
          <button
            type="button"
            data-comedor-plan-clear
            class="${BTN_GHOST} min-h-10 justify-center"
          >
            Limpiar semana
          </button>
        </div>
      </div>
    </aside>`;
}

// ── Render principal ─────────────────────────────────────────────────────────

export function renderComedorWeeklyPlanner(state: ComedorWeeklyPlannerViewState): string {
  if (state.panelState === "loading") {
    return `
      <section class="${RH_LISTADO_SURFACE} p-6">
        <div class="animate-pulse space-y-3">
          <div class="h-7 w-72 rounded bg-slate-100"></div>
          <div class="h-4 w-96 rounded bg-slate-100"></div>
          <div class="h-28 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  if (state.panelState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-700 shadow-sm">
        <p class="font-semibold">No fue posible cargar la planeación semanal.</p>
        <p class="mt-1 text-red-600/80">${escapeComedorHtml(state.errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-plan-retry class="${BTN_SECONDARY} mt-4 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800">
          Reintentar
        </button>
      </section>`;
  }

  return `
    <div class="flex flex-col gap-5">

      <!-- Breadcrumb / back -->
      <div class="flex items-center gap-2">
        <a href="#/comedor" class="${BTN_SECONDARY} h-9 py-1.5 text-slate-600">
          ${ICON_CHEVRON_LEFT}
          Gestión Comedor
        </a>
        <span class="text-slate-300 select-none" aria-hidden="true">/</span>
        <span class="text-sm font-medium text-slate-500">Planeación de Menú</span>
      </div>

      <!-- Barra de navegación de semana -->
      <section class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/5 sm:p-5" aria-label="Selección de semana">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <!-- Navegación prev / label / next -->
          <div class="flex items-center gap-2">
            <button
              type="button"
              data-comedor-plan-prev-week
              class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
              aria-label="Semana anterior"
            >${ICON_CHEVRON_LEFT}</button>

            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-800">${escapeComedorHtml(state.week.weekLabel)}</span>
              ${statusBadge(state.week.status)}
            </div>

            <button
              type="button"
              data-comedor-plan-next-week
              class="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40"
              aria-label="Semana siguiente"
            >${ICON_CHEVRON_RIGHT}</button>
          </div>

          <!-- Selector de semana + CTA principal -->
          <div class="flex flex-wrap items-center gap-2">
            <input
              type="week"
              data-comedor-plan-week-picker
              value="${escapeComedorHtml(state.weekPickerValue)}"
              class="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20"
              aria-label="Ir a semana específica"
            />
            <button type="button" data-comedor-plan-import-open class="${BTN_PRIMARY}">
              ${ICON_UPLOAD}
              Nueva planeación
            </button>
          </div>
        </div>
      </section>

      <!-- Contenido principal: preview + acciones en 2 columnas en pantallas lg -->
      <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_20rem] xl:grid-cols-[1fr_22rem]">
        ${renderPreviewPanel(state)}
        ${renderActionsPanel(state)}
      </div>

    </div>`;
}
