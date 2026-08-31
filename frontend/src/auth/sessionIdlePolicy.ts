export const WARN_LEAD_SECONDS = 30;

export type IdlePhase = "off" | "active" | "warn" | "expired";

export type IdleClockInput = {
  nowMs: number;
  lastActivityMs: number;
  timeoutSeconds: number;
  inFlightCount: number;
  warnLeadSeconds?: number;
};

export function resolveIdlePhase(input: IdleClockInput): IdlePhase {
  const timeout = input.timeoutSeconds;
  if (!Number.isFinite(timeout) || timeout <= 0) return "off";
  if (input.inFlightCount > 0) return "active";

  const elapsedSec = (input.nowMs - input.lastActivityMs) / 1000;
  if (elapsedSec >= timeout) return "expired";

  const warnLead = input.warnLeadSeconds ?? WARN_LEAD_SECONDS;
  const warnAt = Math.max(0, timeout - warnLead);
  if (elapsedSec >= warnAt) return "warn";
  return "active";
}

export function idleSecondsRemaining(input: IdleClockInput): number {
  if (!Number.isFinite(input.timeoutSeconds) || input.timeoutSeconds <= 0) return 0;
  const elapsedSec = (input.nowMs - input.lastActivityMs) / 1000;
  return Math.max(0, Math.ceil(input.timeoutSeconds - elapsedSec));
}
