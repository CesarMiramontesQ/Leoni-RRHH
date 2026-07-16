import { describe, expect, it } from "vitest";
import { createRenderCycleController } from "./renderCycle.ts";

describe("renderCycle", () => {
  it("un repaint aborta listeners del render anterior y conserva el actual", () => {
    const unmount = new AbortController();
    const cycle = createRenderCycleController(unmount.signal);
    const target = new EventTarget();
    let oldCalls = 0;
    let currentCalls = 0;

    target.addEventListener("change", () => {
      oldCalls += 1;
    }, { signal: cycle.next() });
    target.addEventListener("change", () => {
      currentCalls += 1;
    }, { signal: cycle.next() });
    target.dispatchEvent(new Event("change"));

    expect(oldCalls).toBe(0);
    expect(currentCalls).toBe(1);

    unmount.abort();
    target.dispatchEvent(new Event("change"));
    expect(currentCalls).toBe(1);
  });
});
