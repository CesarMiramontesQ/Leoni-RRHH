import { escapeHtml } from "../ui/uiUtils.ts";

export type NotificationFilter = "all" | "unread" | "read";

const FILTERS: { id: NotificationFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "No leídas" },
  { id: "read", label: "Leídas" },
];

export function renderNotificationFilters(active: NotificationFilter): string {
  const buttons = FILTERS.map(({ id, label }) => {
    const isActive = id === active;
    const base =
      "min-h-[44px] shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 active:scale-[0.99]";
    const state = isActive
      ? "bg-gradient-to-br from-leoni-blue to-leoni-blue-light text-white shadow-[0_6px_16px_rgba(0,33,71,0.28)]"
      : "bg-transparent text-slate-600 hover:bg-sky-50/90 hover:text-[#082F5F]";
    return `<button
      type="button"
      id="notif-filter-${id}"
      data-notif-filter="${id}"
      aria-pressed="${isActive ? "true" : "false"}"
      class="${base} ${state}"
    >
      ${escapeHtml(label)}
    </button>`;
  }).join("");

  return `<div
    role="group"
    aria-label="Filtrar notificaciones por estado de lectura"
    class="flex w-full min-w-0 flex-wrap gap-1 rounded-2xl border border-slate-200/90 bg-white/75 p-1 shadow-[0_8px_28px_rgba(15,23,42,0.06)] backdrop-blur-sm sm:inline-flex sm:flex-nowrap sm:overflow-x-auto"
  >
    ${buttons}
  </div>`;
}
