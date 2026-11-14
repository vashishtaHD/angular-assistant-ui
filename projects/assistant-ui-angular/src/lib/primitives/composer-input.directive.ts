// Ported from packages/react/src/primitives/composer/ComposerInput.tsx @ 7d74276
// (the base text binding and autosize from packages/vue/src/primitives/ComposerPrimitiveInput.ts)
import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  type OnChanges,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';
import { flushTapSync } from '@assistant-ui/tap';
import { composerInputDisabled, composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAuiContext } from '../context/aui-context';
import { injectAui } from '../state/inject-aui';
import { injectAuiEvent } from '../state/inject-aui-event';
import { injectAuiState } from '../state/inject-aui-state';
import {
  AUI_COMPOSER_COMPACT,
  AUI_COMPOSER_INPUT_PLUGIN_REGISTRY,
  injectComposerCancelWithFocus,
  injectComposerRunStartFocusGuard,
  isCompositionKey,
} from './composer-input-support';
import { AUI_VIEWPORT } from './viewport-context';

const TOUCH_PRIMARY_QUERY = '(pointer: coarse) and (not (any-pointer: fine))';

/** How Enter submits the composer. */
export type AuiComposerSubmitMode = 'enter' | 'ctrlEnter' | 'none';

const optionalBoolean = (value: unknown): boolean | undefined =>
  value === undefined || value === null ? undefined : booleanAttribute(value);

/**
 * A textarea bound to the composer text, disabled while the thread is
 * disabled. The textarea grows with its content up to `maxRows` rows.
 *
 * Keyboard: `submitMode` `"enter"` (default) sends on Enter (Shift+Enter
 * inserts a newline), `"ctrlEnter"` sends on Ctrl/Cmd+Enter only, `"none"`
 * disables keyboard sending. IME composition is ignored, and an Enter that
 * cannot send (empty draft, or a run in flight on a runtime without queue
 * support) falls through to a newline. With the queue capability,
 * Ctrl/Cmd+Shift+Enter sends with `steer: true`. Escape cancels the run
 * (`cancelOnEscape`); cancelling an edit composer returns focus to the
 * thread composer. Pasted files become attachments (`addAttachmentOnPaste`)
 * when the thread accepts attachments.
 *
 * Focus (all need `autoFocus`, and only apply to the thread composer):
 * `focusOnRunStart`, `focusOnThreadSwitch` and `focusOnScrollToBottom`.
 *
 * While the composer is not editing, the value stays controlled to the empty
 * composer text. Resolves the composer through the nearest scope, so it also
 * works inside an edit composer.
 */
@Directive({
  selector: 'textarea[auiComposerInput]',
  standalone: true,
  host: {
    name: 'input',
    rows: '1',
    '[value]': 'text()',
    '[disabled]': 'isDisabled()',
    '(input)': 'onInput($event)',
    '(keydown)': 'onKeydown($event)',
    '(paste)': 'onPaste($event)',
    '(compositionstart)': 'composing = true',
    '(compositionend)': 'onCompositionEnd($event)',
    '(select)': 'onSelect($event)',
  },
})
export class AuiComposerInputDirective implements OnChanges {
  private readonly aui = injectAui();
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly plugins = inject(AUI_COMPOSER_INPUT_PLUGIN_REGISTRY, { optional: true });
  private readonly compact = inject(AUI_COMPOSER_COMPACT, { optional: true });
  private readonly canTakeFocusOnRunStart = injectComposerRunStartFocusGuard();
  private readonly cancelWithFocus = injectComposerCancelWithFocus(() =>
    this.aui.composer.cancel(),
  );

  /** Controls how Enter submits. Takes precedence over `submitOnEnter`. */
  readonly submitMode = input<AuiComposerSubmitMode | undefined>(undefined);
  /**
   * Whether pressing Enter (without Shift) sends the composer.
   * @deprecated Use `submitMode`; `false` is `submitMode="none"`.
   */
  readonly submitOnEnter = input<boolean | undefined, unknown>(undefined, {
    transform: optionalBoolean,
  });
  /** Whether Escape cancels the run (or the edit). */
  readonly cancelOnEscape = input(true, { transform: booleanAttribute });
  /** Whether pasted files are added as attachments. */
  readonly addAttachmentOnPaste = input(true, { transform: booleanAttribute });
  /** Focus the input on mount, and enable the `focusOn*` options. */
  readonly autoFocus = input(false, { transform: booleanAttribute });
  /** Focus the input when a run starts, when nothing outside the thread holds focus. */
  readonly focusOnRunStart = input(true, { transform: booleanAttribute });
  /** Focus the input when the viewport is scrolled to the bottom. */
  readonly focusOnScrollToBottom = input(true, { transform: booleanAttribute });
  /** Focus the input when the selected thread changes. */
  readonly focusOnThreadSwitch = input(true, { transform: booleanAttribute });
  /**
   * On a touch-primary device (`(pointer: coarse) and (not (any-pointer: fine))`),
   * plain Enter inserts a newline instead of sending. Only applies to
   * `submitMode="enter"`.
   */
  readonly insertNewlineOnTouchEnter = input(false, { transform: booleanAttribute });
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Maximum number of rows the textarea grows to before it scrolls. */
  readonly maxRows = input(8);

