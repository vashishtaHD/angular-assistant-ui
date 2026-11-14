// Ported from packages/react/src/primitives/composer/{composerInputSelector,ComposerInputPluginContext,ComposerCompactContext,useComposerRunStartFocusGuard,useComposerCancelWithFocus}.ts @ 7d74276
import { ElementRef, InjectionToken, inject } from '@angular/core';
import { injectAui } from '../state/inject-aui';

/** Matches a contenteditable element that is not `contenteditable="false"`. */
export const CONTENT_EDITABLE_SELECTOR = "[contenteditable]:not([contenteditable='false'])";

/** Matches the element a composer root focuses when blank form space is clicked. */
export const COMPOSER_INPUT_SELECTOR = `textarea:not(:disabled), ${CONTENT_EDITABLE_SELECTOR}`;

const COMPOSER_SELECTOR = '[data-aui-composer-type]';
const THREAD_SELECTOR = '[data-aui-thread-root]';

/**
 * Provided by `[auiThreadRoot]`: the thread's root element. A composer rendered
 * in a portal outside the thread root still finds the thread it belongs to.
 */
export const AUI_THREAD_ROOT_ELEMENT = new InjectionToken<ElementRef<HTMLElement>>(
  'assistant-ui.angular.thread-root-element',
);

/** Provided by `[auiComposerRoot]`: lets the input report multi-line content in compact mode. */
export interface AuiComposerCompact {
  /** Marks the composer content as spanning more than one line (or not). */
  setMultiline(value: boolean): void;
}

/** Injection token for the nearest composer root's compact-mode channel. */
export const AUI_COMPOSER_COMPACT = new InjectionToken<AuiComposerCompact>(
  'assistant-ui.angular.composer-compact',
);

/**
 * A plugin that intercepts keyboard events and cursor changes in the composer
 * input (trigger popovers use it to handle navigation without the input
 * knowing about specific triggers).
 */
export interface AuiComposerInputPlugin {
  /** Handles a key event. Return true when consumed (stops other plugins and default behaviour). */
  handleKeyDown(e: KeyboardEvent): boolean;
  /** Called on every cursor position change. */
  setCursorPosition(pos: number): void;
}

/** The registry of {@link AuiComposerInputPlugin}s, read at event time. */
export interface AuiComposerInputPluginRegistry {
  /** Registers a plugin; higher `priority` receives events first. Returns an unregister function. */
  register(plugin: AuiComposerInputPlugin, opts?: { priority?: number }): () => void;
  /** The registered plugins in priority order. */
  getPlugins(): readonly AuiComposerInputPlugin[];
}

/** Injection token for the nearest {@link AuiComposerInputPluginRegistry}, if any. */
export const AUI_COMPOSER_INPUT_PLUGIN_REGISTRY =
  new InjectionToken<AuiComposerInputPluginRegistry>('assistant-ui.angular.composer-input-plugins');

/**
 * Whether a keydown belongs to an IME composition. The Enter that commits one
 * can arrive after `compositionend` with `isComposing` false and `keyCode` 229
 * (Safari).
 */
export const isCompositionKey = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === 229;

/**
 * Decides whether a run start may move focus into a composer: focus moves only
 * when it is not somewhere outside the composer and outside the composer's thread.
 */
export type ComposerRunStartFocusGuard = (composerElement: HTMLElement | null) => boolean;

/**
 * The run-start focus decision `[auiComposerInput]` makes, for other composer
 * implementations that need the same call. The thread root comes from
 * {@link AUI_THREAD_ROOT_ELEMENT}, so a composer portaled outside the thread
 * root still knows which thread it belongs to. Returns `false` for a missing
 * element, and for the element itself already holding focus.
 *
 * Must be called in an injection context.
 */
export function injectComposerRunStartFocusGuard(): ComposerRunStartFocusGuard {
  const threadRoot = inject(AUI_THREAD_ROOT_ELEMENT, { optional: true });
  return (composerElement) => {
    if (!composerElement) return false;
    const doc = composerElement.ownerDocument;
    const active = doc.activeElement;
    if (!active || active === doc.body) return true;
    if (active === composerElement) return false;

    const composerRoot = composerElement.closest(COMPOSER_SELECTOR);
    if (composerRoot?.contains(active)) return true;

    const root = threadRoot?.nativeElement ?? null;
    return root !== null && root.contains(active) && active.closest(THREAD_SELECTOR) === root;
  };
}

/**
 * Returns a cancel function that, after cancelling an edit composer, returns
 * focus to the thread's main composer input unless a handler has moved focus.
 * Must be called in an injection context.
 */
export function injectComposerCancelWithFocus(
  cancel: () => void,
): (source: HTMLElement | null) => void {
  const aui = injectAui();
  const threadRoot = inject(AUI_THREAD_ROOT_ELEMENT, { optional: true });
  return (source) => {
    const root = threadRoot?.nativeElement ?? null;
    const doc = source?.ownerDocument;
    const active = doc?.activeElement;
    const composer = source?.closest(COMPOSER_SELECTOR);
    const shouldRestore =
      aui.composer.getState().type === 'edit' &&
      root &&
      active &&
      composer?.getAttribute('data-aui-composer-type') === 'edit' &&
      composer.contains(active) &&
      composer.closest(THREAD_SELECTOR) === root;
    const candidates = shouldRestore
      ? Array.from(root.querySelectorAll<HTMLElement>(COMPOSER_INPUT_SELECTOR)).filter(
          (input) =>
            input.closest(THREAD_SELECTOR) === root &&
            input.closest(COMPOSER_SELECTOR)?.getAttribute('data-aui-composer-type') === 'thread',
        )
      : [];

    cancel();

    if (!doc || !active || !shouldRestore) return;
    if (doc.activeElement !== active && doc.activeElement !== doc.body) return;

    for (const input of candidates) {
      if (!input.isConnected || input.closest('[hidden], [inert]')) continue;
      input.focus({ preventScroll: true });
      if (doc.activeElement !== active && doc.activeElement !== doc.body) break;
    }
  };
}
