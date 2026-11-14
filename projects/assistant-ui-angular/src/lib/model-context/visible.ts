// Ported from packages/react/src/model-context/makeAssistantVisible.tsx @ 7d7427653f6ba47b0b954510eed9c594d64e74d5
import { Directive, ElementRef, booleanAttribute, computed, inject, input } from '@angular/core';
import { tool } from '@assistant-ui/core';
import { bindToClient } from './bind-client';

const DEFAULT_ACTION_SETTLE_DELAY_MS = 2000;
const MAX_ACTION_SETTLE_DELAY_MS = 2_147_483_647;

const waitForSettle = async (settleDelayMs: number) => {
  const delay =
    Number.isFinite(settleDelayMs) &&
    settleDelayMs >= 0 &&
    settleDelayMs <= MAX_ACTION_SETTLE_DELAY_MS
      ? settleDelayMs
      : DEFAULT_ACTION_SETTLE_DELAY_MS;
  if (delay === 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
};

const readActionSettleDelay = (element: HTMLElement) => {
  const value = element.dataset['actionSettleDelay'];
  return value === undefined || value.trim() === ''
    ? DEFAULT_ACTION_SETTLE_DELAY_MS
    : Number(value);
};

/** `CSS.escape` where available, otherwise a backslash-escape of everything but word characters. */
const escapeSelector = (value: string): string =>
  typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, (c) => `\\${c}`);

const click = tool({
  parameters: {
    type: 'object',
    properties: { clickId: { type: 'string' } },
    required: ['clickId'],
  },
  execute: async ({ clickId }: { clickId: string }) => {
    const el = document.querySelector(`[data-click-id='${escapeSelector(clickId)}']`);
    if (el instanceof HTMLElement) {
      el.click();
      await waitForSettle(readActionSettleDelay(el));
      return {};
    }
    return 'Element not found';
  },
});

const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype =
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
};

const edit = tool({
  parameters: {
    type: 'object',
    properties: { editId: { type: 'string' }, value: { type: 'string' } },
    required: ['editId', 'value'],
  },
  execute: async ({ editId, value }: { editId: string; value: string }) => {
    const el = document.querySelector(`[data-edit-id='${escapeSelector(editId)}']`);
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setNativeValue(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      await waitForSettle(readActionSettleDelay(el));
      return {};
    }
    return 'Element not found';
  },
});

let nextVisibleId = 0;

/**
 * Makes the host element visible to the assistant (the Angular equivalent of
 * React's `makeAssistantVisible`). While the directive is alive, the element's
 * `outerHTML` is added to the model context as system text. Set `clickable`
 * to give the model a `click` tool and `editable` to give it an `edit` tool
 * that act on the element through generated `data-click-id` / `data-edit-id`
 * attributes. A visible element nested inside another contributes no text of
 * its own (the outer one already contains it).
 *
 * @example
 * ```html
 * <button auiAssistantVisible clickable>Checkout</button>
 * <input auiAssistantVisible editable [settleDelayMs]="0" />
 * ```
 */
@Directive({
  selector: '[auiAssistantVisible]',
  standalone: true,
  exportAs: 'auiAssistantVisible',
  host: {
    '[attr.data-click-id]': 'clickAttr()',
    '[attr.data-edit-id]': 'editAttr()',
    '[attr.data-action-settle-delay]': 'settleAttr()',
  },
})
export class AuiAssistantVisibleDirective {
  /** Gives the model a `click` tool for this element. */
  readonly clickable = input(false, { transform: booleanAttribute });
  /** Gives the model an `edit` tool for this element (inputs and textareas). */
  readonly editable = input(false, { transform: booleanAttribute });
  /** How long (ms) to wait after an action before the tool call resolves. Default 2000. */
  readonly settleDelayMs = input<number | undefined>(undefined);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly parent = inject(AuiAssistantVisibleDirective, {
    skipSelf: true,
    optional: true,
  });
  private readonly id = `aui-visible-${nextVisibleId++}`;

  /** `data-click-id` host attribute. */
  protected readonly clickAttr = computed(() => (this.clickable() ? this.id : null));
  /** `data-edit-id` host attribute. */
  protected readonly editAttr = computed(() => (this.editable() ? this.id : null));
  /** `data-action-settle-delay` host attribute (validated). */
  protected readonly settleAttr = computed(() => {
    const delay = this.settleDelayMs();
    if (delay === undefined) return null;
    if (!Number.isFinite(delay) || delay < 0 || delay > MAX_ACTION_SETTLE_DELAY_MS) {
      throw new RangeError(`settleDelayMs must be between 0 and ${MAX_ACTION_SETTLE_DELAY_MS}`);
    }
    return this.clickable() || this.editable() ? String(delay) : null;
  });

  constructor() {
    bindToClient(AuiAssistantVisibleDirective, (client) =>
      client.modelContext().register({
        getModelContext: () => ({
          tools: {
            ...(this.clickable() ? { click } : {}),
            ...(this.editable() ? { edit } : {}),
          },
          system: this.parent ? undefined : this.element.outerHTML,
        }),
      }),
    );
  }
}
