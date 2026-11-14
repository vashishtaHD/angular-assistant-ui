// Ported from packages/vue/src/primitives/ComposerPrimitiveInput.ts @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import {
  DestroyRef,
  Directive,
  ElementRef,
  Injector,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
} from '@angular/core';
import { flushTapSync } from '@assistant-ui/tap';
import { composerInputDisabled, composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAuiContext } from '../context/aui-context';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';

/**
 * A textarea bound to the composer text, disabled while the thread is
 * disabled. Enter submits (Shift+Enter inserts a newline, IME composition is
 * ignored) unless `submitOnEnter` is false; an Enter that cannot send falls
 * through to a newline. While the composer is not editing, the value stays
 * controlled to the empty composer text.
 *
 * The textarea grows with its content up to `maxRows` rows.
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
  },
})
export class AuiComposerInputDirective {
  private readonly aui = injectAui();
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Whether pressing Enter (without Shift) sends the composer. */
  readonly submitOnEnter = input(true, { transform: booleanAttribute });
  /** Consumer-controlled disabled flag, combined with the store predicate. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Maximum number of rows the textarea grows to before it scrolls. */
  readonly maxRows = input(8);

  /** @internal */
  readonly text = injectAuiState((s) => (s.composer.isEditing ? s.composer.text : ''));
  private readonly threadDisabled = injectAuiState(composerInputDisabled);
  private readonly sendDisabled = injectAuiState(composerSendDisabled);
  private lastText: string | undefined;
  private resizePending = false;

  constructor() {
    // Recompute the height when the composer text differs from the last
    // measured value (text set elsewhere). The initial value counts as a
    // change. The callback runs after the next render has applied `[value]`.
    this.scheduleResize();
    const unsubscribe = injectAuiContext().source.subscribe(() => {
      if (this.text() !== this.lastText) this.scheduleResize();
    });
    inject(DestroyRef).onDestroy(unsubscribe);
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
    flushTapSync(() => this.aui.composer.setText(target.value, { origin: 'user' }));
    this.lastText = target.value;
    this.resize();
  }

  /** @internal */
  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || !this.submitOnEnter()) return;
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) {
      return;
    }
    if (this.sendDisabled() || this.isDisabled()) return;
    event.preventDefault();
    this.aui.composer.send();
  }

  private scheduleResize(): void {
    if (this.resizePending) return;
    this.resizePending = true;
    afterNextRender(
      () => {
        this.resizePending = false;
        let text: string;
        try {
          text = this.text();
        } catch {
          // The provider's client does not exist yet; its first store
          // notification re-schedules because the text is still unmeasured.
          return;
        }
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
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }
}
