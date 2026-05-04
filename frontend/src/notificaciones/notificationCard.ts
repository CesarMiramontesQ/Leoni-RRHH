import type { NotificacionApiItem } from "../api/notificaciones.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { formatNotificationFriendlyDate } from "./notificationDate.ts";
import { summarizeNotificacionMessage } from "./ui.ts";

function buildAriaLabel(item: NotificacionApiItem): string {
  const estado = item.is_read ? "Leída" : "No leída";
  const preview = summarizeNotificacionMessage(item.message, 120).replace(/\s+/g, " ").trim();
  return `${item.title}. ${preview}. ${estado}.`;
}

const cardTransition =
  "transition-[transform,box-shadow,border-color] duration-[180ms] ease-out";

export function renderNotificationPageCard(item: NotificacionApiItem): string {
  const title = escapeHtml(item.title);
  const message = escapeHtml(summarizeNotificacionMessage(item.message, 220));
  const fecha = escapeHtml(formatNotificationFriendlyDate(item.created_at));
  const aria = escapeHtml(buildAriaLabel(item));

  const unread = !item.is_read;

  const strip = unread
    ? `<div class="w-[5px] shrink-0 self-stretch bg-linear-to-b from-[#002147] via-leoni-blue-light to-[#2563EB]" aria-hidden="true"></div>`
    : "";

  const shell = unread
    ? `border border-[rgba(37,99,235,0.22)] bg-[linear-gradient(135deg,#EAF4FF_0%,#F6FAFF_100%)] shadow-[0_8px_24px_rgba(15,23,42,0.06)] hover:border-[rgba(37,99,235,0.38)] hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)]`
    : `border border-[rgba(148,163,184,0.35)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] shadow-[0_6px_18px_rgba(15,23,42,0.045)] hover:border-[rgba(148,163,184,0.55)] hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)]`;

  const titleClass = unread ? "text-base font-bold tracking-tight text-[#082F5F]" : "text-base font-semibold tracking-tight text-[#0f172a]";

  const messageClass = unread ? "text-sm leading-relaxed text-slate-700" : "text-sm leading-relaxed text-[#475569]";

  const timeClass = unread ? "text-xs font-medium tabular-nums text-slate-500" : "text-xs font-medium tabular-nums text-slate-500";

  const statusUnread = `<span class="inline-flex items-center gap-2 rounded-full border border-[rgba(37,99,235,0.28)] bg-[linear-gradient(135deg,#DBEAFE_0%,#EFF6FF_100%)] px-3 py-1 text-xs font-bold text-[#082F5F] shadow-sm">
    <span class="size-2 shrink-0 rounded-full bg-[#2563EB]" aria-hidden="true"></span>
    No leída
  </span>`;

  const statusRead = `<span class="inline-flex items-center gap-2 rounded-full border border-[rgba(16,185,129,0.25)] bg-[linear-gradient(135deg,#ECFDF5_0%,#F0FDF4_100%)] px-3 py-1 text-xs font-semibold text-kpi-metric-activo-icon shadow-sm">
    <span class="size-2 shrink-0 rounded-full bg-[#10B981]" aria-hidden="true"></span>
    Leída
  </span>`;

  return `<button
    type="button"
    data-notif-id="${item.id}"
    aria-label="${aria}"
    class="group flex w-full cursor-pointer overflow-hidden rounded-2xl text-left ${cardTransition} hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${shell}"
  >
    ${strip}
    <div class="min-w-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">
      <div class="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <p class="min-w-0 ${titleClass}">${title}</p>
        <time class="shrink-0 ${timeClass} sm:pt-0.5 sm:text-right" datetime="${escapeHtml(item.created_at)}">${fecha}</time>
      </div>
      <p class="mt-2.5 ${messageClass}">${message}</p>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        ${unread ? statusUnread : statusRead}
      </div>
    </div>
  </button>`;
}
