import type { ComedorMenuDiaDetalle } from "../../comedor/rh/menuDayDetalle.ts";
import { MENU_DETALLE_CATEGORIAS } from "../../comedor/rh/menuDayDetalle.ts";
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
