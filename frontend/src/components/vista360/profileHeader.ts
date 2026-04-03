import { formatNoEmpleadoDisplay } from "../../utils/noEmpleadoDisplay.ts";
import { formatNombreEmpleadoUi, inicialesDesdeNombreDisplay } from "../../utils/nombreEmpleadoDisplay.ts";
import { escapeHtml } from "./html.ts";

export type ProfileHeaderProps = {
  nombre: string;
  apellido: string;
  numEmpleado: string;
  /** Textos para una sola línea de metadatos (puesto, área, etc.), ya filtrados. */
  metaPartes: string[];
  activo: boolean;
  showEditar: boolean;
};

const BTN_H = "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors";

export function vista360ProfileHeaderHtml(p: ProfileHeaderProps): string {
  const rawFull = `${p.nombre} ${p.apellido}`.trim();
  const full = formatNombreEmpleadoUi(rawFull) || rawFull;
  const ini = inicialesDesdeNombreDisplay(full);
  const idChip = escapeHtml(formatNoEmpleadoDisplay(p.numEmpleado) || "—");
  const metaJoined = p.metaPartes.map((s) => escapeHtml(s)).join(`<span class="text-slate-300" aria-hidden="true"> · </span>`);
  const metaBlock =
    metaJoined.length > 0
      ? `<p class="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4 shrink-0 text-text-muted/80" aria-hidden="true">
            <path d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.184 2.675-.394.633-1.086 1.185-2.066 1.185H7c-.98 0-1.672-.552-2.066-1.185-.397-.639-1.184-1.581-1.184-2.675v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.182-2.649a2.18 2.18 0 0 0-.908-.91 2.18 2.18 0 0 0-1.661-.75H7.5a2.18 2.18 0 0 0-1.661.75 2.18 2.18 0 0 0-.908.91C4.517 5.691 3.75 6.625 3.75 7.706v3.784a2.18 2.18 0 0 0 .75 1.661m16.5 0A2.25 2.25 0 0 1 18 16.5h-12a2.25 2.25 0 0 1-2.25-2.25V8.25A2.25 2.25 0 0 1 6 6h12a2.25 2.25 0 0 1 2.25 2.25v5.25Z" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>${metaJoined}</span>
        </p>`
      : "";

  const statusBadge = p.activo
    ? `<span class="absolute left-1/2 bottom-0 z-10 inline-flex -translate-x-1/2 translate-y-1/2 items-center rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shadow-sm">Activo</span>`
    : `<span class="absolute left-1/2 bottom-0 z-10 inline-flex -translate-x-1/2 translate-y-1/2 items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm">Inactivo</span>`;

  const editBtn = p.showEditar
    ? `<button type="button" data-v360-action="editar"
        class="${BTN_H} border border-border bg-white text-text-primary shadow-xs hover:bg-surface">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 text-text-muted" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" /></svg>
        Editar</button>`
    : "";

  return `
    <div class="rounded-2xl border border-border/70 bg-white p-6 shadow-sm sm:p-8">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div class="relative shrink-0 self-start sm:self-center">
            <div
              class="flex size-24 items-center justify-center rounded-2xl bg-leoni-blue-light text-2xl font-bold tracking-tight text-white shadow-sm sm:size-28 sm:text-[1.65rem]"
              aria-hidden="true"
            >${escapeHtml(ini)}</div>
            ${statusBadge}
          </div>
          <div class="min-w-0 flex-1 pb-3 sm:pb-0">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(full)}</h1>
              <span class="inline-flex max-w-full items-center rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-text-muted" title="Número de empleado">#${idChip}</span>
            </div>
            ${metaBlock}
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2 border-t border-transparent pt-2 lg:border-t-0 lg:pt-0">
          ${editBtn}
          <button type="button" data-v360-action="expediente" disabled
            title="Próximamente"
            class="${BTN_H} bg-leoni-blue text-white shadow-sm opacity-50 cursor-not-allowed">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 opacity-90" aria-hidden="true"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25V8.75A1.75 1.75 0 0 0 16.25 7h-4.586a.25.25 0 0 1-.177-.073L9.823 4.513A1.75 1.75 0 0 0 8.586 4H3.75Z" /></svg>
            Ver expediente</button>
        </div>
      </div>
    </div>`;
}
