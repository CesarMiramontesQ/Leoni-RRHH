/**
 * Tokens visuales alineados con la página de Actas (listados RH).
 * Mantener en sync con `frontend/src/pages/actas.ts` cuando cambie el diseño base.
 */

export const RH_LISTADO_PAGE_OUTER =
  "mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 flex-col gap-5 bg-[#f6f8fb] px-2 pb-2 sm:gap-6 sm:px-3";

export const RH_LISTADO_SURFACE =
  "rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]";

export const RH_LISTADO_BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-[10px] bg-[#1e40af] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

export const RH_LISTADO_BTN_SECONDARY =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#1e40af]/40 hover:bg-slate-50 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

export const RH_LISTADO_BTN_GHOST =
  "inline-flex items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#1e40af]/40 hover:bg-slate-50 hover:text-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";

export const RH_LISTADO_LABEL = "mb-1 block text-xs font-medium text-[#667085]";

export const RH_LISTADO_SELECT =
  "col-start-1 row-start-1 w-full appearance-none rounded-[10px] border border-[#e5e7eb] bg-white py-2 pr-8 pl-3 text-sm text-slate-900 shadow-sm";

export const RH_LISTADO_FOCUS_RING =
  "focus:border-[#1e40af] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2";
