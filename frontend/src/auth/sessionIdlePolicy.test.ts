import { describe, expect, it } from "vitest";
import {
  WARN_LEAD_SECONDS,
  idleSecondsRemaining,
  resolveIdlePhase,
} from "./sessionIdlePolicy.ts";

const TIMEOUT = 120;

function at(lastActivityMs: number, nowMs: number, extra?: { inFlightCount?: number; timeoutSeconds?: number }) {
  return resolveIdlePhase({
    nowMs,
    lastActivityMs,
    timeoutSeconds: extra?.timeoutSeconds ?? TIMEOUT,
    inFlightCount: extra?.inFlightCount ?? 0,
  });
}

describe("resolveIdlePhase", () => {
  it("timeout 0 deja el idle apagado", () => {
    expect(at(0, 999_000, { timeoutSeconds: 0 })).toBe("off");
  });

  it("timeout negativo se trata como apagado", () => {
    expect(at(0, 999_000, { timeoutSeconds: -5 })).toBe("off");
  });

  it("con request de usuario en vuelo no expira aunque el reloj de pared ya pasó", () => {
    expect(at(0, 200_000, { inFlightCount: 1 })).toBe("active");
  });

  it("antes del aviso sigue activo", () => {
    const warnAtMs = (TIMEOUT - WARN_LEAD_SECONDS) * 1000;
    expect(at(0, warnAtMs - 1)).toBe("active");
  });

  it("a los 90 s entra en aviso (quedan 30 s)", () => {
    expect(at(0, 90_000)).toBe("warn");
    expect(idleSecondsRemaining({ nowMs: 90_000, lastActivityMs: 0, timeoutSeconds: TIMEOUT, inFlightCount: 0 })).toBe(30);
  });

  it("un milisegundo antes de los 120 s sigue en aviso", () => {
    expect(at(0, 119_999)).toBe("warn");
  });

  it("a los 120 s expira", () => {
    expect(at(0, 120_000)).toBe("expired");
    expect(idleSecondsRemaining({ nowMs: 120_000, lastActivityMs: 0, timeoutSeconds: TIMEOUT, inFlightCount: 0 })).toBe(0);
  });
});
