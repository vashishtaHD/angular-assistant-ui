// Ported from packages/react/src/unstable/useMessageStallDetection.ts @ 7d74276
import { DestroyRef, assertInInjectionContext, computed, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { getProxiedAssistantState } from '@assistant-ui/store/client';
import { injectAuiContext } from '../context/aui-context';

/**
 * Options for {@link injectMessageStallDetection}.
 *
 * @deprecated Experimental (`unstable_` upstream since 2026-06-13). The API may change in any release.
 */
export interface MessageStallDetectionOptions {
  /**
   * Milliseconds of unchanged message content before the message counts as
   * stalled.
   * @default 2000
   */
  thresholdMs?: number | undefined;
}

/**
 * The result of {@link injectMessageStallDetection}.
 *
 * @deprecated Experimental (`unstable_` upstream since 2026-06-13). The API may change in any release.
 */
export interface MessageStallDetection {
  /** True while the message is running and its content has not changed for at least `thresholdMs`. */
  readonly stalled: boolean;
  /** Milliseconds since the last observed content change, refreshed every second. `0` while not stalled. */
  readonly stalledForMs: number;
}

const NOT_STALLED: MessageStallDetection = Object.freeze({ stalled: false, stalledForMs: 0 });

const sameValues = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/**
 * Detects mid-run output stalls on the current message. While the message is
 * running it watches its text, reasoning and tool-argument values plus
 * tool-result availability, and reports a stall once they stop changing for
 * `thresholdMs`. Useful for re-surfacing a "still working" indicator during
 * tool think-time or provider stalls, after the first tokens have streamed.
 *
 * Must be called in an injection context inside a message scope. The result
 * is evaluated on first read, so read it from a template or a `computed`.
 * Timers are cleared when the context is destroyed.
 *
 * @example
 * ```ts
 * readonly stall = injectMessageStallDetection({ thresholdMs: 3000 });
 * // template: @if (stall().stalled) { <span>Still working...</span> }
 * ```
 *
 * @deprecated Experimental (`unstable_` upstream since 2026-06-13). The API may change in any release.
 */
export function injectMessageStallDetection(
  options?: MessageStallDetectionOptions,
): Signal<MessageStallDetection> {
  assertInInjectionContext(injectMessageStallDetection);
  const thresholdMs = options?.thresholdMs ?? 2000;
  const source = injectAuiContext().source;

  const state = signal<MessageStallDetection>(NOT_STALLED);
  let current = NOT_STALLED;
  let last: readonly unknown[] | undefined;
  let lastActivity = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;

  // Signal writes only happen from timers and store callbacks, never from the
  // computed's first evaluation (which publishes nothing new).
  const publish = (next: MessageStallDetection) => {
    if (next === current) return;
    current = next;
    state.set(next);
  };

  const clearTimers = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    if (interval !== undefined) clearInterval(interval);
    timeout = interval = undefined;
  };

  const readActivity = (): unknown[] => {
    const message = getProxiedAssistantState(source.getClient()).message;
    if (message.status?.type !== 'running') return [false];
    const values: unknown[] = [true, message.content.length];
    for (const part of message.content) {
      if (part.type === 'text' || part.type === 'reasoning') {
        values.push(part.type, part.text);
      } else if (part.type === 'tool-call') {
        values.push(part.type, part.argsText, part.result !== undefined);
      } else {
        values.push(part.type);
      }
    }
    return values;
  };

  const stall = () => {
    publish({ stalled: true, stalledForMs: Math.max(0, Date.now() - lastActivity) });
    interval = setInterval(
      () => publish({ stalled: true, stalledForMs: Math.max(0, Date.now() - lastActivity) }),
      1000,
    );
  };

  const evaluate = () => {
    const values = readActivity();
    if (last && sameValues(values, last)) return;
    last = values;
    clearTimers();
    publish(NOT_STALLED);
    if (values[0] !== true) return;
    lastActivity = Date.now();
    timeout = setTimeout(() => {
      timeout = undefined;
      stall();
    }, thresholdMs);
  };

  const unsubscribe = source.subscribe(() => evaluate());
  inject(DestroyRef).onDestroy(() => {
    unsubscribe();
    clearTimers();
  });

  let started = false;
  return computed(() => {
    if (!started) {
      started = true;
      evaluate();
    }
    return state();
  });
}
