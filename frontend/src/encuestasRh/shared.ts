/**
 * Módulo compartido del dominio Encuestas RH.
 * Consumido por las páginas de gestión (`pages/encuestasRh.ts`), resultados
 * (`pages/encuestasRhResultados.ts`) y self-service (`pages/misEncuestasRh.ts`).
 * No metas aquí visualizaciones de resultados ni los inputs de responder:
 * eso vive en cada página.
 */
import { escapeHtml, fmtFechaCorta } from "../ui/uiUtils.ts";
import { badgeApproved, badgeCancelled, badgeOpen, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";
import type { EncuestaEstado } from "../api/encuestasRh.ts";

/** Badge de estado de una encuesta (borrador/publicada/cerrada) — mismo patrón que `campanaEstadoBadge` de eval360. */
export function estadoBadge(estado: EncuestaEstado): string {
  if (estado === "borrador") return badgeCancelled("Borrador");
  if (estado === "publicada") return badgeOpen("Publicada");
  return badgeApproved("Cerrada");
}

/**
 * Fecha corta en es-MX (día mes-abrev. año) a partir de un ISO `YYYY-MM-DD` o
 * de un datetime con ese prefijo. Devuelve "—" si es nula/vacía/inválida.
 * Reemplaza los `fmtFecha` locales divergentes de encuestasRh.ts,
 * encuestasRhResultados.ts y misEncuestasRh.ts (usar este en su lugar).
 */
export function fmtFechaEncuesta(value: string | null | undefined): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  const out = fmtFechaCorta(datePart);
  // fmtFechaCorta devuelve el input tal cual cuando es inválido.
  return out === datePart ? "—" : out;
}

/**
 * Estado vacío estándar (icono + título + subtítulo opcional + CTA opcional).
 * Patrón `misEncuestasRh:renderEmpty` / `evaluacion360:renderCampanasReal`.
 */
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

/**
 * Mini-desglose de audiencia (por área/por turno): fila etiqueta + barra +
 * total en `tabular-nums`. `items` ya viene mapeado a `{label, total}` por el
 * caller (áreas/turnos tienen distinta forma en `AudienciaPreview`).
 */
export function renderAudienciaDesglose(items: { label: string; total: number }[]): string {
  if (items.length === 0) return "";
  const max = Math.max(1, ...items.map((i) => i.total));
  return `
  <div class="mt-1.5 flex flex-col gap-1">
    ${items
      .map(
        (i) => `
      <div class="flex items-center gap-2 text-xs">
        <span class="w-24 shrink-0 truncate text-blue-900" title="${escapeHtml(i.label)}">${escapeHtml(i.label)}</span>
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-200/50">
          <div class="h-full rounded-full bg-accent" style="width:${Math.round((i.total / max) * 100)}%"></div>
        </div>
        <span class="w-8 shrink-0 text-right font-semibold tabular-nums text-blue-900">${i.total}</span>
      </div>`,
      )
      .join("")}
  </div>`;
}
