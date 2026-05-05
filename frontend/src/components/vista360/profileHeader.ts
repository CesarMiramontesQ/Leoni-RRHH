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

const BTN_H =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

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
    ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 shadow-sm"><span class="size-1.5 rounded-full bg-emerald-600" aria-hidden="true"></span>Activo</span>`
    : `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm"><span class="size-1.5 rounded-full bg-slate-500" aria-hidden="true"></span>Inactivo</span>`;

  const editBtn = p.showEditar
    ? `<button type="button" data-v360-action="editar"
        class="${BTN_H} border border-slate-200 bg-white text-text-primary shadow-sm hover:border-slate-300 hover:bg-slate-50">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 text-text-muted" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" /></svg>
        Editar</button>`
    : "";

  return `
    <div class="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-white to-slate-50/70 p-5 shadow-sm ring-1 ring-slate-900/5 sm:p-7">
      <div class="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex min-w-0 flex-1 flex-col items-center gap-5 text-center sm:flex-row sm:items-center sm:gap-8 sm:text-left">
          <div class="shrink-0">
            <div
              class="flex size-24 items-center justify-center rounded-3xl border border-blue-100 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#1d4ed8] text-2xl font-bold tracking-tight text-white shadow-md shadow-blue-900/20 sm:size-28 sm:text-[1.65rem]"
              aria-hidden="true"
            >${escapeHtml(ini)}</div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              ${statusBadge}
              <span class="inline-flex max-w-full items-center rounded-full border border-slate-200/90 bg-slate-100/90 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700" title="Número de empleado">#${idChip}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
              <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(full)}</h1>
            </div>
            ${metaBlock}
          </div>
        </div>
        <div class="grid w-full shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[22rem]">
          ${editBtn}
          <button type="button" data-v360-action="expediente" disabled
            title="Próximamente"
            class="${BTN_H} bg-leoni-blue text-white shadow-md shadow-leoni-blue/20 transition hover:bg-leoni-blue-light disabled:cursor-not-allowed disabled:opacity-55">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 shrink-0 opacity-90" aria-hidden="true"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25V8.75A1.75 1.75 0 0 0 16.25 7h-4.586a.25.25 0 0 1-.177-.073L9.823 4.513A1.75 1.75 0 0 0 8.586 4H3.75Z" /></svg>
            Ver expediente</button>
        </div>
      </div>
    </div>`;
}
