// Ported from packages/react/src/primitives/actionBar/ActionBarRoot.tsx and useActionBarFloatStatus.ts @ 7d74276
import {
  Directive,
  InjectionToken,
  booleanAttribute,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { injectAuiState } from '../../state/inject-aui-state';

/** When the action bar hides itself automatically. */
export type AuiActionBarAutohide = 'always' | 'not-last' | 'never';
/** When the auto-hidden action bar floats. */
export type AuiActionBarAutohideFloat = 'always' | 'single-branch' | 'never';

/**
 * Lets nested controls (for example a menu) keep an auto-hidden action bar
 * visible while they are open. `acquireInteractionLock()` returns a release
 * function.
 */
export interface AuiActionBarInteraction {
  /** Keeps the bar visible until the returned function is called. */
  acquireInteractionLock(): () => void;
}

/** Provided by `[auiActionBarRoot]` to its content. */
export const AUI_ACTION_BAR_INTERACTION = new InjectionToken<AuiActionBarInteraction>(
  'assistant-ui.angular.action-bar-interaction',
);

type Status = 'hidden' | 'floating' | 'normal';

/**
 * The root of an action bar inside a message scope. Hides itself with the
 * `hidden` attribute (it stays in the DOM, so its content keeps state)
 * according to `hideWhenRunning` and `autohide`, and sets `data-floating`
 * while auto-hidden-but-visible and `autohideFloat` allows floating.
 *
 * An auto-hidden bar becomes visible while the message is hovered (see
 * `[auiMessageRoot]`), focus is within the bar, or a nested control holds an
 * interaction lock.
 *
 * @example
 * ```html
 * <div auiActionBarRoot autohide="not-last" hideWhenRunning>…</div>
 * ```
 */
@Directive({
  selector: '[auiActionBarRoot]',
  standalone: true,
  providers: [
    {
      provide: AUI_ACTION_BAR_INTERACTION,
      useExisting: forwardRef(() => AuiActionBarRootDirective),
    },
  ],
  host: {
    '[attr.hidden]': 'status() === "hidden" ? "" : null',
    '[attr.data-floating]': 'status() === "floating" ? "true" : null',
    '(focusin)': 'focusWithin.set(true)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class AuiActionBarRootDirective implements AuiActionBarInteraction {
  /** Hide while the thread is running or this message's run is in progress. */
  readonly hideWhenRunning = input(false, { transform: booleanAttribute });
  /** Auto-hide mode. */
  readonly autohide = input<AuiActionBarAutohide>('never');
  /** Float mode while auto-hidden but visible. */
  readonly autohideFloat = input<AuiActionBarAutohideFloat>('never');

  private readonly running = injectAuiState(
    (s) => s.thread.isRunning || s.message.runState === 'in-progress',
  );
  private readonly isLast = injectAuiState((s) => s.message.isLast);
  private readonly hovering = injectAuiState((s) => s.message.isHovering);
  private readonly branchCount = injectAuiState((s) => s.message.branchCount);
  /** @internal */
  protected readonly focusWithin = signal(false);
  private readonly locks = signal(0);

  /** @inheritdoc */
  acquireInteractionLock(): () => void {
    let released = false;
    this.locks.update((n) => n + 1);
    return () => {
      if (released) return;
      released = true;
      this.locks.update((n) => Math.max(0, n - 1));
    };
  }

  /** @internal */
  protected readonly status = computed<Status>(() => {
    if (this.hideWhenRunning() && this.running()) return 'hidden';
    const mode = this.autohide();
    const enabled = mode === 'always' || (mode === 'not-last' && !this.isLast());
    if (!enabled) return 'normal';
    if (!(this.locks() > 0 || this.focusWithin() || this.hovering())) return 'hidden';
    const float = this.autohideFloat();
    if (float === 'always' || (float === 'single-branch' && this.branchCount() <= 1)) {
      return 'floating';
    }
    return 'normal';
  });

  /** @internal */
  protected onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement;
    if (!host.contains(event.relatedTarget as Node | null)) this.focusWithin.set(false);
  }
}
