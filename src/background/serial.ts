/**
 * Returns a wrapper that runs calls to `task` one at a time, in call order. Used wherever
 * a read-modify-write of browser state must not interleave with itself.
 */
export function serialized<A extends unknown[], R>(
  task: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  let tail: Promise<unknown> = Promise.resolve();
  return (...args: A) => {
    const run = tail.then(() => task(...args));
    tail = run.catch(() => undefined);
    return run;
  };
}

/** Collapses bursts of calls into one call `delayMs` after the last. */
export function debounced(task: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(task, delayMs);
  };
}
