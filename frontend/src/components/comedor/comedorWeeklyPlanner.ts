import type { ComedorPanelState, ComedorWeekPlanner, ComedorWeekPlannerDayKey } from "../../comedor/rh/types.ts";
import { isWeekendPlannerDay } from "../../comedor/rh/weekPlannerDays.ts";
import { BTN_PRIMARY } from "../../ui/uiTokens.ts";
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

function statusBadge(status: ComedorWeekPlanner["status"]): string {
  if (status === "publicado") {
    return '<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Estado: Publicado</span>';
  }
  return '<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Estado: Borrador</span>';
}

function weekHasRegisteredMenu(panelState: ComedorPanelState): boolean {
  return panelState === "ready";
}

function renderPreviewDaySelector(week: ComedorWeekPlanner, selectedDayKey: ComedorWeekPlannerDayKey): string {
  return `
    <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Seleccionar día para vista previa">
      ${week.dias
        .map((day) => {
          const active = day.key === selectedDayKey;
          return `
        <button
          type="button"
          role="tab"
          aria-selected="${active ? "true" : "false"}"
          data-comedor-plan-preview-day="${day.key}"
          class="inline-flex min-h-10 flex-col items-start rounded-lg border px-3 py-2 text-left text-xs font-semibold transition sm:min-w-[5.5rem] ${
            active
              ? "border-leoni-blue bg-leoni-blue/10 text-leoni-blue ring-1 ring-leoni-blue/25"
              : "border-slate-200 bg-white text-slate-700 hover:border-leoni-blue/40 hover:bg-slate-50"
          }"
        >
          <span>${escapeComedorHtml(day.label)}</span>
          <span class="font-normal text-slate-500">${escapeComedorHtml(day.fechaCorta)}</span>
        </button>`;
        })
        .join("")}
    </div>`;
}

function renderPreviewEmptyState(): string {
  return `
    <div
      class="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-12 text-center"
      role="status"
    >
      <p class="text-sm font-medium text-slate-600">No se ha registrado menú para esta semana.</p>
    </div>`;
}

function renderPreview(week: ComedorWeekPlanner, selectedDayKey: ComedorWeekPlannerDayKey): string {
  const selected = week.dias.find((day) => day.key === selectedDayKey) ?? week.dias[0]!;
  const menuTitle = selected.menuNormal.trim() || "Aún no has configurado este menú";
  return `
    <article class="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex rounded-full bg-leoni-blue/10 px-2.5 py-1 text-xs font-semibold text-leoni-blue">${escapeComedorHtml(
          selected.label,
        )}</span>
        <span class="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">${escapeComedorHtml(
          selected.fechaCorta,
        )}</span>
      </div>
      <h3 class="mt-3 text-lg font-semibold text-slate-900">${escapeComedorHtml(menuTitle)}</h3>
      <p class="mt-1 text-sm text-slate-500">Vista de cómo lo verá el empleado en el portal.</p>
      <div class="mt-4">
        ${renderMenuPreviewDetalleSections(selected.menuNormal, selected.menuDieta, selected.detalle, {
          includeOpcionB: !isWeekendPlannerDay(selected.key),
        })}
      </div>
      <button type="button" disabled class="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-400">
        Seleccionar menú en portal
      </button>
    </article>`;
}

function renderPreviewPanel(state: ComedorWeeklyPlannerViewState): string {
  const hasMenu = weekHasRegisteredMenu(state.panelState);
  return `
    <section id="comedor-plan-preview-panel" class="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
      <p class="text-sm font-semibold text-slate-700">Vista previa del menú</p>
      ${
        hasMenu
          ? `<p class="mt-1 text-sm text-slate-500">Selecciona un día para revisar el menú completo (platillos y complementos).</p>
             ${renderPreviewDaySelector(state.week, state.selectedDayKey)}
             ${renderPreview(state.week, state.selectedDayKey)}`
          : renderPreviewEmptyState()
      }
    </section>`;
}

export function renderComedorWeeklyPlanner(state: ComedorWeeklyPlannerViewState): string {
  if (state.panelState === "loading") {
    return `
      <section class="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <div class="animate-pulse space-y-3">
          <div class="h-7 w-72 rounded bg-slate-100"></div>
          <div class="h-4 w-96 rounded bg-slate-100"></div>
          <div class="h-28 rounded bg-slate-100"></div>
        </div>
      </section>`;
  }

  if (state.panelState === "error") {
    return `
      <section class="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 shadow-sm">
        <p class="font-semibold">No fue posible cargar la planeación semanal.</p>
        <p class="mt-1">${escapeComedorHtml(state.errorMessage ?? "Error inesperado.")}</p>
        <button type="button" data-comedor-plan-retry class="mt-3 inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
          Reintentar
        </button>
      </section>`;
  }

  return `
    <div class="flex flex-col gap-7">
      <section class="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
        <div class="flex flex-col gap-3">
          <a href="#/comedor" class="inline-flex items-center gap-1 text-sm font-semibold text-leoni-blue hover:underline">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
            Volver a Comedor
          </a>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-text-primary">Configuración de Menú Semanal</h1>
            <p class="mt-1 text-sm text-text-muted">Consulta y gestiona la planeación del menú por semana.</p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-comedor-plan-prev-week class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              ← Semana anterior
            </button>
            <span class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">${escapeComedorHtml(
              state.week.weekLabel,
            )}</span>
            <button type="button" data-comedor-plan-next-week class="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Semana siguiente →
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-comedor-plan-import-open class="${BTN_PRIMARY} min-h-10">
              Nueva planeación semanal
            </button>
            <input type="week" data-comedor-plan-week-picker value="${escapeComedorHtml(
              state.weekPickerValue,
            )}" class="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-leoni-blue focus:outline-none focus:ring-2 focus:ring-leoni-blue/20" />
            ${statusBadge(state.week.status)}
          </div>
        </div>
      </section>

      ${renderPreviewPanel(state)}

      <section>
        <p class="mb-3 text-sm font-semibold text-slate-700">Guarda o publica</p>
        <article class="rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 lg:max-w-md">
            <p class="text-sm text-slate-600">Revisa que todos los días tengan contenido antes de publicar.</p>
            <p class="mt-2 text-xs font-medium ${state.incompleteDaysCount > 0 ? "text-red-600" : "text-emerald-700"}">
              ${
                state.incompleteDaysCount > 0
                  ? `${state.incompleteDaysCount} día(s) con información incompleta.`
                  : "Semana completa, lista para publicar."
              }
            </p>
            ${
              state.lastSavedAtLabel
                ? `<p class="mt-1 text-xs text-slate-500">Guardado automáticamente hace ${escapeComedorHtml(
                    state.lastSavedAtLabel,
                  )}</p>`
                : ""
            }
            <div class="mt-5 flex flex-col gap-3">
              <button type="button" data-comedor-plan-publish class="inline-flex min-h-11 items-center justify-center rounded-lg bg-leoni-blue px-4 text-sm font-semibold text-white hover:bg-leoni-blue-light ${
                state.isPublishing ? "opacity-70" : ""
              }" ${state.isPublishing ? "disabled" : ""}>
                ${state.isPublishing ? "Publicando..." : "Publicar semana"}
              </button>
              <button type="button" data-comedor-plan-save-draft class="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 ${
                state.isSavingDraft ? "opacity-70" : ""
              }" ${state.isSavingDraft ? "disabled" : ""}>
                ${state.isSavingDraft ? "Guardando..." : "Guardar borrador"}
              </button>
              <button type="button" data-comedor-plan-clear class="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Limpiar campos
              </button>
            </div>
          </article>
      </section>
    </div>`;
}
