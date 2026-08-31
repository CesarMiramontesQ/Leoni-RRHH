import { getSessionPolicy, logoutSession } from "../api/auth.ts";
import { clearAuth } from "./session.ts";
import { bindIdlePause, unbindIdlePause } from "./sessionIdlePause.ts";
import {
  SessionIdleController,
  markIdleLogout,
  type IdleBus,
  type IdleBusMessage,
} from "./sessionIdle.ts";
import { BTN_PRIMARY, MODAL_OVERLAY, MODAL_PANEL } from "../ui/uiTokens.ts";

const CHANNEL_NAME = "leoni-session-idle";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "wheel"] as const;
const DEFAULT_TIMEOUT_SECONDS = 120;
const TICK_MS = 1000;

let stopCurrent: (() => void) | null = null;
let postRemoteLogout: (() => void) | null = null;

export function notifyRemoteLogout(): void {
  postRemoteLogout?.();
}

export function stopSessionIdleWatch(): void {
  stopCurrent?.();
  stopCurrent = null;
  postRemoteLogout = null;
  unbindIdlePause();
}

export async function signOutToLogin(
  container: HTMLElement,
  reason: "idle" | "manual",
): Promise<void> {
  if (reason === "manual") notifyRemoteLogout();
  stopSessionIdleWatch();
  if (reason === "idle") markIdleLogout();
  try {
    await logoutSession();
  } catch {
    /* el cliente limpia igual */
  }
  clearAuth();
  const { abortAuthenticatedShell } = await import("../shellRouter.ts");
  abortAuthenticatedShell();
  const { mountLogin } = await import("../pages/login.ts");
  mountLogin(container);
}

export async function startSessionIdleWatch(container: HTMLElement, signal: AbortSignal): Promise<void> {
  stopSessionIdleWatch();
  if (signal.aborted) return;

  const timeoutSeconds = await fetchIdleTimeoutSeconds();
  if (signal.aborted || timeoutSeconds <= 0) return;

  const bus = createBroadcastBus();
  postRemoteLogout = () => bus?.post({ type: "logout" });

  const modal = mountIdleWarnModal(() => controller.recordActivity());
  const controller = new SessionIdleController({
    now: () => Date.now(),
    timeoutSeconds,
    onWarn: (remaining) => modal.show(remaining),
    onClearWarn: () => modal.hide(),
    onExpire: () => {
      modal.destroy();
      void signOutToLogin(container, "idle");
    },
    bus,
  });
  bindIdlePause(
    () => controller.beginRequest(),
    () => controller.endRequest(),
  );

  const onActivity = () => controller.recordActivity();
  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, onActivity, { capture: true, passive: true });
  }
  const interval = window.setInterval(() => controller.tick(), TICK_MS);
  controller.recordActivity();

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(interval);
    for (const ev of ACTIVITY_EVENTS) {
      window.removeEventListener(ev, onActivity, { capture: true });
    }
    controller.stop();
    bus?.close();
    modal.destroy();
    unbindIdlePause();
  };
  stopCurrent = stop;
  signal.addEventListener("abort", stop, { once: true });
}

async function fetchIdleTimeoutSeconds(): Promise<number> {
  try {
    const policy = await getSessionPolicy();
    const n = policy.idle_timeout_seconds;
    if (!Number.isFinite(n) || n < 0) return DEFAULT_TIMEOUT_SECONDS;
    return Math.floor(n);
  } catch {
    return DEFAULT_TIMEOUT_SECONDS;
  }
}

function createBroadcastBus(): (IdleBus & { close: () => void }) | undefined {
  if (typeof BroadcastChannel === "undefined") return undefined;
  const ch = new BroadcastChannel(CHANNEL_NAME);
  return {
    post(msg: IdleBusMessage) {
      ch.postMessage(msg);
    },
    subscribe(handler: (msg: IdleBusMessage) => void) {
      const onMsg = (ev: MessageEvent<IdleBusMessage>) => handler(ev.data);
      ch.addEventListener("message", onMsg);
      return () => ch.removeEventListener("message", onMsg);
    },
    close() {
      ch.close();
    },
  };
}

function mountIdleWarnModal(onStay: () => void): {
  show: (remainingSeconds: number) => void;
  hide: () => void;
  destroy: () => void;
} {
  const overlay = document.createElement("div");
  overlay.id = "session-idle-overlay";
  overlay.className = `${MODAL_OVERLAY} z-[80] hidden`;
  overlay.innerHTML = `
    <div class="${MODAL_PANEL} max-w-md p-0" role="dialog" aria-modal="true" aria-labelledby="session-idle-title">
      <header class="border-b border-slate-100 px-5 pb-4 pt-5 sm:px-8">
        <h2 id="session-idle-title" class="text-lg font-semibold text-text-primary">¿Sigues aquí?</h2>
      </header>
      <div class="px-5 py-6 sm:px-8">
        <p class="text-sm leading-relaxed text-text-secondary">
          Tu sesión se cerrará por inactividad en
          <strong id="session-idle-count" class="tabular-nums text-text-primary">30</strong>
          segundos.
        </p>
      </div>
      <footer class="border-t border-slate-100 px-5 py-4 sm:px-8">
        <button type="button" id="session-idle-stay" class="${BTN_PRIMARY}">Sigo aquí</button>
      </footer>
    </div>
  `;
  overlay.querySelector("#session-idle-stay")?.addEventListener("click", (ev) => {
    ev.preventDefault();
    onStay();
  });
  document.body.appendChild(overlay);
  const countEl = overlay.querySelector<HTMLElement>("#session-idle-count");

  return {
    show(remainingSeconds: number) {
      if (countEl) countEl.textContent = String(remainingSeconds);
      overlay.classList.remove("hidden");
      overlay.classList.add("flex");
      overlay.querySelector<HTMLButtonElement>("#session-idle-stay")?.focus();
    },
    hide() {
      overlay.classList.add("hidden");
      overlay.classList.remove("flex");
    },
    destroy() {
      overlay.remove();
    },
  };
}
