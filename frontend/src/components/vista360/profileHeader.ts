import { escapeHtml } from "./html.ts";

function initials(nombre: string, apellido: string): string {
  const ap = apellido.trim();
  if (ap) {
    const a = (nombre[0] ?? "").toUpperCase();
    const b = (ap[0] ?? "").toUpperCase();
    return (a + b) || "?";
  }
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] ?? "").toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? "").toUpperCase();
  return (a + b) || "?";
}

export type ProfileHeaderProps = {
  nombre: string;
  apellido: string;
  numEmpleado: string;
  puesto: string | null;
  activo: boolean;
  showEditar: boolean;
};

export function vista360ProfileHeaderHtml(p: ProfileHeaderProps): string {
  const full = `${p.nombre} ${p.apellido}`.trim();
  const ini = initials(p.nombre, p.apellido);
  const puesto = p.puesto?.trim() || "—";
  const badge = p.activo
    ? `<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        <span class="size-1.5 rounded-full bg-emerald-500"></span>Activo</span>`
    : `<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        <span class="size-1.5 rounded-full bg-slate-400"></span>Inactivo</span>`;

  const editBtn = p.showEditar
    ? `<button type="button" data-v360-action="editar"
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary shadow-sm hover:bg-surface">
        <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 text-text-muted" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" /></svg>
        Editar</button>`
    : "";

  return `
    <header class="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div class="relative shrink-0">
          <span class="flex size-20 items-center justify-center rounded-full bg-leoni-blue-light text-lg font-bold text-white sm:size-24 sm:text-xl" aria-hidden="true">${escapeHtml(ini)}</span>
          ${
            p.activo
              ? `<span class="absolute bottom-0 right-0 size-4 rounded-full border-2 border-white bg-emerald-500" title="Activo" aria-hidden="true"></span>`
              : ""
          }
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">${escapeHtml(full)}</h1>
          <p class="mt-1 text-sm text-text-muted">ID: #${escapeHtml(p.numEmpleado)} · ${escapeHtml(puesto)}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">${badge}</div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:shrink-0">
        ${editBtn}
        <button type="button" data-v360-action="expediente" disabled
          title="Próximamente"
          class="inline-flex items-center gap-2 rounded-lg bg-leoni-blue px-4 py-2 text-sm font-semibold text-white shadow-sm opacity-50 cursor-not-allowed">
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4 opacity-90" aria-hidden="true"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v10.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0 0 18 15.25V8.75A1.75 1.75 0 0 0 16.25 7h-4.586a.25.25 0 0 1-.177-.073L9.823 4.513A1.75 1.75 0 0 0 8.586 4H3.75Z" /></svg>
          Ver expediente</button>
      </div>
    </header>`;
}
