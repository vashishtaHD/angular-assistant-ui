// Ported from packages/react/src/primitives/composer/ComposerRoot.tsx @ 7d74276
// (submit wiring from packages/vue/src/primitives/useComposerSendState.ts)
import { Directive, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { composerSendDisabled } from '@assistant-ui/core/store/internal';
import { injectAui } from '../state/inject-aui';
import { injectAuiState } from '../state/inject-aui-state';
import {
  AUI_COMPOSER_COMPACT,
  type AuiComposerCompact,
  COMPOSER_INPUT_SELECTOR,
  CONTENT_EDITABLE_SELECTOR,
} from './composer-input-support';

// Keeps tabindex="-1": roving-tabindex widgets click-focus items at -1.
const INTERACTIVE_ELEMENT_SELECTOR = [
  'a',
  'audio[controls]',
  'button',
  'details',
  'embed',
  'iframe',
  'input',
  'label',
  'select',
  'summary',
  'textarea',
  'video[controls]',
  CONTENT_EDITABLE_SELECTOR,
  '[tabindex]',
].join(', ');

/**
 * Marks a `<form>` as the composer root. Submitting the form sends the
 * composer (and prevents the native navigation) unless sending is disabled.
 * Clicking blank form space focuses the composer input. Sets
 * `data-aui-composer-type` (`thread` or `edit`).
 *
 * With `compact`, the root renders `data-compact` while the input holds at
 * most one line and there are no attachments, quote, queued messages or active
 * dictation, so styles can collapse the composer into a single row.
 */
@Directive({
  selector: 'form[auiComposerRoot]',
  standalone: true,
  providers: [
    { provide: AUI_COMPOSER_COMPACT, useExisting: forwardRef(() => AuiComposerRootDirective) },
  ],
  host: {
    '[attr.data-aui-composer-type]': 'composerType()',
    '[attr.data-compact]': 'isCompact() ? "" : null',
    '(submit)': 'onSubmit($event)',
    '(mousedown)': 'onMouseDown($event)',
  },
})
export class AuiComposerRootDirective implements AuiComposerCompact {
  private readonly aui = injectAui();
  private readonly sendDisabled = injectAuiState(composerSendDisabled);
  /** @internal */
  protected readonly composerType = injectAuiState((s) => s.optional.composer?.type);
  private readonly stateAllowsCompact = injectAuiState((s) => {
    const composer = s.optional.composer;
    return composer
      ? composer.attachments.length === 0 &&
          composer.quote == null &&
          composer.queue.length === 0 &&
          composer.dictation == null &&
          !composer.text.includes('\n')
      : false;
  });

  /** Opt into compact mode (see the directive description). */
  readonly compact = input(false, { transform: booleanAttribute });

  private readonly multiline = signal(false);
  /** @internal */
  protected readonly isCompact = computed(
    () => this.compact() && this.stateAllowsCompact() && !this.multiline(),
  );

  /** @internal Called by the input through `AUI_COMPOSER_COMPACT`. */
  setMultiline(value: boolean): void {
    this.multiline.set(value);
  }

  /** @internal */
  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.sendDisabled()) return;
    this.aui.composer.send();
  }

  /** @internal */
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const form = event.currentTarget as HTMLElement;
    const target = event.target;
    if (!(target instanceof Element) || !form.contains(target)) return;
    // Bound the ancestor walk to the form: hosts may wrap the composer in an
    // element carrying tabindex="-1".
    const interactive = target.closest(INTERACTIVE_ELEMENT_SELECTOR);
    if (interactive && form.contains(interactive)) return;
    const input = form.querySelector<HTMLElement>(COMPOSER_INPUT_SELECTOR);
    if (!input) return;
    event.preventDefault();
    input.focus();
  }
}
