import { badgeApproved, badgeCancelled, badgePending, badgeRejected } from "../../../ui/uiTokens.ts";
import { escapeHtml } from "../../../ui/uiUtils.ts";
import { difClass, formatConciliacionMonto, formatConciliacionMontoPlain, pickMontos } from "../formatConciliacion.ts";
import type { ConciliacionCategoria, ConciliacionConceptoFila, ConciliacionEstatus } from "../types.ts";

const ESTATUS_DOT: Record<ConciliacionEstatus, string> = {
  conciliado: "bg-emerald-500",
  menor: "bg-amber-500",
  critica: "bg-red-500",
  sin_contab: "bg-slate-400",
};

function estatusBadge(estatus: ConciliacionEstatus): string {
  if (estatus === "conciliado") return badgeApproved("Conciliado");
  if (estatus === "menor") return badgePending("Dif. menor");
  if (estatus === "critica") return badgeRejected("Dif. crítica");
  return badgeCancelled("Sin contab.");
}

function renderMontosCells(montos: ReturnType<typeof pickMontos>): string {
  return `
    <td class="px-3 py-3 text-right text-sm tabular-nums text-text-primary whitespace-nowrap">${formatConciliacionMontoPlain(montos.nominaAcum)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums text-text-primary whitespace-nowrap">${formatConciliacionMontoPlain(montos.tressAcum)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums whitespace-nowrap ${difClass(montos.difNomTress)}">${formatConciliacionMonto(montos.difNomTress)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums text-text-primary whitespace-nowrap">${formatConciliacionMontoPlain(montos.directosContab)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums text-text-primary whitespace-nowrap">${formatConciliacionMontoPlain(montos.indirectosContab)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums text-text-primary whitespace-nowrap">${formatConciliacionMontoPlain(montos.totalContab)}</td>
    <td class="px-3 py-3 text-right text-sm tabular-nums whitespace-nowrap ${difClass(montos.difNomContab)}">${formatConciliacionMonto(montos.difNomContab)}</td>`;
}

function renderConceptoRow(categoriaId: string, fila: ConciliacionConceptoFila, hidden: boolean): string {
  const hiddenAttr = hidden ? ' hidden data-conciliacion-collapsed="1"' : "";
  return `
    <tr class="border-b border-slate-100 transition hover:bg-slate-50/70" data-conciliacion-child="${escapeHtml(categoriaId)}"${hiddenAttr}>
      <td class="px-3 py-3">
        <div class="flex min-w-[12rem] items-center gap-2 pl-6">
          <span class="size-2 shrink-0 rounded-full ${ESTATUS_DOT[fila.estatus]}" aria-hidden="true"></span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(fila.nombre)}</span>
        </div>
      </td>
      ${renderMontosCells(pickMontos(fila))}
      <td class="px-3 py-3 whitespace-nowrap">${estatusBadge(fila.estatus)}</td>
    </tr>`;
}

function renderCategoriaRow(categoria: ConciliacionCategoria): string {
  const difBadge =
    categoria.difCount > 0
      ? badgeRejected(`${categoria.difCount} con dif.`)
      : badgeApproved("Conciliado");
  const chevronClass = categoria.expanded ? "rotate-90" : "";

  return `
    <tr class="border-b border-slate-200 bg-slate-50/80" data-conciliacion-category="${escapeHtml(categoria.id)}" data-conciliacion-expanded="${categoria.expanded ? "1" : "0"}">
      <td class="px-3 py-3.5">
        <button
          type="button"
          class="flex w-full min-w-[12rem] items-center gap-2 text-left"
          data-conciliacion-action="toggle-category"
          data-conciliacion-category-id="${escapeHtml(categoria.id)}"
          aria-expanded="${categoria.expanded ? "true" : "false"}"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-text-muted transition-transform ${chevronClass}" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          <span class="text-sm font-bold text-text-primary">${escapeHtml(categoria.nombre)}</span>
          <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-text-secondary">${escapeHtml(categoria.tipoLabel)}</span>
        </button>
      </td>
      ${renderMontosCells(pickMontos(categoria))}
      <td class="px-3 py-3.5 whitespace-nowrap">${difBadge}</td>
    </tr>`;
}

export function renderConciliacionTableBody(categorias: readonly ConciliacionCategoria[]): string {
  return categorias
    .map((categoria) => {
      const childHidden = !categoria.expanded;
      return [
        renderCategoriaRow(categoria),
        ...categoria.filas.map((fila) => renderConceptoRow(categoria.id, fila, childHidden)),
      ].join("");
    })
    .join("");
}
