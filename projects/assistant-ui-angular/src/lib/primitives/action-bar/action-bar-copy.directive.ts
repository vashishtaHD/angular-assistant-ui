// Ported from packages/core/src/react/primitive-hooks/useActionBarCopy.ts and packages/vue/src/primitives/actionBar.ts @ 7d74276
import {
  DestroyRef,
  Directive,
  NgZone,
  booleanAttribute,
  inject,
  input,
  numberAttribute,
} from '@angular/core';
import { actionBarCopyDisabled } from '@assistant-ui/core/store/internal';
import { getProxiedAssistantState } from '@assistant-ui/store/client';
import { flushTapSync } from '@assistant-ui/tap';
import { injectAuiContext } from '../../context/aui-context';
import { injectAui } from '../../state/inject-aui';
import { injectAuiState } from '../../state/inject-aui-state';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';
import { AUI_CLIPBOARD } from './clipboard';

/**
 * A button that copies the message text (or, while editing, the edit
 * composer text) through {@link AUI_CLIPBOARD}. `data-copied` is present for
 * `copiedDuration` milliseconds after a successful copy; moving to another
 * message or destroying the button cancels the timer and clears it. Disabled
 * while an assistant message is still running or the message has no text.
 *
 * @example
 * ```html
 * <button auiActionBarCopy [copiedDuration]="2000">Copy</button>
 * ```
 */
@Directive({
  selector: 'button[auiActionBarCopy]',
  standalone: true,
  hostDirectives: [AuiActionButtonHostDirective],
  host: { '[attr.data-copied]': 'isCopied() ? "" : null' },
})
export class AuiActionBarCopyDirective {
  /** Milliseconds `data-copied` stays set after a copy. */
  readonly copiedDuration = input(3000, { transform: numberAttribute });
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly aui = injectAui();
  private readonly source = injectAuiContext().source;
  private readonly clipboard = inject(AUI_CLIPBOARD);
  private readonly zone = inject(NgZone);
  private readonly blocked = injectAuiState(actionBarCopyDisabled);
  /** @internal */
  protected readonly isCopied = injectAuiState((s) => s.message.isCopied);
  private readonly isEditing = injectAuiState((s) => s.composer.isEditing);
  private readonly composerText = injectAuiState((s) => s.composer.text);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private feedbackTarget: ((value: boolean) => void) | undefined;
  private messageId: string | undefined;
  private destroyed = false;

  constructor() {
    this.messageId = this.currentMessageId();
    const unsubscribe = this.source.subscribe(() => {
      const id = this.currentMessageId();
      if (id === this.messageId) return;
      this.messageId = id;
      this.reset();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      unsubscribe();
      this.reset();
    });
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.copy(),
    });
  }

  private currentMessageId(): string | undefined {
    try {
      return getProxiedAssistantState(this.source.getClient()).optional.message?.id;
    } catch {
      // The message left the thread: its scope no longer resolves.
      return undefined;
    }
  }

  /** Cancels the pending timer and clears the copied flag on the message that set it. */
  private reset(): void {
    if (this.timer === undefined) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    const target = this.feedbackTarget;
    this.feedbackTarget = undefined;
    if (target) flushTapSync(() => target(false));
  }

  private copy(): void {
    const value = this.isEditing() ? this.composerText() : this.aui.message.getCopyText();
    if (!value) return;
    const copiedMessageId = this.aui.message.getState().id;
    const setIsCopied = this.aui.message.setIsCopied;
    let write: void | Promise<void>;
    try {
      // Synchronous, so clipboard user-gesture gating survives.
      write = this.clipboard(value);
    } catch {
      return;
    }
    Promise.resolve(write).then(
      () => {
        if (this.destroyed || this.currentMessageId() !== copiedMessageId) return;
        if (this.timer !== undefined) clearTimeout(this.timer);
        flushTapSync(() => {
          this.feedbackTarget?.(false);
          this.feedbackTarget = setIsCopied;
          setIsCopied(true);
        });
        const duration = this.copiedDuration();
        // Outside the zone: the timer must not hold the app unstable (SSR, whenStable).
        this.timer = this.zone.runOutsideAngular(() =>
          setTimeout(() => {
            this.timer = undefined;
            this.feedbackTarget = undefined;
            flushTapSync(() => setIsCopied(false));
          }, duration),
        );
      },
      () => undefined,
    );
  }
}
