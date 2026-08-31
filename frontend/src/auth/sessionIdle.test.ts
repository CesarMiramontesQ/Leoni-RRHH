import { beforeEach, describe, expect, it, vi } from "vitest";

const session = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => session.get(key) ?? null,
  setItem: (key: string, value: string) => {
    session.set(key, value);
  },
  removeItem: (key: string) => {
    session.delete(key);
  },
});

import {
  SessionIdleController,
  consumeIdleLogoutNotice,
  markIdleLogout,
  type IdleBusMessage,
} from "./sessionIdle.ts";

function makeBus() {
  const handlers = new Set<(msg: IdleBusMessage) => void>();
  const posted: IdleBusMessage[] = [];
  return {
    posted,
    post(msg: IdleBusMessage) {
      posted.push(msg);
      for (const h of handlers) h(msg);
    },
    subscribe(handler: (msg: IdleBusMessage) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

describe("SessionIdleController", () => {
  it("avisa a los 90 s y expira a los 120 s", () => {
    let now = 0;
    const warns: number[] = [];
    let expired = 0;
    const c = new SessionIdleController({
      now: () => now,
      timeoutSeconds: 120,
      onWarn: (s) => warns.push(s),
      onClearWarn: () => undefined,
      onExpire: () => {
        expired += 1;
      },
    });
    c.recordActivity();
    now = 90_000;
    c.tick();
    expect(warns).toEqual([30]);
    now = 120_000;
    c.tick();
    expect(expired).toBe(1);
    c.tick();
    expect(expired).toBe(1);
  });

  it("actividad tras el aviso limpia el modal", () => {
    let now = 0;
    let cleared = 0;
    const c = new SessionIdleController({
      now: () => now,
      timeoutSeconds: 120,
      onWarn: () => undefined,
      onClearWarn: () => {
        cleared += 1;
      },
      onExpire: () => undefined,
    });
    c.recordActivity();
    now = 90_000;
    c.tick();
    now = 91_000;
    c.recordActivity();
    expect(cleared).toBe(1);
  });

  it("un request de usuario pausa el reloj y al terminar conserva el tiempo restante", () => {
    let now = 0;
    let expired = 0;
    const warns: number[] = [];
    const c = new SessionIdleController({
      now: () => now,
      timeoutSeconds: 120,
      onWarn: (s) => warns.push(s),
      onClearWarn: () => undefined,
      onExpire: () => {
        expired += 1;
      },
    });
    c.recordActivity();
    now = 10_000;
    c.beginRequest();
    now = 200_000;
    c.tick();
    expect(expired).toBe(0);
    c.endRequest();
    c.tick();
    expect(expired).toBe(0);
    expect(warns).toEqual([]);
    now = 280_000;
    c.tick();
    expect(warns[0]).toBe(30);
  });

  it("timeout 0 no avisa ni expira", () => {
    let now = 0;
    let calls = 0;
    const c = new SessionIdleController({
      now: () => now,
      timeoutSeconds: 0,
      onWarn: () => {
        calls += 1;
      },
      onClearWarn: () => undefined,
      onExpire: () => {
        calls += 1;
      },
    });
    c.recordActivity();
    now = 999_000;
    c.tick();
    expect(calls).toBe(0);
  });

  it("publica actividad y reacciona a logout remoto", () => {
    const bus = makeBus();
    let expired = 0;
    const a = new SessionIdleController({
      now: () => 0,
      timeoutSeconds: 120,
      onWarn: () => undefined,
      onClearWarn: () => undefined,
      onExpire: () => {
        expired += 1;
      },
      bus,
    });
    a.recordActivity();
    expect(bus.posted.some((m) => m.type === "activity")).toBe(true);

    new SessionIdleController({
      now: () => 0,
      timeoutSeconds: 120,
      onWarn: () => undefined,
      onClearWarn: () => undefined,
      onExpire: () => {
        expired += 1;
      },
      bus,
    });
    bus.post({ type: "logout" });
    expect(expired).toBeGreaterThanOrEqual(1);
  });
});

describe("aviso de logout por inactividad", () => {
  beforeEach(() => session.clear());

  it("marca y consume el aviso una sola vez", () => {
    expect(consumeIdleLogoutNotice()).toBe(false);
    markIdleLogout();
    expect(consumeIdleLogoutNotice()).toBe(true);
    expect(consumeIdleLogoutNotice()).toBe(false);
  });
});
