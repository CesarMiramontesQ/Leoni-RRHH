import { escapeHtml } from "../ui/uiUtils.ts";
import type { NotificationFilter } from "./notificationFilters.ts";

const bellIcon = `<svg class="mx-auto size-12 text-slate-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true">
  <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const emptyCard =
  "rounded-2xl border border-[rgba(148,163,184,0.35)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] px-6 py-14 text-center shadow-[0_8px_24px_rgba(15,23,42,0.05)]";

export function renderNotificationsEmptyGlobal(): string {
  return `<div class="flex flex-col items-center justify-center ${emptyCard}">
    ${bellIcon}
    <p class="mt-4 text-base font-semibold text-[#082F5F]">No tienes notificaciones</p>
    <p class="mt-2 max-w-sm text-sm text-[#475569]">Cuando haya novedades, aparecerán aquí.</p>
  </div>`;
}

export function renderNotificationsEmptyFiltered(filter: NotificationFilter): string {
  const title =
    filter === "unread" ? "No tienes notificaciones no leídas."
    : filter === "read" ? "No tienes notificaciones leídas."
    : null;
  if (!title) return renderNotificationsEmptyGlobal();

  return `<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/80 px-6 py-12 text-center shadow-[0_6px_18px_rgba(15,23,42,0.04)] backdrop-blur-sm">
    <p class="text-sm font-semibold text-[#082F5F]">${escapeHtml(title)}</p>
    <p class="mt-2 text-xs text-[#475569]">Prueba otro filtro o vuelve más tarde.</p>
  </div>`;
}
