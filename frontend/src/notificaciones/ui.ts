import type { NotificacionApiItem } from "../api/notificaciones.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

function parseDate(iso: string): Date | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}

export function formatNotificacionFecha(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  return d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function formatNotificacionRelativa(iso: string): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const deltaMs = Date.now() - d.getTime();
  const deltaMin = Math.max(1, Math.round(deltaMs / 60000));
  if (deltaMin < 60) return `hace ${deltaMin} min`;
  const deltaH = Math.round(deltaMin / 60);
  if (deltaH < 24) return `hace ${deltaH} h`;
  const deltaD = Math.round(deltaH / 24);
  if (deltaD < 7) return `hace ${deltaD} d`;
  return formatNotificacionFecha(iso);
}

export function summarizeNotificacionMessage(message: string, maxLen: number): string {
  const clean = message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

export function renderNotificacionBadge(unreadCount: number): string {
  if (unreadCount <= 0) return "";
  const text = unreadCount > 99 ? "99+" : String(unreadCount);
  return `<span class="absolute -top-1 -right-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">${escapeHtml(text)}</span>`;
}

function buildListItemAriaLabel(item: NotificacionApiItem, previewMax: number): string {
  const estado = item.is_read ? "Leída" : "No leída";
  const preview = summarizeNotificacionMessage(item.message, previewMax).replace(/\s+/g, " ").trim();
  return `${item.title}. ${preview}. ${estado}.`;
}

export function renderNotificacionListItem(
  item: NotificacionApiItem,
  options: { compact: boolean },
): string {
  const title = escapeHtml(item.title);
  const message = escapeHtml(summarizeNotificacionMessage(item.message, options.compact ? 120 : 180));
  const fecha = escapeHtml(options.compact ? formatNotificacionRelativa(item.created_at) : formatNotificacionFecha(item.created_at));
  const aria = escapeHtml(buildListItemAriaLabel(item, options.compact ? 100 : 120));
  const datetime = escapeHtml(item.created_at);

  if (options.compact) {
    const shell = item.is_read ? "notif-dropdown-item notif-dropdown-item--read" : "notif-dropdown-item notif-dropdown-item--unread";
    const titleClass = item.is_read ? "notif-dropdown-item__title notif-dropdown-item__title--read" : "notif-dropdown-item__title notif-dropdown-item__title--unread";
    const statusUnread = `<span class="notif-dropdown-status notif-dropdown-status--unread">
      <span class="notif-dropdown-status__dot notif-dropdown-status__dot--unread" aria-hidden="true"></span>
      No leída
    </span>`;
    const statusRead = `<span class="notif-dropdown-status notif-dropdown-status--read">
      <span class="notif-dropdown-status__dot notif-dropdown-status__dot--read" aria-hidden="true"></span>
      Leída
    </span>`;

    return `<button type="button" class="${shell}" data-notif-id="${item.id}" aria-label="${aria}">
      <div class="notif-dropdown-item__row">
        <p class="${titleClass}">${title}</p>
        <time class="notif-dropdown-item__time" datetime="${datetime}">${fecha}</time>
      </div>
      <p class="notif-dropdown-item__desc">${message}</p>
      <div class="notif-dropdown-item__meta">
        ${item.is_read ? statusRead : statusUnread}
      </div>
    </button>`;
  }

  const rowBase =
    "w-full rounded-md border px-3 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue";
  const rowState = item.is_read ? "border-border bg-white" : "border-leoni-blue/30 bg-leoni-blue/5";
  const dot = item.is_read
    ? `<span class="inline-flex size-2 rounded-full bg-border"></span>`
    : `<span class="inline-flex size-2 rounded-full bg-leoni-blue"></span>`;

  return `<button type="button" class="${rowBase} ${rowState}" data-notif-id="${item.id}" aria-label="${aria}">
    <div class="flex items-start justify-between gap-3">
      <p class="text-sm font-semibold text-text-primary">${title}</p>
      <span class="shrink-0 text-xs text-text-muted">${fecha}</span>
    </div>
    <p class="mt-1 text-xs text-text-muted">${message}</p>
    <div class="mt-2 flex items-center gap-2 text-[11px] font-medium text-text-muted">
      ${dot}
      <span>${item.is_read ? "Leída" : "No leída"}</span>
    </div>
  </button>`;
}
