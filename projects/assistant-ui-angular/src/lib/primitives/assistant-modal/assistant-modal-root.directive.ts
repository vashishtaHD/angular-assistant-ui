// Ported from packages/react/src/primitives/assistantModal/AssistantModalRoot.tsx @ 7d74276
import {
  Directive,
  Injector,
  afterNextRender,
  booleanAttribute,
  inject,
  input,
  model,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';
import { injectAuiEvent } from '../../state/inject-aui-event';
import type { AuiAssistantModalContentDirective } from './assistant-modal-content.directive';

let nextModalId = 0;

/**
 * Root of the assistant modal (a popover-style chat window opened from a
 * floating button). It owns the `open` model shared by
 * `button[auiAssistantModalTrigger]`, `[auiAssistantModalAnchor]` and
 * `[auiAssistantModalContent]`.
 *
 * By default the modal opens whenever a run starts (`thread.runStart`); set
 * `[openOnRunStart]="false"` to disable that. Supports `[(open)]`.
 *
 * Must be inside an `[auiProvider]`.
 *
 * @example
 * ```html
 * <div auiAssistantModalRoot>
 *   <div auiAssistantModalAnchor>
 *     <button auiAssistantModalTrigger>Chat</button>
 *   </div>
 *   <div auiAssistantModalContent>…</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[auiAssistantModalRoot]',
  standalone: true,
  exportAs: 'auiAssistantModalRoot',
  host: {
    '[attr.data-state]': 'open() ? "open" : "closed"',
    '(document:pointerdown)': 'onDocumentPointerdown($event)',
    '(document:keydown.escape)': 'onEscape($event)',
  },
})
export class AuiAssistantModalRootDirective implements OnChanges {
  private readonly injector = inject(Injector);

  /** Whether the modal is open. Two-way bindable. */
  readonly open = model(false);
  /** Open the modal when a run starts. */
  readonly openOnRunStart = input(true, { transform: booleanAttribute });

  /** Stable id of the content element. */
  readonly contentId = `aui-assistant-modal-${++nextModalId}`;

  /** @internal Registered by `button[auiAssistantModalTrigger]`. */
  trigger: HTMLElement | null = null;
  /** @internal Registered by `[auiAssistantModalAnchor]`. */
  anchor: HTMLElement | null = null;
  /** @internal Registered by `[auiAssistantModalContent]`. */
  content: AuiAssistantModalContentDirective | null = null;

  private lastOpen = false;

  constructor() {
    injectAuiEvent('thread.runStart', () => {
      if (this.openOnRunStart() && !this.open()) this.setOpen(true);
    });
  }

  /** @internal */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) this.handleOpenState(this.open());
  }

  /**
   * Opens or closes the modal.
   *
   * @param open - The next state.
   * @param restoreFocus - After closing, move focus back to the trigger.
   */
  setOpen(open: boolean, restoreFocus = false): void {
    this.open.set(open);
    this.handleOpenState(open);
    if (!open && restoreFocus) this.trigger?.focus();
  }

  /** Toggles the modal. */
  toggle(): void {
    this.setOpen(!this.open());
  }

  /** @internal Called by the content when it is created while already open. */
  focusOnCreate(): void {
    if (this.open()) this.scheduleFocus();
  }

  private handleOpenState(open: boolean): void {
    if (open === this.lastOpen) return;
    this.lastOpen = open;
    if (open) this.scheduleFocus();
  }

  private scheduleFocus(): void {
    afterNextRender(() => this.content?.focusInitial(), { injector: this.injector });
  }

  /** @internal Escape dismisses wherever focus is, unless another handler claimed it. */
  onEscape(event: Event): void {
    if (!this.open() || event.defaultPrevented) return;
    event.preventDefault();
    this.setOpen(false, true);
  }

  /** @internal */
  onDocumentPointerdown(event: PointerEvent): void {
    if (!this.open() || !this.content?.dismissOnInteractOutside()) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (
      this.content.contains(target) ||
      this.trigger?.contains(target) ||
      this.anchor?.contains(target)
    ) {
      return;
    }
    this.setOpen(false);
  }
}
