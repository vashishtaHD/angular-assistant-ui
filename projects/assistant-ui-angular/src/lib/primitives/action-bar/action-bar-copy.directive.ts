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
import { hasMessage } from '../../scope/message-scope';
import { AuiActionButtonHostDirective, injectActionButton } from '../action-button';
import { AUI_CLIPBOARD } from './clipboard';

interface ScopeIdentity {
  id: string | undefined;
  token: unknown;
}

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
  private feedbackTarget:
    { id: string; set: (value: boolean) => void; isAlive: () => boolean } | undefined;
  private scope: ScopeIdentity;
  /** Bumped whenever the message scope changes; invalidates pending writes. */
  private generation = 0;
  private destroyed = false;

  constructor() {
    this.scope = this.currentScope();
    const unsubscribe = this.source.subscribe(() => {
      const next = this.currentScope();
      if (next.id === this.scope.id && next.token === this.scope.token) return;
      this.scope = next;
      this.generation++;
      this.reset();
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.generation++;
      unsubscribe();
      this.release();
    });
    injectActionButton({
      disabled: () => this.disabled() || this.blocked(),
      onClick: () => this.copy(),
    });
  }

  /**
   * The message in scope: its id plus an identity token for the bound client.
   * The scope facade is stable, so the token is the runtime-backed message's
   * runtime when core exposes it, otherwise the client's own `setIsCopied`
   * method (the very function this button writes feedback through): either
   * changes exactly when the scope binds a different client instance.
   */
  private currentScope(): ScopeIdentity {
    try {
      const client = this.source.getClient();
      const runtime = (
        client.message() as { __internal_getRuntime?: () => unknown }
      ).__internal_getRuntime?.();
      return {
        id: getProxiedAssistantState(client).optional.message?.id,
        token: runtime ?? client.message.setIsCopied,
      };
    } catch {
      // The message left the thread: its scope no longer resolves.
      return { id: undefined, token: undefined };
    }
  }

  /**
   * Answers "does the message that owns the feedback flag still exist?" from
   * the ownership captured at copy time, so switching the provider to another
   * thread is not mistaken for deleting the message.
   */
  private ownerAliveCheck(id: string): () => boolean {
    const ownerToken = this.scope.token;
    try {
      const thread = this.source.getClient().thread() as {
        __internal_getRuntime?: () => {
          getState(): { messages: readonly { id: string }[] };
        };
      };
      const threadRuntime = thread.__internal_getRuntime?.();
      if (threadRuntime) {
        return () => threadRuntime.getState().messages.some((message) => message.id === id);
      }
    } catch {
      // Fall through to the scope-based check.
    }
    // Without a runtime: while the owner is still bound, ask the live thread;
    // once the scope moved to another client the owner can only have been switched away from.
    return () => this.scope.token !== ownerToken || hasMessage(this.aui, id);
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /**
   * The scope moved: cancel the timer and clear the flag now if the new scope
   * still holds the message. Otherwise keep the target; the row is about to be
   * torn down and {@link release} clears it once that is safe.
   */
  private reset(): void {
    this.cancelTimer();
    const target = this.feedbackTarget;
    if (target && this.resolvesMessage(target.id)) this.clearFeedback(false);
  }

  /** Teardown: cancel the timer and clear whatever flag this button still owns. */
  private release(): void {
    this.cancelTimer();
    this.clearFeedback(true);
  }

  private clearFeedback(deferWhenUnresolved: boolean): void {
    const target = this.feedbackTarget;
    this.feedbackTarget = undefined;
    // A deleted message has no flag left to clear (and its scope would throw);
    // a message merely switched away from still does.
    if (!target?.isAlive()) return;
    const clear = () => {
      try {
        flushTapSync(() => target.set(false));
      } catch {
        // The owner was torn down meanwhile: nothing left to clear.
      }
    };
    if (!deferWhenUnresolved || this.resolvesMessage(target.id)) {
      clear();
    } else {
      // The current scope no longer holds the message but its owner does:
      // writing now would re-resolve scopes that are still being torn down.
      // Do it once they are gone.
      this.zone.runOutsideAngular(() => setTimeout(clear, 0));
    }
  }

  private resolvesMessage(id: string): boolean {
    try {
      return hasMessage(this.aui, id);
    } catch {
      return false;
    }
  }

  private copy(): void {
    const value = this.isEditing() ? this.composerText() : this.aui.message.getCopyText();
    if (!value) return;
    const copiedMessageId = this.aui.message.getState().id;
    const generation = this.generation;
    const isAlive = this.ownerAliveCheck(copiedMessageId);
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
        if (this.destroyed || generation !== this.generation) return;
        if (this.timer !== undefined) clearTimeout(this.timer);
        flushTapSync(() => {
          this.feedbackTarget?.set(false);
          this.feedbackTarget = { id: copiedMessageId, set: setIsCopied, isAlive };
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
