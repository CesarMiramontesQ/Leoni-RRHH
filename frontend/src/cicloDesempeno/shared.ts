/**
 * Módulo compartido del dominio Ciclo de Desempeño (orquestador de Metas +
 * Evaluación 360°). Consumido por la página de gestión (`pages/cicloDesempeno.ts`)
 * y la de empleado (`pages/misDesempeno.ts`). Mismo patrón que `metas/shared.ts`.
 */
import { escapeHtml, fmtFechaCorta } from "../ui/uiUtils.ts";
import { badgeApproved, badgeCancelled, badgeOpen, badgePending, badgeRejected, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";
import type { CicloDesempenoBanda, CicloDesempenoEstado } from "../api/cicloDesempeno.ts";

export const CICLO_ESTADO_LABELS: Record<CicloDesempenoEstado, string> = {
  borrador: "Borrador",
  activo: "Activo",
  cerrado: "Cerrado",
};

export const BANDA_LABELS: Record<CicloDesempenoBanda, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
};

/** Badge de estado de un ciclo — mismo patrón que `estadoCicloBadge` de Metas. */
export function estadoCicloDesempenoBadge(estado: CicloDesempenoEstado): string {
  if (estado === "borrador") return badgeCancelled("Borrador");
  if (estado === "activo") return badgeOpen("Activo");
  return badgeApproved("Cerrado");
}

/** Badge de banda (desempeño o potencial): bajo=danger, medio=warning, alto=success. */
export function bandaBadge(banda: CicloDesempenoBanda | null | undefined): string {
  if (banda === "alto") return badgeApproved(BANDA_LABELS.alto);
  if (banda === "medio") return badgePending(BANDA_LABELS.medio);
  if (banda === "bajo") return badgeRejected(BANDA_LABELS.bajo);
  return badgeCancelled("Sin datos");
}

/** Fecha corta es-MX a partir de un ISO `YYYY-MM-DD` o datetime. "—" si es nula/vacía/inválida. */
export function fmtFechaCiclo(value: string | null | undefined): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  const out = fmtFechaCorta(datePart);
  return out === datePart ? "—" : out;
}

/** Valor numérico formateado con 1 decimal, en `tabular-nums`; "—" si es nulo. */
export function fmtScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(1);
}

/** Estado vacío estándar — mismo patrón que `metas/shared.ts:renderEmptyState`. */
export function renderEmptyState(opts: { title: string; subtitle?: string; icon?: string; actionHtml?: string }): string {
  const icon =
    opts.icon ??
    `<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />`;
  return `
  <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true">${icon}</svg>
    <p class="mt-4 text-base font-semibold text-text-primary">${escapeHtml(opts.title)}</p>
    ${opts.subtitle ? `<p class="mt-1 max-w-sm text-sm text-text-muted">${escapeHtml(opts.subtitle)}</p>` : ""}
    ${opts.actionHtml ? `<div class="mt-4">${opts.actionHtml}</div>` : ""}
  </div>`;
}
