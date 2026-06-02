import type { ComedorMenuDelDia } from "../../comedor/rh/resolveMenuDiaFromSemana.ts";
import type { ComedorMenuDiaDetalle } from "../../comedor/rh/menuDayDetalle.ts";
import { MENU_DETALLE_CATEGORIAS } from "../../comedor/rh/menuDayDetalle.ts";
import { isWeekendPlannerDay } from "../../comedor/rh/weekPlannerDays.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

const SIN_INFO = "Sin información registrada";

function renderLista(items: readonly string[]): string {
  if (items.length === 0) {
    return `<p class="mt-1 text-sm text-slate-500">${SIN_INFO}</p>`;
  }
  return `<ul class="mt-1 list-inside list-disc space-y-0.5 text-sm font-medium text-slate-700">${items
    .map((item) => `<li>${escapeComedorHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderCategoriaBlock(title: string, items: readonly string[], boxClass: string): string {
  return `
    <div class="rounded-lg border px-3 py-3 ${boxClass}">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${escapeComedorHtml(title)}</p>
      ${renderLista(items)}
    </div>`;
}

export type MenuPreviewDetalleOptions = {
  /** Sábado y domingo: solo Opción A en plantilla y UI. */
  includeOpcionB?: boolean;
};

/** Bloques HTML de plato principal + categorías complementarias para la vista previa. */
export function renderMenuPreviewDetalleSections(
  menuNormal: string,
  menuDieta: string,
  detalle: ComedorMenuDiaDetalle,
  options: MenuPreviewDetalleOptions = {},
): string {
  const includeOpcionB = options.includeOpcionB ?? true;
  const platoNormal = menuNormal.trim();
  const platoDieta = menuDieta.trim();
  const opcionBBlock = includeOpcionB
    ? `<div class="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Opción B</p>
          <p class="mt-0.5 text-sm font-medium text-emerald-800">${escapeComedorHtml(platoDieta || SIN_INFO)}</p>
        </div>`
    : "";
  const platoPrincipal = `
    <div class="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plato principal</p>
      <div class="mt-2 space-y-2">
        <div class="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Opción A · Tradicional</p>
          <p class="mt-0.5 text-sm font-medium text-slate-700">${escapeComedorHtml(
            platoNormal || SIN_INFO,
          )}</p>
        </div>
        ${opcionBBlock}
      </div>
    </div>`;

  const complementarias = MENU_DETALLE_CATEGORIAS.map(({ key, label }) =>
    renderCategoriaBlock(label, detalle[key], "border-slate-200 bg-slate-50/60"),
  ).join("");

  return `${platoPrincipal}${complementarias}`;
}

export type MenuDelDiaPanelState = "idle" | "loading" | "ready" | "empty" | "error";

export type RenderMenuDelDiaPanelParams = {
  state: MenuDelDiaPanelState;
  menu: ComedorMenuDelDia | null;
  errorMessage?: string | null;
  /** ISO yyyy-mm-dd de la fecha consultada (para el encabezado). */
  fechaConsultaIso?: string | null;
};

function formatMenuDelDiaHeading(fechaIso: string | null | undefined, menu: ComedorMenuDelDia | null): string {
  const todayIso = (() => {
    const now = new Date();
    const y = String(now.getFullYear()).padStart(4, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  if (fechaIso && fechaIso === todayIso) return "Menú disponible para hoy";
  if (menu) return `Menú del día · ${menu.dayLabel} ${menu.fechaDisplay}`;
  return "Menú del día";
}

/** Sección informativa del formulario de registro de comida. */
export function renderComedorMenuDelDiaPanel(params: RenderMenuDelDiaPanelParams): string {
  const { state, menu, errorMessage, fechaConsultaIso } = params;
  const heading = formatMenuDelDiaHeading(fechaConsultaIso ?? menu?.fechaIso ?? null, menu);

  if (state === "idle") {
    return `
      <section
        class="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-5"
        aria-live="polite"
      >
        <h3 class="text-sm font-semibold text-[#0A1628]">${escapeComedorHtml(heading)}</h3>
        <p class="mt-2 text-sm text-slate-500">Selecciona una fecha inicial para consultar el menú planeado.</p>
      </section>`;
  }

  if (state === "loading") {
    return `
      <section
        class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="flex items-center gap-3 text-sm text-slate-500">
          <svg class="size-5 animate-spin text-leoni-blue" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Consultando menú planeado...
        </div>
      </section>`;
  }

  if (state === "error") {
    return `
      <section
        class="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 sm:p-5"
        role="alert"
      >
        <h3 class="font-semibold">${escapeComedorHtml(heading)}</h3>
        <p class="mt-1">${escapeComedorHtml(errorMessage ?? "No fue posible consultar el menú planeado.")}</p>
      </section>`;
  }

  if (state === "empty" || !menu) {
    return `
      <section
        class="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-5"
        aria-live="polite"
      >
        <h3 class="text-sm font-semibold text-[#0A1628]">${escapeComedorHtml(heading)}</h3>
        <p class="mt-2 text-sm text-slate-500">No hay menú planeado para esta fecha. Puedes continuar con tu registro con normalidad.</p>
      </section>`;
  }

  return `
    <section
      class="rounded-2xl border border-leoni-blue/20 bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-leoni-blue/10 sm:p-5"
      aria-live="polite"
    >
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-[#0A1628]">${escapeComedorHtml(heading)}</h3>
          <p class="mt-1 text-xs text-slate-500">Consulta la oferta antes de confirmar tu selección.</p>
        </div>
        <span class="inline-flex rounded-full bg-leoni-blue/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-leoni-blue">
          ${escapeComedorHtml(menu.dayLabel)}
        </span>
      </div>
      <div class="mt-4 space-y-3">
        ${renderMenuPreviewDetalleSections(menu.menuNormal, menu.menuDieta, menu.detalle, {
          includeOpcionB: !isWeekendPlannerDay(menu.dayKey),
        })}
      </div>
    </section>`;
}
