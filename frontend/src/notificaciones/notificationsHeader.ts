import { escapeHtml } from "../ui/uiUtils.ts";

export function renderNotificationsHeader(options: {
  markingAll: boolean;
  markAllDisabled: boolean;
}): string {
  const { markingAll, markAllDisabled } = options;
  const disabled = markingAll || markAllDisabled;
  const label = markingAll ? "Marcando..." : "Marcar todas como leídas";

  return `<header class="flex flex-col gap-6 border-b border-slate-200/70 pb-7 sm:flex-row sm:items-start sm:justify-between sm:gap-12 sm:pb-8">
    <div class="min-w-0">
      <h1 class="text-2xl font-bold tracking-tight text-[#082F5F] sm:text-3xl">Notificaciones</h1>
      <p class="mt-2.5 max-w-xl text-sm leading-relaxed text-[#475569]">
        Consulta tu historial y gestiona el estado de lectura.
      </p>
    </div>
    <div class="shrink-0 sm:pt-1">
      <button
        type="button"
        id="notificaciones-marcar-todas"
        class="w-full rounded-xl border border-[rgba(37,99,235,0.32)] bg-white px-5 py-2.5 text-sm font-semibold text-[#082F5F] shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out hover:border-[rgba(37,99,235,0.45)] hover:bg-[linear-gradient(180deg,#FFFFFF_0%,#F0F7FF_100%)] hover:shadow-[0_10px_26px_rgba(37,99,235,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none sm:w-auto"
        ${disabled ? "disabled" : ""}
        aria-busy="${markingAll ? "true" : "false"}"
        aria-label="Marcar todas las notificaciones como leídas"
      >
        ${escapeHtml(label)}
      </button>
    </div>
  </header>`;
}
