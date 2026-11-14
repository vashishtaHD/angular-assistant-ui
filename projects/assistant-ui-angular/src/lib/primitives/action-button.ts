// Ported from packages/react/src/utils/createActionButton.tsx @ 7d74276
// (the Vue equivalents repeat this per button via primitives/attrDisabled.ts)
import { Directive, ElementRef, Renderer2, computed, inject, signal } from '@angular/core';

/** Options for {@link injectActionButton}. */
export interface ActionButtonOptions {
  /**
   * True when the button must not act. Typically a store predicate from
   * `@assistant-ui/core/store/internal` OR-ed with the consumer's `disabled`
   * input. Read inside the host's change detection, so signals are tracked.
   */
  disabled: () => boolean;
  /** Runs on click, only when enabled and the click was not default-prevented. */
  onClick: (event: MouseEvent) => void;
}

/**
 * Host directive that owns the shared button mechanics: `[attr.disabled]`,
 * `data-disabled`, a default `type="button"` and the guarded click handler.
 * Declare it in `hostDirectives` of an action-button directive and call
 * {@link injectActionButton} from that directive's constructor.
 */
@Directive({
  standalone: true,
  host: {
    '[attr.disabled]': 'attrValue()',
    '[attr.data-disabled]': 'attrValue()',
    '(click)': 'handleClick($event)',
  },
})
export class AuiActionButtonHostDirective {
  private readonly options = signal<ActionButtonOptions | null>(null);

  /** `""` while disabled, `null` (attribute removed) otherwise. */
  protected readonly attrValue = computed(() => (this.options()?.disabled() ? '' : null));

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    if (!element.hasAttribute('type')) {
      inject(Renderer2).setAttribute(element, 'type', 'button');
    }
  }

  /** @internal Called by {@link injectActionButton}. */
  configure(options: ActionButtonOptions): void {
    this.options.set(options);
  }

  /** @internal */
  protected handleClick(event: MouseEvent): void {
    const options = this.options();
    if (!options || event.defaultPrevented || options.disabled()) return;
    options.onClick(event);
  }
}

/**
 * Wires an action-button directive: sets `[attr.disabled]` and `data-disabled`
 * from `opts.disabled`, adds `type="button"` when the host element has no
 * `type`, and calls `opts.onClick` for clicks that arrive while enabled.
 *
 * The calling directive must list {@link AuiActionButtonHostDirective} in its
 * `hostDirectives`. Call it from the constructor or a field initialiser.
 *
 * @example
 * ```ts
 * @Directive({
 *   selector: 'button[auiThing]',
 *   hostDirectives: [AuiActionButtonHostDirective],
 * })
 * export class AuiThingDirective {
 *   private readonly aui = injectAui();
 *   private readonly blocked = injectAuiState(thingDisabled);
 *   constructor() {
 *     injectActionButton({ disabled: this.blocked, onClick: () => this.aui.thing.go() });
 *   }
 * }
 * ```
 */
export function injectActionButton(opts: ActionButtonOptions): void {
  const host = inject(AuiActionButtonHostDirective, { self: true, optional: true });
  if (!host) {
    throw new Error(
      'injectActionButton() requires AuiActionButtonHostDirective in the directive\'s "hostDirectives".',
    );
  }
  host.configure(opts);
}
