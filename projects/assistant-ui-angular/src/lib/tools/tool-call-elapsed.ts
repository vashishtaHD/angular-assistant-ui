// Ported from packages/react/src/hooks/useToolCallElapsed.ts @ 7d74276
import {
  DestroyRef,
  NgZone,
  assertInInjectionContext,
  computed,
  inject,
  signal,
  type Signal,
} from '@angular/core';
import { getProxiedAssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * Returns a signal of the elapsed wall-clock time of the current tool call in
 * milliseconds, ticking once per second while the call runs.
 *
 * Reads `part.timing`. The value is `undefined` when the part is not a tool
 * call, carries no timing, or ended without a recorded completion (the
 * duration is unknown), and when no message part scope is available, so kit
 * components stay renderable on their own. The clock is read only once the
 * signal is first read (from a template or a `computed`), and the ticking
 * interval runs only while the call runs; it stops when the call settles and
 * when the injection context is destroyed. Must be called in an injection
 * context.
 *
 * @example
 * ```ts
 * readonly elapsedMs = injectToolCallElapsed();
 * // template: @if (elapsedMs() !== undefined) { <span>{{ elapsedMs()! / 1000 }}s</span> }
 * ```
 */
export function injectToolCallElapsed(): Signal<number | undefined> {
  assertInInjectionContext(injectToolCallElapsed);
  const { source } = injectAuiContext();
  const zone = inject(NgZone);

  // Bumped by store updates and clock ticks, never from inside the computed.
  const version = signal(0);
  let interval: ReturnType<typeof setInterval> | undefined;
  let now: number | undefined;
  let started = false;
  let destroyed = false;

  const stop = () => {
    if (interval !== undefined) clearInterval(interval);
    interval = undefined;
    now = undefined;
  };

  const timingOf = () => {
    const part = getProxiedAssistantState(source.getClient()).optional.part;
    if (part?.type !== 'tool-call') return { timing: undefined, running: false };
    return { timing: part.timing, running: part.status.type === 'running' };
  };

  // Starts or stops the clock to match the part. Writes no signal.
  const sync = () => {
    if (destroyed) return;
    const { timing, running } = timingOf();
    const ticking = running && timing !== undefined && timing.completedAt === undefined;
    if (!ticking) {
      stop();
      return;
    }
    if (interval !== undefined) return;
    now = Date.now();
    // Outside the zone so a running call does not keep the app unstable; the
    // signal write schedules change detection on its own.
    interval = zone.runOutsideAngular(() =>
      setInterval(() => {
        now = Date.now();
        version.update((v) => v + 1);
      }, 1000),
    );
  };

  const unsubscribe = source.subscribe(() => {
    if (started) sync();
    version.update((v) => v + 1);
  });
  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    unsubscribe();
    stop();
  });

  return computed(() => {
    version();
    if (!started) {
      started = true;
      sync();
    }
    const { timing } = timingOf();
    if (timing === undefined) return undefined;
    if (timing.completedAt !== undefined) return Math.max(0, timing.completedAt - timing.startedAt);
    if (interval === undefined || now === undefined) return undefined;
    return Math.max(0, now - timing.startedAt);
  });
}
