import type { ComedorKpi, ComedorPanelState } from "../../comedor/rh/types.ts";
import { comedorKpiVariantClass, escapeComedorHtml } from "./comedorUiUtils.ts";

function iconSemanaActual(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5a2.25 2.25 0 0 0 2.25-2.25m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5a2.25 2.25 0 0 1 2.25 2.25v7.5" /></svg>`;
}

function iconProximaSemana(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`;
}

function iconActivos(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.09 9.09 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m6.92-12.05c.182.02.364.02.546 0 2.08-.232 3.848-1.548 4.856-3.342M15.75 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`;
}

function iconAsistencia(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>`;
}

function iconForKpiId(id: string): string {
  const v = comedorKpiVariantClass(id);
  if (v === "rh-comedor-kpi--semana-actual") return iconSemanaActual();
  if (v === "rh-comedor-kpi--proxima-semana") return iconProximaSemana();
  if (v === "rh-comedor-kpi--activos") return iconActivos();
  if (v === "rh-comedor-kpi--asistencia") return iconAsistencia();
  return iconSemanaActual();
}

function renderProgressBar(percent: number | undefined): string {
  if (typeof percent !== "number") return "";
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const fillClass = value === 0 ? "rh-comedor-kpi-progress__fill rh-comedor-kpi-progress__fill--zero" : "rh-comedor-kpi-progress__fill";
  return `
    <div class="rh-comedor-kpi-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}" aria-label="Progreso ${value} por ciento">
      <div class="${fillClass}" style="width:${value}%"></div>
    </div>`;
}

/** Primera línea = etiqueta bajo el valor; resto = pie (subtexto). Compatibilidad: sin salto = una sola descripción. */
function splitKpiDescription(descripcion: string): { body: string; footer: string | null } {
  const idx = descripcion.indexOf("\n");
  if (idx === -1) {
    return { body: descripcion, footer: null };
  }
  const body = descripcion.slice(0, idx).trim();
  const footer = descripcion.slice(idx + 1).trim();
  return { body, footer: footer.length > 0 ? footer : null };
}

function renderKpiCard(kpi: ComedorKpi): string {
  const variant = comedorKpiVariantClass(kpi.id);
  const { body, footer } = splitKpiDescription(kpi.descripcion);
  const trend = kpi.tendencia
    ? `<span class="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 sm:text-xs">${escapeComedorHtml(kpi.tendencia)}</span>`
    : "";
  const footerBlock =
    footer ?
      `<p class="rh-comedor-kpi-card__footer mt-2 text-[12px] leading-snug text-[#64748b]">${escapeComedorHtml(footer)}</p>`
    : "";
  const progressBlock = renderProgressBar(kpi.progressPercent);
  return `
    <article class="rh-comedor-kpi-card rh-sol-kpi-card ${variant} flex min-h-46 flex-col rounded-2xl border p-4 shadow-[0_6px_20px_rgba(15,23,42,0.05)] transition-[box-shadow,transform,border-color] duration-200 sm:p-5">
      <header class="rh-comedor-kpi-card__head flex items-center gap-2.5">
        <div class="rh-sol-kpi-card__icon rh-comedor-kpi-card__icon flex size-11 shrink-0 items-center justify-center rounded-[12px]" aria-hidden="true">${iconForKpiId(kpi.id)}</div>
        <div class="flex min-w-0 flex-1 items-start justify-between gap-2">
          <p class="rh-comedor-kpi-card__title text-[13px] font-bold leading-tight tracking-tight text-[#475569]">${escapeComedorHtml(kpi.titulo)}</p>
          ${trend}
        </div>
      </header>
      <div class="rh-comedor-kpi-card__body mt-4 min-w-0 flex-1">
        <p class="rh-comedor-kpi-card__value text-[clamp(1.85rem,4.5vw,2.25rem)] font-extrabold tabular-nums leading-none tracking-tight text-[#0f172a]">${escapeComedorHtml(kpi.valor)}</p>
        <p class="rh-comedor-kpi-card__desc mt-2 text-[13px] leading-snug text-[#64748b]">${escapeComedorHtml(body)}</p>
        ${footerBlock}
        ${progressBlock}
      </div>
    </article>`;
}

function renderLoadingCards(): string {
  const skel = `
    <div class="rh-sol-kpi-skel rh-comedor-kpi-card flex min-h-46 animate-pulse flex-col rounded-2xl border border-[rgba(148,163,184,0.2)] bg-linear-to-br from-white to-[#f8fbff] p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <div class="flex items-center gap-2.5">
        <div class="size-11 shrink-0 rounded-[12px] bg-slate-200/90"></div>
        <div class="h-3.5 flex-1 rounded-md bg-slate-200/80"></div>
      </div>
      <div class="mt-4 flex-1 space-y-2">
        <div class="h-9 w-24 rounded-md bg-slate-200/90"></div>
        <div class="h-3.5 w-full max-w-48 rounded-md bg-slate-100/90"></div>
        <div class="h-3 w-2/3 rounded-md bg-slate-100/80"></div>
      </div>
    </div>`;
  return Array.from({ length: 4 }, () => skel).join("");
}

export function renderComedorStats(
  state: ComedorPanelState,
  kpis: readonly ComedorKpi[] | null,
  errorMessage: string | null,
  gridClass = "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
): string {
  if (state === "loading") {
    return `<section class="${gridClass}">${renderLoadingCards()}</section>`;
  }

  if (state === "error") {
    return `
      <section class="rh-sol-table-error-fallback rounded-2xl border border-red-200/90 bg-white px-4 py-4 text-sm text-red-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <p class="font-semibold text-red-900">No fue posible cargar métricas del comedor.</p>
        <p class="mt-1 text-red-800/90">${escapeComedorHtml(errorMessage ?? "Error inesperado.")}</p>
        <button
          type="button"
          data-comedor-retry-kpis
          class="mt-3 inline-flex min-h-10 items-center rounded-[10px] border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 shadow-sm transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2"
        >
          Reintentar
        </button>
      </section>`;
  }

  if (state === "empty" || !kpis || kpis.length === 0) {
    return `
      <section class="rh-sol-empty rounded-2xl border border-[rgba(148,163,184,0.22)] bg-white px-4 py-8 text-center text-sm text-[#64748b] shadow-[0_8px_24px_rgba(15,23,42,0.06)]" role="status">
        No hay métricas disponibles para este periodo.
      </section>`;
  }

  return `<section class="${gridClass}">${kpis.map(renderKpiCard).join("")}</section>`;
}