  /** @internal */
  composing = false;

  /** @internal */
  readonly text = injectAuiState((s) => {
    // `optional`: the composer scope is absent until the provider has created its client.
    const composer = s.optional.composer;
    return composer?.isEditing ? composer.text : '';
  });
  private readonly threadDisabled = injectAuiState(composerInputDisabled);
  private readonly sendDisabled = injectAuiState(composerSendDisabled);
  private lastText: string | undefined;
  private resizePending = false;
  private focusEnabled = false;

  constructor() {
    // Recompute the height when the composer text differs from the last
    // measured value (text set elsewhere). The initial value counts as a
    // change. The callback runs after the next render has applied `[value]`.
    this.scheduleResize();
    const unsubscribe = injectAuiContext().source.subscribe(() => {
      if (this.text() !== this.lastText) this.scheduleResize();
      this.syncFocus();
    });
    inject(DestroyRef).onDestroy(unsubscribe);

    afterNextRender(() => this.syncFocus(), { injector: this.injector });

    injectAuiEvent('thread.runStart', () => {
      if (!this.isThreadComposer() || !this.focusOnRunStart()) return;
      if (!this.canTakeFocusOnRunStart(this.el.nativeElement)) return;
      this.focus();
    });
    injectAuiEvent('threads.selectionChanged', () => {
      if (!this.isThreadComposer() || !this.focusOnThreadSwitch()) return;
      this.focus();
    });
    const viewport = inject(AUI_VIEWPORT, { optional: true });
    if (viewport) {
      const off = viewport.onScrollToBottom(() => {
        if (this.isThreadComposer() && this.focusOnScrollToBottom()) this.focus();
      });
      inject(DestroyRef).onDestroy(off);
    }
  }

  /** Focuses once `autoFocus` is on and the input is enabled. */
  ngOnChanges(): void {
    afterNextRender(() => this.syncFocus(), { injector: this.injector });
  }

  /** @internal */
  isDisabled(): boolean {
    return this.disabled() || this.threadDisabled();
  }

