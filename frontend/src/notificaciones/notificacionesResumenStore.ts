import {
  getNoLeidasCount,
  getNotificacionesRecientes,
  type NotificacionApiItem,
  type NotificacionesFetchError,
} from "../api/notificaciones.ts";

export type NotificacionesResumenStatus = "idle" | "loading" | "ready" | "error";

export type NotificacionesResumenSnapshot = {
  unreadCount: number;
  recientes: NotificacionApiItem[];
  status: NotificacionesResumenStatus;
  errorMessage: string | null;
};

export type RefreshNotificacionesResumenResult =
  | { ok: true }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized: false; message: string };

const emptySnapshot = (): NotificacionesResumenSnapshot => ({
  unreadCount: 0,
  recientes: [],
  status: "idle",
  errorMessage: null,
});

let snapshot: NotificacionesResumenSnapshot = emptySnapshot();
const listeners = new Set<() => void>();
let inflight: Promise<RefreshNotificacionesResumenResult> | null = null;

function notify(): void {
  for (const fn of listeners) fn();
}

function dedupeRecientes(items: NotificacionApiItem[]): NotificacionApiItem[] {
  const byId = new Map<number, NotificacionApiItem>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function isUnauthorized(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status?: unknown }).status === 401
  );
}

function readFetchMessage(e: unknown): string {
  if (typeof e === "object" && e !== null && "detail" in e) {
    const d = (e as NotificacionesFetchError).detail;
    if (typeof d === "string" && d.trim()) return d.trim();
  }
  return "No se pudieron cargar las notificaciones.";
}

async function runRefresh(): Promise<RefreshNotificacionesResumenResult> {
  snapshot = {
    ...snapshot,
    status: "loading",
    errorMessage: null,
  };
  notify();

  try {
    const [noLeidas, items] = await Promise.all([getNoLeidasCount(), getNotificacionesRecientes()]);
    const recientes = dedupeRecientes(items);
    snapshot = {
      unreadCount: noLeidas,
      recientes,
      status: "ready",
      errorMessage: null,
    };
    notify();
    return { ok: true };
  } catch (e: unknown) {
    if (isUnauthorized(e)) {
      snapshot = {
        unreadCount: 0,
        recientes: [],
        status: "error",
        errorMessage: null,
      };
      notify();
      return { ok: false, unauthorized: true };
    }
    const message = readFetchMessage(e);
    snapshot = {
      ...snapshot,
      status: "error",
      errorMessage: message,
    };
    notify();
    return { ok: false, unauthorized: false, message };
  }
}

/**
 * Obtiene conteo + recientes desde la API (Bearer del usuario actual), sin caché HTTP del navegador.
 * Varias llamadas concurrentes comparten la misma petición en vuelo para evitar duplicados.
 */
export function refreshNotificacionesResumen(): Promise<RefreshNotificacionesResumenResult> {
  if (!inflight) {
    inflight = runRefresh().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function getNotificacionesResumenSnapshot(): NotificacionesResumenSnapshot {
  return {
    unreadCount: snapshot.unreadCount,
    recientes: [...snapshot.recientes],
    status: snapshot.status,
    errorMessage: snapshot.errorMessage,
  };
}

/** Limpia el resumen al cerrar sesión o antes de cargar un usuario nuevo. */
export function resetNotificacionesResumen(): void {
  snapshot = emptySnapshot();
  notify();
}

/**
 * Suscripción ligera para futuros refrescos en tiempo real (WebSocket / SSE).
 * El shell puede ignorarla y pintar solo tras `refreshNotificacionesResumen`.
 */
export function subscribeNotificacionesResumen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
