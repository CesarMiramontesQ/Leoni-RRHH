import { escapeHtml } from "../ui/uiUtils.ts";
import { RH_SURFACE_CARD } from "../ui/uiTokens.ts";
import type { CampanaEstado, EvaluacionEstado, KpiCard, TipoEvaluador } from "./types.ts";

const KPI_ICONS: Record<string, string> = {
  target: `<path d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5ZM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 0v.008H12V15Z" stroke-linecap="round" stroke-linejoin="round" />`,
  send: `<path d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" stroke-linecap="round" stroke-linejoin="round" />`,
  check: `<path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  users: `<path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  "user-check": `<path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" stroke-linecap="round" stroke-linejoin="round" />`,
  star: `<path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" stroke-linecap="round" stroke-linejoin="round" />`,
  warn: `<path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
  alert: `<path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" stroke-linecap="round" stroke-linejoin="round" />`,
};

export function eval360Sparkline(values: number[], color: string): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const padding = 2;
  const points = values
    .map((v, i) => {
      const x = padding + (i / (values.length - 1)) * (w - padding * 2);
      const y = h - padding - ((v - min) / range) * (h - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg width="${w}" height="${h}" class="shrink-0" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function renderEval360KpiGrid(kpis: KpiCard[]): string {
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
    ${kpis
      .map(
        (k) => `
      <article class="${RH_SURFACE_CARD} flex flex-col gap-2.5 p-4">
        <div class="flex items-start justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(k.label)}</p>
          <span class="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent" aria-hidden="true">
            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">${KPI_ICONS[k.icon] ?? KPI_ICONS.target}</svg>
          </span>
        </div>
        <div class="flex items-end justify-between gap-2">
          <p class="text-2xl font-bold tabular-nums tracking-tight text-text-primary sm:text-3xl">${escapeHtml(k.value)}${k.suffix ? `<sup class="ml-0.5 text-sm font-normal text-text-muted">${escapeHtml(k.suffix)}</sup>` : ""}</p>
          ${eval360Sparkline(k.spark, "var(--color-accent, #2563EB)")}
        </div>
        <div class="flex items-center justify-between gap-1.5 text-xs text-text-muted">
          <span class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${k.deltaPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}">
            <span aria-hidden="true">${k.deltaPositive ? "↑" : "↓"}</span>${escapeHtml(k.delta)}
          </span>
          <span class="text-[11px]">${escapeHtml(k.sub)}</span>
        </div>
      </article>`,
      )
      .join("")}
  </div>`;
}

export function campanaEstadoBadge(estado: CampanaEstado): string {
  const map: Record<CampanaEstado, { cls: string; dot: string; label: string }> = {
    borrador: { cls: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-400", label: "Borrador" },
    activa: { cls: "border-blue-200 bg-blue-50 text-blue-900", dot: "bg-blue-500", label: "Activa" },
    en_progreso: { cls: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500", label: "En progreso" },
    finalizada: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "Finalizada" },
    cerrada: { cls: "border-slate-200 bg-slate-100 text-slate-700", dot: "bg-slate-500", label: "Cerrada" },
    cancelada: { cls: "border-red-200 bg-red-50 text-red-900", dot: "bg-red-500", label: "Cancelada" },
  };
  const b = map[estado];
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${b.cls}"><span class="size-1.5 shrink-0 rounded-full ${b.dot}" aria-hidden="true"></span>${b.label}</span>`;
}

export function evaluacionEstadoBadge(estado: EvaluacionEstado): string {
  const map: Record<EvaluacionEstado, { cls: string; dot: string; label: string }> = {
    pendiente: { cls: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-400", label: "Pendiente" },
    en_progreso: { cls: "border-blue-200 bg-blue-50 text-blue-900", dot: "bg-blue-500", label: "En progreso" },
    completada: { cls: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500", label: "Completada" },
  };
  const b = map[estado];
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${b.cls}"><span class="size-1.5 shrink-0 rounded-full ${b.dot}" aria-hidden="true"></span>${b.label}</span>`;
}

const TIPO_EVALUADOR_LABELS: Record<TipoEvaluador, string> = {
  jefe: "Jefe directo",
  par: "Par",
  subordinado: "Subordinado",
  cliente: "Cliente",
  autoevaluacion: "Autoevaluación",
};

export function tipoEvaluadorLabel(tipo: TipoEvaluador): string {
  return TIPO_EVALUADOR_LABELS[tipo];
}

export function renderAvanceBar(pct: number): string {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 80 ? "bg-emerald-500" : clamped >= 50 ? "bg-blue-500" : "bg-amber-500";
  return `
    <div class="flex items-center gap-2 min-w-[7rem]">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div class="h-full rounded-full ${color}" style="width:${clamped}%"></div>
      </div>
      <span class="text-xs font-semibold tabular-nums text-slate-700 w-8 text-right">${clamped}%</span>
    </div>`;
}

export function renderHorizontalGapBar(requerida: number, actual: number, max = 5): string {
  const reqPct = (requerida / max) * 100;
  const actPct = (actual / max) * 100;
  return `
    <div class="space-y-1">
      <div class="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div class="absolute inset-y-0 left-0 rounded-full bg-slate-300/60" style="width:${reqPct}%"></div>
        <div class="absolute inset-y-0 left-0 rounded-full bg-accent" style="width:${actPct}%"></div>
      </div>
      <div class="flex justify-between text-[10px] text-slate-500">
        <span>Actual ${actual.toFixed(1)}</span>
        <span>Requerida ${requerida.toFixed(1)}</span>
      </div>
    </div>`;
}

export function renderSurfaceCard(title: string, subtitle: string, body: string): string {
  return `
    <article class="${RH_SURFACE_CARD} overflow-hidden">
      <header class="border-b border-[rgba(148,163,184,0.18)] px-5 py-4">
        <h2 class="text-sm font-semibold text-text-primary">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="mt-0.5 text-xs text-text-muted">${escapeHtml(subtitle)}</p>` : ""}
      </header>
      <div class="p-5">${body}</div>
    </article>`;
}
