// Ported from packages/react/src/utils/smooth/useSmooth.ts @ 7d74276
import {
  DestroyRef,
  assertInInjectionContext,
  computed,
  inject,
  isSignal,
  signal,
  type Signal,
} from '@angular/core';
import type { PartStatus } from './group-parts';

/** Tuning options for the smooth text streaming animation. */
export interface SmoothOptions {
  /**
   * Target time in milliseconds to drain the backlog of unrevealed
   * characters. Larger values reveal long backlogs more gradually.
   * @default 250
   */
  drainMs?: number | undefined;
  /**
   * Maximum time in milliseconds between revealed characters, i.e. the
   * slowest reveal rate when the backlog is short.
   * @default 5
   */
  maxCharIntervalMs?: number | undefined;
  /**
   * Maximum number of characters revealed per animation frame.
   * @default Infinity
   */
  maxCharsPerFrame?: number | undefined;
  /**
   * Minimum time in milliseconds between committed updates. The reveal keeps
   * advancing every frame, but the visible text is committed at most once per
   * interval. The final frame always commits. `0` commits every frame.
   * @default 0
   */
  minCommitMs?: number | undefined;
}

/** The `smooth` argument: `false` disables, `true` uses defaults, an object tunes. */
export type SmoothInput = boolean | SmoothOptions | null | undefined;

/** The smoothed text and the status it should report. */
export interface SmoothState {
  /** The revealed prefix of the source text. */
  readonly text: string;
  /** `running` until the reveal has caught up with the source, then the source status. */
  readonly status: PartStatus;
}

const DEFAULT_DRAIN_MS = 250;
const DEFAULT_MAX_CHAR_INTERVAL_MS = 5;
const SMOOTH_STATUS: PartStatus = Object.freeze({ type: 'running' });

const positiveOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && value > 0 ? value : fallback;

class TextStreamAnimator {
  private frameId: number | null = null;
  private lastUpdateTime = 0;
  lastCommitTime = -Infinity;

  targetText = '';
  drainMs = DEFAULT_DRAIN_MS;
  maxCharIntervalMs = DEFAULT_MAX_CHAR_INTERVAL_MS;
  maxCharsPerFrame = Infinity;
  minCommitMs = 0;

  /** The reveal cursor; advances every frame. */
  currentText = '';
  /** The visible text; follows `currentText` at most once per `minCommitMs`. */
  committedText = '';
  initialized = false;

  constructor(private readonly onCommit: () => void) {}

  start(): void {
    if (this.frameId !== null || this.currentText === this.targetText) return;
    this.lastUpdateTime = performance.now();
    // Always asynchronous: start() runs inside a computed, which must not
    // write signals, and a frame commits through one.
    this.frameId = requestAnimationFrame(() => this.animate());
  }

