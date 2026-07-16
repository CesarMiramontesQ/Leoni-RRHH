export type RenderCycleController = {
  next: () => AbortSignal;
  abort: () => void;
};

export function createRenderCycleController(
  unmountSignal: AbortSignal,
): RenderCycleController {
  let current: AbortController | null = null;

  function abort(): void {
    current?.abort();
    current = null;
  }

  return {
    next: () => {
      abort();
      current = new AbortController();
      if (unmountSignal.aborted) {
        current.abort();
      } else {
        const active = current;
        unmountSignal.addEventListener(
          "abort",
          () => active.abort(),
          { once: true, signal: active.signal },
        );
      }
      return current.signal;
    },
    abort,
  };
}
