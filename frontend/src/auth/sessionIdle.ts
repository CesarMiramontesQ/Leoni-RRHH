import { idleSecondsRemaining, resolveIdlePhase } from "./sessionIdlePolicy.ts";

export const IDLE_LOGOUT_REASON_KEY = "auth_logout_reason";
export const IDLE_LOGOUT_REASON = "idle";

export function markIdleLogout(): void {
  sessionStorage.setItem(IDLE_LOGOUT_REASON_KEY, IDLE_LOGOUT_REASON);
}

export function consumeIdleLogoutNotice(): boolean {
  const value = sessionStorage.getItem(IDLE_LOGOUT_REASON_KEY);
  sessionStorage.removeItem(IDLE_LOGOUT_REASON_KEY);
  return value === IDLE_LOGOUT_REASON;
}

export type IdleBusMessage =
  | { type: "activity"; at: number }
  | { type: "logout" };

export type IdleBus = {
  post(msg: IdleBusMessage): void;
  subscribe(handler: (msg: IdleBusMessage) => void): () => void;
};

export type SessionIdleControllerOpts = {
  now: () => number;
  timeoutSeconds: number;
  onWarn: (remainingSeconds: number) => void;
  onClearWarn: () => void;
  onExpire: () => void;
  bus?: IdleBus;
};

export class SessionIdleController {
  private lastActivityMs: number;
  private inFlight = 0;
  private pauseStartedAt: number | null = null;
  private showingWarn = false;
  private expired = false;
  private readonly unsub: (() => void) | undefined;

  constructor(private readonly opts: SessionIdleControllerOpts) {
    this.lastActivityMs = opts.now();
    this.unsub = opts.bus?.subscribe((msg) => this.onBus(msg));
  }

  stop(): void {
    this.unsub?.();
  }

  recordActivity(): void {
    if (this.expired) return;
    const t = this.opts.now();
    this.lastActivityMs = t;
    if (this.inFlight > 0) this.pauseStartedAt = t;
    if (this.showingWarn) {
      this.showingWarn = false;
      this.opts.onClearWarn();
    }
    this.opts.bus?.post({ type: "activity", at: t });
  }

  beginRequest(): void {
    if (this.expired) return;
    this.inFlight += 1;
    if (this.inFlight === 1) this.pauseStartedAt = this.opts.now();
  }

  endRequest(): void {
    if (this.inFlight <= 0) return;
    this.inFlight -= 1;
    if (this.inFlight === 0 && this.pauseStartedAt != null) {
      this.lastActivityMs += this.opts.now() - this.pauseStartedAt;
      this.pauseStartedAt = null;
    }
  }

  tick(): void {
    if (this.expired) return;
    const input = {
      nowMs: this.opts.now(),
      lastActivityMs: this.lastActivityMs,
      timeoutSeconds: this.opts.timeoutSeconds,
      inFlightCount: this.inFlight,
    };
    const phase = resolveIdlePhase(input);
    if (phase === "warn") {
      this.showingWarn = true;
      this.opts.onWarn(idleSecondsRemaining(input));
      return;
    }
    if (phase === "expired") {
      this.expire(false);
      return;
    }
    if (this.showingWarn) {
      this.showingWarn = false;
      this.opts.onClearWarn();
    }
  }

  private onBus(msg: IdleBusMessage): void {
    if (this.expired) return;
    if (msg.type === "activity") {
      this.lastActivityMs = msg.at;
      if (this.inFlight > 0) this.pauseStartedAt = this.opts.now();
      if (this.showingWarn) {
        this.showingWarn = false;
        this.opts.onClearWarn();
      }
      return;
    }
    this.expire(true);
  }

  private expire(fromRemote: boolean): void {
    if (this.expired) return;
    this.expired = true;
    if (this.showingWarn) {
      this.showingWarn = false;
      this.opts.onClearWarn();
    }
    if (!fromRemote) this.opts.bus?.post({ type: "logout" });
    this.opts.onExpire();
  }
}
