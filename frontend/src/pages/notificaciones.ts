import { clearAuth } from "../auth/session.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  getNotificacionesPage,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type NotificacionApiItem,
  type NotificacionesFetchError,
} from "../api/notificaciones.ts";
import { renderNotificacionListItem } from "../notificaciones/ui.ts";

const PAGE_SIZE = 20;

type PageState = {
  items: NotificacionApiItem[];
  nextCursor: number | null;
  loading: boolean;
  loadingMore: boolean;
  markingAll: boolean;
  error: string | null;
};

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
  const headerActions = `<div class="flex items-center gap-2">
    <button
      type="button"
      id="notificaciones-marcar-todas"
      class="rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
      ${state.markingAll || state.items.length === 0 ? "disabled" : ""}
    >
      ${state.markingAll ? "Marcando..." : "Marcar todas como leídas"}
    </button>
  </div>`;

  let body = "";
  if (state.loading) {
    body = `<div class="rounded-lg border border-border bg-white px-4 py-10 text-center text-sm text-text-muted">Cargando notificaciones...</div>`;
  } else if (state.error) {
    body = `<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">${state.error}</div>`;
  } else if (state.items.length === 0) {
    body = `<div class="rounded-lg border border-border bg-white px-4 py-10 text-center text-sm text-text-muted">No tienes notificaciones.</div>`;
  } else {
    const rows = state.items
      .map((item) => renderNotificacionListItem(item, { compact: false }))
      .join("");
    body = `<div class="space-y-3">${rows}</div>`;
  }

  const moreBtn =
    state.nextCursor == null ?
      ""
    : `<div class="mt-4 flex justify-center">
      <button
        type="button"
        id="notificaciones-cargar-mas"
        class="rounded-md border border-border px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
        ${state.loadingMore ? "disabled" : ""}
      >
        ${state.loadingMore ? "Cargando..." : "Cargar más"}
      </button>
    </div>`;

  return `<section class="mx-auto w-full max-w-4xl space-y-4">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-lg font-semibold text-text-primary">Notificaciones</h1>
        <p class="mt-1 text-sm text-text-muted">Consulta tu historial y gestiona el estado de lectura.</p>
      </div>
      ${headerActions}
    </header>
    ${body}
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
  };

  function paint(): void {
    const root = container.querySelector("#notificaciones-page");
    if (root) {
      root.innerHTML = notificacionesPageHtml(state);
    }
  }

  mountAppShell(container, {
    pageTitle: "Notificaciones",
    activeNav: "notificaciones",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="notificaciones-page">${notificacionesPageHtml(state)}</div>`,
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
    if (state.markingAll || state.items.length === 0) return;
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
