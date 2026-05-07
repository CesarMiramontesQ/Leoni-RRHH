import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  getNotificacionesPage,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type NotificacionApiItem,
  type NotificacionesFetchError,
} from "../api/notificaciones.ts";
import { renderNotificationsEmptyFiltered, renderNotificationsEmptyGlobal } from "../notificaciones/emptyNotificationsState.ts";
import { renderNotificationPageCard } from "../notificaciones/notificationCard.ts";
import type { NotificationFilter } from "../notificaciones/notificationFilters.ts";
import { renderNotificationFilters } from "../notificaciones/notificationFilters.ts";
import { renderNotificationsHeader } from "../notificaciones/notificationsHeader.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const PAGE_SIZE = 20;

type PageState = {
  items: NotificacionApiItem[];
  nextCursor: number | null;
  loading: boolean;
  loadingMore: boolean;
  markingAll: boolean;
  error: string | null;
  filter: NotificationFilter;
};

function filterItems(items: NotificacionApiItem[], filter: NotificationFilter): NotificacionApiItem[] {
  if (filter === "all") return items;
  if (filter === "unread") return items.filter((i) => !i.is_read);
  return items.filter((i) => i.is_read);
}

function isUnauthorizedError(error: unknown): boolean {
  return typeof error === "object" && error != null && "status" in error && (error as { status?: unknown }).status === 401;
}

async function handleSessionExpired(container: HTMLElement): Promise<void> {
  clearAuth();
  const shellRouter = await import("../shellRouter.ts");
  shellRouter.abortAuthenticatedShell();
  const loginPage = await import("./login.ts");
  loginPage.mountLogin(container);
}

function notificacionesPageHtml(state: PageState): string {
  const hasUnread = state.items.some((i) => !i.is_read);
  const header = renderNotificationsHeader({
    markingAll: state.markingAll,
    markAllDisabled: !hasUnread,
  });

  const showFilters = !state.loading && !state.error;
  const filtersBlock = showFilters ? `<div class="mt-5">${renderNotificationFilters(state.filter)}</div>` : "";

  let body = "";
  if (state.loading) {
    body = `<div class="flex flex-col items-center justify-center rounded-2xl border border-[rgba(148,163,184,0.3)] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_100%)] px-6 py-16 shadow-[0_8px_24px_rgba(15,23,42,0.05)]" role="status" aria-live="polite">
      <div class="size-10 animate-spin rounded-full border-2 border-[#2563EB]/20 border-t-[#2563EB]" aria-hidden="true"></div>
      <p class="mt-4 text-sm font-medium text-[#475569]">Cargando notificaciones...</p>
    </div>`;
  } else if (state.error) {
    body = `<div class="rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-4 text-sm text-red-800 shadow-[0_6px_18px_rgba(127,29,29,0.08)]" role="alert">${escapeHtml(state.error)}</div>`;
  } else if (state.items.length === 0) {
    body = renderNotificationsEmptyGlobal();
  } else {
    const filtered = filterItems(state.items, state.filter);
    if (filtered.length === 0) {
      body = renderNotificationsEmptyFiltered(state.filter);
    } else {
      const rows = filtered.map((item) => renderNotificationPageCard(item)).join("");
      body = `<div class="space-y-5">${rows}</div>`;
    }
  }

  const moreBtn =
    state.nextCursor == null || state.loading || state.error ?
      ""
    : `<div class="mt-6 flex justify-center">
      <button
        type="button"
        id="notificaciones-cargar-mas"
        class="rounded-xl border border-[rgba(37,99,235,0.22)] bg-white px-5 py-2.5 text-sm font-semibold text-[#082F5F] shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,background-color,border-color] duration-200 ease-out hover:border-[rgba(37,99,235,0.35)] hover:bg-[#F8FBFF] hover:shadow-[0_10px_26px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 enabled:active:translate-y-px"
        ${state.loadingMore ? "disabled" : ""}
        aria-label="Cargar más notificaciones del historial"
      >
        ${state.loadingMore ? "Cargando..." : "Cargar más"}
      </button>
    </div>`;

  return `<section class="mx-auto w-full max-w-240 space-y-0 py-1 sm:py-2">
    ${header}
    ${filtersBlock}
    <div class="${showFilters ? "mt-5" : "mt-7"}">${body}</div>
    ${moreBtn}
  </section>`;
}