  /** @internal */
  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    if (!this.aui.composer.getState().isEditing) {
      target.value = this.text();
      return;
    }
    // Recover a stuck flag when the browser drops `compositionend`.
    if (this.composing && (event as InputEvent).isComposing === false) this.composing = false;
    const isComposing = (event as InputEvent).isComposing === true || this.composing;
    flushTapSync(() => this.aui.composer.setText(target.value, { origin: 'user' }));
    this.lastText = target.value;
    this.resize();
    if (!isComposing) this.reportCursor(target);
  }

  /** @internal */
  onCompositionEnd(event: Event): void {
    this.composing = false;
    if (!this.aui.composer.getState().isEditing) return;
    const target = event.target as HTMLTextAreaElement;
    flushTapSync(() => this.aui.composer.setText(target.value, { origin: 'user' }));
    this.reportCursor(target);
  }

  /** @internal */
  onSelect(event: Event): void {
    if (this.composing) return;
    this.reportCursor(event.target as HTMLTextAreaElement);
  }

  /** @internal */
  onKeydown(event: KeyboardEvent): void {
    if (isCompositionKey(event)) return;
    const plugins = this.plugins?.getPlugins() ?? [];

    if (event.key === 'Escape') {
      for (const plugin of plugins) if (plugin.handleKeyDown(event)) return;
      if (!this.cancelOnEscape()) return;
      if (this.aui.composer.getState().canCancel) {
        this.cancelWithFocus(this.el.nativeElement);
        event.preventDefault();
      }
      return;
    }

    if (event.defaultPrevented || this.isDisabled()) return;
    for (const plugin of plugins) if (plugin.handleKeyDown(event)) return;
    if (event.key !== 'Enter') return;

    const thread = this.aui.thread.getState();
    const hasQueue = thread.capabilities.queue;
    const declared = this.declaredSubmitMode();

    // Steer hotkey: Cmd/Ctrl+Shift+Enter.
    if (
      event.shiftKey &&
      (event.ctrlKey || event.metaKey) &&
      hasQueue &&
      declared !== 'none' &&
      this.aui.composer.getState().canSend
    ) {
      event.preventDefault();
      this.aui.composer.send({ steer: true });
      return;
    }

    if (event.shiftKey) return;
    // Block submission while running unless the queue is supported; a voice
    // session leaves the decision to canSend.
    if (thread.isRunning && !hasQueue && thread.voice === undefined) return;

    const mode = this.effectiveSubmitMode(declared);
    const shouldSubmit = mode === 'ctrlEnter' ? event.ctrlKey || event.metaKey : mode === 'enter';
    if (!shouldSubmit || this.sendDisabled()) return;
    event.preventDefault();
    // Submit through the containing form (validation and submit handlers run, the
    // root sends); a standalone input has no form and sends directly.
    const form = this.el.nativeElement.closest('form');
    if (form) form.requestSubmit();
    else this.aui.composer.send();
  }

  /** @internal */
  async onPaste(event: ClipboardEvent): Promise<void> {
    if (event.defaultPrevented || !this.addAttachmentOnPaste()) return;
    const files = Array.from(event.clipboardData?.files ?? []);
    if (!this.aui.thread.getState().capabilities.attachments || files.length === 0) return;
    event.preventDefault();
    await Promise.all(
      files.map(async (file) => {
        try {
          await this.aui.composer.addAttachment(file);
        } catch {
          // The composer runtime emits composer.attachmentAddError before rejecting.
        }
      }),
    );
  }

  private declaredSubmitMode(): AuiComposerSubmitMode {
    return this.submitMode() ?? (this.submitOnEnter() === false ? 'none' : 'enter');
  }

  private effectiveSubmitMode(declared: AuiComposerSubmitMode): AuiComposerSubmitMode {
    if (declared !== 'enter' || !this.insertNewlineOnTouchEnter()) return declared;
    const touchPrimary =
      typeof window !== 'undefined' && !!window.matchMedia?.(TOUCH_PRIMARY_QUERY).matches;
    return touchPrimary ? 'none' : declared;
  }

  private isThreadComposer(): boolean {
    return this.aui.composer.getState().type === 'thread';
  }

  private reportCursor(target: HTMLTextAreaElement): void {
    const plugins = this.plugins?.getPlugins();
    if (!plugins?.length) return;
    const pos = target.selectionStart ?? target.value.length;
    for (const plugin of plugins) plugin.setCursorPosition(pos);
  }

  /** Focuses when autoFocus becomes enabled (mount, or the input becoming enabled). */
  private syncFocus(): void {
    const enabled = this.autoFocus() && !this.isDisabled();
    if (enabled && !this.focusEnabled) this.focus();
    this.focusEnabled = enabled;
  }

  private focus(): void {
    const el = this.el.nativeElement;
    if (!this.autoFocus() || this.isDisabled()) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
  }

  private scheduleResize(): void {
    if (this.resizePending) return;
    this.resizePending = true;
    afterNextRender(
      () => {
        this.resizePending = false;
        const text = this.text();
        this.lastText = text;
        this.resize();
      },
      { injector: this.injector },
    );
  }

  private resize(): void {
    const el = this.el.nativeElement;
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    let lineHeight = parseFloat(style.lineHeight);
    if (Number.isNaN(lineHeight)) lineHeight = (parseFloat(style.fontSize) || 16) * 1.2;
    const max = this.maxRows() * lineHeight;
    const scrollHeight = el.scrollHeight;
    el.style.height = `${Math.min(scrollHeight, max)}px`;
    this.reportMultiline(el, style, lineHeight, scrollHeight);
  }

  private reportMultiline(
    el: HTMLTextAreaElement,
    style: CSSStyleDeclaration,
    row: number,
    scrollHeight: number,
  ): void {
    if (!this.compact) return;
    if (el.value === '') {
      this.compact.setMultiline(false);
      return;
    }
    const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const content = scrollHeight - padding;
    if (row > 0 && Math.round(content / row) > 1) this.compact.setMultiline(true);
  }
}
