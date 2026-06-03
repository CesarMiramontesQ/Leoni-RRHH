import type { ComedorMenuDelDia } from "../../comedor/rh/resolveMenuDiaFromSemana.ts";
import type { ComedorMenuDiaDetalle } from "../../comedor/rh/menuDayDetalle.ts";
import { MENU_DETALLE_CATEGORIAS } from "../../comedor/rh/menuDayDetalle.ts";
import { isWeekendPlannerDay } from "../../comedor/rh/weekPlannerDays.ts";
import { escapeComedorHtml } from "./comedorUiUtils.ts";

const SIN_INFO = "Sin información registrada";

/** Tarjeta de categoría: fondo blanco, borde sutil, sombra ligera, radius 12px. */
const MENU_PREVIEW_CATEGORIA_CARD =
  "flex h-full min-h-[5.5rem] flex-col rounded-xl border border-[#eef2f7] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

const MENU_PREVIEW_CARD_TITLE = "text-[13px] font-semibold leading-none text-slate-500";

const MENU_PREVIEW_CARD_BODY = "text-lg font-semibold leading-snug text-[#0A1628]";

const MENU_PREVIEW_CARD_BODY_EMPTY = "text-base font-medium text-slate-400";

const CATEGORIA_ICON: Record<(typeof MENU_DETALLE_CATEGORIAS)[number]["key"], string> = {
  sopa_o_crema: "🍲",
  guarniciones: "🥗",
  complementos: "🍞",
  tortillas: "🌮",
  postres: "🍮",
  salsas: "🌶️",
  aguas: "🥤",
};

function renderLista(items: readonly string[]): string {
  if (items.length === 0) {
    return `<p class="mt-2 ${MENU_PREVIEW_CARD_BODY_EMPTY}">${SIN_INFO}</p>`;
  }
  if (items.length === 1) {
    return `<p class="mt-2 ${MENU_PREVIEW_CARD_BODY}">${escapeComedorHtml(items[0]!)}</p>`;
  }
  return `<ul class="mt-2 space-y-1.5 ${MENU_PREVIEW_CARD_BODY}">${items
    .map(
      (item) =>
        `<li class="flex gap-2"><span class="mt-2.5 size-1 shrink-0 rounded-full bg-slate-300" aria-hidden="true"></span><span>${escapeComedorHtml(item)}</span></li>`,
    )
    .join("")}</ul>`;
}

function renderCategoriaBlock(
  key: (typeof MENU_DETALLE_CATEGORIAS)[number]["key"],
  title: string,
  items: readonly string[],
): string {
  const icon = CATEGORIA_ICON[key];
  return `
    <div class="${MENU_PREVIEW_CATEGORIA_CARD}">
      <p class="${MENU_PREVIEW_CARD_TITLE}">
        <span class="mr-1.5 text-sm leading-none" aria-hidden="true">${icon}</span>${escapeComedorHtml(title)}
      </p>
      <div class="mt-auto flex flex-1 flex-col">${renderLista(items)}</div>
    </div>`;
}

/** Cuadrícula: 1 / 2 / 3 columnas; 4 solo en pantallas muy grandes. */
const MENU_PREVIEW_CATEGORIAS_GRID =
  "grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

/** Opciones A/B del plato principal en fila (50% c/u desde sm). */
const MENU_PREVIEW_PLATO_OPCIONES_GRID = "grid grid-cols-1 sm:grid-cols-2";

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
  const opcionA = `
        <div class="flex h-full flex-col p-3 sm:pr-4">
          <p class="text-xs font-semibold text-slate-500">
            <span class="mr-1 inline-flex size-5 items-center justify-center rounded bg-slate-200/80 text-[11px] text-slate-700">A</span>
            Tradicional
          </p>
          <p class="mt-2 flex-1 ${MENU_PREVIEW_CARD_BODY}">${escapeComedorHtml(platoNormal || SIN_INFO)}</p>
        </div>`;
  const opcionB = includeOpcionB
    ? `<div class="flex h-full flex-col bg-emerald-50/60 p-3 sm:border-l sm:border-[#eef2f7] sm:pl-4">
          <p class="text-xs font-semibold text-emerald-700">
            <span class="mr-1 inline-flex size-5 items-center justify-center rounded bg-emerald-100 text-[11px] text-emerald-800">B</span>
            Alternativa
          </p>
          <p class="mt-2 flex-1 text-lg font-semibold leading-snug text-emerald-950">${escapeComedorHtml(platoDieta || SIN_INFO)}</p>
        </div>`
    : "";
  const platoOpcionesGridClass = includeOpcionB ? MENU_PREVIEW_PLATO_OPCIONES_GRID : "grid grid-cols-1";
  const platoPrincipal = `
    <div class="overflow-hidden rounded-xl border border-[#eef2f7] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p class="border-b border-[#eef2f7] px-3 py-2 text-[13px] font-semibold text-slate-500">Plato principal</p>
      <div class="${platoOpcionesGridClass} bg-slate-50/50">
        ${opcionA}
        ${opcionB}
      </div>
    </div>`;

  const complementarias = `
    <div class="${MENU_PREVIEW_CATEGORIAS_GRID} mt-6">
      ${MENU_DETALLE_CATEGORIAS.map(({ key, label }) => renderCategoriaBlock(key, label, detalle[key])).join("")}
    </div>`;

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
      <div class="mt-4">
        ${renderMenuPreviewDetalleSections(menu.menuNormal, menu.menuDieta, menu.detalle, {
          includeOpcionB: !isWeekendPlannerDay(menu.dayKey),
        })}
      </div>
    </section>`;
}
