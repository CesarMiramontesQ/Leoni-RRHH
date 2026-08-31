let begin = (): void => undefined;
let end = (): void => undefined;

export function bindIdlePause(nextBegin: () => void, nextEnd: () => void): void {
  begin = nextBegin;
  end = nextEnd;
}

export function unbindIdlePause(): void {
  begin = (): void => undefined;
  end = (): void => undefined;
}

export async function pauseIdleDuring<T>(fn: () => Promise<T>): Promise<T> {
  begin();
  try {
    return await fn();
  } finally {
    end();
  }
}