  stop(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /** Jumps to `text` with nothing pending. */
  snapTo(text: string): void {
    this.stop();
    this.currentText = text;
    this.targetText = text;
    this.committedText = text;
    this.lastCommitTime = -Infinity;
  }

  private readonly animate = (): void => {
    const currentTime = performance.now();
    let timeToConsume = currentTime - this.lastUpdateTime;

    const remainingChars = this.targetText.length - this.currentText.length;
    const baseTimePerChar = Math.min(this.maxCharIntervalMs, this.drainMs / remainingChars);

    const frameLimit = Math.min(remainingChars, this.maxCharsPerFrame);
    let charsToAdd = 0;
    while (timeToConsume >= baseTimePerChar && charsToAdd < frameLimit) {
      charsToAdd++;
      timeToConsume -= baseTimePerChar;
    }
    // A cap-limited frame must not bank its surplus time, or the next frame
    // would burst past the cap.
    if (charsToAdd === frameLimit && frameLimit === this.maxCharsPerFrame) timeToConsume = 0;

    this.frameId =
      charsToAdd !== remainingChars ? requestAnimationFrame(() => this.animate()) : null;
    if (charsToAdd === 0) return;

    this.currentText = this.targetText.slice(0, this.currentText.length + charsToAdd);
    this.lastUpdateTime = currentTime - timeToConsume;

    const isComplete = charsToAdd === remainingChars;
    if (isComplete || currentTime - this.lastCommitTime >= this.minCommitMs) {
      this.lastCommitTime = currentTime;
      this.committedText = this.currentText;
      this.onCommit();
    }
  };
}

/** Signal of whether the user prefers reduced motion; `false` without `matchMedia`. */
function injectPrefersReducedMotion(): Signal<boolean> {
  const value = signal(false);
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return value;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  value.set(query.matches);
  const listener = (event: MediaQueryListEvent) => value.set(event.matches);
  query.addEventListener('change', listener);
  inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
  return value;
}

const read = <T>(value: T | Signal<T>): T => (isSignal(value) ? value() : value);

/**
 * Animates streamed text with a typewriter-style reveal and returns both the
 * revealed text and the status to report: `running` until the reveal has
 * caught up with the source. {@link injectSmooth} is this without the status.
 *
 * The reveal is driven by `requestAnimationFrame` (no `effect`). It is
 * disabled, passing the source through untouched, when `smooth` is `false`,
 * when `prefers-reduced-motion: reduce` matches (this wins over `true`), or
 * when `requestAnimationFrame` does not exist. If the source settles before
 * any character has been revealed, its text is committed immediately so a
 * missed frame cannot leave an empty bubble.
 *
 * Must be called in an injection context.
 */
export function injectSmoothState(
  text: Signal<string>,
  status: Signal<PartStatus>,
  smooth: SmoothInput | Signal<SmoothInput> = true,
): Signal<SmoothState> {
  assertInInjectionContext(injectSmoothState);
  const reduceMotion = injectPrefersReducedMotion();
  const tick = signal(0);
  const animator = new TextStreamAnimator(() => tick.update((v) => v + 1));
  inject(DestroyRef).onDestroy(() => animator.stop());

  // A computed (not an effect) drives the animator: it only starts frames
  // and rewrites plain fields; signals are written from the frame callback.
  return computed<SmoothState>(() => {
    tick();
    const source = text();
    const sourceStatus = status();
    const running = sourceStatus.type === 'running';
    const input = read(smooth);
    const options = typeof input === 'object' && input !== null ? input : undefined;
    const canAnimate = typeof requestAnimationFrame === 'function';
    const enabled = input !== false && input !== null && !reduceMotion() && canAnimate;

    if (!enabled) {
      if (canAnimate) animator.snapTo(source);
      animator.initialized = false;
      return { text: source, status: sourceStatus };
    }

    animator.drainMs = positiveOr(options?.drainMs, DEFAULT_DRAIN_MS);
    animator.maxCharIntervalMs = positiveOr(
      options?.maxCharIntervalMs,
      DEFAULT_MAX_CHAR_INTERVAL_MS,
    );
    animator.maxCharsPerFrame = positiveOr(options?.maxCharsPerFrame, Infinity);
    animator.minCommitMs = positiveOr(options?.minCommitMs, 0);

    const discontinuous =
      !animator.initialized ||
      !source.startsWith(animator.committedText) ||
      !source.startsWith(animator.targetText);
    if (discontinuous) {
      // First run, a new part, or text that is not an extension of what was
      // shown: restart the reveal (a settled source shows in full at once).
      animator.initialized = true;
      animator.snapTo(running ? '' : source);
      animator.targetText = source;
      animator.start();
    } else {
      animator.targetText = source;
      if (!running && animator.currentText === '') {
        // No character has painted; a pending frame that never runs would
        // leave an empty bubble after the source settles.
        animator.snapTo(source);
      } else {
        animator.start();
      }
    }

    const shown = animator.committedText;
    return { text: shown, status: source === shown ? sourceStatus : SMOOTH_STATUS };
  });
}

/**
 * Animates streamed text with a typewriter-style reveal and returns the
 * revealed prefix as a signal. `status` says whether the source is still
 * streaming; once it settles the reveal keeps going until it has caught up
 * with the full text. `opts` is `false` (off), `true` (default rate, the
 * default) or {@link SmoothOptions}, as a value or a signal.
 *
 * Disabled under `prefers-reduced-motion: reduce`, which wins over `true`.
 * Must be called in an injection context. Use {@link injectSmoothState} to
 * also read the status the animation reports.
 *
 * @example
 * ```ts
 * readonly shown = injectSmooth(this.text, this.status, { drainMs: 500 });
 * ```
 */
export function injectSmooth(
  text: Signal<string>,
  status: Signal<PartStatus>,
  opts?: SmoothInput | Signal<SmoothInput>,
): Signal<string> {
  const state = injectSmoothState(text, status, opts);
  return computed(() => state().text);
}
