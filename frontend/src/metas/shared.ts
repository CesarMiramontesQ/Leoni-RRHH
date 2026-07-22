/**
 * Módulo compartido del dominio Metas (OKR ligero).
 * Consumido por la página de gestión (`pages/metas.ts`) y la de empleado
 * (`pages/misMetas.ts`). Mismo patrón que `encuestasRh/shared.ts`.
 */
import { escapeHtml, fmtFechaCorta } from "../ui/uiUtils.ts";
import { badgeApproved, badgeCancelled, badgeOpen, badgePending, RH_LISTADO_SURFACE } from "../ui/uiTokens.ts";
import type { CicloEstado, MetaEstado, MetaNivel, RcDireccion, RcTipoMetrica } from "../api/metas.ts";

export const CICLO_ESTADO_LABELS: Record<CicloEstado, string> = {
  borrador: "Borrador",
  activo: "Activo",
  cerrado: "Cerrado",
};

export const META_ESTADO_LABELS: Record<MetaEstado, string> = {
  asignada: "Asignada",
  en_progreso: "En progreso",
  cerrada: "Cerrada",
};

export const NIVEL_LABELS: Record<MetaNivel, string> = {
  individual: "Individual",
  equipo: "Equipo",
};

export const TIPO_METRICA_LABELS: Record<RcTipoMetrica, string> = {
  numero: "Número",
  porcentaje: "Porcentaje",
  booleano: "Booleano (cumple / no cumple)",
  moneda: "Moneda",
};

export const DIRECCION_LABELS: Record<RcDireccion, string> = {
  subir: "Subir (más es mejor)",
  bajar: "Bajar (menos es mejor)",
};

/** Badge de estado de un ciclo — mismo patrón que `estadoBadge` de Encuestas RH. */
export function estadoCicloBadge(estado: CicloEstado): string {
  if (estado === "borrador") return badgeCancelled("Borrador");
  if (estado === "activo") return badgeOpen("Activo");
  return badgeApproved("Cerrado");
}

/** Badge de estado de una meta. */
export function estadoMetaBadge(estado: MetaEstado): string {
  if (estado === "asignada") return badgePending("Asignada");
  if (estado === "en_progreso") return badgeOpen("En progreso");
  return badgeApproved("Cerrada");
}

function clampRoundPct(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round(Math.max(0, Math.min(100, valor)));
}

/**
 * Barra de avance (%): relleno proporcional + valor en `tabular-nums`.
 * Mismo criterio visual que el desglose de audiencia de Encuestas RH
 * (`renderAudienciaDesglose`), adaptado a una sola barra por fila.
 */
export function avanceBar(pct: number, opts?: { compact?: boolean }): string {
  const clamped = clampRoundPct(pct);
  const height = opts?.compact ? "h-1.5" : "h-2";
  return `<div class="flex items-center gap-2">
    <div class="${height} min-w-[3rem] flex-1 overflow-hidden rounded-full bg-slate-200">
      <div class="h-full rounded-full bg-accent" style="width:${clamped}%"></div>
    </div>
    <span class="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-text-secondary">${clamped}%</span>
  </div>`;
}

/**
 * Réplica en cliente de `calcular_avance_rc` (app/services/metas_service.py)
 * — MISMA fórmula que el backend, usada solo para la previsualización en
 * vivo al capturar un valor de check-in. El backend sigue siendo la fuente
 * de verdad (recalcula al guardar); esta función nunca se usa para decidir
 * nada que se envíe al servidor, solo para el "% de avance" que se muestra
 * mientras el usuario teclea.
 */
export function avanceRcCliente(rc: {
  tipo_metrica: RcTipoMetrica;
  direccion: RcDireccion;
  valor_inicial: number;
  valor_objetivo: number;
  valor_actual: number;
}): number {
  const ini = rc.valor_inicial;
  const obj = rc.valor_objetivo;
  const act = rc.valor_actual;
  let raw: number;
  if (rc.tipo_metrica === "booleano") {
    raw = act === obj ? 100 : 0;
  } else if (rc.direccion === "subir") {
    const denom = obj - ini;
    raw = denom === 0 ? (act >= obj ? 100 : 0) : ((act - ini) / denom) * 100;
  } else {
    const denom = ini - obj;
    raw = denom === 0 ? (act <= obj ? 100 : 0) : ((ini - act) / denom) * 100;
  }
  return clampRoundPct(raw);
}

/** Fecha corta es-MX a partir de un ISO `YYYY-MM-DD` o datetime. "—" si es nula/vacía/inválida. */
export function fmtFechaMeta(value: string | null | undefined): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const datePart = s.length >= 10 ? s.slice(0, 10) : s;
  const out = fmtFechaCorta(datePart);
  return out === datePart ? "—" : out;
}

/** Estado vacío estándar — mismo patrón que `encuestasRh/shared.ts:renderEmptyState`. */
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