export function mountNotificaciones(container: HTMLElement, signal: AbortSignal): void {
  const state: PageState = {
    items: [],
    nextCursor: null,
    loading: true,
    loadingMore: false,
    markingAll: false,
    error: null,
    filter: "all",
  };

  function paint(): void {
    const root = container.querySelector("#notificaciones-page");
    if (root) {
      root.innerHTML = notificacionesPageHtml(state);
    }
  }

  mountAppShell(container, {
    pageTitle: "Notificaciones",
    mainClass: "py-0",
    mainHtml: `<div id="notificaciones-page" class="notificaciones-page-root -mx-4 min-h-[min(60vh,28rem)] px-4 pt-6 pb-10 sm:-mx-6 sm:px-6 sm:pt-8 sm:pb-12 lg:-mx-8 lg:px-8">${notificacionesPageHtml(state)}</div>`,
  });

  const pageRoot = container.querySelector("#notificaciones-page");

  async function cargarPrimeraPagina(): Promise<void> {
    state.loading = true;
    state.error = null;
    paint();
    try {
      const page = await getNotificacionesPage(null, PAGE_SIZE);
      state.items = page.items;
      state.nextCursor = page.next_cursor;
      state.loading = false;
      paint();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await handleSessionExpired(container);
        return;
      }
      state.loading = false;
      state.error = (error as NotificacionesFetchError).detail || "No se pudieron cargar las notificaciones.";
      paint();
    }
  }

  async function cargarMas(): Promise<void> {
    if (state.nextCursor == null || state.loadingMore) return;
    state.loadingMore = true;
    paint();
    try {
      const page = await getNotificacionesPage(state.nextCursor, PAGE_SIZE);
      state.items = [...state.items, ...page.items];
      state.nextCursor = page.next_cursor;
      state.loadingMore = false;
      paint();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await handleSessionExpired(container);
        return;
      }
      state.loadingMore = false;
      state.error = (error as NotificacionesFetchError).detail || "No se pudieron cargar más resultados.";
      paint();
    }
  }

  async function marcarUna(itemId: number): Promise<void> {
    const idx = state.items.findIndex((item) => item.id === itemId);
    if (idx < 0) return;
    const current = state.items[idx];
    if (current.is_read) {
      if (current.target_url) window.location.hash = current.target_url;
      return;
    }

    try {
      const updated = await marcarNotificacionLeida(itemId);
      state.items[idx] = updated;
      paint();
      if (updated.target_url) window.location.hash = updated.target_url;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await handleSessionExpired(container);
        return;
      }
      state.error = (error as NotificacionesFetchError).detail || "No se pudo marcar la notificación.";
      paint();
    }
  }

  async function marcarTodas(): Promise<void> {
    if (state.markingAll) return;
    if (!state.items.some((i) => !i.is_read)) return;
    state.markingAll = true;
    state.error = null;
    paint();
    try {
      const marcadas = await marcarTodasLeidas();
      if (marcadas > 0) {
        state.items = state.items.map((item) => ({ ...item, is_read: true }));
      }
      state.markingAll = false;
      paint();
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await handleSessionExpired(container);
        return;
      }
      state.markingAll = false;
      state.error = (error as NotificacionesFetchError).detail || "No se pudo completar la acción masiva.";
      paint();
    }
  }

  pageRoot?.addEventListener(
    "click",
    (event) => {
      const target = event.target as HTMLElement;
      const filterEl = target.closest<HTMLElement>("[data-notif-filter]");
      if (filterEl) {
        const raw = filterEl.getAttribute("data-notif-filter");
        if (raw === "all" || raw === "unread" || raw === "read") {
          state.filter = raw;
          paint();
        }
        return;
      }
      if (target.closest("#notificaciones-cargar-mas")) {
        void cargarMas();
        return;
      }
      if (target.closest("#notificaciones-marcar-todas")) {
        void marcarTodas();
        return;
      }
      const card = target.closest<HTMLElement>("[data-notif-id]");
      if (card) {
        const rawId = card.getAttribute("data-notif-id");
        const id = rawId ? Number.parseInt(rawId, 10) : NaN;
        if (!Number.isNaN(id)) void marcarUna(id);
      }
    },
    { signal },
  );

  void cargarPrimeraPagina();
}
